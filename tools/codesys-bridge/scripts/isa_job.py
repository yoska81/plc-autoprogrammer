# encoding:utf-8
# ISA Auto Programmer's job script for CODESYS (the CODESYS ScriptEngine, run by the CODESYS bridge as
#   CODESYS.exe --profile="<profile>" --noUI --runscript="isa_job.py"
# with the job file in the ISA_CODESYS_JOB environment variable). It reads job.json next to it and writes
# result.json there; progress lines go to progress.txt (the bridge passes them to the app). IronPython 2.7 and
# Python 3 alike. ScriptEngine names (projects, system, online, device_repository, PouType …) are given by CODESYS.
#
# Jobs:
#   build: open the project (or create it with a CODESYS Control Win V3 device), save it as the app's copy (the
#          user's own file is never changed), create or replace each object (POU, DUT, GVL) in the active
#          application, put the main program in the MainTask, save, build, and return the build messages.
from __future__ import print_function
import io
import json
import os
import traceback

JOB = os.environ.get('ISA_CODESYS_JOB', '')
HERE = os.path.dirname(JOB) if JOB else os.getcwd()


def say(text):
    with io.open(os.path.join(HERE, 'progress.txt'), 'a', encoding='utf-8') as f:
        f.write(u'%s\n' % text)


def write_result(obj):
    data = json.dumps(obj)
    if not isinstance(data, type(u'')):
        data = data.decode('utf-8')
    with io.open(os.path.join(HERE, 'result.json'), 'w', encoding='utf-8') as f:
        f.write(data)


def find_one(parent, name):
    found = parent.find(name, True)
    return found[0] if found else None


def add_device(proj, device_name):
    """A new project's PLC: the first device of that name in the device repository (e.g. CODESYS Control Win V3)."""
    devices = device_repository.get_all_devices(name=device_name, source=None)
    if not devices:
        raise Exception('CODESYS has no device "%s" installed: choose a CODESYS project of yours (with your PLC) instead.' % device_name)
    d = devices[0].device_id
    proj.add('Device', d.type, d.id, d.version)


POU_TYPES = {'program': 'Program', 'function_block': 'FunctionBlock', 'function': 'Function'}


def put(app, o):
    """Creates or replaces one object; returns what was done."""
    name, kind = o['name'], o['kind']
    obj = find_one(app, name)
    action = 'replaced' if obj is not None else 'created'
    if obj is None:
        if kind == 'gvl':
            obj = app.create_gvl(name)
        elif kind == 'dut':
            obj = app.create_dut(name)
        elif kind == 'function':
            obj = app.create_pou(name, PouType.Function, o.get('returnType') or 'BOOL')
        else:
            obj = app.create_pou(name, getattr(PouType, POU_TYPES[kind]))
    obj.textual_declaration.replace(new_text=o['declaration'])
    if kind in POU_TYPES:
        obj.textual_implementation.replace(new_text=o.get('implementation', ''))
    return {'name': name, 'kind': kind, 'action': action}


def into_task(proj, main):
    """The main program in the MainTask (the task a standard project has); a note when there is none."""
    task = find_one(proj, 'MainTask')
    if task is None:
        return 'The project has no MainTask: call %s from a task of yours in CODESYS.' % main
    names = []
    for p in task.pous:
        names.append(getattr(p, 'name', str(p)))
    if main not in names:
        task.pous.add(main)
    return None


def build_messages():
    """The build's errors and warnings: the message categories whose description says build / compile."""
    out = []
    cats = list(system.get_message_categories(True))
    chosen = [c for c in cats if any(w in (system.get_message_category_description(c) or '').lower() for w in ('build', 'compile', 'übersetz', 'erstellen'))] or cats
    for c in chosen:
        for m in system.get_message_objects(c):
            sev = str(getattr(m, 'severity', ''))
            if 'error' not in sev.lower() and 'warning' not in sev.lower():
                continue
            pos = getattr(m, 'position', None)
            obj = getattr(m, 'object', None)
            out.append({
                'severity': 'error' if 'error' in sev.lower() else 'warning',
                'text': u'%s' % getattr(m, 'text', m),
                'object': (getattr(obj, 'get_name', lambda *a: None)(False) if obj is not None else None) or getattr(m, 'object_name', None),
                'line': getattr(pos, 'line', None) if pos is not None else None,
            })
    return out


def build(job):
    if projects.primary:
        projects.primary.close()
    source = job.get('project')
    copy = job['copy']
    if source and os.path.exists(source):
        say('Opening %s' % os.path.basename(source))
        proj = projects.open(source, primary=True)
        proj.save_as(copy)
    else:
        say('A new CODESYS project with %s' % job.get('device', 'CODESYS Control Win V3'))
        proj = projects.create(copy, True)
        add_device(proj, job.get('device', 'CODESYS Control Win V3'))
    app = proj.active_application
    if app is None:
        raise Exception('The CODESYS project has no application: open it in CODESYS, add one under the PLC, and try again.')
    done = []
    for o in job['objects']:
        say('Writing %s' % o['name'])
        done.append(put(app, o))
    notes = []
    if job.get('main'):
        note = into_task(proj, job['main'])
        if note:
            notes.append(note)
    proj.save()
    for c in system.get_message_categories(True):
        system.clear_messages(c)
    say('Building')
    app.build()
    msgs = build_messages()
    proj.save()
    return {
        'project': copy,
        'objects': done,
        'errors': len([m for m in msgs if m['severity'] == 'error']),
        'warnings': len([m for m in msgs if m['severity'] == 'warning']),
        'messages': msgs,
        'notes': notes,
    }


def main():
    try:
        with io.open(JOB, encoding='utf-8') as f:
            job = json.load(f)
        if job.get('cmd') == 'build':
            write_result({'ok': True, 'result': build(job)})
        else:
            write_result({'ok': False, 'error': 'The app sent a job the CODESYS script does not know (%s): update the app.' % job.get('cmd')})
    except Exception as e:
        say(traceback.format_exc())
        write_result({'ok': False, 'error': u'%s' % e})


main()
