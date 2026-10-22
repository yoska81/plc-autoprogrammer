// The commands of the Studio 5000 bridge:
//   ping · detect (Studio 5000 Logix Designer, the Logix Designer SDK and its Python) · writeL5x (the app's L5X into
//   the projects folder) · import (the L5X's parts into the app's copy of the user's .ACD: theirs never changed)
//   · info (the copy's communication path) · download (only with the app's confirm screen: confirmed, and leave to
//   put the controller in Program mode) · open (an .ACD or .L5X with Studio 5000, for the user)
//   · stop (urgent: ends a running job).
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using TiaBridge;

namespace Studio5000Bridge
{
    public static class Commands
    {
        public static Protocol Register(Protocol p, IMachine pc, Jobs jobs, string projectsDir)
        {
            CancellationTokenSource current = null;
            StudioFound found = null;

            SdkPython Sdk()
            {
                found = found?.Python != null ? found : StudioDetect.Find(pc);
                if (!found.Ready) throw new BridgeError(string.Join(" ", found.Steps));
                return found.Python;
            }
            Dictionary<string, object> Job(Dictionary<string, object> job, Action<string> pr)
            {
                using (var cts = new CancellationTokenSource())
                {
                    current = cts;
                    try { var py = Sdk(); if (cts.IsCancellationRequested) throw new BridgeError("Stopped, as you asked. Your own Studio 5000 project was not changed."); return jobs.Run(py, job, pr, cts.Token); }
                    finally { current = null; }
                }
            }

            p.On("ping", (a, pr) => new Dictionary<string, object> { ["pong"] = true });
            p.On("detect", (a, pr) =>
            {
                pr("Looking for Studio 5000 and the Logix Designer SDK…");
                found = StudioDetect.Find(pc);
                foreach (var l in found.Logix) Log.Write($"logix designer {l.Version} \"{l.Name}\"");
                Log.Write($"sdk folder: {found.SdkFolder ?? "none"}; python: {(found.Python == null ? "none" : $"{found.Python.Exe} {found.Python.Prefix} ({found.Python.How})")}");
                return new Dictionary<string, object>
                {
                    ["ready"] = found.Ready,
                    ["logix"] = found.Logix.Select(l => (object)new Dictionary<string, object> { ["name"] = l.Name, ["version"] = l.Version }).ToList(),
                    ["sdk"] = found.SdkFolder,
                    ["python"] = found.Python?.How,
                    ["projectsDir"] = projectsDir,
                    ["steps"] = found.Steps.Cast<object>().ToList(),
                };
            });
            p.On("writeL5x", (a, pr) =>
            {
                string name = Safe(Str(a, "name") ?? "Machine");
                string text = a.TryGetValue("text", out object t) && t is string s && s.Length > 0 ? s : throw new BridgeError("The app sent no L5X (generate the program first).");
                Directory.CreateDirectory(projectsDir);
                string file = Path.Combine(projectsDir, $"{name}.L5X");
                File.WriteAllText(file, text, new System.Text.UTF8Encoding(false));
                return new Dictionary<string, object> { ["path"] = file };
            });
            p.On("import", (a, pr) =>
            {
                string acd = Str(a, "acd") ?? throw new BridgeError("Choose your Studio 5000 project (.ACD) first.");
                if (!pc.Exists(acd)) throw new BridgeError($"There is no Studio 5000 project at {acd}: choose it again.");
                string l5x = Str(a, "l5x") ?? throw new BridgeError("The app sent no L5X.");
                var xpaths = a.TryGetValue("xpaths", out object x) && x is List<object> l && l.Count > 0 ? l : throw new BridgeError("The app sent nothing to import.");
                // the app's copy, next to the user's project: theirs is only read
                string copy = Path.Combine(Path.GetDirectoryName(acd) ?? projectsDir, $"{Path.GetFileNameWithoutExtension(acd)}_ISA.ACD");
                pr("Starting the Logix Designer SDK (this takes a minute)…");
                return Job(new Dictionary<string, object> { ["cmd"] = "import", ["acd"] = acd, ["copy"] = copy, ["l5x"] = l5x, ["xpaths"] = xpaths }, pr);
            });
            p.On("info", (a, pr) =>
            {
                string file = Str(a, "project") ?? throw new BridgeError("No project.");
                if (!pc.Exists(file)) throw new BridgeError($"There is no Studio 5000 project at {file}.");
                return Job(new Dictionary<string, object> { ["cmd"] = "info", ["project"] = file }, pr);
            });
            p.On("download", (a, pr) =>
            {
                // A download changes what runs on the machine: only from the app's confirm screen.
                if (!(a.TryGetValue("confirmed", out object c) && c is bool yes && yes)) throw new BridgeError("A download needs the confirm screen in the app (nothing was sent to the controller).");
                bool Flag(string k) => a.TryGetValue(k, out object v) && v is bool b && b;
                if (!Flag("programAllowed")) throw new BridgeError("A Logix download needs the controller in Program mode (it stops): tick \"The controller may be put in Program mode\" if that is safe.");
                string file = Str(a, "project") ?? throw new BridgeError("Put the program in first: there is no project to download.");
                if (!pc.Exists(file)) throw new BridgeError($"There is no Studio 5000 project at {file}: put the program in again.");
                string path = Str(a, "commPath") ?? throw new BridgeError("Enter the path to the controller (as in Studio 5000's Who Active, e.g. AB_ETH-1\\192.168.1.10\\Backplane\\0).");
                Log.Write($"download confirmed: {file} to {path}, program mode allowed, run after {Flag("runAfter")}");
                return Job(new Dictionary<string, object> { ["cmd"] = "download", ["confirmed"] = true, ["programAllowed"] = true, ["runAfter"] = Flag("runAfter"), ["project"] = file, ["commPath"] = path }, pr);
            });
            p.On("open", (a, pr) =>
            {
                string file = Str(a, "file") ?? throw new BridgeError("No file to open.");
                if (!pc.Exists(file)) throw new BridgeError($"There is no file at {file}.");
                if (!System.Text.RegularExpressions.Regex.IsMatch(file, @"\.(ACD|L5X)$", System.Text.RegularExpressions.RegexOptions.IgnoreCase)) throw new BridgeError("Only a Studio 5000 project (.ACD) or an .L5X is opened.");
                pc.Open(file);
                return new Dictionary<string, object> { ["opened"] = file };
            });
            p.OnUrgent("stop", (a, pr) =>
            {
                var c = current;
                c?.Cancel();
                Log.Write(c == null ? "stop: nothing running" : "stop: the SDK job is ended");
                return new Dictionary<string, object> { ["stopping"] = c != null };
            });
            return p;
        }

        static string Str(Dictionary<string, object> a, string k) => a.TryGetValue(k, out object v) && v is string s && s.Trim().Length > 0 ? s.Trim() : null;

        public static string Safe(string name)
        {
            var s = new string(name.Select(c => "\\/:*?\"<>|".IndexOf(c) >= 0 ? '_' : c).ToArray()).Trim();
            return s.Length == 0 ? "Machine" : s.Length > 80 ? s.Substring(0, 80) : s;
        }
    }
}
