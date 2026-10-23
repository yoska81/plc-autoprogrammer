// The CLICK bridge's tests: detect on made-up PCs, the runner on a fake CLICK (pause when another window is in
// front, Stop, never save, a failed step named with the windows open) and the commands (urgent stop while a run
// goes). Run with:  dotnet run --project tools/click-bridge/tests
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using ClickBridge;
using TiaBridge;

static class Tests
{
    static int _passed;
    static void Test(string name, Action body) { body(); _passed++; Console.WriteLine($"  ok  {name}"); }
    static void Eq(object want, object got, string what = "") { if (!Equals(want, got)) throw new Exception($"{what}: expected {want}, got {got}"); }
    static void True(bool ok, string what) { if (!ok) throw new Exception(what); }
    static T Throws<T>(Action a) where T : Exception { try { a(); } catch (T e) { return e; } throw new Exception($"no {typeof(T).Name}"); }

    sealed class FakePc : IPc
    {
        public Dictionary<string, string[]> Keys = new Dictionary<string, string[]>();
        public Dictionary<string, string> Values = new Dictionary<string, string>();
        public Dictionary<string, string[]> Folders = new Dictionary<string, string[]>();
        public List<KeyValuePair<int, string>> Procs = new List<KeyValuePair<int, string>>();
        public string[] SubKeys(string path, bool wow) => Keys.TryGetValue($"{wow}|{path}", out var k) ? k : new string[0];
        public string Value(string path, string name, bool wow) => Values.TryGetValue($"{wow}|{path}|{name}", out var v) ? v : null;
        public string[] Programs(string folder) => Folders.TryGetValue(folder, out var f) ? f : new string[0];
        public IList<KeyValuePair<int, string>> Running(string exe) => Procs;
        public FakePc With(bool wow, string key, string name, string version, string folder, params string[] exes)
        {
            string k = $"{wow}|{ClickDetect.Uninstall}";
            Keys[k] = (Keys.TryGetValue(k, out var have) ? have : new string[0]).Concat(new[] { key }).ToArray();
            string p = $"{wow}|{ClickDetect.Uninstall}\\{key}";
            Values[$"{p}|DisplayName"] = name; Values[$"{p}|DisplayVersion"] = version;
            if (folder != null) { Values[$"{p}|InstallLocation"] = folder; Folders[folder] = exes; }
            return this;
        }
    }

    /// <summary>A PC whose running CLICK processes change between asks (a launcher, then CLICK).</summary>
    sealed class LaterPc : IPc
    {
        readonly IPc _pc; readonly Func<IList<KeyValuePair<int, string>>> _running;
        public LaterPc(IPc pc, Func<IList<KeyValuePair<int, string>>> running) { _pc = pc; _running = running; }
        public string[] SubKeys(string path, bool wow) => _pc.SubKeys(path, wow);
        public string Value(string path, string name, bool wow) => _pc.Value(path, name, wow);
        public string[] Programs(string folder) => _pc.Programs(folder);
        public IList<KeyValuePair<int, string>> Running(string exe) => _running();
    }

    /// <summary>A CLICK in memory: its windows and controls, what was done to it, who is in front.</summary>
    sealed class FakeUi : IUi
    {
        public List<string> Did = new List<string>();
        public Dictionary<string, List<(string id, string name, string type)>> Controls = new Dictionary<string, List<(string, string, string)>>();
        public int Front = 42;
        public Func<int, int> FrontAt;
        int _calls;
        /// <summary>The process Start returns (a launcher's, when CLICK's windows are in another), and the one with the windows.</summary>
        public int StartPid = 42;
        public int? WindowsIn;
        public int Start(string exe) { Did.Add($"start {exe}"); return StartPid; }
        public IList<string> Windows(int pid) => WindowsIn != null && pid != WindowsIn ? new List<string>() : Controls.Keys.ToList();
        /// <summary>Times Window throws as UI Automation does when a window closes while it is read (CLICK starting).</summary>
        public int WindowGoneTimes;
        public string Window(int pid, string title, int timeoutMs) => WindowGoneTimes-- > 0 ? throw new InvalidOperationException("The target element corresponds to UI that is no longer available") : WindowsIn != null && pid != WindowsIn ? null : Controls.Keys.FirstOrDefault(w => System.Text.RegularExpressions.Regex.IsMatch(w, title, System.Text.RegularExpressions.RegexOptions.IgnoreCase));
        /// <summary>Where a control is on the screen, left to right (by id): for order "left".</summary>
        public Dictionary<string, int> Left = new Dictionary<string, int>();
        public string Find(string window, Selector sel, int timeoutMs)
        {
            if (!Controls.ContainsKey(window)) return null;
            var hits = Controls[window].Where(c => sel.Matches(c.id, c.name, c.type)).ToList();
            if (sel.Order == "left") hits = hits.OrderBy(c => Left.TryGetValue(c.id, out int x) ? x : 0).ToList();
            return hits.Count > sel.Index ? $"{window}/{(hits[sel.Index].name == "" ? hits[sel.Index].id : hits[sel.Index].name)}" : null;
        }
        /// <summary>Windows that a press opens (CLICK 4's Startup button opens the CPU dialog inside it), and that a Cancel / Close closes.</summary>
        public Dictionary<string, string> PressOpens = new Dictionary<string, string>();
        /// <summary>The controls a window gets when it opens (else just an OK button).</summary>
        public Dictionary<string, List<(string id, string name, string type)>> Ready = new Dictionary<string, List<(string, string, string)>>();
        void Open(string w) => Controls[w] = Ready.TryGetValue(w, out var c) ? c : new List<(string, string, string)> { ("", "OK", "Button") };
        public void Invoke(string el)
        {
            Did.Add($"press {el}");
            if (PressOpens.TryGetValue(el, out string opens)) Open(opens);
            if (el.EndsWith("/Cancel") || el.EndsWith("/Close")) Controls.Remove(el.Substring(0, el.LastIndexOf('/')));
        }
        public void SetText(string el, string text) => Did.Add($"text {el}={text}");
        public void DoubleClick(string el) => Did.Add($"double {el}");
        public void MouseClick(string el) { Did.Add($"mouse {el}"); if (PressOpens.TryGetValue(el, out string opens)) Open(opens); }
        public void Check(string el, bool on) => Did.Add($"check {el}={on}");
        public void Select(string el, string item) => Did.Add($"select {el}={item}");
        /// <summary>CLICK 4: a ribbon, no menu UI Automation can see.</summary>
        public bool NoMenus;
        public void Menu(string window, IList<string> path) { if (NoMenus) throw new BridgeError($"CLICK has no menu \"{path[0]}\"."); Did.Add($"menu {string.Join(">", path)}"); }
        public void Show(string window) => Did.Add($"show {window}");
        public void Screenshot(string file) => Did.Add($"shot {System.IO.Path.GetFileName(file)}");
        /// <summary>Whether bringing CLICK to the front works (Windows may refuse); Raised counts the tries.</summary>
        public bool RaiseWorks;
        public int Raised;
        public void Raise(string window) { Raised++; if (RaiseWorks) { Front = 42; FrontAt = null; } }
        /// <summary>A window that opens when keys are typed (CLICK 4's Ctrl+N opens the CPU dialog).</summary>
        public Dictionary<string, string> KeysOpen = new Dictionary<string, string>();
        public void Keys(string window, string keys)
        {
            Did.Add($"keys {keys}");
            if (KeysOpen.TryGetValue(keys, out string opens)) Open(opens);
        }
        public int ForegroundProcess() => FrontAt != null ? FrontAt(++_calls) : Front;
        public string Dump(string window) => string.Join("\n", Controls[window].Select(c => $"{c.type} \"{c.name}\" id={c.id}"));
    }

    static FakeUi Click()
    {
        var ui = new FakeUi();
        ui.Controls["CLICK Programming Software - [Untitled]"] = new List<(string, string, string)> { ("", "File", "MenuItem") };
        ui.Controls["Select a CPU Module"] = new List<(string, string, string)> { ("cboCpu", "CPU", "ComboBox"), ("", "OK", "Button"), ("", "Cancel", "Button") };
        return ui;
    }

    static List<Step> Plan(string json) => ((List<object>)Json.Parse(json)).Cast<Dictionary<string, object>>().Select(Step.From).ToList();

    static int Main()
    {
        Test("detect: CLICK in the 32-bit programs list, the program in its folder (not the uninstaller), newest first", () =>
        {
            var pc = new FakePc()
                .With(true, "{A}", "CLICK Programming Software Ver. 2.60", "2.60", @"C:\AD\Click260", @"C:\AD\Click260\unins000.exe", @"C:\AD\Click260\CLICK.exe")
                .With(false, "{B}", "CLICK Programming Software Ver. 3.71", "3.71", @"C:\AD\Click3", @"C:\AD\Click3\ClickUpdater.exe", @"C:\AD\Click3\CLICK3.exe")
                .With(false, "{C}", "Something else", "1.0", @"C:\Other", @"C:\Other\click.exe")
                .With(false, "{D}", "CLICK Programming Software", "3.80", null);
            var all = ClickDetect.Find(pc);
            Eq(2, all.Count);
            Eq("3.71", all[0].Version); Eq(@"C:\AD\Click3\CLICK3.exe", all[0].Exe);
            Eq(@"C:\AD\Click260\CLICK.exe", all[1].Exe);
            Eq(1, ClickDetect.Compare("3.10", "3.9"));
        });

        Test("plan steps: read from the app's JSON", () =>
        {
            var p = Plan("[{\"do\":\"window\",\"title\":\"^Select a CPU\"},{\"do\":\"select\",\"find\":{\"id\":\"cboCpu\",\"type\":\"ComboBox\"},\"item\":\"C0-10DD1E-D\",\"say\":\"CPU\"},{\"do\":\"menu\",\"path\":[\"File\",\"New Project\"]},{\"do\":\"wait\",\"ms\":50}]");
            Eq("select", p[1].Do); Eq("cboCpu", p[1].Find.Id); Eq("C0-10DD1E-D", p[1].Item);
            Eq("File > New Project", string.Join(" > ", p[2].Path)); Eq(50, p[3].Ms);
        });

        Test("runner: does the steps in order with progress; never a save", () =>
        {
            var ui = Click(); var said = new List<string>();
            int n = new Runner(ui, 42, CancellationToken.None, said.Add).Run(Plan("[{\"do\":\"window\",\"title\":\"^CLICK Programming\"},{\"do\":\"menu\",\"path\":[\"File\",\"New Project\"],\"say\":\"New project\"},{\"do\":\"window\",\"title\":\"^Select a CPU\"},{\"do\":\"select\",\"find\":{\"id\":\"cboCpu\"},\"item\":\"C0-10DD1E-D\"},{\"do\":\"click\",\"find\":{\"name\":\"^OK$\",\"type\":\"Button\"}},{\"do\":\"doubleClick\",\"find\":{\"name\":\"^Cancel$\"}}]"));
            Eq(6, n);
            Eq("menu File>New Project|select Select a CPU Module/CPU=C0-10DD1E-D|press Select a CPU Module/OK|double Select a CPU Module/Cancel", string.Join("|", ui.Did));
            True(said.Contains("2/6 New project"), string.Join("|", said));
            foreach (var bad in new[] { "[{\"do\":\"keys\",\"keys\":\"^s\"}]", "[{\"do\":\"keys\",\"keys\":\"abc^{S}\"}]", "[{\"do\":\"menu\",\"path\":[\"File\",\"Save Project As\"]}]", "[{\"do\":\"click\",\"find\":{\"name\":\"^Save\"}}]" })
            {
                var e = Throws<BridgeError>(() => new Runner(ui, 42, CancellationToken.None, said.Add).Run(Plan(bad)));
                True(e.Message.Contains("never saves"), e.Message);
            }
            Eq(4, ui.Did.Count);
        });

        Test("runner: another window in front pauses it (said), CLICK back in front goes on", () =>
        {
            var ui = Click(); var said = new List<string>();
            ui.FrontAt = (call) => call <= 20 ? 7 : 42; // the user is in another program, and bringing CLICK forward did not work
            new Runner(ui, 42, CancellationToken.None, said.Add) { PollMs = 1 }.Run(Plan("[{\"do\":\"window\",\"title\":\"^CLICK\"},{\"do\":\"keys\",\"keys\":\"{ENTER}\"}]"));
            True(said.Any(s => s.StartsWith("Paused: click on the CLICK window")), string.Join("|", said));
            True(said.Any(s => s.StartsWith("Going on")), "resumed");
            Eq("keys {ENTER}", ui.Did.Single());
        });

        Test("runner: Stop ends it before the next step, also while paused; nothing saved", () =>
        {
            var ui = Click();
            using (var cts = new CancellationTokenSource())
            {
                var said = new List<string>();
                int k = 0;
                var r = new Runner(ui, 42, cts.Token, s => { said.Add(s); if (++k == 2) cts.Cancel(); });
                var e = Throws<BridgeError>(() => r.Run(Plan("[{\"do\":\"window\",\"title\":\"^CLICK\",\"say\":\"a\"},{\"do\":\"keys\",\"keys\":\"x\",\"say\":\"b\"},{\"do\":\"keys\",\"keys\":\"y\",\"say\":\"c\"}]")));
                True(e.Message.StartsWith("Stopped at step 3") && e.Message.Contains("Nothing was saved"), e.Message);
                Eq("keys x", ui.Did.Single());
            }
            using (var cts = new CancellationTokenSource())
            {
                ui = Click(); ui.Front = 7;
                var r = new Runner(ui, 42, cts.Token, s => { if (s.StartsWith("Paused")) cts.Cancel(); }) { PollMs = 1 };
                var e = Throws<BridgeError>(() => r.Run(Plan("[{\"do\":\"window\",\"title\":\"^CLICK\"},{\"do\":\"keys\",\"keys\":\"x\"}]")));
                True(e.Message.StartsWith("Stopped at step 2"), e.Message);
                Eq(0, ui.Did.Count);
            }
        });

        Test("runner: a control that is not there: one plain sentence naming the step; nothing saved", () =>
        {
            var ui = Click();
            var e = Throws<BridgeError>(() => new Runner(ui, 42, CancellationToken.None, _ => { }).Run(Plan("[{\"do\":\"window\",\"title\":\"^Select a CPU\"},{\"do\":\"click\",\"find\":{\"name\":\"^Apply$\",\"type\":\"Button\"},\"say\":\"Apply the CPU\"}]")));
            Eq("CLICK: could not do \"Apply the CPU\" (no control Button \"^Apply$\" in the window). Nothing was saved.", e.Message);
            e = Throws<BridgeError>(() => new Runner(ui, 42, CancellationToken.None, _ => { }).Run(Plan("[{\"do\":\"keys\",\"keys\":\"x\"}]")));
            True(e.Message.Contains("names no window first"), e.Message);
        });

        Test("runner: an optional window that does not come is skipped with its steps; waitGone waits for the user to close a window", () =>
        {
            var ui = Click(); var said = new List<string>();
            int polls = 0;
            new Runner(ui, 42, CancellationToken.None, said.Add) { PollMs = 1 }.Run(Plan(
                "[{\"do\":\"window\",\"title\":\"^CLICK\"},{\"do\":\"window\",\"title\":\"^Import complete\",\"optional\":true,\"timeoutMs\":1},{\"do\":\"click\",\"find\":{\"name\":\"^OK$\"},\"optional\":true},{\"do\":\"keys\",\"keys\":\"a\"}]"));
            Eq("keys a", ui.Did.Single(), "the optional ones skipped, the next one done");
            // the user closes "System Configuration" after a few polls
            ui.Controls["System Configuration"] = new List<(string, string, string)>();
            var t = new Thread(() => { while (polls < 5) { Thread.Sleep(2); polls++; } ui.Controls.Remove("System Configuration"); });
            t.Start();
            new Runner(ui, 42, CancellationToken.None, said.Add) { PollMs = 1 }.Run(Plan("[{\"do\":\"waitGone\",\"title\":\"^System Configuration\",\"say\":\"Add the modules, then close System Configuration\"}]"));
            t.Join();
            True(!ui.Controls.ContainsKey("System Configuration"), "waited until it closed");
            True(said.Last().Contains("Add the modules"), said.Last());
            // a non-optional window that does not come fails, named
            var e = Throws<BridgeError>(() => new Runner(ui, 42, CancellationToken.None, _ => { }).Run(Plan("[{\"do\":\"window\",\"title\":\"^Nothing\",\"timeoutMs\":1}]")));
            True(e.Message.Contains("no CLICK window \"^Nothing\" came"), e.Message);
        });

        Test("runner: waitUser hands over until Continue (resume); Stop still ends it; without a way to resume it refuses", () =>
        {
            var ui = Click(); var said = new List<string>();
            using (var resume = new AutoResetEvent(false))
            {
                var t = new Thread(() => { Thread.Sleep(250); resume.Set(); });
                t.Start();
                new Runner(ui, 42, CancellationToken.None, said.Add, resume).Run(Plan("[{\"do\":\"window\",\"title\":\"^CLICK\"},{\"do\":\"waitUser\",\"text\":\"Type rung 7 (a PID box).\"},{\"do\":\"keys\",\"keys\":\"z\"}]"));
                t.Join();
                True(said.Any(x => x.StartsWith("Your turn: Type rung 7 (a PID box). Then press Continue.")), string.Join("|", said));
                Eq("keys z", ui.Did.Single());
            }
            using (var cts = new CancellationTokenSource())
            using (var resume = new AutoResetEvent(false))
            {
                var r = new Runner(ui, 42, cts.Token, s => { if (s.StartsWith("Your turn")) cts.Cancel(); }, resume);
                True(Throws<BridgeError>(() => r.Run(Plan("[{\"do\":\"waitUser\",\"text\":\"x\"}]"))).Message.StartsWith("Stopped at step 1"), "stop while waiting");
            }
            True(Throws<BridgeError>(() => new Runner(ui, 42, CancellationToken.None, _ => { }).Run(Plan("[{\"do\":\"waitUser\",\"text\":\"x\"}]"))).Message.Contains("cannot wait for you"), "no resume");
        });

        Test("runner: check sets a box on; readFile reads only the bridge's folder", () =>
        {
            var ui = Click();
            ui.Controls["Print"] = new List<(string, string, string)> { ("", "Ladder", "CheckBox") };
            new Runner(ui, 42, CancellationToken.None, _ => { }).Run(Plan("[{\"do\":\"window\",\"title\":\"^Print\"},{\"do\":\"check\",\"find\":{\"name\":\"^Ladder$\"}}]"));
            Eq("check Print/Ladder=True", ui.Did.Last());
            string folder = Path.Combine(Path.GetTempPath(), "click-read-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(folder);
            File.WriteAllText(Path.Combine(folder, "nick.csv"), "X001,Start");
            var output = new StringWriter();
            var p = Commands.Register(new Protocol(output), new FakePc(), ui, null, folder);
            p.Handle("{\"id\":1,\"cmd\":\"readFile\",\"args\":{\"name\":\"..\\\\..\\\\nick.csv\"}}");
            p.Handle("{\"id\":2,\"cmd\":\"readFile\",\"args\":{\"name\":\"other.csv\"}}");
            var m = output.ToString().Split('\n').Where(l => l.Trim().Length > 0).Select(l => (Dictionary<string, object>)Json.Parse(l)).Where(x => x.ContainsKey("ok")).ToList();
            Eq("X001,Start", System.Text.Encoding.UTF8.GetString(Convert.FromBase64String((string)((Dictionary<string, object>)m[0]["result"])["base64"])));
            True(((string)m[1]["error"]).Contains("There is no other.csv"), (string)m[1]["error"]);
            Directory.Delete(folder, true);
        });

        Test("commands: detect, start (attach to the running CLICK), writeFile, run; stop answered while a run goes", () =>
        {
            var pc = new FakePc().With(false, "{B}", "CLICK Programming Software Ver. 3.71", "3.71", @"C:\AD\Click3", @"C:\AD\Click3\CLICK3.exe");
            var ui = Click();
            ui.FrontAt = _ => 42;
            string folder = Path.Combine(Path.GetTempPath(), "click-test-" + Guid.NewGuid().ToString("N"));
            var output = new StringWriter();
            Action pressKey = null;
            var p = Commands.Register(new Protocol(output), pc, ui, a => { pressKey = a; return true; }, folder);
            // a long plan: stop arrives on the reading thread while it runs
            var plan = "[{\"do\":\"window\",\"title\":\"^CLICK\"}" + string.Concat(Enumerable.Repeat(",{\"do\":\"wait\",\"ms\":100}", 50)) + "]";
            var input = new StringReader(string.Join("\n",
                "{\"id\":1,\"cmd\":\"detect\"}",
                "{\"id\":2,\"cmd\":\"start\"}",
                "{\"id\":3,\"cmd\":\"writeFile\",\"args\":{\"name\":\"..\\\\nick.csv\",\"text\":\"X001,Start\"}}",
                "{\"id\":4,\"cmd\":\"run\",\"args\":{\"steps\":" + plan + "}}",
                "{\"id\":5,\"cmd\":\"quit\"}") + "\n");
            // send stop 300 ms in, through the same protocol (urgent)
            var t = new Thread(() => { Thread.Sleep(300); p.Handle("{\"id\":9,\"cmd\":\"stop\"}"); });
            t.Start();
            p.Run(input, "test");
            t.Join();
            var m = output.ToString().Split('\n').Where(l => l.Trim().Length > 0).Select(l => (Dictionary<string, object>)Json.Parse(l)).ToList();
            Dictionary<string, object> Ans(double id) => m.Last(x => Equals(x.GetValueOrDefault("id"), id) && x.ContainsKey("ok"));
            Eq(true, ((Dictionary<string, object>)Ans(1)["result"])["ready"]);
            var st = (Dictionary<string, object>)Ans(2)["result"];
            Eq(true, st["attached"] is bool b ? !b : false, "not running: started"); // FakePc has no running process
            Eq("start C:\\AD\\Click3\\CLICK3.exe", ui.Did[0]);
            string written = (string)((Dictionary<string, object>)Ans(3)["result"])["path"];
            Eq(Path.Combine(folder, "nick.csv"), written, "the file name only, in the bridge's folder");
            Eq("X001,Start", File.ReadAllText(written));
            Eq(true, ((Dictionary<string, object>)Ans(9)["result"])["stopping"]);
            True(((string)Ans(4)["error"]).StartsWith("Stopped at step"), (string)Ans(4)["error"]);
            True(m.FindIndex(x => Equals(x.GetValueOrDefault("id"), 9.0)) < m.FindIndex(x => Equals(x.GetValueOrDefault("id"), 4.0) && x.ContainsKey("ok")), "stop answered before the run ends");
            True(pressKey != null, "the Pause key is watched once a run starts");
            Directory.Delete(folder, true);
        });

        Test("runner: oneOf (CLICK 4: no menus) tries the File menu, then Ctrl+N, and keeps the one that works; logs the windows", () =>
        {
            var ui = Click();
            ui.NoMenus = true;
            ui.Controls.Remove("Select a CPU Module");
            ui.KeysOpen["^n"] = "Select a CPU Module";
            var steps = Plan("[{\"do\":\"window\",\"title\":\"^CLICK\"},{\"do\":\"oneOf\",\"what\":\"New project\",\"options\":[" +
                "{\"label\":\"File menu\",\"steps\":[{\"do\":\"menu\",\"path\":[\"File\",\"New Project\"]},{\"do\":\"window\",\"title\":\"^Select a CPU\",\"timeoutMs\":0}]}," +
                "{\"label\":\"Ctrl+N\",\"steps\":[{\"do\":\"keys\",\"keys\":\"^n\"},{\"do\":\"window\",\"title\":\"^Select a CPU\",\"timeoutMs\":0}]}]}," +
                "{\"do\":\"click\",\"find\":{\"type\":\"Button\",\"name\":\"^OK$\"}}]");
            new Runner(ui, 42, CancellationToken.None, _ => { }) { Version = "4.00" }.Run(steps);
            True(ui.Did.Contains("keys ^n") && ui.Did.Contains("press Select a CPU Module/OK"), string.Join(" | ", ui.Did));
            True(ui.Did.IndexOf("keys {ESC}") < ui.Did.IndexOf("keys ^n"), "the way that did not work is closed first: " + string.Join(" | ", ui.Did));
        });

        Test("runner: oneOf where nothing works says what it tried, in one sentence; Stop is not tried around", () =>
        {
            var ui = Click();
            ui.NoMenus = true;
            ui.Controls.Remove("Select a CPU Module");
            var steps = Plan("[{\"do\":\"window\",\"title\":\"^CLICK\"},{\"do\":\"oneOf\",\"what\":\"New project\",\"options\":[" +
                "{\"label\":\"File menu\",\"steps\":[{\"do\":\"menu\",\"path\":[\"File\",\"New Project\"]}]}," +
                "{\"label\":\"Ctrl+N\",\"steps\":[{\"do\":\"keys\",\"keys\":\"^n\"},{\"do\":\"window\",\"title\":\"^Select a CPU\",\"timeoutMs\":0}]}]}]");
            try { new Runner(ui, 42, CancellationToken.None, _ => { }) { Version = "4.00" }.Run(steps); throw new Exception("should fail"); }
            catch (BridgeError e) { Eq("CLICK 4.00: could not find New project (tried: File menu, Ctrl+N). Nothing was saved.", e.Message); }
            using (var cts = new CancellationTokenSource())
            {
                cts.Cancel();
                try { new Runner(ui, 42, cts.Token, _ => { }).Run(steps); throw new Exception("should stop"); }
                catch (BridgeError e) { True(e.Message.StartsWith("Stopped at step 1"), e.Message); }
            }
        });

        Test("runner: each window is recorded in the log the first time a step opens it; every window on a failure", () =>
        {
            var file = System.IO.Path.Combine(System.IO.Path.GetTempPath(), $"click-log-{Guid.NewGuid():N}.log");
            Log.Open(file);
            var ui = Click();
            new Runner(ui, 42, CancellationToken.None, _ => { }).Run(Plan("[{\"do\":\"window\",\"title\":\"^Select a CPU\"},{\"do\":\"window\",\"title\":\"^Select a CPU\"},{\"do\":\"click\",\"find\":{\"name\":\"^OK$\"}}]"));
            string text = System.IO.File.ReadAllText(file);
            Eq(1, System.Text.RegularExpressions.Regex.Matches(text, "controls of \"\\^Select a CPU\" \\(recorded").Count, "once: " + text);
            True(text.Contains("ComboBox \"CPU\" id=cboCpu"), text);
            Throws<BridgeError>(() => new Runner(ui, 42, CancellationToken.None, _ => { }).Run(Plan("[{\"do\":\"window\",\"title\":\"^Select a CPU\"},{\"do\":\"click\",\"find\":{\"name\":\"^Apply$\"}}]")));
            text = System.IO.File.ReadAllText(file);
            True(text.Contains("controls of \"CLICK Programming Software - [Untitled]\":") && text.Contains("controls of \"Select a CPU Module\":"), "every window on a failure: " + text);
        });

        Test("runner: a save step inside a oneOf is refused before the run", () =>
        {
            var ui = Click();
            var steps = Plan("[{\"do\":\"window\",\"title\":\"^CLICK\"},{\"do\":\"oneOf\",\"what\":\"x\",\"options\":[{\"label\":\"a\",\"steps\":[{\"do\":\"keys\",\"keys\":\"^s\"}]}]}]");
            try { new Runner(ui, 42, CancellationToken.None, _ => { }).Run(steps); throw new Exception("should refuse"); }
            catch (BridgeError e) { True(e.Message.Contains("never saves"), e.Message); }
            True(!ui.Did.Any(d => d.StartsWith("keys")), "nothing typed");
        });

        // CLICK 4.00, from a user's log: Ctrl+N opens "Startup" (three picture buttons without names; Start a new project is
        // the leftmost), and the CPU dialog opens inside it; the CPU list's entries are named by part number.
        const string Cpu = "^(Select a CPU|CPU Module|New Project|Select CPU)";
        string newProject(string cpu) => "[{\"do\":\"window\",\"title\":\"^CLICK\"},{\"do\":\"oneOf\",\"what\":\"New project\",\"options\":[" +
            "{\"label\":\"Ctrl+N\",\"steps\":[{\"do\":\"window\",\"title\":\"^CLICK\"},{\"do\":\"keys\",\"keys\":\"^n\"}," +
            "{\"do\":\"window\",\"title\":\"^Startup$|" + Cpu + "\",\"timeoutMs\":0}," +
            "{\"do\":\"click\",\"find\":{\"type\":\"Button\",\"name\":\"^(Start a new project)?$\",\"order\":\"left\"},\"timeoutMs\":0,\"optional\":true}," +
            "{\"do\":\"window\",\"title\":\"" + Cpu + "\",\"timeoutMs\":0}]}]}," +
            "{\"do\":\"click\",\"find\":{\"name\":\"^" + cpu + "\\\\b\"},\"say\":\"CPU\"},{\"do\":\"click\",\"find\":{\"name\":\"^OK$\",\"type\":\"Button\"}}]";
        FakeUi click4()
        {
            var ui = Click();
            ui.Controls.Remove("Select a CPU Module");
            ui.Controls["Navigation"] = new List<(string, string, string)> { ("", "Close", "Button") }; // a pane of CLICK, open before
            ui.KeysOpen["^n"] = "Startup";
            ui.Ready["Startup"] = new List<(string, string, string)> { ("b891", "", "Button"), ("b1035", "", "Button"), ("b747", "", "Button"), ("", "Close", "Button"), ("", "Help", "Button") };
            ui.Left["b891"] = 891; ui.Left["b1035"] = 1035; ui.Left["b747"] = 747;
            ui.PressOpens["Startup/b747"] = "Select a CPU Module";
            ui.Ready["Select a CPU Module"] = new List<(string, string, string)> { ("", "ALL", "ComboBox"), ("", "C0-00DD1-D", "ListItem"), ("", "C0-10DD1E-D", "ListItem"), ("", "C0-10DD2E-D", "ListItem"), ("", "OK", "Button"), ("", "Cancel", "Button"), ("", "Help", "Button") };
            return ui;
        }

        Test("runner (CLICK 4.00): Ctrl+N's Startup window → its leftmost button (Start a new project) → the CPU dialog inside it → the CPU → OK", () =>
        {
            var ui = click4();
            new Runner(ui, 42, CancellationToken.None, _ => { }) { Version = "4.00" }.Run(Plan(newProject("C0-10DD1E-D")));
            var did = string.Join(" | ", ui.Did);
            Eq("keys ^n | press Startup/b747 | press Select a CPU Module/C0-10DD1E-D | press Select a CPU Module/OK", did);
        });

        Test("runner (CLICK 3 or a CLICK 4 without Startup): the CPU dialog straight after Ctrl+N; no Startup button pressed", () =>
        {
            var ui = click4();
            ui.KeysOpen["^n"] = "Select a CPU Module";
            new Runner(ui, 42, CancellationToken.None, _ => { }) { Version = "4.00" }.Run(Plan(newProject("C0-10DD1E-D")));
            Eq("keys ^n | press Select a CPU Module/C0-10DD1E-D | press Select a CPU Module/OK", string.Join(" | ", ui.Did));
        });

        Test("runner: a run that fails closes the dialogs it opened, innermost first (Cancel, then Close); CLICK's own panes stay", () =>
        {
            var ui = click4();
            var e = Throws<BridgeError>(() => new Runner(ui, 42, CancellationToken.None, _ => { }) { Version = "4.00" }.Run(Plan(newProject("C0-99XX-D"))));
            True(e.Message.StartsWith("CLICK 4.00: could not do \"CPU\"") && e.Message.EndsWith("Nothing was saved."), e.Message);
            var did = string.Join(" | ", ui.Did);
            True(did.EndsWith("press Select a CPU Module/Cancel | press Startup/Close"), did);
            True(ui.Controls.ContainsKey("Navigation") && !ui.Controls.ContainsKey("Startup"), "the pane open before the run stays; the dialogs are gone");
        });

        Test("runner: Stop leaves CLICK as it is (no dialog closed): the user may keep what was entered", () =>
        {
            var ui = click4();
            using (var cts = new CancellationTokenSource())
            {
                var r = new Runner(ui, 42, cts.Token, s => { if (s.Contains("CPU")) cts.Cancel(); });
                Throws<BridgeError>(() => r.Run(Plan(newProject("C0-10DD1E-D").Replace("\"say\":\"CPU\"", "\"say\":\"CPU\"},{\"do\":\"note\",\"text\":\"x\""))));
                True(!ui.Did.Any(d => d.EndsWith("/Cancel") || d.EndsWith("/Close")), string.Join(" | ", ui.Did));
            }
        });

        Test("runner: CLICK behind the app (its button was just pressed) is brought to the front, no pause", () =>
        {
            var ui = Click(); var said = new List<string>();
            ui.Front = 7; ui.RaiseWorks = true;
            new Runner(ui, 42, CancellationToken.None, said.Add) { PollMs = 1 }.Run(Plan("[{\"do\":\"window\",\"title\":\"^CLICK\"},{\"do\":\"keys\",\"keys\":\"{ENTER}\"}]"));
            Eq(1, ui.Raised);
            True(!said.Any(x => x.StartsWith("Paused")), string.Join("|", said));
            Eq("keys {ENTER}", ui.Did.Single());
        });

        Test("commands: CLICK started through a launcher: its window is found in the CLICK process that has it; Startup alone counts", () =>
        {
            var pc = new FakePc().With(false, "{B}", "CLICK Programming Software Ver. 4.00", "4.00", @"C:\AD\Click4", @"C:\AD\Click4\CLICK.exe");
            var ui = Click();
            ui.StartPid = 41; ui.WindowsIn = 42;
            int calls = 0;
            ui.FrontAt = _ => 42;
            var output = new StringWriter();
            // CLICK is not running when start is asked; its process appears after the launcher
            var p = Commands.Register(new Protocol(output), new LaterPc(pc, () => ++calls > 1 ? new List<KeyValuePair<int, string>> { new KeyValuePair<int, string>(42, "CLICK Programming Software") } : new List<KeyValuePair<int, string>>()), ui);
            p.Run(new StringReader("{\"id\":1,\"cmd\":\"start\"}\n{\"id\":2,\"cmd\":\"quit\"}\n"), "test");
            var m = output.ToString().Split('\n').Where(l => l.Trim().Length > 0).Select(l => (Dictionary<string, object>)Json.Parse(l)).ToList();
            var st = (Dictionary<string, object>)m.Last(x => Equals(x.GetValueOrDefault("id"), 1.0) && x.ContainsKey("ok"))["result"];
            Eq(42.0, st["processId"]);
            True(ui.Did.Contains("show CLICK Programming Software - [Untitled]"), string.Join(" | ", ui.Did));

            ui = Click(); ui.Controls.Remove("CLICK Programming Software - [Untitled]"); ui.Controls["Startup"] = new List<(string, string, string)> { ("b", "", "Button") };
            output = new StringWriter();
            p = Commands.Register(new Protocol(output), pc, ui);
            p.Run(new StringReader("{\"id\":1,\"cmd\":\"start\"}\n{\"id\":2,\"cmd\":\"quit\"}\n"), "test");
            True(output.ToString().Contains("\"processId\":42"), output.ToString());
            True(ui.Raised == 1 && !ui.Did.Any(d => d.StartsWith("show")), "the Startup window alone is raised, not maximized");
        });

        Test("commands: a CLICK running without a window (closed, its process stayed): a new CLICK is started and used", () =>
        {
            var pc = new FakePc().With(false, "{B}", "CLICK Programming Software Ver. 4.00", "4.00", @"C:\AD\Click4", @"C:\AD\Click4\CLICK.exe");
            pc.Procs.Add(new KeyValuePair<int, string>(7, ""));
            var ui = Click();
            ui.WindowsIn = 42; ui.FrontAt = _ => 42;
            int was = Commands.AttachWaitSeconds; Commands.AttachWaitSeconds = 1;
            try
            {
                var output = new StringWriter();
                var p = Commands.Register(new Protocol(output), pc, ui);
                p.Run(new StringReader("{\"id\":1,\"cmd\":\"start\"}\n{\"id\":2,\"cmd\":\"quit\"}\n"), "test");
                True(output.ToString().Contains("\"processId\":42") && ui.Did.Contains("start C:\\AD\\Click4\\CLICK.exe"), output + " | " + string.Join(" | ", ui.Did));
            }
            finally { Commands.AttachWaitSeconds = was; }
        });

        Test("commands: a window closing while start reads CLICK's windows (CLICK still opening) is looked at again", () =>
        {
            var pc = new FakePc().With(false, "{B}", "CLICK Programming Software Ver. 4.00", "4.00", @"C:\AD\Click4", @"C:\AD\Click4\CLICK.exe");
            var ui = Click(); ui.WindowGoneTimes = 2; ui.FrontAt = _ => 42;
            var output = new StringWriter();
            Commands.Register(new Protocol(output), pc, ui).Run(new StringReader("{\"id\":1,\"cmd\":\"start\"}\n{\"id\":2,\"cmd\":\"quit\"}\n"), "test");
            True(output.ToString().Contains("\"processId\":42"), output.ToString());
        });

        Test("runner: a click step with mouse: a real mouse click, not UI Automation's press", () =>
        {
            var ui = Click();
            new Runner(ui, 42, CancellationToken.None, _ => { }).Run(Plan("[{\"do\":\"window\",\"title\":\"^Select a CPU\"},{\"do\":\"click\",\"find\":{\"type\":\"Button\",\"name\":\"^OK$\"},\"mouse\":true}]"));
            Eq("mouse Select a CPU Module/OK", ui.Did.Single());
        });

        Test("runner: a shot step saves a screenshot (into the shot folder; nothing without one)", () =>
        {
            var ui = Click();
            new Runner(ui, 42, CancellationToken.None, _ => { }) { ShotFolder = "C:\\x" }.Run(Plan("[{\"do\":\"shot\",\"text\":\"r1 after insert\"}]"));
            Eq("shot r1_after_insert.png", ui.Did.Single());
            ui = Click();
            new Runner(ui, 42, CancellationToken.None, _ => { }).Run(Plan("[{\"do\":\"shot\",\"text\":\"x\"}]"));
            Eq(0, ui.Did.Count);
        });

        Test("commands: no CLICK installed says how to get it; run before start says to open CLICK", () =>
        {
            var output = new StringWriter();
            var p = Commands.Register(new Protocol(output), new FakePc(), Click());
            p.Handle("{\"id\":1,\"cmd\":\"start\"}");
            p.Handle("{\"id\":2,\"cmd\":\"run\",\"args\":{\"steps\":[{\"do\":\"wait\",\"ms\":1}]}}");
            p.Handle("{\"id\":3,\"cmd\":\"detect\"}");
            var m = output.ToString().Split('\n').Where(l => l.Trim().Length > 0).Select(l => (Dictionary<string, object>)Json.Parse(l)).Where(x => x.ContainsKey("ok")).ToList();
            True(((string)m[0]["error"]).Contains("not installed"), (string)m[0]["error"]);
            Eq("Open CLICK first.", m[1]["error"]);
            Eq(false, ((Dictionary<string, object>)m[2]["result"])["ready"]);
        });

        Console.WriteLine($"ClickBridge tests: all passed ({_passed})");
        return 0;
    }
}
