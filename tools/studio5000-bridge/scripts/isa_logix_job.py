# ISA Auto Programmer's job script for Studio 5000 Logix Designer, through Rockwell's Logix Designer SDK (its
# Python client, logix_designer_sdk), run by the Studio 5000 bridge as
#   <the SDK's python> isa_logix_job.py <job.json>
# It writes result.json next to the job and progress lines to progress.txt (the bridge passes them to the app).
# Names as in Rockwell's Logix Designer SDK guide (LDSDK-GR001): LogixProject.open_logix_project, save,
# set_communications_path / get_communications_path, change_controller_mode (RequestedControllerMode), download;
# the partial import is the C# PartialImportFromXmlFileAsync in the Python client's naming.
#
# Jobs:
#   import:  copy the user's .ACD to the app's copy (theirs is never opened for writing), open the copy, import
#            the parts of the app's L5X (data types, controller tags, MainProgram) over what is there, save.
#   info:    the communication path the project has (for the download's confirm screen).
#   download (only with the app's confirm screen: confirmed, and programAllowed: a Logix download needs the
#            controller in Program mode): set the path, Program mode, download, Run mode only when asked.
import asyncio
import json
import os
import shutil
import sys
import traceback

JOB = sys.argv[1] if len(sys.argv) > 1 else os.environ.get('ISA_LOGIX_JOB', '')
HERE = os.path.dirname(JOB) if JOB else os.getcwd()


def say(text):
    with open(os.path.join(HERE, 'progress.txt'), 'a', encoding='utf-8') as f:
        f.write('%s\n' % text)


def write_result(obj):
    with open(os.path.join(HERE, 'result.json'), 'w', encoding='utf-8') as f:
        json.dump(obj, f)


def sdk():
    try:
        from logix_designer_sdk.logix_project import LogixProject  # noqa: F401
    except ImportError:
        raise Exception('The Logix Designer SDK\'s Python client is not installed for this Python: install it from the SDK folder (pip install the .whl there), then try again.')
    import logix_designer_sdk.logix_project as lp
    return lp


def logger():
    for where in ('logix_designer_sdk', 'logix_designer_sdk.logix_project', 'logix_designer_sdk.event_logger'):
        try:
            mod = __import__(where, fromlist=['StdOutEventLogger'])
            if hasattr(mod, 'StdOutEventLogger'):
                return mod.StdOutEventLogger()
        except ImportError:
            pass
    return None


def member(obj, names):
    for n in names:
        if hasattr(obj, n):
            return getattr(obj, n)
    raise Exception('This Logix Designer SDK has no %s (it has: %s): send us the log.' % (' / '.join(names), ', '.join(sorted(x for x in dir(obj) if not x.startswith('_')))))


async def open_project(lp, path):
    say('Opening %s' % os.path.basename(path))
    return await lp.LogixProject.open_logix_project(path, logger())


def collision(lp):
    opts = getattr(lp.LogixProject, 'ImportCollisionOptions', None) or getattr(lp, 'ImportCollisionOptions', None)
    if opts is None:
        raise Exception('This Logix Designer SDK has no ImportCollisionOptions: send us the log.')
    return member(opts, ['OVERWRITE_ON_COLL', 'OverwriteOnColl', 'OVERWRITE_ON_COLLISION'])


async def do_import(job):
    lp = sdk()
    acd, copy = job['acd'], job['copy']
    if not os.path.exists(acd):
        raise Exception('There is no Studio 5000 project at %s: choose it again.' % acd)
    say('Copying %s to %s' % (os.path.basename(acd), os.path.basename(copy)))
    shutil.copy2(acd, copy)
    project = await open_project(lp, copy)
    partial = member(project, ['partial_import_from_xml_file'])
    done = []
    for xp in job['xpaths']:
        say('Importing %s' % xp)
        await partial(xp, job['l5x'], collision(lp))
        done.append(xp)
    say('Saving')
    await project.save()
    return {'project': copy, 'imported': done}


async def info(job):
    lp = sdk()
    project = await open_project(lp, job['project'])
    path = await member(project, ['get_communications_path'])()
    return {'commPath': path or ''}


async def download(job):
    if job.get('confirmed') is not True:
        raise Exception('A download needs the confirm screen in the app (nothing was sent to the controller).')
    if job.get('programAllowed') is not True:
        raise Exception('A Logix download needs the controller in Program mode (it stops): tick "The controller may be put in Program mode" if that is safe.')
    lp = sdk()
    modes = getattr(lp, 'RequestedControllerMode', None) or getattr(lp.LogixProject, 'RequestedControllerMode')
    project = await open_project(lp, job['project'])
    say('Communication path %s' % job['commPath'])
    await project.set_communications_path(job['commPath'])
    say('Program mode')
    await project.change_controller_mode(member(modes, ['PROGRAM', 'Program']))
    say('Downloading')
    await project.download()
    ran = False
    if job.get('runAfter') is True:
        say('Run mode')
        await project.change_controller_mode(member(modes, ['RUN', 'Run']))
        ran = True
    return {'mode': 'run' if ran else 'program', 'commPath': job['commPath']}


JOBS = {'import': do_import, 'info': info, 'download': download}


def main():
    try:
        with open(JOB, encoding='utf-8') as f:
            job = json.load(f)
        run = JOBS.get(job.get('cmd'))
        if run is None:
            write_result({'ok': False, 'error': 'The app sent a job the Studio 5000 script does not know (%s): update the app.' % job.get('cmd')})
            return
        write_result({'ok': True, 'result': asyncio.run(run(job))})
    except Exception as e:  # the SDK's own exceptions too: their text is the reason
        say(traceback.format_exc())
        write_result({'ok': False, 'error': str(e) or e.__class__.__name__})


if __name__ == '__main__':
    main()
