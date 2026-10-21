// Builds the CLICK bridge (tools/click-bridge, .NET Framework 4.8) into resources/click-bridge for the installer
// (package.json build.extraResources). Needs the .NET SDK (dotnet); the Windows build server has it.
//   node scripts/build-click-bridge.cjs
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const project = path.join(root, 'tools', 'click-bridge', 'ClickBridge.csproj');
const built = path.join(root, 'tools', 'click-bridge', 'bin', 'Release', 'net48');
const out = path.join(root, 'resources', 'click-bridge');

try {
  execFileSync('dotnet', ['build', project, '-c', 'Release', '--nologo'], { stdio: 'inherit' });
} catch (err) {
  console.error(`The CLICK bridge could not be built (${err.message}). Install the .NET SDK (https://dot.net) and run again.`);
  process.exit(1);
}
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const f of ['ClickBridge.exe', 'ClickBridge.exe.config']) fs.copyFileSync(path.join(built, f), path.join(out, f));
fs.copyFileSync(path.join(root, 'tools', 'click-bridge', 'README.md'), path.join(out, 'README.md'));
console.log(`CLICK bridge → ${path.relative(root, out)}`);
