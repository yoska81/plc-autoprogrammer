// Runs a step plan (src/plc/click/clickPlan.ts) on CLICK Programming Software while the user watches:
//   - before every step that touches the keyboard or a control, CLICK must be the window in front; when the user
//     clicks elsewhere the run pauses (and says so) until CLICK is in front again;
//   - Stop (the app's button, or the Pause key anywhere) ends it before the next step;
//   - it never saves: a step that would (Ctrl+S, a Save menu or button) is refused;
//   - a step that fails names the step and writes the window's controls to the log (to correct the plan);
//   - an optional step (a window that may not come, e.g. a confirmation) is skipped when it does not come;
//   - waitGone hands over to the user (e.g. "add these modules, then close the window") until a window closes;
//   - waitUser hands over until the user presses Continue in the app (a rung the app cannot enter: they type it).
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
        /// <summary>window · menu · click · doubleClick · setText · select · keys · wait · note · waitGone · waitUser</summary>
        public string Do;
        /// <summary>The step may not happen (its window or control does not come): then it, and the steps up to the next
        /// non-optional one, are skipped.</summary>
        public bool Optional;
        public string Title, Text, Item, Keys, Say;
        public List<string> Path;
        public Selector Find;
        public int Ms;
        public int TimeoutMs = 15000;

        public static Step From(Dictionary<string, object> d)
        {
            string S(string k) => d.TryGetValue(k, out object v) ? v as string : null;
            int N(string k, int def) => d.TryGetValue(k, out object v) && v is double x ? (int)x : def;
            var s = new Step { Do = S("do"), Title = S("title"), Text = S("text"), Item = S("item"), Keys = S("keys"), Say = S("say"), Ms = N("ms", 0), TimeoutMs = N("timeoutMs", 15000), Optional = d.TryGetValue("optional", out object o) && o is bool b && b };
            if (d.TryGetValue("path", out object p) && p is List<object> l) s.Path = l.OfType<string>().ToList();
            if (d.TryGetValue("find", out object f) && f is Dictionary<string, object> sel)
                s.Find = new Selector { Id = sel.TryGetValue("id", out object i) ? i as string : null, Name = sel.TryGetValue("name", out object n) ? n as string : null, Type = sel.TryGetValue("type", out object t) ? t as string : null, Index = sel.TryGetValue("index", out object x) && x is double dx ? (int)dx : 0 };
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
        string _window;

        public Runner(IUi ui, int pid, CancellationToken stop, Action<string> progress, WaitHandle resume = null) { _ui = ui; _pid = pid; _stop = stop; _progress = progress; _resume = resume; }

        static readonly Regex SaveKeys = new Regex(@"\^\{?[sS]\}?|\{F12\}", RegexOptions.Compiled);
        static readonly Regex SaveName = new Regex(@"^\s*save\b", RegexOptions.IgnoreCase | RegexOptions.Compiled);

        /// <summary>Refuses a step that would save the project (the user saves, never the app).</summary>
        public static void Guard(Step s)
        {
            if (s.Do == "keys" && s.Keys != null && SaveKeys.IsMatch(s.Keys)) throw new BridgeError($"The plan has a step that would save the project ({s.Keys}); the app never saves for you.");
            if (s.Do == "menu" && s.Path != null && s.Path.Any(x => SaveName.IsMatch(x))) throw new BridgeError("The plan has a step that would save the project (a Save menu); the app never saves for you.");
            if ((s.Do == "click" || s.Do == "doubleClick" || s.Do == "select") && s.Find?.Name != null && SaveName.IsMatch(s.Find.Name.TrimStart('^'))) throw new BridgeError("The plan has a step that would press Save; the app never saves for you.");
        }

        public int Run(IList<Step> steps)
        {
            foreach (var s in steps) Guard(s);
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
                catch (BridgeError) { throw; }
                catch (Exception e) { throw Fail(i, s, e.InnerException?.Message ?? e.Message); }
            }
            return steps.Count;
        }

        void Stopped(int i)
        {
            if (_stop.IsCancellationRequested) throw new BridgeError($"Stopped at step {i + 1}, as you asked. Nothing was saved: close CLICK without saving, or keep what was entered and save it yourself.");
        }

        /// <summary>Waits while another window is in front (the user is doing something else); stops on Stop.</summary>
        void Front(int i)
        {
            if (_ui.ForegroundProcess() == _pid) return;
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

        /// <summary>A window or control a step needs did not come.</summary>
        sealed class NotThere : Exception { public NotThere(string m) : base(m) { } }

        static string Need(string what, Step s) => what ?? throw new NotThere(s.Do == "window" ? $"no CLICK window \"{s.Title}\" came" : $"no control {s.Find} in the window");

        void Do(Step s, int i)
        {
            switch (s.Do)
            {
                case "note": _progress(s.Text ?? ""); return;
                case "wait": Sleep(s.Ms, i); return;
                case "window":
                    _window = Need(_ui.Window(_pid, s.Title, s.TimeoutMs), s);
                    return;
                case "waitGone": WaitGone(s, i); return;
                case "waitUser": WaitUser(s, i); return;
            }
            if (_window == null) throw new BridgeError($"Step {i + 1} ({s}): the plan names no window first.");
            Front(i);
            switch (s.Do)
            {
                case "menu": _ui.Menu(_window, s.Path ?? new List<string>()); break;
                case "keys": _ui.Keys(_window, s.Keys ?? ""); break;
                case "click": _ui.Invoke(Need(_ui.Find(_window, s.Find, s.TimeoutMs), s)); break;
                case "doubleClick": _ui.DoubleClick(Need(_ui.Find(_window, s.Find, s.TimeoutMs), s)); break;
                case "setText": _ui.SetText(Need(_ui.Find(_window, s.Find, s.TimeoutMs), s), s.Text ?? ""); break;
                case "select": _ui.Select(Need(_ui.Find(_window, s.Find, s.TimeoutMs), s), s.Item ?? ""); break;
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
            Log.Write($"step {i + 1} failed: {why}. Windows: {open}");
            if (_window != null) { try { Log.Write("controls of the window:\n" + _ui.Dump(_window)); } catch (Exception e) { Log.Write($"could not list the controls: {e.Message}"); } }
            return new BridgeError($"Step {i + 1} ({s.Say ?? s.ToString()}) did not work: {why}. Open in CLICK: {(open.Length > 0 ? open : "no window")}. Nothing was saved. Send us the log (its path is shown below) so we can fit the steps to your CLICK version.");
        }
    }
}
