# The CODESYS job script (scripts/isa_job.py) against a fake ScriptEngine (the names CODESYS gives a script),
# under python3:  python3 tools/codesys-bridge/tests/test_job.py
import json, os, runpy, shutil, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(HERE, '..', 'scripts', 'isa_job.py')


class Text:
    def __init__(self): self.text = ''
    def replace(self, new_text=None, **kw): self.text = new_text


class Obj:
    def __init__(self, name, kind): self.name, self.kind, self.children = name, kind, []; self.textual_declaration, self.textual_implementation = Text(), Text()
    def get_name(self, _=False): return self.name
    def find(self, name, recursive=False):
        out = [c for c in self.children if c.name == name]
        for c in self.children: out += c.find(name, True) if recursive else []
        return out


class App(Obj):
    def __init__(self): Obj.__init__(self, 'Application', 'app'); self.built = 0; self.log = []
    def create_pou(self, name, t, ret=None): o = Obj(name, t); o.ret = ret; self.children.append(o); return o
    def create_dut(self, name): o = Obj(name, 'dut'); self.children.append(o); return o
    def create_gvl(self, name): o = Obj(name, 'gvl'); self.children.append(o); return o
    def build(self): self.built += 1; S.messages = list(S.after_build)


class Pous(list):
    def add(self, name): self.append(type('P', (), {'name': name})())


class Proj(Obj):
    def __init__(self, path, app=True, task=True):
        Obj.__init__(self, 'project', 'project'); self.path = path; self.saved = []; self.devices = []
        self.active_application = App() if app else None
        if task:
            t = Obj('MainTask', 'task'); t.pous = Pous(); t.pous.add('PLC_PRG'); self.children.append(t)
    def save(self): self.saved.append(self.path)
    def save_as(self, p): self.path = p; self.saved.append(p)
    def add(self, name, *dev): self.devices.append((name,) + dev)
    def close(self): S.primary = None


class S:  # state of the fake CODESYS
    primary = None; opened = []; created = []; messages = []; after_build = []; repo = []


class Projects:
    @property
    def primary(self): return S.primary
    def open(self, path, primary=True): p = Proj(path); S.opened.append(path); S.primary = p; return p
    def create(self, path, primary=True): p = Proj(path, app=S.create_app, task=False); S.created.append(path); S.primary = p; return p


class Msg:
    def __init__(self, sev, text, obj=None, line=None): self.severity, self.text, self.object, self.position = sev, text, obj, (type('Pos', (), {'line': line})() if line else None)


class System:
    def get_message_categories(self, active=True): return ['{build}', '{other}']
    def get_message_category_description(self, c): return 'Build' if c == '{build}' else 'Something else'
    def get_message_objects(self, c): return S.messages if c == '{build}' else [Msg('Severity.Error', 'not a build message')]
    def clear_messages(self, c): S.messages = []


class Repo:
    def get_all_devices(self, name=None, source=None): return [type('D', (), {'device_id': type('Id', (), {'type': 4096, 'id': '0000 0004', 'version': '3.5.19.0'})()})()] if name in S.repo else []


PouType = type('PouType', (), {'Program': 'Program', 'FunctionBlock': 'FunctionBlock', 'Function': 'Function'})


def run(job, project_exists=True, create_app=True, repo=('CODESYS Control Win V3',)):
    d = tempfile.mkdtemp()
    try:
        S.primary = None; S.opened = []; S.created = []; S.messages = []; S.create_app = create_app; S.repo = list(repo)
        src = os.path.join(d, 'Line.project')
        if project_exists: open(src, 'w').close()
        job = dict(job, project=src, copy=os.path.join(d, 'Line_ISA.project'))
        with open(os.path.join(d, 'job.json'), 'w') as f: json.dump(job, f)
        os.environ['ISA_CODESYS_JOB'] = os.path.join(d, 'job.json')
        runpy.run_path(SCRIPT, init_globals={'projects': Projects(), 'system': System(), 'device_repository': Repo(), 'PouType': PouType}, run_name='__main__')
        with open(os.path.join(d, 'result.json')) as f: res = json.load(f)
        progress = open(os.path.join(d, 'progress.txt')).read() if os.path.exists(os.path.join(d, 'progress.txt')) else ''
        return res, S.primary, progress, d
    finally:
        shutil.rmtree(d, ignore_errors=True)


OBJECTS = [
    {'kind': 'dut', 'name': 'Mode', 'declaration': 'TYPE Mode : (Off, Auto); END_TYPE', 'implementation': ''},
    {'kind': 'gvl', 'name': 'GVL', 'declaration': 'VAR_GLOBAL\n  x : BOOL;\nEND_VAR', 'implementation': ''},
    {'kind': 'function', 'name': 'Scale', 'declaration': 'FUNCTION Scale : REAL\nVAR_INPUT r : INT; END_VAR', 'implementation': 'Scale := r;', 'returnType': 'REAL'},
    {'kind': 'program', 'name': 'Main', 'declaration': 'PROGRAM Main', 'implementation': 'x := TRUE;'},
]

# the user's project: opened, saved as the app's copy (the user's file untouched), objects created, Main in MainTask, built
S.after_build = [Msg('Severity.Error', "Identifier 'y' not defined", Obj('Main', 'program'), 3), Msg('Severity.Warning', 'Unused variable', None, None), Msg('Severity.Information', 'Build complete')]
res, proj, progress, d = run({'cmd': 'build', 'objects': OBJECTS, 'main': 'Main'})
assert res['ok'], res
r = res['result']
assert S.opened and S.opened[0].endswith('Line.project'), S.opened
assert proj.saved[0].endswith('Line_ISA.project') and all(p.endswith('Line_ISA.project') for p in proj.saved), proj.saved
assert [o['action'] for o in r['objects']] == ['created'] * 4, r['objects']
app = proj.active_application
assert app.find('Main')[0].textual_implementation.text == 'x := TRUE;'
assert app.find('Scale')[0].ret == 'REAL' and app.find('Scale')[0].kind == 'Function'
assert app.find('Mode')[0].textual_declaration.text.startswith('TYPE Mode')
assert [p.name for p in proj.find('MainTask')[0].pous] == ['PLC_PRG', 'Main']
assert app.built == 1
assert r['errors'] == 1 and r['warnings'] == 1, r
assert r['messages'][0] == {'severity': 'error', 'text': "Identifier 'y' not defined", 'object': 'Main', 'line': 3}, r['messages']
assert 'Building' in progress and 'Writing Main' in progress

# an object already there is replaced, not doubled; Main already in the task stays once
def again():
    res, proj, _, _ = run({'cmd': 'build', 'objects': OBJECTS[3:], 'main': 'Main'})
    return res
S.after_build = []
orig_open = Projects.open
def open_with_main(self, path, primary=True):
    p = orig_open(self, path, primary); m = p.active_application.create_pou('Main', 'Program'); m.textual_implementation.text = 'old'; p.find('MainTask')[0].pous.add('Main'); return p
Projects.open = open_with_main
res, proj, _, _ = run({'cmd': 'build', 'objects': OBJECTS[3:], 'main': 'Main'})
Projects.open = orig_open
assert res['result']['objects'] == [{'name': 'Main', 'kind': 'program', 'action': 'replaced'}], res
assert [o.name for o in proj.active_application.children] == ['Main'] and proj.active_application.find('Main')[0].textual_implementation.text == 'x := TRUE;'
assert [p.name for p in proj.find('MainTask')[0].pous].count('Main') == 1

# no project of the user's: a new one with the CODESYS Control Win V3 device; no MainTask: said
res, proj, _, _ = run({'cmd': 'build', 'objects': OBJECTS[3:], 'main': 'Main'}, project_exists=False)
assert res['ok'] and S.created and proj.devices == [('Device', 4096, '0000 0004', '3.5.19.0')], (res, proj.devices)
assert res['result']['notes'] == ['The project has no MainTask: call Main from a task of yours in CODESYS.'], res
# that device not installed / no application: one plain sentence
res, _, _, _ = run({'cmd': 'build', 'objects': OBJECTS, 'main': 'Main'}, project_exists=False, repo=())
assert not res['ok'] and 'CODESYS has no device "CODESYS Control Win V3" installed' in res['error'], res
res, _, _, _ = run({'cmd': 'build', 'objects': OBJECTS, 'main': 'Main'}, project_exists=False, create_app=False)
assert not res['ok'] and res['error'].startswith('The CODESYS project has no application'), res
res, _, _, _ = run({'cmd': 'fly'})
assert not res['ok'] and 'does not know (fly)' in res['error']
print('codesys job script: all passed')
