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

    /// <summary>A CLICK in memory: its windows and controls, what was done to it, who is in front.</summary>
    sealed class FakeUi : IUi
    {
        public List<string> Did = new List<string>();
        public Dictionary<string, List<(string id, string name, string type)>> Controls = new Dictionary<string, List<(string, string, string)>>();
        public int Front = 42;
        public Func<int, int> FrontAt;
        int _calls;
        public int Start(string exe) { Did.Add($"start {exe}"); return 42; }
        public IList<string> Windows(int pid) => Controls.Keys.ToList();
        public string Window(int pid, string title, int timeoutMs) => Controls.Keys.FirstOrDefault(w => System.Text.RegularExpressions.Regex.IsMatch(w, title, System.Text.RegularExpressions.RegexOptions.IgnoreCase));
        public string Find(string window, Selector sel, int timeoutMs)
        {
            var hits = Controls[window].Where(c => sel.Matches(c.id, c.name, c.type)).ToList();
            return hits.Count > sel.Index ? $"{window}/{hits[sel.Index].name}" : null;
        }
        public void Invoke(string el) => Did.Add($"press {el}");
        public void SetText(string el, string text) => Did.Add($"text {el}={text}");
        public void DoubleClick(string el) => Did.Add($"double {el}");
        public void Select(string el, string item) => Did.Add($"select {el}={item}");
        public void Menu(string window, IList<string> path) => Did.Add($"menu {string.Join(">", path)}");
        public void Keys(string window, string keys) => Did.Add($"keys {keys}");
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
            ui.FrontAt = (call) => call <= 3 ? 7 : 42; // the user is in another program for the first checks
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

        Test("runner: a control that is not there names the step, the windows open; nothing saved", () =>
        {
            var ui = Click();
            var e = Throws<BridgeError>(() => new Runner(ui, 42, CancellationToken.None, _ => { }).Run(Plan("[{\"do\":\"window\",\"title\":\"^Select a CPU\"},{\"do\":\"click\",\"find\":{\"name\":\"^Apply$\",\"type\":\"Button\"},\"say\":\"Apply the CPU\"}]")));
            True(e.Message.StartsWith("Step 2 (Apply the CPU) did not work: no control Button \"^Apply$\" in the window"), e.Message);
            True(e.Message.Contains("\"Select a CPU Module\"") && e.Message.Contains("Send us the log"), e.Message);
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
