# The Studio 5000 job script (scripts/isa_logix_job.py) against a fake logix_designer_sdk (tests/fake_sdk), under
# python3:  python3 tools/studio5000-bridge/tests/test_job.py
import json, os, runpy, shutil, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(HERE, '..', 'scripts', 'isa_logix_job.py')
sys.path.insert(0, os.path.join(HERE, 'fake_sdk'))
import logix_designer_sdk.logix_project as fake  # noqa: E402


def run(job, files=()):
    d = tempfile.mkdtemp()
    try:
        for name, text in files: open(os.path.join(d, name), 'w').write(text)
        job = {k: (v.replace('{dir}', d) if isinstance(v, str) else v) for k, v in job.items()}
        jf = os.path.join(d, 'job.json')
        json.dump(job, open(jf, 'w'))
        del fake.CALLS[:]
        sys.argv = ['isa_logix_job.py', jf]
        runpy.run_path(SCRIPT, run_name='__main__')
        res = json.load(open(os.path.join(d, 'result.json')))
        progress = open(os.path.join(d, 'progress.txt')).read() if os.path.exists(os.path.join(d, 'progress.txt')) else ''
        copied = open(os.path.join(d, 'Line_ISA.ACD')).read() if os.path.exists(os.path.join(d, 'Line_ISA.ACD')) else None
        original = open(os.path.join(d, 'Line.ACD')).read() if os.path.exists(os.path.join(d, 'Line.ACD')) else None
        return res, list(fake.CALLS), progress, copied, original
    finally:
        shutil.rmtree(d, ignore_errors=True)


XP = ['Controller/DataTypes', 'Controller/Tags', "Controller/Programs/Program[@Name='MainProgram']"]
# import: the user's ACD copied (theirs untouched), the copy opened, each part imported over what is there, saved
res, calls, progress, copied, original = run({'cmd': 'import', 'acd': '{dir}/Line.ACD', 'copy': '{dir}/Line_ISA.ACD', 'l5x': '{dir}/Conveyor.L5X', 'xpaths': XP}, files=[('Line.ACD', 'the user project'), ('Conveyor.L5X', '<xml/>')])
assert res['ok'], res
assert copied == 'the user project' and original == 'the user project'
assert calls[0][0] == 'open' and calls[0][1].endswith('Line_ISA.ACD') and calls[0][2] == 'StdOutEventLogger', calls
assert [c[1] for c in calls if c[0] == 'import'] == XP and all(c[2] == 'Conveyor.L5X' and c[3] == 'OVERWRITE_ON_COLL' for c in calls if c[0] == 'import'), calls
assert calls[-1][0] == 'save' and calls[-1][1].endswith('Line_ISA.ACD')
assert not any(c[0] in ('download', 'mode') for c in calls), 'an import never downloads'
assert res['result']['imported'] == XP and 'Importing Controller/Tags' in progress
# a missing project; an import the SDK refuses: its reason, in one sentence, nothing saved
res, calls, _, _, _ = run({'cmd': 'import', 'acd': '{dir}/gone.ACD', 'copy': '{dir}/Line_ISA.ACD', 'l5x': 'x', 'xpaths': XP})
assert not res['ok'] and res['error'].startswith('There is no Studio 5000 project at') and not calls, res
fake.STATE['fail_import'] = 'Tags'
res, calls, _, _, _ = run({'cmd': 'import', 'acd': '{dir}/Line.ACD', 'copy': '{dir}/Line_ISA.ACD', 'l5x': '{dir}/C.L5X', 'xpaths': XP}, files=[('Line.ACD', 'x')])
fake.STATE['fail_import'] = None
assert not res['ok'] and res['error'] == 'Import failed: Controller/Tags not found' and not any(c[0] == 'save' for c in calls), (res, calls)
# info: the project's communication path
res, calls, _, _, _ = run({'cmd': 'info', 'project': '{dir}/Line_ISA.ACD'})
assert res['ok'] and res['result']['commPath'] == 'AB_ETH-1\\192.168.1.10\\Backplane\\0', res
# download: never without the confirm, nor without leave to put the controller in Program mode; Run only when asked
for job in ({'cmd': 'download', 'project': 'p', 'commPath': 'c'}, {'cmd': 'download', 'project': 'p', 'commPath': 'c', 'confirmed': 'yes', 'programAllowed': True}):
    res, calls, _, _, _ = run(job)
    assert not res['ok'] and 'confirm screen' in res['error'] and not calls, res
res, calls, _, _, _ = run({'cmd': 'download', 'project': 'p', 'commPath': 'c', 'confirmed': True})
assert not res['ok'] and 'needs the controller in Program mode' in res['error'] and not calls, res
res, calls, _, _, _ = run({'cmd': 'download', 'project': '{dir}/Line_ISA.ACD', 'commPath': 'AB_ETH-1\\10.0.0.5\\Backplane\\0', 'confirmed': True, 'programAllowed': True})
assert res['ok'] and [c[0] for c in calls] == ['open', 'set_path', 'mode', 'download'] and calls[2][1] == 'PROGRAM' and res['result']['mode'] == 'program', (res, calls)
res, calls, _, _, _ = run({'cmd': 'download', 'project': '{dir}/Line_ISA.ACD', 'commPath': 'c', 'confirmed': True, 'programAllowed': True, 'runAfter': True})
assert [c[0] for c in calls][-1] == 'mode' and calls[-1][1] == 'RUN' and res['result']['mode'] == 'run', calls
res, _, _, _, _ = run({'cmd': 'fly'})
assert not res['ok'] and 'does not know (fly)' in res['error']
print('studio 5000 job script: all passed')
