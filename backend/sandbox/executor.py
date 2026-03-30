#!/usr/bin/env python3
"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Sandbox Executor — Runs INSIDE the isolated container.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This script:
  1. Reads a JSON payload from stdin (code, language, test_input)
  2. Writes code to a temp file
  3. Executes it as a child process with resource limits
  4. Captures stdout/stderr
  5. Returns structured JSON to stdout

SECURITY LAYERS (inside-container):
  - setrlimit for CPU time, memory, file size, processes
  - Timeout enforcement via subprocess
  - No environment variables leaked
  - Runs as non-root (uid=65534)
  - Filesystem is read-only except /tmp/code
"""

import json
import os
import resource
import signal
import subprocess
import sys
import tempfile
import time
import uuid


# ─── Resource Limits ─────────────────────────────────────
MAX_CPU_TIME_SEC = 10          # Hard CPU time limit
MAX_WALL_TIME_SEC = 12         # Wall-clock timeout (slightly > CPU)
MAX_MEMORY_BYTES = 256 * 1024 * 1024   # 256 MB
MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB (prevent filling disk)
MAX_PROCESSES = 32             # Max child processes/threads
MAX_OUTPUT_CHARS = 50_000      # Truncate output beyond this

# Minimal clean environment for the child process
_CHILD_ENV = {
    'PATH': '/usr/local/bin:/usr/bin:/bin',
    'LANG': 'C.UTF-8',
    'HOME': '/tmp/code',
    'PYTHONDONTWRITEBYTECODE': '1',
    'PYTHONUNBUFFERED': '1',
    'NODE_OPTIONS': '--max-old-space-size=200',
}


def _set_resource_limits():
    """Called in the child process before exec to set resource limits."""
    try:
        # CPU time limit (seconds)
        resource.setrlimit(resource.RLIMIT_CPU, (MAX_CPU_TIME_SEC, MAX_CPU_TIME_SEC))
        # Address space limit (bytes)
        resource.setrlimit(resource.RLIMIT_AS, (MAX_MEMORY_BYTES, MAX_MEMORY_BYTES))
        # Max output file size (bytes) — prevents filling /tmp
        resource.setrlimit(resource.RLIMIT_FSIZE, (MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_BYTES))
        # Max number of processes
        resource.setrlimit(resource.RLIMIT_NPROC, (MAX_PROCESSES, MAX_PROCESSES))
        # Core dump disabled
        resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    except (ValueError, resource.error):
        pass  # Some limits may not be available


def _build_python_runner(user_code: str, test_input: str) -> str:
    """Build a Python script that wraps user code with stdin simulation."""
    return f'''
import sys
import io
import json

sys.stdin = io.StringIO({json.dumps(test_input)})

# --- User Code ---
{user_code}

# --- Auto-detect and call solution function ---
_found = False
for _fname in ['solution', 'solve', 'main', 'Solution']:
    if _fname in dir() and callable(eval(_fname)):
        try:
            _input_val = {json.dumps(test_input)}.strip()
            try:
                _parsed = json.loads(_input_val)
                if isinstance(_parsed, list):
                    _result = eval(_fname)(*_parsed)
                else:
                    _result = eval(_fname)(_parsed)
            except (json.JSONDecodeError, TypeError):
                _result = eval(_fname)(_input_val)
            if _result is not None:
                print(_result)
            _found = True
            break
        except TypeError:
            try:
                _result = eval(_fname)()
                if _result is not None:
                    print(_result)
                _found = True
                break
            except:
                pass
'''


def _build_js_runner(user_code: str, test_input: str) -> str:
    """Build a JavaScript runner script with stdin simulation."""
    return f'''
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


def execute(payload: dict) -> dict:
    """Execute user code and return structured results."""
    code = payload.get('code', '')
    language = payload.get('language', 'python')
    test_input = payload.get('test_input', '')

    # Determine file extension and command
    if language in ('python', 'python3', 'py'):
        runner_code = _build_python_runner(code, test_input)
        ext = '.py'
        cmd_prefix = ['python3']
    elif language in ('javascript', 'js', 'node'):
        runner_code = _build_js_runner(code, test_input)
        ext = '.js'
        cmd_prefix = ['node']
    else:
        return {
            'stdout': '',
            'stderr': f'Unsupported language: {language}',
            'exit_code': 1,
            'runtime_ms': 0,
            'timed_out': False,
            'error': f'Unsupported language: {language}',
        }

    # Write code to temp file
    exec_id = uuid.uuid4().hex[:8]
    code_file = f'/tmp/code/run_{exec_id}{ext}'

    try:
        with open(code_file, 'w', encoding='utf-8') as f:
            f.write(runner_code)

        cmd = cmd_prefix + [code_file]
        start = time.perf_counter()

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=MAX_WALL_TIME_SEC,
                cwd='/tmp/code',
                env=_CHILD_ENV,
                preexec_fn=_set_resource_limits,
            )
            elapsed_ms = (time.perf_counter() - start) * 1000

            stdout = result.stdout[:MAX_OUTPUT_CHARS] if result.stdout else ''
            stderr = result.stderr[:MAX_OUTPUT_CHARS] if result.stderr else ''

            # Clean file paths from error messages
            stderr = stderr.replace(code_file, '<your_code>')

            return {
                'stdout': stdout,
                'stderr': stderr,
                'exit_code': result.returncode,
                'runtime_ms': round(elapsed_ms, 1),
                'timed_out': False,
                'error': None,
            }

        except subprocess.TimeoutExpired:
            elapsed_ms = (time.perf_counter() - start) * 1000
            return {
                'stdout': '',
                'stderr': f'Time Limit Exceeded ({MAX_WALL_TIME_SEC}s)',
                'exit_code': -1,
                'runtime_ms': round(elapsed_ms, 1),
                'timed_out': True,
                'error': 'Time Limit Exceeded',
            }

    except Exception as e:
        return {
            'stdout': '',
            'stderr': str(e),
            'exit_code': -1,
            'runtime_ms': 0,
            'timed_out': False,
            'error': str(e),
        }

    finally:
        # Cleanup temp file
        try:
            os.remove(code_file)
        except OSError:
            pass


def main():
    """Entry point: read JSON from stdin, execute, write JSON to stdout."""
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw)
    except (json.JSONDecodeError, Exception) as e:
        result = {
            'stdout': '',
            'stderr': f'Invalid input payload: {e}',
            'exit_code': -1,
            'runtime_ms': 0,
            'timed_out': False,
            'error': f'Invalid input: {e}',
        }
        print(json.dumps(result))
        sys.exit(1)

    result = execute(payload)
    print(json.dumps(result))


if __name__ == '__main__':
    main()
