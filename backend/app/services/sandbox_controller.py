"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Sandbox Controller — Manages Docker-based isolated execution.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Responsibilities:
  1. Build/verify the sandbox Docker image
  2. Spawn ephemeral containers per execution request
  3. Enforce security boundaries via Docker runtime flags
  4. Collect results and destroy containers
  5. Fall back to subprocess mode when Docker is unavailable

SECURITY ENFORCEMENT (per container):
  ┌─────────────────────────────────────────────────┐
  │  --network=none          No network access       │
  │  --read-only             Read-only rootfs         │
  │  --cap-drop=ALL          No Linux capabilities    │
  │  --security-opt          No privilege escalation  │
  │  --memory=256m           Max 256MB RAM            │
  │  --cpus=1.0              Max 1 CPU core           │
  │  --pids-limit=64         Max 64 processes         │
  │  --tmpfs /tmp/code:...   Writable tmpfs (10MB)    │
  │  --user=65534:65534      Non-root execution       │
  │  auto_remove=True        Destroyed after run      │
  └─────────────────────────────────────────────────┘
"""

import json
import logging
import os
import time
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

# ─── Configuration ────────────────────────────────────────
SANDBOX_IMAGE_NAME = "lakshyatrack-sandbox:latest"
SANDBOX_DOCKERFILE_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "sandbox"
)

# Container resource limits
CONTAINER_MEMORY_LIMIT = "256m"        # 256 MB
CONTAINER_CPU_LIMIT = 1.0             # 1 CPU core
CONTAINER_PIDS_LIMIT = 64             # Max 64 processes
CONTAINER_TIMEOUT_SEC = 15            # Wall-clock timeout for container
TMPFS_SIZE = "10m"                    # 10 MB writable space

# Container security options
SECURITY_OPTS = [
    "no-new-privileges:true",          # Block privilege escalation
]


class SandboxError(Exception):
    """Raised when sandbox operations fail."""
    pass


class SandboxController:
    """
    Manages Docker-based sandbox containers for code execution.

    Usage:
        controller = SandboxController()
        result = controller.execute(code, language, test_input)
    """

    def __init__(self):
        self._docker_client = None
        self._docker_available = None
        self._image_ready = False

    @property
    def docker_available(self) -> bool:
        """Check if Docker is available on this system."""
        if self._docker_available is not None:
            return self._docker_available

        try:
            import docker
            client = docker.from_env()
            client.ping()
            self._docker_client = client
            self._docker_available = True
            logger.info("Docker daemon connected successfully")
        except Exception as e:
            self._docker_available = False
            logger.warning(f"Docker not available: {e}. Sandbox will use fallback mode.")

        return self._docker_available

    @property
    def client(self):
        """Get the Docker client, raising if unavailable."""
        if not self.docker_available:
            raise SandboxError("Docker is not available")
        return self._docker_client

    def ensure_image(self) -> bool:
        """
        Ensure the sandbox Docker image exists.
        Builds it from the Dockerfile if missing.
        """
        if self._image_ready:
            return True

        try:
            self.client.images.get(SANDBOX_IMAGE_NAME)
            self._image_ready = True
            logger.info(f"Sandbox image '{SANDBOX_IMAGE_NAME}' found")
            return True
        except Exception:
            pass

        # Build the image
        try:
            logger.info(f"Building sandbox image from {SANDBOX_DOCKERFILE_DIR}...")
            self.client.images.build(
                path=SANDBOX_DOCKERFILE_DIR,
                tag=SANDBOX_IMAGE_NAME,
                rm=True,           # Remove intermediate containers
                forcerm=True,      # Force remove even on failure
                pull=False,        # Don't pull base image every time
            )
            self._image_ready = True
            logger.info(f"Sandbox image '{SANDBOX_IMAGE_NAME}' built successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to build sandbox image: {e}")
            raise SandboxError(f"Failed to build sandbox image: {e}")

    def execute(
        self,
        code: str,
        language: str,
        test_input: str,
        timeout: float = CONTAINER_TIMEOUT_SEC,
    ) -> Dict[str, Any]:
        """
        Execute code in an isolated Docker container.

        Args:
            code: User-submitted code string
            language: Programming language ('python', 'javascript', etc.)
            test_input: Test case input string
            timeout: Max wall-clock seconds

        Returns:
            Dict with keys: stdout, stderr, exit_code, runtime_ms, timed_out, error
        """
        if not self.docker_available:
            return self._fallback_execute(code, language, test_input, timeout)

        try:
            self.ensure_image()
        except SandboxError:
            return self._fallback_execute(code, language, test_input, timeout)

        # Build the JSON payload to send via stdin
        payload = json.dumps({
            'code': code,
            'language': language,
            'test_input': test_input,
        })

        start = time.perf_counter()

        try:
            # Run the container with all security constraints
            container = self.client.containers.run(
                image=SANDBOX_IMAGE_NAME,
                stdin_open=True,
                detach=True,

                # ── Security: Network ──
                network_mode="none",

                # ── Security: Filesystem ──
                read_only=True,
                tmpfs={
                    '/tmp/code': f'size={TMPFS_SIZE},noexec=off,nodev,nosuid,uid=65534,gid=65534',
                },

                # ── Security: User ──
                user="65534:65534",

                # ── Security: Capabilities ──
                cap_drop=["ALL"],
                security_opt=SECURITY_OPTS,

                # ── Security: Resources ──
                mem_limit=CONTAINER_MEMORY_LIMIT,
                memswap_limit=CONTAINER_MEMORY_LIMIT,  # No swap
                cpu_period=100000,
                cpu_quota=int(CONTAINER_CPU_LIMIT * 100000),
                pids_limit=CONTAINER_PIDS_LIMIT,

                # ── Lifecycle ──
                auto_remove=False,     # We remove manually after collecting logs

                # ── No environment variables ──
                environment={},
            )

            # Send the payload via stdin
            sock = container.attach_socket(params={'stdin': 1, 'stream': 1})
            sock._sock.sendall(payload.encode('utf-8'))
            sock._sock.shutdown(1)  # Close write end (EOF)
            sock.close()

            # Wait for container to finish
            try:
                exit_result = container.wait(timeout=timeout)
                exit_code = exit_result.get('StatusCode', -1)
                timed_out = False
            except Exception:
                # Timeout — force kill
                try:
                    container.kill()
                except Exception:
                    pass
                exit_code = -1
                timed_out = True

            elapsed_ms = (time.perf_counter() - start) * 1000

            # Collect logs
            try:
                stdout_raw = container.logs(stdout=True, stderr=False).decode('utf-8', errors='replace')
                stderr_raw = container.logs(stdout=False, stderr=True).decode('utf-8', errors='replace')
            except Exception:
                stdout_raw = ''
                stderr_raw = ''

            # Remove container
            try:
                container.remove(force=True)
            except Exception:
                pass

            if timed_out:
                return {
                    'stdout': '',
                    'stderr': f'Time Limit Exceeded ({timeout}s)',
                    'exit_code': -1,
                    'runtime_ms': round(elapsed_ms, 1),
                    'timed_out': True,
                    'error': 'Time Limit Exceeded',
                }

            # The executor writes JSON to stdout — parse it
            try:
                result = json.loads(stdout_raw.strip())
                return result
            except json.JSONDecodeError:
                # Executor didn't produce valid JSON — raw output
                return {
                    'stdout': stdout_raw[:10000],
                    'stderr': stderr_raw[:10000],
                    'exit_code': exit_code,
                    'runtime_ms': round(elapsed_ms, 1),
                    'timed_out': False,
                    'error': 'Sandbox executor produced invalid output',
                }

        except Exception as e:
            elapsed_ms = (time.perf_counter() - start) * 1000
            logger.error(f"Sandbox execution failed: {e}", exc_info=True)
            return {
                'stdout': '',
                'stderr': str(e),
                'exit_code': -1,
                'runtime_ms': round(elapsed_ms, 1),
                'timed_out': False,
                'error': f'Sandbox error: {str(e)}',
            }

    def _fallback_execute(
        self,
        code: str,
        language: str,
        test_input: str,
        timeout: float,
    ) -> Dict[str, Any]:
        """
        Fallback: execute using subprocess when Docker is not available.

        WARNING: This mode does NOT provide container-level isolation.
        It is intended ONLY for local development. In production, Docker
        MUST be available.
        """
        import subprocess as sp
        import tempfile
        import sys
        import uuid

        logger.warning("FALLBACK MODE: Running without container isolation!")

        # Minimal safe env (never pass host env)
        safe_env = {
            'PATH': os.environ.get('PATH', ''),
            'PYTHONDONTWRITEBYTECODE': '1',
            'PYTHONUNBUFFERED': '1',
            'LANG': os.environ.get('LANG', 'en_US.UTF-8'),
            'SYSTEMROOT': os.environ.get('SYSTEMROOT', ''),
            'TEMP': tempfile.gettempdir(),
            'TMP': tempfile.gettempdir(),
        }
        safe_env = {k: v for k, v in safe_env.items() if v}

        # Build runner code using the same logic as executor.py
        if language in ('python', 'python3', 'py'):
            runner_code = self._build_python_runner(code, test_input)
            ext = '.py'
            cmd_prefix = [sys.executable]
        elif language in ('javascript', 'js', 'node'):
            runner_code = self._build_js_runner(code, test_input)
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

        tmp_dir = os.path.join(tempfile.gettempdir(), 'lakshyatrack_sandbox')
        os.makedirs(tmp_dir, exist_ok=True)
        exec_id = uuid.uuid4().hex[:8]
        code_file = os.path.join(tmp_dir, f'run_{exec_id}{ext}')

        try:
            with open(code_file, 'w', encoding='utf-8') as f:
                f.write(runner_code)

            start = time.perf_counter()
            try:
                result = sp.run(
                    cmd_prefix + [code_file],
                    capture_output=True,
                    text=True,
                    timeout=timeout,
                    cwd=tmp_dir,
                    env=safe_env,
                )
                elapsed_ms = (time.perf_counter() - start) * 1000
                stdout = result.stdout[:50000] if result.stdout else ''
                stderr = result.stderr[:50000] if result.stderr else ''
                stderr = stderr.replace(code_file, '<your_code>')

                return {
                    'stdout': stdout,
                    'stderr': stderr,
                    'exit_code': result.returncode,
                    'runtime_ms': round(elapsed_ms, 1),
                    'timed_out': False,
                    'error': None,
                }

            except sp.TimeoutExpired:
                elapsed_ms = (time.perf_counter() - start) * 1000
                return {
                    'stdout': '',
                    'stderr': f'Time Limit Exceeded ({timeout}s)',
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
            try:
                os.remove(code_file)
            except OSError:
                pass

    @staticmethod
    def _build_python_runner(user_code: str, test_input: str) -> str:
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

    @staticmethod
    def _build_js_runner(user_code: str, test_input: str) -> str:
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


# ─── Singleton ────────────────────────────────────────────
_controller: Optional[SandboxController] = None


def get_sandbox_controller() -> SandboxController:
    """Get or create the singleton sandbox controller."""
    global _controller
    if _controller is None:
        _controller = SandboxController()
    return _controller
