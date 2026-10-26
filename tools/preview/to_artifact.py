"""Turn the single-file Vite build into side-panel page content (no html/head/body tags)."""
import pathlib, sys
src = pathlib.Path(sys.argv[1]).read_text()
s0 = src.index('<script type="module"')
s1 = src.rindex('</script>') + len('</script>')
script = src[s0:s1]
rest = src[s1:]
st0 = rest.index('<style')
st1 = rest.rindex('</style>') + len('</style>')
style = rest[st0:st1]
extra = """<title>ISA Auto Programmer</title>
<style>
/* One-screen app: fill the frame without 100vh so the skeleton's safe-area padding still fits. */
html, body { height: 100%; }
body { background: #f3f4f6; color: #111827; }
#root { height: 100% !important; }
</style>
"""
out = (extra + style + "\n" + script + '\n<div id="root"></div>\n').replace('\ufffd', '\\uFFFD')
pathlib.Path(sys.argv[2]).write_text(out)
print('KB', len(out) // 1024, '| scripts', out.count('<script'), '| root', out.count('id="root"'))
