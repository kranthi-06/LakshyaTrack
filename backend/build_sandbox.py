#!/usr/bin/env python3
"""Build and verify the sandbox Docker image."""
import subprocess, sys, os, json

SANDBOX_DIR = os.path.join(os.path.dirname(__file__), 'sandbox')
IMAGE_NAME = 'lakshyatrack-sandbox:latest'

def build_image():
    print(f"Building sandbox image from {SANDBOX_DIR}...")
    r = subprocess.run(['docker', 'build', '-t', IMAGE_NAME, '.'], cwd=SANDBOX_DIR, capture_output=True, text=True)
    if r.returncode != 0:
        print(f"ERROR:\n{r.stderr}")
        sys.exit(1)
    print(f"Image '{IMAGE_NAME}' built successfully")

def verify_image():
    print("\nVerifying sandbox image...")
    r = subprocess.run(['docker', 'run', '--rm', '--entrypoint', 'id', IMAGE_NAME], capture_output=True, text=True)
    print(f"  User: {r.stdout.strip()}")
    r = subprocess.run(['docker', 'run', '--rm', '--entrypoint', 'python3', IMAGE_NAME, '--version'], capture_output=True, text=True)
    print(f"  Python: {r.stdout.strip()}")
    payload = '{"code": "print(42)", "language": "python", "test_input": ""}'
    r = subprocess.run(['docker', 'run', '--rm', '-i', '--network=none', '--read-only',
        '--tmpfs', '/tmp/code:size=10m,nodev,nosuid,uid=65534,gid=65534',
        '--cap-drop=ALL', '--security-opt=no-new-privileges:true',
        '--memory=256m', '--cpus=1.0', '--pids-limit=64',
        '--user=65534:65534', IMAGE_NAME], input=payload, capture_output=True, text=True)
    out = json.loads(r.stdout.strip())
    assert out['stdout'].strip() == '42', f"Expected 42, got: {out}"
    print(f"  Execution: OK (output={out['stdout'].strip()})")
    print("\nAll verifications passed!")

if __name__ == '__main__':
    build_image()
    verify_image()
