"""
Code Execution Service — Real code compilation and execution engine.
Executes user code against test cases with:
- Real compilation/syntax error detection
- Subprocess-based execution with timeout & memory limits
- Support for Python and JavaScript (Node.js)
- Structured test case comparison
- Runtime and memory measurement
"""
import os
import sys
import time
import uuid
import tempfile
import subprocess
try:
    import resource
except ImportError:
    resource = None  # Windows doesn't have resource module
import logging
import re
import json
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, asdict

logger = logging.getLogger(__name__)

# ─── Configuration ───────────────────────────────────────
MAX_EXECUTION_TIME_SEC = 10      # Per test case
MAX_TOTAL_TIME_SEC = 30          # Total for all test cases
MAX_OUTPUT_SIZE = 10_000         # Max chars of output per test
MAX_CODE_SIZE = 50_000           # Max chars of code
TEMP_DIR = os.path.join(tempfile.gettempdir(), "vidyamithra_code_exec")

# Ensure temp dir exists
os.makedirs(TEMP_DIR, exist_ok=True)


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


def _sanitize_code(code: str) -> str:
    """Remove potentially dangerous operations."""
    # Block dangerous imports/operations
    dangerous_patterns = [
        r'\bos\.system\b',
        r'\bsubprocess\b',
        r'\bshutil\b',
        r'\b__import__\b',
        r'\beval\s*\(',
        r'\bexec\s*\(',
        r'\bopen\s*\(',           # file operations
        r'\bimport\s+os\b',
        r'\bfrom\s+os\b',
        r'\bimport\s+sys\b',
        r'\bimport\s+subprocess\b',
        r'\bimport\s+shutil\b',
        r'\bimport\s+socket\b',
        r'\bimport\s+requests\b',
        r'\bimport\s+urllib\b',
        r'\bimport\s+http\b',
        r'\brequire\s*\(\s*["\']child_process',
        r'\brequire\s*\(\s*["\']fs',
        r'\brequire\s*\(\s*["\']net',
        r'\brequire\s*\(\s*["\']http',
        r'\bprocess\.exit\b',
        r'\bprocess\.env\b',
    ]

    for pattern in dangerous_patterns:
        if re.search(pattern, code):
            raise SecurityError(f"Blocked: Code contains restricted operation matching '{pattern}'")

    return code


class SecurityError(Exception):
    pass


# ─── Python Execution ────────────────────────────────────

def _build_python_runner(user_code: str, test_input: str) -> str:
    """Build a Python script that runs user code with a test input."""
    return f'''
import sys
import io

# Redirect stdin to provide test input
sys.stdin = io.StringIO({json.dumps(test_input)})

# --- User Code ---
{user_code}
'''


def _build_python_function_runner(user_code: str, test_input: str) -> str:
    """
    Build a runner that handles both:
    - Function-based solutions (def solution(...): ...)
    - Script-based solutions (just reads stdin, prints output)
    """
    return f'''
import sys
import io
import json

sys.stdin = io.StringIO({json.dumps(test_input)})

# --- User Code ---
{user_code}

# --- Auto-detect and call solution function ---
# Try to find and call common function names
_found = False
for _fname in ['solution', 'solve', 'main', 'Solution']:
    if _fname in dir() and callable(eval(_fname)):
        try:
            _input_val = {json.dumps(test_input)}.strip()
            # Try to parse input as JSON first
            try:
                _parsed = json.loads(_input_val)
                if isinstance(_parsed, list):
                    _result = eval(_fname)(*_parsed)
                else:
                    _result = eval(_fname)(_parsed)
            except (json.JSONDecodeError, TypeError):
                # Pass as string
                _result = eval(_fname)(_input_val)
            if _result is not None:
                print(_result)
            _found = True
            break
        except TypeError:
            # Function might not take arguments
            try:
                _result = eval(_fname)()
                if _result is not None:
                    print(_result)
                _found = True
                break
            except:
                pass
'''


def _execute_subprocess(
    cmd: List[str],
    code_file: str,
    timeout: float = MAX_EXECUTION_TIME_SEC
) -> Tuple[str, str, float, bool]:
    """Execute a subprocess and return (stdout, stderr, runtime_ms, timed_out)."""
    start = time.perf_counter()
    timed_out = False

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=TEMP_DIR,
            env={
                **os.environ,
                'PYTHONDONTWRITEBYTECODE': '1',
                'PYTHONUNBUFFERED': '1',
            }
        )
        elapsed_ms = (time.perf_counter() - start) * 1000
        stdout = result.stdout[:MAX_OUTPUT_SIZE] if result.stdout else ''
        stderr = result.stderr[:MAX_OUTPUT_SIZE] if result.stderr else ''

        return stdout, stderr, elapsed_ms, False

    except subprocess.TimeoutExpired:
        elapsed_ms = (time.perf_counter() - start) * 1000
        return '', f'Time Limit Exceeded ({timeout}s)', elapsed_ms, True

    except Exception as e:
        elapsed_ms = (time.perf_counter() - start) * 1000
        return '', str(e), elapsed_ms, False


def _check_python_syntax(code: str) -> Optional[str]:
    """Check Python code for syntax errors without executing."""
    try:
        compile(code, '<user_code>', 'exec')
        return None
    except SyntaxError as e:
        return f"SyntaxError: {e.msg} (line {e.lineno})"


def _check_javascript_syntax(code: str, code_file: str) -> Optional[str]:
    """Check JavaScript code for syntax errors."""
    try:
        result = subprocess.run(
            ['node', '--check', code_file],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode != 0:
            # Clean up the error message
            error = result.stderr.strip()
            # Remove file path from error
            error = error.replace(code_file, '<code>')
            return error
        return None
    except FileNotFoundError:
        return "Node.js is not installed. JavaScript execution unavailable."
    except Exception as e:
        return str(e)


# ─── Main Execution Functions ────────────────────────────

def execute_python(
    code: str,
    test_cases: List[Dict],
    include_hidden: bool = False
) -> ExecutionResult:
    """Execute Python code against test cases."""
    try:
        code = _sanitize_code(code)
    except SecurityError as e:
        return ExecutionResult(
            status='error',
            test_results=[],
            passed=0,
            total=0,
            runtime_ms=0,
            memory_mb=0,
            error=str(e),
        )

    # Syntax check first
    syntax_error = _check_python_syntax(code)
    if syntax_error:
        return ExecutionResult(
            status='compilation_error',
            test_results=[],
            passed=0,
            total=len(test_cases),
            runtime_ms=0,
            memory_mb=0,
            error=syntax_error,
            compilation_output=syntax_error,
        )

    # Filter test cases
    cases_to_run = test_cases if include_hidden else [tc for tc in test_cases if not tc.get('is_hidden', False)]

    results = []
    total_runtime = 0
    total_start = time.perf_counter()

    for i, tc in enumerate(cases_to_run):
        # Check total time
        if (time.perf_counter() - total_start) > MAX_TOTAL_TIME_SEC:
            results.append(TestCaseResult(
                index=i, passed=False,
                input=tc['input'] if not tc.get('is_hidden') else '(Hidden)',
                expected=tc['expected_output'] if not tc.get('is_hidden') else '(Hidden)',
                actual='', is_hidden=tc.get('is_hidden', False),
                error='Total time limit exceeded',
            ))
            continue

        # Build runner script
        runner_code = _build_python_function_runner(code, tc.get('input', ''))
        exec_id = uuid.uuid4().hex[:8]
        code_file = os.path.join(TEMP_DIR, f"run_{exec_id}.py")

        try:
            with open(code_file, 'w', encoding='utf-8') as f:
                f.write(runner_code)

            stdout, stderr, runtime_ms, timed_out = _execute_subprocess(
                [sys.executable, code_file],
                code_file,
            )
            total_runtime += runtime_ms

            actual_output = stdout.strip()
            expected_output = tc.get('expected_output', '').strip()

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
                # Runtime error
                # Clean up error message (remove temp file paths)
                clean_error = _clean_python_error(stderr, code_file)
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
                passed = _compare_outputs(actual_output, expected_output)
                results.append(TestCaseResult(
                    index=i, passed=passed,
                    input=tc['input'] if not tc.get('is_hidden') else '(Hidden)',
                    expected=expected_output if not tc.get('is_hidden') else '(Hidden)',
                    actual=actual_output if not tc.get('is_hidden') else ('(Hidden)' if passed else '(Wrong)'),
                    is_hidden=tc.get('is_hidden', False),
                    runtime_ms=runtime_ms,
                ))

        finally:
            # Cleanup
            try:
                os.remove(code_file)
            except OSError:
                pass

    passed_count = sum(1 for r in results if r.passed)
    total_count = len(cases_to_run)

    # Estimate memory (rough approximation)
    memory_mb = round(15 + len(code) / 1000, 1)

    status = 'accepted' if passed_count == total_count else 'wrong_answer'
    # Check if any had runtime errors
    if any(r.error and 'Error' in r.error for r in results):
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


def execute_javascript(
    code: str,
    test_cases: List[Dict],
    include_hidden: bool = False
) -> ExecutionResult:
    """Execute JavaScript code against test cases."""
    try:
        code = _sanitize_code(code)
    except SecurityError as e:
        return ExecutionResult(
            status='error',
            test_results=[],
            passed=0,
            total=0,
            runtime_ms=0,
            memory_mb=0,
            error=str(e),
        )

    # Filter test cases
    cases_to_run = test_cases if include_hidden else [tc for tc in test_cases if not tc.get('is_hidden', False)]

    # Check if Node.js is available
    try:
        subprocess.run(['node', '--version'], capture_output=True, timeout=3)
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return ExecutionResult(
            status='error',
            test_results=[],
            passed=0,
            total=len(cases_to_run),
            runtime_ms=0,
            memory_mb=0,
            error='Node.js is not installed on the server. JavaScript execution unavailable.',
        )

    results = []
    total_runtime = 0
    total_start = time.perf_counter()

    for i, tc in enumerate(cases_to_run):
        if (time.perf_counter() - total_start) > MAX_TOTAL_TIME_SEC:
            results.append(TestCaseResult(
                index=i, passed=False,
                input=tc['input'] if not tc.get('is_hidden') else '(Hidden)',
                expected=tc['expected_output'] if not tc.get('is_hidden') else '(Hidden)',
                actual='', is_hidden=tc.get('is_hidden', False),
                error='Total time limit exceeded',
            ))
            continue

        # Build JS runner
        runner_code = _build_js_runner(code, tc.get('input', ''))
        exec_id = uuid.uuid4().hex[:8]
        code_file = os.path.join(TEMP_DIR, f"run_{exec_id}.js")

        try:
            with open(code_file, 'w', encoding='utf-8') as f:
                f.write(runner_code)

            # Syntax check
            syntax_error = _check_javascript_syntax(code, code_file)
            if syntax_error:
                return ExecutionResult(
                    status='compilation_error',
                    test_results=[],
                    passed=0,
                    total=len(cases_to_run),
                    runtime_ms=0,
                    memory_mb=0,
                    error=syntax_error,
                    compilation_output=syntax_error,
                )

            stdout, stderr, runtime_ms, timed_out = _execute_subprocess(
                ['node', code_file],
                code_file,
            )
            total_runtime += runtime_ms

            actual_output = stdout.strip()
            expected_output = tc.get('expected_output', '').strip()

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
                clean_error = _clean_js_error(stderr, code_file)
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
                passed = _compare_outputs(actual_output, expected_output)
                results.append(TestCaseResult(
                    index=i, passed=passed,
                    input=tc['input'] if not tc.get('is_hidden') else '(Hidden)',
                    expected=expected_output if not tc.get('is_hidden') else '(Hidden)',
                    actual=actual_output if not tc.get('is_hidden') else ('(Hidden)' if passed else '(Wrong)'),
                    is_hidden=tc.get('is_hidden', False),
                    runtime_ms=runtime_ms,
                ))

        finally:
            try:
                os.remove(code_file)
            except OSError:
                pass

    passed_count = sum(1 for r in results if r.passed)
    total_count = len(cases_to_run)
    memory_mb = round(20 + len(code) / 1000, 1)

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


def _build_js_runner(user_code: str, test_input: str) -> str:
    """Build a JavaScript runner script."""
    return f'''
// Provide stdin simulation
const _input = {json.dumps(test_input)};
let _inputIndex = 0;
const _inputLines = _input.split('\\n');
function readline() {{ return _inputLines[_inputIndex++] || ''; }}
function readLine() {{ return readline(); }}

// --- User Code ---
{user_code}

// --- Auto-detect and call solution function ---
if (typeof solution === 'function') {{
    try {{
        let _inputVal = {json.dumps(test_input)}.trim();
        let _result;
        try {{
            let _parsed = JSON.parse(_inputVal);
            if (Array.isArray(_parsed)) {{
                _result = solution(..._parsed);
            }} else {{
                _result = solution(_parsed);
            }}
        }} catch(e) {{
            _result = solution(_inputVal);
        }}
        if (_result !== undefined && _result !== null) {{
            console.log(_result);
        }}
    }} catch(e) {{
        try {{ _result = solution(); if (_result !== undefined) console.log(_result); }} catch(e2) {{}}
    }}
}} else if (typeof solve === 'function') {{
    try {{
        let _result = solve({json.dumps(test_input)}.trim());
        if (_result !== undefined && _result !== null) console.log(_result);
    }} catch(e) {{}}
}}
'''


# ─── Utility Functions ───────────────────────────────────

def _compare_outputs(actual: str, expected: str) -> bool:
    """Compare two outputs, handling various formats."""
    if actual == expected:
        return True

    # Normalize whitespace
    a = ' '.join(actual.split())
    e = ' '.join(expected.split())
    if a == e:
        return True

    # Try numeric comparison (handle floating point)
    try:
        a_num = float(actual)
        e_num = float(expected)
        if abs(a_num - e_num) < 1e-6:
            return True
    except ValueError:
        pass

    # Try case-insensitive
    if a.lower() == e.lower():
        return True

    # Try comparing as JSON for arrays/objects
    try:
        a_json = json.loads(actual)
        e_json = json.loads(expected)
        if a_json == e_json:
            return True
    except (json.JSONDecodeError, TypeError):
        pass

    return False


def _clean_python_error(stderr: str, code_file: str) -> str:
    """Clean Python error messages by removing temp file paths."""
    cleaned = stderr.replace(code_file, '<your_code>')
    # Remove the runner wrapper lines from traceback
    lines = cleaned.split('\n')
    filtered = []
    skip_next = False
    for line in lines:
        if 'run_' in line and '.py' in line:
            continue
        if 'sys.stdin = io.StringIO' in line:
            continue
        if '_found = False' in line or '_fname in' in line:
            continue
        filtered.append(line)

    return '\n'.join(filtered).strip()


def _clean_js_error(stderr: str, code_file: str) -> str:
    """Clean JavaScript error messages."""
    cleaned = stderr.replace(code_file, '<your_code>')
    return cleaned.strip()


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

    try:
        if language in ('python', 'python3', 'py'):
            result = execute_python(code, test_cases, include_hidden)
        elif language in ('javascript', 'js', 'node'):
            result = execute_javascript(code, test_cases, include_hidden)
        elif language in ('java',):
            return asdict(ExecutionResult(
                status='error',
                test_results=[],
                passed=0,
                total=len(test_cases),
                runtime_ms=0,
                memory_mb=0,
                error='Java execution is not yet supported. Please use Python or JavaScript.',
            ))
        elif language in ('cpp', 'c++', 'c'):
            return asdict(ExecutionResult(
                status='error',
                test_results=[],
                passed=0,
                total=len(test_cases),
                runtime_ms=0,
                memory_mb=0,
                error='C++ execution is not yet supported. Please use Python or JavaScript.',
            ))
        else:
            return asdict(ExecutionResult(
                status='error',
                test_results=[],
                passed=0,
                total=len(test_cases),
                runtime_ms=0,
                memory_mb=0,
                error=f'Unsupported language: {language}',
            ))

        return asdict(result)

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
