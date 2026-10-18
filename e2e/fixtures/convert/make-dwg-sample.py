# Builds the small DWG test drawing (our own content, never a user's file) and the DXF that LibreDWG's dwg2dxf
# writes from it, for the DXF reader tests (INSERT with transforms, blocks, old-style POLYLINE, DIMENSION, MTEXT).
#   pip install ezdxf; then, with LibreDWG 0.14 (win64 zip, run under wine on Linux):
#   python3 e2e/fixtures/convert/make-dwg-sample.py <libredwg folder>
import os, subprocess, sys
import ezdxf
from ezdxf.enums import TextEntityAlignment

here = os.path.dirname(os.path.abspath(__file__))
src = os.path.join(here, 'dwg-sample.src.dxf')
dwg = os.path.join(here, 'dwg-sample.dwg')
out = os.path.join(here, 'dwg-sample.libredwg.dxf')

doc = ezdxf.new('R2018', setup=True)
msp = doc.modelspace()
# A3 sheet frame and a title block drawn as a block (inserted once)
msp.add_lwpolyline([(0, 0), (420, 0), (420, 297), (0, 297)], close=True)
tb = doc.blocks.new('TITLE')
tb.add_lwpolyline([(0, 0), (180, 0), (180, 40), (0, 40)], close=True)
tb.add_text('图名 Sheet title', height=3).set_placement((5, 30))
tb.add_attdef('NAME', (60, 30), height=3.5)
tb.add_text('页 Sheet', height=3).set_placement((140, 30))
tb.add_attdef('SHEET', (165, 30), height=3.5)
title = msp.add_blockref('TITLE', (235, 5))
title.add_auto_attribs({'NAME': '继电器控制 Relay control', 'SHEET': '5'})
# a coil symbol with its tag as an attribute, inserted three times: plain, scaled and rotated
coil = doc.blocks.new('COIL')
coil.add_circle((0, 0), 4)
coil.add_text('A1', height=2).set_placement((-6, 4))
coil.add_attdef('TAG', (6, -1), height=3)
for tag, pos, kw in [('KA1', (60, 200), {}), ('KA2', (120, 200), {'xscale': 2, 'yscale': 2}), ('KT1', (180, 200), {'rotation': 90})]:
    ref = msp.add_blockref('COIL', pos, dxfattribs=kw)
    ref.add_auto_attribs({'TAG': tag})
# an old-style 2D polyline (POLYLINE / VERTEX / SEQEND) for a wire
msp.add_polyline2d([(40, 150), (100, 150), (100, 120)], dxfattribs={'layer': 'WIRE'})
msp.add_text('线号 101', height=2.5, dxfattribs={'layer': 'WIRE'}).set_placement((45, 152))
# a dimension with its text overridden, and one with the measured value
d = msp.add_linear_dim(base=(40, 100), p1=(40, 90), p2=(140, 90), text='Cut length <> mm')
d.render()
d2 = msp.add_linear_dim(base=(40, 80), p1=(40, 70), p2=(90, 70))
d2.render()
# MTEXT with formatting codes
msp.add_mtext('{\\fSimSun|b0|i0|c134;急停}\\PE-stop SB0 \\C1;2NC\\P%%c20', dxfattribs={'char_height': 3}).set_location((60, 260))
doc.saveas(src)

ldwg = sys.argv[1]
win = lambda p: subprocess.check_output(['winepath', '-w', p]).decode().strip()
env = dict(os.environ, WINEDEBUG='-all')
subprocess.run(['wine', os.path.join(ldwg, 'dxf2dwg.exe'), '-y', '-o', win(dwg), win(src)], env=env, check=False)
subprocess.run(['wine', os.path.join(ldwg, 'dwg2dxf.exe'), '-y', '-o', win(out), win(dwg)], env=env, check=False)
os.remove(src)
print(dwg, os.path.getsize(dwg), out, os.path.getsize(out))
