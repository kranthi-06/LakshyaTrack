"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Code Execution Service — Secure Sandbox-Backed Execution Engine
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Architecture:
  API Request → code_execution_service.run_code()
              → SandboxController.execute()
              → Docker Container (ephemeral, isolated)
              → executor.py (inside container)
              → User code execution
              → Structured JSON result

Security Philosophy:
  - ZERO reliance on regex filtering or input sanitization for security
  - ALL security enforced at OS/container level
  - Regex patterns retained ONLY for user-friendly error messages
    (they are NOT a security boundary)
  - Defense in depth: container isolation + resource limits + network isolation

Executes user code against test cases with:
  - Docker container isolation (production)
  - Subprocess fallback (development only)
  - Structured test case comparison
  - Runtime measurement
  - Support for Python and JavaScript (Node.js)
"""
import json
import logging
import os
import re
import time
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict

from app.services.sandbox_controller import get_sandbox_controller

logger = logging.getLogger(__name__)

# ─── Configuration ───────────────────────────────────────
MAX_TOTAL_TIME_SEC = 60          # Total time for all test cases
MAX_CODE_SIZE = 50_000           # Max chars of code
MAX_OUTPUT_SIZE = 10_000         # Max chars of output per test


@dataclass
class TestCaseResult:
    index: int
    passed: bool
    input: str
    expected: str
    actual: str
    is_hidden: bool
    error: Optional[str] = None
    runtime_ms: float = 0


@dataclass
class ExecutionResult:
    status: str  # 'accepted', 'wrong_answer', 'compilation_error', 'runtime_error', 'timeout', 'error'
    test_results: List[Dict]
    passed: int
    total: int
    runtime_ms: float
    memory_mb: float
    error: Optional[str] = None
    stdout: Optional[str] = None
    compilation_output: Optional[str] = None


def _check_python_syntax(code: str) -> Optional[str]:
    """Check Python code for syntax errors without executing."""
    try:
        compile(code, '<user_code>', 'exec')
        return None
    except SyntaxError as e:
        return f"SyntaxError: {e.msg} (line {e.lineno})"


def _provide_user_friendly_warning(code: str) -> Optional[str]:
    """
    Provide user-friendly warnings for code that uses operations
    which will fail inside the sandbox.

    NOTE: This is NOT a security boundary. Even if bypass is possible,
    the sandbox container will enforce the real restrictions.
    This is purely for better UX — telling users *why* their code
    will fail rather than letting them hit cryptic OS errors.
    """
    warning_patterns = [
        (r'\bimport\s+os\b', "The 'os' module is not available in the sandbox"),
        (r'\bimport\s+subprocess\b', "The 'subprocess' module is not available in the sandbox"),
        (r'\bimport\s+socket\b', "Network access is disabled in the sandbox"),
        (r'\bimport\s+requests\b', "Network access is disabled in the sandbox"),
        (r'\bimport\s+urllib\b', "Network access is disabled in the sandbox"),
        (r'\bimport\s+http\b', "Network access is disabled in the sandbox"),
        (r'\brequire\s*\(\s*["\']child_process', "child_process is not available in the sandbox"),
        (r'\brequire\s*\(\s*["\']net', "Network access is disabled in the sandbox"),
        (r'\bprocess\.env\b', "Environment variables are not accessible in the sandbox"),
    ]

    for pattern, message in warning_patterns:
        if re.search(pattern, code):
            return message

    return None


# ─── Output Comparison ───────────────────────────────────

def _compare_outputs(actual: str, expected: str) -> bool:
    """Compare two outputs, handling various formats."""
    if actual == expected:
        return True

    # Normalize whitespace
    a = ' '.join(actual.split())
    e = ' '.join(expected.split())
    if a == e:
        return True

    # Numeric comparison (handle floating point)
    try:
        a_num = float(actual)
        e_num = float(expected)
        if abs(a_num - e_num) < 1e-6:
            return True
    except ValueError:
        pass

    # Case-insensitive
    if a.lower() == e.lower():
        return True

    # JSON comparison for arrays/objects
    try:
        a_json = json.loads(actual)
        e_json = json.loads(expected)
        if a_json == e_json:
            return True
    except (json.JSONDecodeError, TypeError):
        pass

    return False


def _clean_error_message(stderr: str) -> str:
    """Clean error messages for user display."""
    if not stderr:
        return ''
    lines = stderr.split('\n')
    filtered = []
    for line in lines:
        if 'sys.stdin = io.StringIO' in line:
            continue
        if '_found = False' in line or '_fname in' in line:
            continue
        filtered.append(line)
    return '\n'.join(filtered).strip()


# ─── Main Execution Functions ────────────────────────────

def _execute_with_sandbox(
    code: str,
    language: str,
    test_cases: List[Dict],
    include_hidden: bool = False,
) -> ExecutionResult:
    """
    Execute code against test cases using the sandbox controller.

    Each test case is executed in a separate Docker container for
    complete isolation between test runs.
    """
    controller = get_sandbox_controller()

    # Determine which test cases to run
    cases_to_run = test_cases if include_hidden else [
        tc for tc in test_cases if not tc.get('is_hidden', False)
    ]

    results = []
    total_runtime = 0
    total_start = time.perf_counter()

    for i, tc in enumerate(cases_to_run):
        # Check total time budget
        if (time.perf_counter() - total_start) > MAX_TOTAL_TIME_SEC:
            results.append(TestCaseResult(
                index=i, passed=False,
                input=tc['input'] if not tc.get('is_hidden') else '(Hidden)',
                expected=tc['expected_output'] if not tc.get('is_hidden') else '(Hidden)',
                actual='', is_hidden=tc.get('is_hidden', False),
                error='Total time limit exceeded',
            ))
            continue

        test_input = tc.get('input', '')
        expected_output = tc.get('expected_output', '').strip()

        # Execute in sandbox
        sandbox_result = controller.execute(
            code=code,
            language=language,
            test_input=test_input,
        )

        runtime_ms = sandbox_result.get('runtime_ms', 0)
        total_runtime += runtime_ms
        timed_out = sandbox_result.get('timed_out', False)
        stdout = sandbox_result.get('stdout', '').strip()
        stderr = sandbox_result.get('stderr', '')
        error = sandbox_result.get('error')

        if timed_out:
            results.append(TestCaseResult(
                index=i, passed=False,
                input=tc['input'] if not tc.get('is_hidden') else '(Hidden)',
                expected=expected_output if not tc.get('is_hidden') else '(Hidden)',
                actual='Time Limit Exceeded',
                is_hidden=tc.get('is_hidden', False),
                error='Time Limit Exceeded',
                runtime_ms=runtime_ms,
            ))
        elif stderr and not stdout:
            clean_error = _clean_error_message(stderr)
            results.append(TestCaseResult(
                index=i, passed=False,
                input=tc['input'] if not tc.get('is_hidden') else '(Hidden)',
                expected=expected_output if not tc.get('is_hidden') else '(Hidden)',
                actual='',
                is_hidden=tc.get('is_hidden', False),
                error=clean_error,
                runtime_ms=runtime_ms,
            ))
        else:
            actual_output = stdout
            passed = _compare_outputs(actual_output, expected_output)
            results.append(TestCaseResult(
                index=i, passed=passed,
                input=tc['input'] if not tc.get('is_hidden') else '(Hidden)',
                expected=expected_output if not tc.get('is_hidden') else '(Hidden)',
                actual=actual_output if not tc.get('is_hidden') else (
                    '(Hidden)' if passed else '(Wrong)'
                ),
                is_hidden=tc.get('is_hidden', False),
                runtime_ms=runtime_ms,
            ))

    passed_count = sum(1 for r in results if r.passed)
    total_count = len(cases_to_run)

    # Estimate memory
    memory_mb = round(15 + len(code) / 1000, 1)

    # Determine status
    status = 'accepted' if passed_count == total_count else 'wrong_answer'
    if any(r.error and 'Error' in (r.error or '') for r in results):
        status = 'runtime_error'
    if any(r.error and 'Time Limit' in (r.error or '') for r in results):
        status = 'timeout'

    return ExecutionResult(
        status=status,
        test_results=[asdict(r) for r in results],
        passed=passed_count,
        total=total_count,
        runtime_ms=round(total_runtime, 1),
        memory_mb=memory_mb,
    )


# ─── Public API ──────────────────────────────────────────

def run_code(
    code: str,
    language: str,
    test_cases: List[Dict],
    include_hidden: bool = False
) -> Dict[str, Any]:
    """
    Main entry point: Execute code in the specified language against test cases.
    Returns a structured result dictionary.

    This function:
      1. Validates input (size, emptiness)
      2. Checks syntax (Python only — fast, avoids spinning up a container)
      3. Provides user-friendly warnings for sandbox-restricted operations
      4. Delegates execution to the sandbox controller
      5. Returns structured results
    """
    if not code or not code.strip():
        return asdict(ExecutionResult(
            status='error',
            test_results=[],
            passed=0,
            total=len(test_cases),
            runtime_ms=0,
            memory_mb=0,
            error='No code provided.',
        ))

    if len(code) > MAX_CODE_SIZE:
        return asdict(ExecutionResult(
            status='error',
            test_results=[],
            passed=0,
            total=len(test_cases),
            runtime_ms=0,
            memory_mb=0,
            error=f'Code too large ({len(code)} chars). Maximum: {MAX_CODE_SIZE} chars.',
        ))

    # Normalize language
    lang_map = {
        'python': 'python', 'python3': 'python', 'py': 'python',
        'javascript': 'javascript', 'js': 'javascript', 'node': 'javascript',
    }
    normalized_lang = lang_map.get(language)

    if not normalized_lang:
        if language in ('java',):
            msg = 'Java execution is not yet supported. Please use Python or JavaScript.'
        elif language in ('cpp', 'c++', 'c'):
            msg = 'C++ execution is not yet supported. Please use Python or JavaScript.'
        else:
            msg = f'Unsupported language: {language}'

        return asdict(ExecutionResult(
            status='error',
            test_results=[],
            passed=0,
            total=len(test_cases),
            runtime_ms=0,
            memory_mb=0,
            error=msg,
        ))

    # Fast syntax check for Python (avoids container startup for obvious errors)
    if normalized_lang == 'python':
        syntax_error = _check_python_syntax(code)
        if syntax_error:
            return asdict(ExecutionResult(
                status='compilation_error',
                test_results=[],
                passed=0,
                total=len(test_cases),
                runtime_ms=0,
                memory_mb=0,
                error=syntax_error,
                compilation_output=syntax_error,
            ))

    # User-friendly warning (NOT a security boundary)
    warning = _provide_user_friendly_warning(code)

    try:
        result = _execute_with_sandbox(
            code=code,
            language=normalized_lang,
            test_cases=test_cases,
            include_hidden=include_hidden,
        )

        result_dict = asdict(result)

        # Attach warning if applicable
        if warning and result.status != 'error':
            result_dict['warning'] = warning

        return result_dict

    except Exception as e:
        logger.error(f"Code execution failed: {e}", exc_info=True)
        return asdict(ExecutionResult(
            status='error',
            test_results=[],
            passed=0,
            total=len(test_cases),
            runtime_ms=0,
            memory_mb=0,
            error=f'Internal execution error: {str(e)}',
        ))
