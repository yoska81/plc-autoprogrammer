"""
Builds the synthetic Yaskawa MPE720 test project src/plc/import/__fixtures__/demo_mp.YMW7 (made-up machine,
made-up names): the same layout MPE720 Ver.7 writes (a header, then a 7z archive packed with LZMA) with a
few comment files, the CPU, one servo axis and two ladder drawings in the compiled form the reader decodes.
Run once with py7zr installed (pip install py7zr):  python3 tools/fixtures/make_ymw7_fixture.py
"""
import io, os, struct
import py7zr
import py7zr.properties

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'plc', 'import', '__fixtures__', 'demo_mp.YMW7')

def reg(cls, sub, word, kind=1):
    return bytes([kind]) + bytes([cls, sub]) + struct.pack('<H', word)

def step(op, operand=b'\x00'):
    return bytes([op]) + operand

I, O, M, D, T = 1, 2, 3, 5, 6
W, L = 0x10, 0x20
k2 = lambda v: b'\x02' + struct.pack('<h', v)

# H01 "Demo conveyor"
h01 = b''.join([
    # Run = (Start | Run) & !Stop   — 26 start a parallel block, 25 OR row, 28 AND NC
    step(0x26, reg(I, 0, 0x0000)), step(0x25, reg(M, 0, 100)), step(0x28, reg(I, 1, 0x0000)), step(0x50, reg(M, 0, 100)),
    # Run → 5 s on-delay (10 ms base) → lamp output
    step(0x24, reg(M, 0, 100)), step(0x40, k2(500)), step(0xf0, reg(D, W, 1)), step(0x50, reg(O, 0, 0x0000)),
    # MW00010 > 100 → compiler bit → horn output
    step(0x80, reg(M, W, 10)), step(0x9d, k2(100)), step(0x50, reg(T, 0, 0)), step(0x24, reg(T, 0, 0)), step(0x50, reg(O, 1, 0x0000)),
    # IF Reset: MW00010 = 0
    step(0x24, reg(I, 2, 0x0000)), step(0x05, b'\x01'), step(0x80, k2(0)), step(0x82, reg(M, W, 10)), step(0x07, b'\x03'),
    # MW00011 = MW00010 + 1 (unconditional)
    step(0x80, reg(M, W, 10)), step(0x84, k2(1)), step(0x82, reg(M, W, 11)),
    # rising edge of Count → SET Done
    step(0x24, reg(I, 3, 0x0000)), step(0x30, reg(D, 0, 0)), step(0x51, reg(M, 0, 200)),
    # call H01.01, then an instruction the reader does not know
    step(0x00, b'\x03\x01\x01'),
    step(0xaf, reg(M, W, 20, 0x01)), step(0xf0, reg(M, W, 30)), step(0xf0, k2(5)),
    step(0x07, b'\x00'),
])
# H01.01 "Demo sub": branch shared by two rungs:  Run —+— Done → OB00002 ; +— !Done → OB00003
h0101 = b''.join([
    step(0x24, reg(M, 0, 100)), step(0x24, reg(M, 0, 200)), step(0x50, reg(O, 2, 0x0000)),
    step(0x28, reg(M, 0, 200)), step(0x50, reg(O, 3, 0x0000)),
    step(0x07, b'\x00'),
])

def drawing(title, code):
    def rec(typ, data):
        return struct.pack('<HHIHHI', typ, 0, 0, 1, 0, 16 + len(data)) + data
    t = title.encode('latin1')
    r1050 = bytes(0x1f) + bytes([len(t)]) + t
    r1050 += bytes(96 - len(r1050))
    body = rec(0x1050, r1050) + rec(0x1060, code)
    head = struct.pack('<HHIHHI', 0, 0x10, 0, 1, 6, 32 + len(body)) + bytes(16)
    return head + body

files = {
    'PLC_0001/CMT/CIREG/IB$$$00.CMT': 'IB00000 .Start button\r\nIB00001 .Stop button\r\nIB00002 .Reset button\r\nIB00003 .Count sensor\r\n',
    'PLC_0001/CMT/COREG/OB$$$00.CMT': 'OB00000 .Run lamp\r\nOB00001 .Horn\r\nOB00002 .Done lamp\r\nOB00003 .Busy lamp\r\n',
    'PLC_0001/CMT/CMREG/MB$$$00.CMT': 'MB001000 .Conveyor running\r\nMB002000 .Batch done\r\n',
    'PLC_0001/CMT/CMREG/MW$$$00.CMT': 'MW00010 .Part counter\r\nMW00011 .Next count\r\n',
    'PLC_0001/PRG/TDEF/$PCDEF': '[CONTROLLER]\r\nNAME=CPU-DEMO(4axes)\r\n',
    'PLC_0001/PRG/IOMAP/$SLOTCFG': b'\x00' * 16 + b'SLT1000\x00\x00\x00\x00\x00\x00\x00DEMOCPU$MP2X\x00\x00\x00\x00SLT1001\x00\x00\x00\x00\x00\x00\x00UNDEFINED\x00\x00\x00\x00SLT1002\x00\x00\x00\x00\x00\x00\x00DEMOIO$MP2X\x00',
    'PLC_0001/PRG/IOMAP/$SVP0101': b'\x00' * 8 + b'SGDEMO-AMP01\x00\x00\x00\x00SGMDEMO-MOT01\x00',
    'PLC_0001/PRG/DWGH/$GH01': drawing('Demo conveyor', h01),
    'PLC_0001/PRG/DWGH/$GH01_01': drawing('Demo sub', h0101),
    # a damaged drawing: its last operand is cut short (the reader lists it and goes on)
    'PLC_0001/PRG/DWGH/$GH03': drawing('Damaged demo', bytes([0x24, 1, 3, 0, 100, 0, 0x40, 0x02, 0x05])),
    'PLC_0001/Motion/$MPM001.txt.tmp': 'MPM001 "DEMO";\r\nMOV [A1]1000;\r\nend;\r\n',
}
# MPE720 packs the archive's header with LZMA too (py7zr would use LZMA2)
type(py7zr.properties.DEFAULT_FILTERS).ENCODED_HEADER_FILTER = [{'id': py7zr.FILTER_LZMA}]
buf = io.BytesIO()
with py7zr.SevenZipFile(buf, 'w', filters=[{'id': py7zr.FILTER_LZMA}]) as z:
    for name, data in files.items():
        z.writestr(data.encode('latin1') if isinstance(data, str) else data, name)
archive = buf.getvalue()
header = bytes([0x01, 0x00, 0x20, 0x00]) + bytes(34)  # 38 bytes, as MPE720 writes before the archive
with open(OUT, 'wb') as f:
    f.write(header + archive)
print(OUT, len(header + archive))
