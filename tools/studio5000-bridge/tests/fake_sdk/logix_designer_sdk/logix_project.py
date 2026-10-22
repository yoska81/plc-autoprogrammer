# A stand-in for logix_designer_sdk.logix_project: LogixProject with the calls the job script makes; CALLS records them.
import json, os

CALLS = []
STATE = {'comm_path': 'AB_ETH-1\\192.168.1.10\\Backplane\\0', 'fail_import': None}


class RequestedControllerMode:
    PROGRAM = 'PROGRAM'
    RUN = 'RUN'


class LogixProject:
    class ImportCollisionOptions:
        OVERWRITE_ON_COLL = 'OVERWRITE_ON_COLL'

    def __init__(self, path): self.path = path

    @staticmethod
    async def open_logix_project(path, logger=None):
        CALLS.append(('open', path, logger.__class__.__name__ if logger else None))
        return LogixProject(path)

    async def partial_import_from_xml_file(self, xpath, file, options):
        if STATE['fail_import'] and STATE['fail_import'] in xpath: raise Exception('Import failed: %s not found' % xpath)
        CALLS.append(('import', xpath, os.path.basename(file), options))

    async def save(self): CALLS.append(('save', self.path))
    async def get_communications_path(self): CALLS.append(('get_path',)); return STATE['comm_path']
    async def set_communications_path(self, p): CALLS.append(('set_path', p))
    async def change_controller_mode(self, m): CALLS.append(('mode', m))
    async def download(self): CALLS.append(('download',))
