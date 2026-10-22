// The real PC for the Studio 5000 bridge: the registry, Public Documents, the PATH, and starting the SDK's Python.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using Microsoft.Win32;

namespace Studio5000Bridge
{
    public sealed class WindowsMachine : IMachine
    {
        static RegistryKey Open(string path, bool wow32) => RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, wow32 ? RegistryView.Registry32 : RegistryView.Registry64).OpenSubKey(path);

        public string[] SubKeys(string path, bool wow32) { using (var k = Open(path, wow32)) return k?.GetSubKeyNames() ?? new string[0]; }
        public string Value(string path, string name, bool wow32) { using (var k = Open(path, wow32)) return k?.GetValue(name) as string; }
        public string PublicDocuments => Environment.GetFolderPath(Environment.SpecialFolder.CommonDocuments);
        public IList<string> PathDirs => (Environment.GetEnvironmentVariable("PATH") ?? "").Split(';').Where(d => d.Trim().Length > 0).Concat(new[] { Environment.GetFolderPath(Environment.SpecialFolder.Windows) }).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        public string[] Dirs(string path) => Directory.Exists(path) ? Directory.GetDirectories(path) : new string[0];
        public bool Exists(string file) => File.Exists(file);

        public int RunQuick(string exe, string args, int timeoutMs)
        {
            try
            {
                using (var p = Process.Start(new ProcessStartInfo(exe, args) { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true }))
                {
                    if (!p.WaitForExit(timeoutMs)) { try { p.Kill(); } catch (InvalidOperationException) { /* gone */ } return -1; }
                    return p.ExitCode;
                }
            }
            catch (System.ComponentModel.Win32Exception) { return -1; }
        }

        public IProc Start(string exe, string args, IDictionary<string, string> env)
        {
            var info = new ProcessStartInfo(exe, args) { UseShellExecute = false, CreateNoWindow = true };
            foreach (var kv in env) info.EnvironmentVariables[kv.Key] = kv.Value;
            return new Proc(Process.Start(info));
        }

        public void Open(string file) => Process.Start(new ProcessStartInfo(file) { UseShellExecute = true });

        sealed class Proc : IProc
        {
            readonly Process _p;
            public Proc(Process p) { _p = p; }
            public bool Exited => _p.HasExited;
            public int ExitCode => _p.HasExited ? _p.ExitCode : -1;
            public void Kill() { try { if (!_p.HasExited) _p.Kill(); } catch (InvalidOperationException) { /* gone */ } }
        }
    }
}
