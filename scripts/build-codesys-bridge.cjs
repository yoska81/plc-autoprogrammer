// Builds the CODESYS bridge (tools/codesys-bridge, .NET Framework 4.8) into resources/codesys-bridge for the installer
// (package.json build.extraResources). Needs the .NET SDK (dotnet); the Windows build server has it.
//   node scripts/build-codesys-bridge.cjs
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const project = path.join(root, 'tools', 'codesys-bridge', 'CodesysBridge.csproj');
const built = path.join(root, 'tools', 'codesys-bridge', 'bin', 'Release', 'net48');
const out = path.join(root, 'resources', 'codesys-bridge');

try {
  execFileSync('dotnet', ['build', project, '-c', 'Release', '--nologo'], { stdio: 'inherit' });
} catch (err) {
  console.error(`The CODESYS bridge could not be built (${err.message}). Install the .NET SDK (https://dot.net) and run again.`);
  process.exit(1);
}
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const f of ['CodesysBridge.exe', 'CodesysBridge.exe.config', 'isa_job.py']) fs.copyFileSync(path.join(built, f), path.join(out, f));
fs.copyFileSync(path.join(root, 'tools', 'codesys-bridge', 'README.md'), path.join(out, 'README.md'));
console.log(`CODESYS bridge → ${path.relative(root, out)}`);
