// Runs a step plan (src/plc/click/clickPlan.ts) on CLICK Programming Software while the user watches:
//   - before every step that touches the keyboard or a control, CLICK must be the window in front: the run brings it
//     there itself (the user pressed the app's button, so the app is in front at the start); when that does not work
//     (the user clicked elsewhere) the run pauses (and says so) until CLICK is in front again;
//   - Stop (the app's button, or the Pause key anywhere) ends it before the next step;
//   - it never saves: a step that would (Ctrl+S, a Save menu or button) is refused;
//   - a step that fails names the step and writes the window's controls to the log (to correct the plan), and the
//     dialogs the run opened are closed (Cancel / Close): the user is never left with them;
//   - an optional step (a window that may not come, e.g. a confirmation) is skipped when it does not come;
//   - waitGone hands over to the user (e.g. "add these modules, then close the window") until a window closes;
//   - waitUser hands over until the user presses Continue in the app (a rung the app cannot enter: they type it);
//   - oneOf tries ways to do one thing in turn (CLICK 3 has a File menu, CLICK 4 a ribbon UI Automation cannot see:
//     the menu, then Ctrl+N, then the key tips), and says which it tried when none works;
//   - every window a step opens is recorded in the log the first time in a run (its controls), and every window on a failure,
//     so the log always has what is needed to fit the steps to the user's CLICK.
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using TiaBridge;

namespace ClickBridge
{
    public sealed class Step
    {
        /// <summary>window · menu · click · doubleClick · setText · select · check · keys · wait · note · waitGone · waitUser · shot</summary>
        public string Do;
        /// <summary>The step may not happen (its window or control does not come): then it, and the steps up to the next
        /// non-optional one, are skipped.</summary>
        public bool Optional;
        public string Title, Text, Item, Keys, Say;
        /// <summary>check: the box on (true) or off.</summary>
        public bool On = true;
        public List<string> Path;
        public Selector Find;
        /// <summary>oneOf: what it does ("New project"), and the ways to do it, tried in turn.</summary>
        public string What;
        public List<KeyValuePair<string, List<Step>>> Options;
        public int Ms;
        public int TimeoutMs = 15000;
        /// <summary>click: a real mouse click on it (CLICK's own dialogs' OK), not UI Automation's press.</summary>
        public bool Mouse;

        public static Step From(Dictionary<string, object> d)
        {
            string S(string k) => d.TryGetValue(k, out object v) ? v as string : null;
            int N(string k, int def) => d.TryGetValue(k, out object v) && v is double x ? (int)x : def;
            var s = new Step { Do = S("do"), Title = S("title"), Text = S("text"), Item = S("item"), Keys = S("keys"), Say = S("say"), Ms = N("ms", 0), TimeoutMs = N("timeoutMs", 15000), Optional = d.TryGetValue("optional", out object o) && o is bool b && b };
            if (d.TryGetValue("on", out object on) && on is bool bo) s.On = bo;
            s.Mouse = d.TryGetValue("mouse", out object mo) && mo is bool mb && mb;
            if (d.TryGetValue("path", out object p) && p is List<object> l) s.Path = l.OfType<string>().ToList();
            s.What = S("what");
            if (d.TryGetValue("options", out object opts) && opts is List<object> ol)
                s.Options = ol.OfType<Dictionary<string, object>>().Select(o => new KeyValuePair<string, List<Step>>(
                    o.TryGetValue("label", out object lb) ? lb as string ?? "" : "",
                    (o.TryGetValue("steps", out object st) && st is List<object> sl ? sl : new List<object>()).OfType<Dictionary<string, object>>().Select(From).ToList())).ToList();
            if (d.TryGetValue("find", out object f) && f is Dictionary<string, object> sel)
                s.Find = new Selector { Id = sel.TryGetValue("id", out object i) ? i as string : null, Name = sel.TryGetValue("name", out object n) ? n as string : null, Type = sel.TryGetValue("type", out object t) ? t as string : null, Index = sel.TryGetValue("index", out object x) && x is double dx ? (int)dx : 0, Order = sel.TryGetValue("order", out object ord) ? ord as string : null };
            return s;
        }

        public override string ToString() => Do switch
        {
            "window" => $"window \"{Title}\"",
            "waitGone" => $"until the window \"{Title}\" is closed",
            "waitUser" => $"the user's turn: {Text}",
            "menu" => $"menu {string.Join(" › ", Path ?? new List<string>())}",
            "keys" => $"keys {Keys}",
            "wait" => $"wait {Ms} ms",
            "note" => $"note {Text}",
            "oneOf" => $"{What} (one of: {string.Join(", ", (Options ?? new List<KeyValuePair<string, List<Step>>>()).Select(o => o.Key))})",
            _ => $"{Do} {Find}" + (Text != null ? $" \"{Text}\"" : "") + (Item != null ? $" → {Item}" : ""),
        };
    }

    public sealed class Runner
    {
        readonly IUi _ui;
        readonly int _pid;
        readonly CancellationToken _stop;
        readonly Action<string> _progress;
        readonly WaitHandle _resume;
        /// <summary>How long a run waits for the user to bring CLICK back to the front.</summary>
        public int PauseLimitMs = 10 * 60 * 1000;
        public int PollMs = 300;
        /// <summary>Where shot steps save their screenshots (shots\&lt;text&gt;.png); none: shot steps do nothing.</summary>
        public string ShotFolder;
        /// <summary>The CLICK version, for the messages ("CLICK 4.00: …").</summary>
        public string Version = "";
        string _window;
        /// <summary>The windows already recorded in the log in this run (each once per run).</summary>
        readonly HashSet<string> _recorded = new HashSet<string>();

        public Runner(IUi ui, int pid, CancellationToken stop, Action<string> progress, WaitHandle resume = null) { _ui = ui; _pid = pid; _stop = stop; _progress = progress; _resume = resume; }

        static readonly Regex SaveKeys = new Regex(@"\^\{?[sS]\}?|\{F12\}", RegexOptions.Compiled);
        static readonly Regex SaveName = new Regex(@"^\s*save\b", RegexOptions.IgnoreCase | RegexOptions.Compiled);

        /// <summary>Refuses a step that would save the project (the user saves, never the app).</summary>
        public static void Guard(Step s)
        {
            foreach (var o in s.Options ?? new List<KeyValuePair<string, List<Step>>>()) foreach (var x in o.Value) Guard(x);
            if (s.Do == "keys" && s.Keys != null && SaveKeys.IsMatch(s.Keys)) throw new BridgeError($"The plan has a step that would save the project ({s.Keys}); the app never saves for you.");
            if (s.Do == "menu" && s.Path != null && s.Path.Any(x => SaveName.IsMatch(x))) throw new BridgeError("The plan has a step that would save the project (a Save menu); the app never saves for you.");
            if ((s.Do == "click" || s.Do == "doubleClick" || s.Do == "select") && s.Find?.Name != null && SaveName.IsMatch(s.Find.Name.TrimStart('^'))) throw new BridgeError("The plan has a step that would press Save; the app never saves for you.");
        }

        public int Run(IList<Step> steps)
        {
            foreach (var s in steps) Guard(s);
            try { _before = new HashSet<string>(_ui.Windows(_pid)); } catch (Exception) { _before = new HashSet<string>(); }
            try { Exec(steps); }
            // Stop keeps CLICK as it is (the user may keep what was entered); a failure closes what the run opened
            catch (BridgeError e) when (!(e is StoppedError)) { CloseDialogs(); throw; }
            return steps.Count;
        }

        string Ver => string.IsNullOrEmpty(Version) ? "CLICK" : $"CLICK {Version}";

        void Exec(IList<Step> steps)
        {
            bool skipping = false;
            for (int i = 0; i < steps.Count; i++)
            {
                var s = steps[i];
                Stopped(i);
                if (skipping && s.Optional) { Log.Write($"step {i + 1} skipped (optional)"); continue; }
                skipping = false;
                if (s.Say != null) _progress($"{i + 1}/{steps.Count} {s.Say}");
                Log.Write($"step {i + 1}: {s}");
                try { Do(s, i); }
                catch (NotThere) when (s.Optional) { Log.Write($"step {i + 1}: not there, skipped (optional)"); skipping = true; }
                catch (NotThere e) { throw Fail(i, s, e.Message); }
                catch (StoppedError) { throw; }
                // an optional step whose control is there but does not take it (not a check box, no such item):
                // left as CLICK has it
                catch (Exception e) when (s.Optional) { Log.Write($"step {i + 1}: could not ({e.InnerException?.Message ?? e.Message}), skipped (optional)"); }
                catch (BridgeError) { throw; }
                catch (Exception e) { throw Fail(i, s, e.InnerException?.Message ?? e.Message); }
            }
        }

        /// <summary>The ways to do one thing, in turn; the first that works is kept. Stop ends it at once.</summary>
        void OneOf(Step s, int i)
        {
            var tried = new List<string>();
            foreach (var o in s.Options ?? new List<KeyValuePair<string, List<Step>>>())
            {
                Stopped(i);
                tried.Add(o.Key);
                try { Exec(o.Value); Log.Write($"{s.What}: done with {o.Key}"); return; }
                catch (StoppedError) { throw; }
                catch (Exception e)
                {
                    Log.Write($"{s.What}: {o.Key} did not work ({e.Message})");
                    RecordAll();
                    // close what the way that did not work may have opened (a dialog, a menu, the ribbon's key tips)
                    CloseDialogs();
                    var main = _ui.Window(_pid, MainTitle, 0);
                    if (main != null) { try { _ui.Keys(main, "{ESC}"); } catch (Exception) { /* nothing open */ } }
                }
            }
            throw new BridgeError($"{Ver}: could not find {s.What} (tried: {string.Join(", ", tried)}). Nothing was saved.");
        }

        /// <summary>CLICK's main window (the plans' CLICK_MAIN).</summary>
        const string MainTitle = "^CLICK Programming Software";
        static readonly Regex Main = new Regex(MainTitle, RegexOptions.IgnoreCase | RegexOptions.Compiled);

        /// <summary>The windows of CLICK open before the run (its own panes; a dialog the user had open): never closed.</summary>
        HashSet<string> _before = new HashSet<string>();

        /// <summary>Every dialog of CLICK the run opened (not open before it), innermost first, closed with its Cancel or Close
        /// button (never a save: a dialog that has neither stays). A run that fails leaves none for the user.</summary>
        void CloseDialogs()
        {
            IList<string> open;
            try { open = _ui.Windows(_pid); } catch (Exception) { return; }
            foreach (var t in open.Reverse().Where(t => !Main.IsMatch(t) && !_before.Contains(t)))
            {
                try
                {
                    var w = _ui.Window(_pid, "^" + Regex.Escape(t) + "$", 0);
                    var b = w == null ? null : _ui.Find(w, new Selector { Type = "Button", Name = "^Cancel$" }, 0) ?? _ui.Find(w, new Selector { Type = "Button", Name = "^Close$" }, 0);
                    if (b == null) continue;
                    Log.Write($"closing \"{t}\" (the run opened it)");
                    _ui.Invoke(b);
                    Thread.Sleep(PollMs);
                }
                catch (Exception e) { Log.Write($"could not close \"{t}\": {e.Message}"); }
            }
        }

        /// <summary>A window's controls into the log, the first time a step uses it.</summary>
        void Record(string window, string title)
        {
            if (!_recorded.Add(title)) return;
            try { Log.Write($"controls of \"{title}\" (recorded the first time it is used):\n" + _ui.Dump(window)); }
            catch (Exception e) { Log.Write($"could not record \"{title}\": {e.Message}"); }
        }

        /// <summary>Every window of CLICK (dialogs too) into the log: on a failure.</summary>
        void RecordAll()
        {
            foreach (var t in _ui.Windows(_pid))
            {
                try { var w = _ui.Window(_pid, "^" + Regex.Escape(t) + "$", 0); if (w != null) Log.Write($"controls of \"{t}\":\n" + _ui.Dump(w)); }
                catch (Exception e) { Log.Write($"could not record \"{t}\": {e.Message}"); }
            }
        }

        void Stopped(int i)
        {
            if (_stop.IsCancellationRequested) throw new StoppedError($"Stopped at step {i + 1}, as you asked. Nothing was saved: close CLICK without saving, or keep what was entered and save it yourself.");
        }

        /// <summary>Waits while another window is in front (the user is doing something else); stops on Stop.</summary>
        void Front(int i)
        {
            if (_ui.ForegroundProcess() == _pid) return;
            // the app's own window is in front when a run starts (its button was pressed): bring CLICK forward first
            try { _ui.Raise(_window); } catch (Exception e) { Log.Write($"could not bring CLICK to the front: {e.Message}"); }
            for (int t = 0; t < 1000 && _ui.ForegroundProcess() != _pid; t += 100) Thread.Sleep(Math.Min(100, PollMs));
            if (_ui.ForegroundProcess() == _pid) { Log.Write("brought CLICK to the front"); return; }
            _progress($"Paused: click on the CLICK window to go on (step {i + 1}). Press Stop to end.");
            Log.Write($"paused at step {i + 1}: CLICK is not in front");
            int waited = 0;
            while (_ui.ForegroundProcess() != _pid)
            {
                Stopped(i);
                if (waited >= PauseLimitMs) throw new BridgeError($"CLICK was not brought back to the front for {PauseLimitMs / 60000} minutes: stopped at step {i + 1}. Nothing was saved.");
                Thread.Sleep(PollMs);
                waited += PollMs;
            }
            Log.Write("resumed");
            _progress($"Going on (step {i + 1}).");
        }

        /// <summary>Stop (the app's button or the Pause key): ends the run, whatever way of a oneOf is being tried.</summary>
        sealed class StoppedError : BridgeError { public StoppedError(string m) : base(m) { } }

        /// <summary>A window or control a step needs did not come.</summary>
        sealed class NotThere : Exception { public NotThere(string m) : base(m) { } }

        static string Need(string what, Step s) => what ?? throw new NotThere(s.Do == "window" ? $"no CLICK window \"{s.Title}\" came" : $"no control {s.Find} in the window");

        void Do(Step s, int i)
        {
            switch (s.Do)
            {
                case "note": _progress(s.Text ?? ""); return;
                case "wait": Sleep(s.Ms, i); return;
                case "shot":
                    if (ShotFolder != null) _ui.Screenshot(System.IO.Path.Combine(ShotFolder, "shots", Regex.Replace(s.Text ?? $"step-{i + 1}", @"[^\w.-]+", "_") + ".png"));
                    return;
                case "window":
                    _window = Need(_ui.Window(_pid, s.Title, s.TimeoutMs), s);
                    Record(_window, s.Title);
                    return;
                case "oneOf": OneOf(s, i); return;
                case "waitGone": WaitGone(s, i); return;
                case "waitUser": WaitUser(s, i); return;
            }
            if (_window == null) throw new BridgeError($"Step {i + 1} ({s}): the plan names no window first.");
            Front(i);
            switch (s.Do)
            {
                case "menu": _ui.Menu(_window, s.Path ?? new List<string>()); break;
                case "keys": _ui.Keys(_window, s.Keys ?? ""); break;
                case "click":
                    var el = Need(_ui.Find(_window, s.Find, s.TimeoutMs), s);
                    if (s.Mouse) _ui.MouseClick(el); else _ui.Invoke(el);
                    break;
                case "doubleClick": _ui.DoubleClick(Need(_ui.Find(_window, s.Find, s.TimeoutMs), s)); break;
                case "setText": _ui.SetText(Need(_ui.Find(_window, s.Find, s.TimeoutMs), s), s.Text ?? ""); break;
                case "select": _ui.Select(Need(_ui.Find(_window, s.Find, s.TimeoutMs), s), s.Item ?? ""); break;
                case "check": _ui.Check(Need(_ui.Find(_window, s.Find, s.TimeoutMs), s), s.On); break;
                default: throw new BridgeError($"Step {i + 1}: the bridge cannot do \"{s.Do}\" (update the app).");
            }
        }

        /// <summary>The user's turn: waits (no time limit but the pause one) until no window like the title is open.</summary>
        void WaitGone(Step s, int i)
        {
            int waited = 0;
            while (_ui.Window(_pid, s.Title, 0) != null)
            {
                Stopped(i);
                if (waited >= PauseLimitMs) throw new BridgeError($"The window \"{s.Title}\" stayed open for {PauseLimitMs / 60000} minutes: stopped at step {i + 1}. Nothing was saved.");
                Thread.Sleep(PollMs);
                waited += PollMs;
            }
        }

        /// <summary>The user's turn until Continue (the app's "resume"); Stop still ends the run.</summary>
        void WaitUser(Step s, int i)
        {
            if (_resume == null) throw new BridgeError($"Step {i + 1} needs you, but this run cannot wait for you (update the app).");
            _progress($"Your turn: {s.Text ?? s.Say ?? "do this step in CLICK"} Then press Continue.");
            Log.Write($"step {i + 1}: waiting for the user");
            int waited = 0;
            while (!_resume.WaitOne(100))
            {
                Stopped(i);
                waited += 100;
                if (waited >= PauseLimitMs) throw new BridgeError($"Nobody pressed Continue for {PauseLimitMs / 60000} minutes: stopped at step {i + 1}. Nothing was saved.");
            }
            Log.Write("the user pressed Continue");
        }

        void Sleep(int ms, int i)
        {
            for (int t = 0; t < ms; t += 100) { Stopped(i); Thread.Sleep(Math.Min(100, ms - t)); }
        }

        /// <summary>A failed step: what it was, the windows open, and the window's controls in the log.</summary>
        BridgeError Fail(int i, Step s, string why)
        {
            string open = string.Join(", ", _ui.Windows(_pid).Select(w => $"\"{w}\""));
            Log.Write($"step {i + 1} ({s}) failed: {why}. Windows: {open}");
            RecordAll();
            // one plain sentence for the user; the details are in the log
            return new BridgeError($"{Ver}: could not {(s.Say != null ? $"do \"{s.Say}\"" : $"do step {i + 1}")} ({why}). Nothing was saved.");
        }
    }
}
