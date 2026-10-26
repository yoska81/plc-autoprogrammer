// Builds the Studio 5000 bridge (tools/studio5000-bridge, .NET Framework 4.8) into resources/studio5000-bridge for the installer
// (package.json build.extraResources). Needs the .NET SDK (dotnet); the Windows build server has it.
//   node scripts/build-studio5000-bridge.cjs
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const project = path.join(root, 'tools', 'studio5000-bridge', 'Studio5000Bridge.csproj');
const built = path.join(root, 'tools', 'studio5000-bridge', 'bin', 'Release', 'net48');
const out = path.join(root, 'resources', 'studio5000-bridge');

try {
  execFileSync('dotnet', ['build', project, '-c', 'Release', '--nologo'], { stdio: 'inherit' });
} catch (err) {
  console.error(`The Studio 5000 bridge could not be built (${err.message}). Install the .NET SDK (https://dot.net) and run again.`);
  process.exit(1);
}
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const f of ['Studio5000Bridge.exe', 'Studio5000Bridge.exe.config', 'isa_logix_job.py']) fs.copyFileSync(path.join(built, f), path.join(out, f));
fs.copyFileSync(path.join(root, 'tools', 'studio5000-bridge', 'README.md'), path.join(out, 'README.md'));
console.log(`Studio 5000 bridge → ${path.relative(root, out)}`);
