// The commands of the CODESYS bridge:
//   ping · detect (CODESYS installed: versions, profiles) · build (the program into a CODESYS project, then a build:
//   the user's project is opened and saved as the app's copy, never changed; or a new project) · open (the project in
//   CODESYS, for the user) · download (only with the app's confirm screen: confirmed; online change unless the PLC
//   may stop) · stop (urgent: ends the CODESYS of a running job).
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using TiaBridge;

namespace CodesysBridge
{
    public static class Commands
    {
        public static Protocol Register(Protocol p, IMachine pc, Jobs jobs, string projectsDir)
        {
            CancellationTokenSource current = null;

            CodesysInstall Install(Dictionary<string, object> args)
            {
                var all = CodesysDetect.Find(pc);
                string want = Str(args, "exe");
                return (want != null ? all.FirstOrDefault(i => string.Equals(i.Exe, want, StringComparison.OrdinalIgnoreCase)) : all.FirstOrDefault())
                    ?? throw new BridgeError("CODESYS is not installed on this PC. Install the CODESYS Development System (free from the CODESYS Store), then try again.");
            }

            p.On("ping", (a, pr) => new Dictionary<string, object> { ["pong"] = true });
            p.On("detect", (a, pr) =>
            {
                pr("Looking for CODESYS…");
                var all = CodesysDetect.Find(pc);
                foreach (var i in all) Log.Write($"codesys {i.Version} \"{i.Profile}\" {i.Exe}");
                return new Dictionary<string, object>
                {
                    ["ready"] = all.Count > 0,
                    ["installs"] = all.Select(i => (object)new Dictionary<string, object> { ["name"] = i.Name, ["version"] = i.Version, ["exe"] = i.Exe, ["profile"] = i.Profile }).ToList(),
                    ["projectsDir"] = projectsDir,
                    ["steps"] = all.Count > 0 ? new List<object>() : new List<object> { "Install the CODESYS Development System (free from the CODESYS Store), then Check again." },
                };
            });
            p.On("build", (a, pr) =>
            {
                // Stop counts from here (a Stop while CODESYS is still being found ends it too)
                using (var cts = new CancellationTokenSource())
                {
                current = cts;
                try
                {
                var install = Install(a);
                string source = Str(a, "project");
                string name = Safe(Str(a, "name") ?? "Machine");
                // the app's copy: next to the user's project (theirs is never changed), or a new project of its own
                string copy = source != null
                    ? Path.Combine(Path.GetDirectoryName(source) ?? projectsDir, $"{Path.GetFileNameWithoutExtension(source)}_ISA.project")
                    : Path.Combine(projectsDir, name, $"{name}.project");
                if (source != null && !pc.Exists(source)) throw new BridgeError($"There is no CODESYS project at {source}: choose it again.");
                Directory.CreateDirectory(Path.GetDirectoryName(copy));
                var job = new Dictionary<string, object>
                {
                    ["cmd"] = "build",
                    ["project"] = source,
                    ["copy"] = copy,
                    ["device"] = Str(a, "device") ?? "CODESYS Control Win V3",
                    ["main"] = Str(a, "main"),
                    ["objects"] = a.TryGetValue("objects", out object o) && o is List<object> l ? l : throw new BridgeError("The app sent no program (generate it first)."),
                };
                if (cts.IsCancellationRequested) throw new BridgeError("Stopped, as you asked: CODESYS was not started. Your own project was not changed.");
                pr($"Starting CODESYS {install.Version} (it works in the background, this takes a minute)…");
                return jobs.Run(install, job, pr, cts.Token);
                }
                finally { current = null; }
                }
            });
            p.On("download", (a, pr) =>
            {
                // A download changes what runs on the machine: only from the app's confirm screen.
                if (!(a.TryGetValue("confirmed", out object c) && c is bool yes && yes)) throw new BridgeError("A download needs the confirm screen in the app (nothing was sent to the PLC).");
                string file = Str(a, "project") ?? throw new BridgeError("Put the program in and build first: there is no project to download.");
                if (!pc.Exists(file)) throw new BridgeError($"There is no CODESYS project at {file}: put the program in and build again.");
                string ip = Str(a, "ip");
                if (ip == null || !System.Text.RegularExpressions.Regex.IsMatch(ip, @"^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$")) throw new BridgeError("Enter the PLC's IP address (like 192.168.0.10).");
                bool Flag(string k) => a.TryGetValue(k, out object v) && v is bool b && b;
                var job = new Dictionary<string, object>
                {
                    ["cmd"] = "download", ["confirmed"] = true, ["project"] = file, ["ip"] = ip,
                    ["stopAllowed"] = Flag("stopAllowed"), ["startAfter"] = Flag("startAfter"),
                    ["user"] = Str(a, "user"), ["password"] = a.TryGetValue("password", out object pw) && pw is string ps && ps.Length > 0 ? ps : null,
                };
                Log.Write($"download confirmed: {file} to {ip}, stop {job["stopAllowed"]}, start {job["startAfter"]}, user {(job["user"] != null ? "given" : "none")}, password {(job["password"] != null ? "given" : "none")}");
                using (var cts = new CancellationTokenSource())
                {
                    current = cts;
                    try
                    {
                        var install = Install(a);
                        pr($"Starting CODESYS {install.Version} to download (in the background)…");
                        return jobs.Run(install, job, pr, cts.Token);
                    }
                    finally { current = null; }
                }
            });
            p.On("open", (a, pr) =>
            {
                string file = Str(a, "project") ?? throw new BridgeError("No project to open.");
                if (!pc.Exists(file)) throw new BridgeError($"There is no CODESYS project at {file}.");
                pc.Open(file);
                return new Dictionary<string, object> { ["opened"] = file };
            });
            p.OnUrgent("stop", (a, pr) =>
            {
                var c = current;
                c?.Cancel();
                Log.Write(c == null ? "stop: nothing running" : "stop: CODESYS is closed");
                return new Dictionary<string, object> { ["stopping"] = c != null };
            });
            return p;
        }

        static string Str(Dictionary<string, object> a, string k) => a.TryGetValue(k, out object v) && v is string s && s.Trim().Length > 0 ? s.Trim() : null;

        /// <summary>A name Windows and CODESYS take for a project (no \ / : * ? " &lt; &gt; |).</summary>
        public static string Safe(string name)
        {
            var s = new string(name.Select(c => "\\/:*?\"<>|".IndexOf(c) >= 0 ? '_' : c).ToArray()).Trim();
            return s.Length == 0 ? "Machine" : s.Length > 80 ? s.Substring(0, 80) : s;
        }
    }
}
