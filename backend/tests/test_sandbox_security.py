"""Sandbox Security Tests"""
import os, sys, time, pytest
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from app.services.sandbox_controller import get_sandbox_controller
from app.services.code_execution_service import run_code, _compare_outputs

class TestSandboxSecurity:
    def setup_method(self):
        self.c = get_sandbox_controller()
    def test_no_env_leak(self):
        r = self.c.execute("import os\nprint(os.environ.get('DATABASE_URL','SAFE'))", 'python', '')
        assert 'postgres' not in r.get('stdout','').lower()
    def test_no_network(self):
        code = "import urllib.request\ntry:\n urllib.request.urlopen('http://example.com',timeout=2)\n print('NET_OK')\nexcept: print('BLOCKED')"
        assert 'NET_OK' not in self.c.execute(code, 'python', '').get('stdout','')
    def test_no_fs_read(self):
        assert 'root:' not in self.c.execute("try:\n print(open('/etc/shadow').read())\nexcept: print('B')", 'python', '').get('stdout','')
    def test_infinite_loop(self):
        r = self.c.execute("while True: pass", 'python', '')
        assert r.get('timed_out') or r.get('error')
    def test_memory_bomb(self):
        r = self.c.execute("d=[]\nwhile True: d.append('A'*1048576)", 'python', '')
        assert r.get('exit_code',-1) != 0 or r.get('timed_out')
    def test_valid_python(self):
        assert self.c.execute("print(2+2)", 'python', '')['stdout'].strip() == '4'
    def test_valid_stdin(self):
        assert self.c.execute("print(int(input())*2)", 'python', '21')['stdout'].strip() == '42'
    def test_valid_js(self):
        assert self.c.execute("console.log(2+2);", 'javascript', '')['stdout'].strip() == '4'

class TestCodeExecutionService:
    def test_empty(self): assert run_code('','python',[])['status']=='error'
    def test_syntax(self): assert run_code('def f(:','python',[{'input':'','expected_output':''}])['status']=='compilation_error'
    def test_basic(self):
        r = run_code("n=int(input())\nprint(n+1)",'python',[{'input':'5','expected_output':'6','is_hidden':False}])
        assert r['passed']==1 and r['status']=='accepted'

class TestOutputComparison:
    def test_exact(self): assert _compare_outputs('hello','hello')
    def test_num(self): assert _compare_outputs('3.0','3')
    def test_miss(self): assert not _compare_outputs('hello','world')

if __name__=='__main__': pytest.main([__file__,'-v'])
