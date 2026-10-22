// The real PC for the CODESYS bridge: Program Files, folders, and starting CODESYS.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;

namespace CodesysBridge
{
    public sealed class WindowsMachine : IMachine
    {
        public IList<string> ProgramFiles => new[]
        {
            Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
            Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),
        };

        public string[] Dirs(string path) => Directory.Exists(path) ? Directory.GetDirectories(path) : new string[0];
        public string[] Files(string path, string pattern) => Directory.Exists(path) ? Directory.GetFiles(path, pattern) : new string[0];
        public bool Exists(string file) => File.Exists(file);

        public IProc Start(string exe, string args, IDictionary<string, string> env)
        {
            var info = new ProcessStartInfo(exe, args) { UseShellExecute = false, WorkingDirectory = Path.GetDirectoryName(exe), CreateNoWindow = true };
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
