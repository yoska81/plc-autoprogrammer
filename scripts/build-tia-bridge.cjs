// Builds the TIA Portal bridge (tools/tia-bridge, .NET Framework 4.8) into resources/tia-bridge for the installer
// (package.json build.extraResources). Needs the .NET SDK (dotnet); the Windows build server has it. No Siemens
// file is used or shipped: the bridge loads Siemens.Engineering.dll from the user's TIA Portal at run time.
//   node scripts/build-tia-bridge.cjs
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const project = path.join(root, 'tools', 'tia-bridge', 'TiaBridge.csproj');
const built = path.join(root, 'tools', 'tia-bridge', 'bin', 'Release', 'net48');
const out = path.join(root, 'resources', 'tia-bridge');

try {
  execFileSync('dotnet', ['build', project, '-c', 'Release', '-f', 'net48', '--nologo'], { stdio: 'inherit' });
} catch (err) {
  console.error(`The TIA Portal bridge could not be built (${err.message}). Install the .NET SDK (https://dot.net) and run again.`);
  process.exit(1);
}
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const f of ['TiaBridge.exe', 'TiaBridge.exe.config']) fs.copyFileSync(path.join(built, f), path.join(out, f));
fs.copyFileSync(path.join(root, 'tools', 'tia-bridge', 'README.md'), path.join(out, 'README.md'));
console.log(`TIA Portal bridge → ${path.relative(root, out)}`);
