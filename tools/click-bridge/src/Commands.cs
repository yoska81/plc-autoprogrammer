// The commands of the CLICK bridge:
//   ping · detect (CLICK Programming Software installed: version, program) · start (attach to the running CLICK
//   or start it) · run (a step plan, while the user watches) · stop (urgent: ends a run before its next step)
//   · resume (urgent: the user finished their turn, the run goes on)
//   · dump (the controls of CLICK's windows, for the log) · writeFile (a file the plan imports, e.g. nicknames)
//   · folder (the bridge's folder) · readFile (a file the user saved there from CLICK: nicknames, the printed ladder).
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using TiaBridge;

namespace ClickBridge
{
    public static class Commands
    {
        /// <summary>How long start waits for CLICK's window (a first start of CLICK can be slow).</summary>
        public static int StartWaitSeconds = 90;
        /// <summary>How long start waits for the window of a CLICK that is already running, before starting one.</summary>
        public static int AttachWaitSeconds = 10;
        /// <summary>CLICK's main window, or CLICK 4's Startup window alone at its start.</summary>
        const string StartTitles = "CLICK|^Startup$";

        public static Protocol Register(Protocol p, IPc pc, IUi ui, Func<Action, bool> watchStopKey = null, string folder = null)
        {
            int pid = 0;
            string version = "";
            CancellationTokenSource current = null;
            var resume = new AutoResetEvent(false);
            bool keyWatched = false, keyOk = false;
            folder = folder ?? Path.Combine(Path.GetTempPath(), "isa-click");

            ClickInstall Install(Dictionary<string, object> args)
            {
                var all = ClickDetect.Find(pc);
                string want = Str(args, "exe");
                return (want != null ? all.FirstOrDefault(i => string.Equals(i.Exe, want, StringComparison.OrdinalIgnoreCase)) : all.FirstOrDefault())
                    ?? throw new BridgeError("CLICK Programming Software is not installed on this PC. Install it from AutomationDirect (free download), then try again.");
            }

            p.On("ping", (a, pr) => new Dictionary<string, object> { ["pong"] = true });
            p.On("detect", (a, pr) =>
            {
                pr("Looking for CLICK Programming Software…");
                var all = ClickDetect.Find(pc);
                foreach (var i in all) Log.Write($"click {i.Version} {i.Exe}");
                return new Dictionary<string, object>
                {
                    ["ready"] = all.Count > 0,
                    ["installs"] = all.Select(i => (object)new Dictionary<string, object> { ["name"] = i.Name, ["version"] = i.Version, ["exe"] = i.Exe }).ToList(),
                    ["running"] = all.Count > 0 && pc.Running(all[0].Exe).Count > 0,
                    ["steps"] = all.Count > 0 ? new List<object>() : new List<object> { "Install CLICK Programming Software from AutomationDirect (free download), then Check again." },
                };
            });
            p.On("start", (a, pr) =>
            {
                var inst = Install(a);
                var running = pc.Running(inst.Exe);
                if (running.Count > 0) { pid = running[0].Key; pr("Using the CLICK Programming Software that is open."); }
                else { pr($"Starting CLICK Programming Software {inst.Version}…"); pid = ui.Start(inst.Exe); }
                // The process started may hand over to another (a launcher), and CLICK 4 may first show only its Startup
                // window: the window is looked for in every CLICK process, by either title.
                string main = null;
                var until = DateTime.UtcNow.AddSeconds(running.Count > 0 ? AttachWaitSeconds : StartWaitSeconds);
                bool startedHere = running.Count == 0;
                while (main == null)
                {
                    foreach (int cand in new[] { pid }.Concat(pc.Running(inst.Exe).Select(r => r.Key)).Distinct())
                    {
                        string w;
                        try { w = ui.Window(cand, StartTitles, 0); }
                        catch (Exception e) { Log.Write($"click: process {cand}: {e.Message}; looking again"); w = null; } // CLICK still opening
                        if (w != null) { if (cand != pid) Log.Write($"click: the window is in process {cand} (started {pid})"); pid = cand; main = w; break; }
                    }
                    if (main != null) break;
                    if (DateTime.UtcNow >= until)
                    {
                        string procs = string.Join(", ", pc.Running(inst.Exe).Select(r => $"{r.Key} \"{r.Value}\""));
                        if (!startedHere)
                        {
                            // a CLICK left running without a window (closed, but its process stayed): start one that has
                            Log.Write($"click: the running CLICK has no window ({procs}); starting CLICK");
                            pr($"Starting CLICK Programming Software {inst.Version}…");
                            pid = ui.Start(inst.Exe);
                            startedHere = true;
                            until = DateTime.UtcNow.AddSeconds(StartWaitSeconds);
                            continue;
                        }
                        Log.Write($"click: no window within {StartWaitSeconds} s; processes: {procs}");
                        throw new BridgeError($"CLICK Programming Software did not show its window within {StartWaitSeconds} seconds. Restart the PC (a CLICK that was closed may still be running without a window), then try again.");
                    }
                    Thread.Sleep(500);
                }
                version = inst.Version;
                // maximized only when it is the main window (not the Startup dialog)
                var mainWindow = ui.Window(pid, "^CLICK Programming Software", 0); // not "ClickNewFeature", its welcome box
                if (mainWindow != null) ui.Show(mainWindow); else ui.Raise(main);
                Log.Write($"click pid {pid}, windows: {string.Join(" | ", ui.Windows(pid))}");
                return new Dictionary<string, object> { ["version"] = inst.Version, ["processId"] = pid, ["windows"] = ui.Windows(pid).Cast<object>().ToList(), ["attached"] = running.Count > 0 };
            });
            p.On("dump", (a, pr) =>
            {
                if (pid == 0) throw new BridgeError("Open CLICK first.");
                var front = ui.Window(pid, "CLICK", 2000);
                if (front != null && a.TryGetValue("show", out object sh) && sh is bool show && show) ui.Show(front);
                var text = string.Join("\n\n", ui.Windows(pid).Select(t => { var w = ui.Window(pid, "^" + System.Text.RegularExpressions.Regex.Escape(t) + "$", 2000); return w == null ? $"(window \"{t}\" closed)" : ui.Dump(w); }));
                Directory.CreateDirectory(folder);
                string file = Path.Combine(folder, $"click-controls-{DateTime.Now:yyyyMMdd-HHmmss}.txt");
                File.WriteAllText(file, text);
                Log.Write($"controls of CLICK's windows → {file}\n{text}");
                return new Dictionary<string, object> { ["file"] = file, ["lines"] = text.Split('\n').Length };
            });
            p.On("writeFile", (a, pr) =>
            {
                // the file name only (no folder of the app's choosing: it stays in the bridge's own folder)
                string given = Str(a, "name") ?? throw new BridgeError("No file name.");
                string name = given.Substring(given.LastIndexOfAny(new[] { '\\', '/' }) + 1);
                if (name.Length == 0 || name == "." || name == "..") throw new BridgeError("No file name.");
                Directory.CreateDirectory(folder);
                string file = Path.Combine(folder, name);
                File.WriteAllText(file, a.TryGetValue("text", out object t) ? t as string ?? "" : "", new System.Text.UTF8Encoding(false));
                return new Dictionary<string, object> { ["path"] = file };
            });
            p.On("folder", (a, pr) => new Dictionary<string, object> { ["path"] = folder });
            p.On("readFile", (a, pr) =>
            {
                // only a file in the bridge's own folder (where the user saved what CLICK exported)
                string given = Str(a, "name") ?? throw new BridgeError("No file name.");
                string name = given.Substring(given.LastIndexOfAny(new[] { '\\', '/' }) + 1);
                string file = Path.Combine(folder, name);
                if (name.Length == 0 || !File.Exists(file)) throw new BridgeError($"There is no {name} in {folder}: save it there from CLICK's dialog.");
                var bytes = File.ReadAllBytes(file);
                return new Dictionary<string, object> { ["name"] = name, ["base64"] = Convert.ToBase64String(bytes), ["bytes"] = bytes.Length };
            });
            p.On("run", (a, pr) =>
            {
                if (pid == 0) throw new BridgeError("Open CLICK first.");
                var steps = (a.TryGetValue("steps", out object s) && s is List<object> l ? l : new List<object>()).OfType<Dictionary<string, object>>().Select(Step.From).ToList();
                if (steps.Count == 0) throw new BridgeError("The plan has no steps.");
                if (!keyWatched && watchStopKey != null) { keyWatched = true; keyOk = watchStopKey(() => current?.Cancel()); }
                using (var cts = new CancellationTokenSource())
                {
                    current = cts;
                    try
                    {
                        pr(keyOk ? "Starting. Watch CLICK; press Stop or the Pause key to end at any time." : "Starting. Watch CLICK; press Stop to end at any time.");
                        resume.Reset();
                        // a minimized CLICK has no place on the screen: restore and maximize it first
                        var main = ui.Window(pid, "CLICK", 5000);
                        if (main != null) ui.Show(main);
                        int n = new Runner(ui, pid, cts.Token, pr, resume) { Version = version }.Run(steps);
                        return new Dictionary<string, object> { ["steps"] = n };
                    }
                    finally { current = null; }
                }
            });
            p.OnUrgent("resume", (a, pr) =>
            {
                bool running = current != null;
                if (running) resume.Set();
                return new Dictionary<string, object> { ["resumed"] = running };
            });
            p.OnUrgent("stop", (a, pr) =>
            {
                var c = current;
                c?.Cancel();
                Log.Write(c == null ? "stop: nothing running" : "stop: the run ends before its next step");
                return new Dictionary<string, object> { ["stopping"] = c != null };
            });
            return p;
        }

        static string Str(Dictionary<string, object> a, string k) => a.TryGetValue(k, out object v) && v is string s && s.Trim().Length > 0 ? s.Trim() : null;
    }
}
