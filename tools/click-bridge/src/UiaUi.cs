// IUi on the real PC: Windows UI Automation (System.Windows.Automation) on CLICK Programming Software's windows.
// Controls are found by their automation id, name and type; a control that offers no pattern to press is clicked
// at its clickable point (the coordinate fallback). Keys go through SendKeys to the window brought to the front.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows.Automation;
using TiaBridge;

namespace ClickBridge
{
    public sealed class UiaUi : IUi
    {
        readonly Dictionary<string, AutomationElement> _els = new Dictionary<string, AutomationElement>();
        int _next;

        string Keep(AutomationElement e) { string id = $"e{++_next}"; _els[id] = e; return id; }
        AutomationElement El(string id) => _els.TryGetValue(id, out var e) ? e : throw new BridgeError("A CLICK window closed while the app was using it.");

        public int Start(string exe)
        {
            var p = Process.Start(new ProcessStartInfo(exe) { UseShellExecute = true, WorkingDirectory = System.IO.Path.GetDirectoryName(exe) });
            p.WaitForInputIdle(60000);
            return p.Id;
        }

        static IEnumerable<AutomationElement> TopWindows(int pid) =>
            AutomationElement.RootElement.FindAll(TreeScope.Children, new PropertyCondition(AutomationElement.ProcessIdProperty, pid)).Cast<AutomationElement>();

        public IList<string> Windows(int pid) => TopWindows(pid).Select(w => w.Current.Name).ToList();

        public string Window(int pid, string titlePattern, int timeoutMs)
        {
            var rx = new Regex(titlePattern ?? "", RegexOptions.IgnoreCase);
            var until = DateTime.UtcNow.AddMilliseconds(timeoutMs);
            do
            {
                // a dialog may be a child of the main window rather than a top-level window
                foreach (var w in TopWindows(pid))
                {
                    if (rx.IsMatch(w.Current.Name)) return Keep(w);
                    var child = w.FindAll(TreeScope.Children, new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Window)).Cast<AutomationElement>().FirstOrDefault(c => rx.IsMatch(c.Current.Name));
                    if (child != null) return Keep(child);
                }
                Thread.Sleep(250);
            } while (DateTime.UtcNow < until);
            return null;
        }

        public string Find(string window, Selector sel, int timeoutMs)
        {
            var root = El(window);
            var until = DateTime.UtcNow.AddMilliseconds(timeoutMs);
            do
            {
                var all = root.FindAll(TreeScope.Descendants, Condition.TrueCondition).Cast<AutomationElement>()
                    .Where(e => sel.Matches(e.Current.AutomationId, e.Current.Name, e.Current.ControlType.ProgrammaticName.Replace("ControlType.", "")))
                    .ToList();
                if (all.Count > sel.Index) return Keep(all[sel.Index]);
                Thread.Sleep(250);
            } while (DateTime.UtcNow < until);
            return null;
        }

        public void Invoke(string element)
        {
            var e = El(element);
            Log.Write($"ui press {Describe(e)}");
            if (e.TryGetCurrentPattern(InvokePattern.Pattern, out object p)) { ((InvokePattern)p).Invoke(); return; }
            if (e.TryGetCurrentPattern(SelectionItemPattern.Pattern, out p)) { ((SelectionItemPattern)p).Select(); return; }
            if (e.TryGetCurrentPattern(TogglePattern.Pattern, out p)) { ((TogglePattern)p).Toggle(); return; }
            if (e.TryGetCurrentPattern(ExpandCollapsePattern.Pattern, out p)) { ((ExpandCollapsePattern)p).Expand(); return; }
            Click(e);
        }

        public void DoubleClick(string element)
        {
            var e = El(element);
            Log.Write($"ui double-click {Describe(e)}");
            Click(e);
            Thread.Sleep(60);
            mouse_event(0x0002, 0, 0, 0, UIntPtr.Zero);
            mouse_event(0x0004, 0, 0, 0, UIntPtr.Zero);
        }

        public void SetText(string element, string text)
        {
            var e = El(element);
            Log.Write($"ui text {Describe(e)} = \"{text}\"");
            if (e.TryGetCurrentPattern(ValuePattern.Pattern, out object p) && !((ValuePattern)p).Current.IsReadOnly) { ((ValuePattern)p).SetValue(text); return; }
            e.SetFocus();
            System.Windows.Forms.SendKeys.SendWait("^a" + Escape(text));
        }

        public void Select(string element, string itemPattern)
        {
            var e = El(element);
            Log.Write($"ui select {Describe(e)} → {itemPattern}");
            if (e.TryGetCurrentPattern(ExpandCollapsePattern.Pattern, out object ec)) { ((ExpandCollapsePattern)ec).Expand(); Thread.Sleep(200); }
            var rx = new Regex(itemPattern, RegexOptions.IgnoreCase);
            var item = e.FindAll(TreeScope.Descendants, new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.ListItem)).Cast<AutomationElement>().FirstOrDefault(x => rx.IsMatch(x.Current.Name))
                ?? throw new BridgeError($"\"{e.Current.Name}\" has no item like \"{itemPattern}\".");
            if (item.TryGetCurrentPattern(SelectionItemPattern.Pattern, out object si)) ((SelectionItemPattern)si).Select(); else Click(item);
            if (e.TryGetCurrentPattern(ExpandCollapsePattern.Pattern, out ec)) { try { ((ExpandCollapsePattern)ec).Collapse(); } catch (InvalidOperationException) { /* closed by the pick */ } }
        }

        public void Menu(string window, IList<string> path)
        {
            var w = El(window);
            Log.Write($"ui menu {string.Join(" > ", path)}");
            int pid = w.Current.ProcessId;
            AutomationElement scope = w;
            for (int i = 0; i < path.Count; i++)
            {
                // each part is a pattern of the item's name (without its & and ending dots): "Nick ?Names?"
                var rx = new Regex("^(?:" + path[i] + @")(\.\.\.|…)?$", RegexOptions.IgnoreCase);
                AutomationElement item = null;
                var until = DateTime.UtcNow.AddSeconds(5);
                while (item == null && DateTime.UtcNow < until)
                {
                    // a menu that opens is its own window: look in the window, then in every window of CLICK
                    item = new[] { scope }.Concat(TopWindows(pid)).SelectMany(s => s.FindAll(TreeScope.Descendants, new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.MenuItem)).Cast<AutomationElement>())
                        .FirstOrDefault(m => rx.IsMatch(m.Current.Name.Replace("&", "")));
                    if (item == null) Thread.Sleep(200);
                }
                if (item == null) throw new BridgeError($"CLICK has no menu \"{string.Join(" › ", path.Take(i + 1))}\".");
                if (i < path.Count - 1 && item.TryGetCurrentPattern(ExpandCollapsePattern.Pattern, out object ec)) ((ExpandCollapsePattern)ec).Expand();
                else if (item.TryGetCurrentPattern(InvokePattern.Pattern, out object inv)) ((InvokePattern)inv).Invoke();
                else Click(item);
                scope = item;
                Thread.Sleep(150);
            }
        }

        public void Keys(string window, string keys)
        {
            var w = El(window);
            Log.Write($"ui keys {keys}");
            SetForegroundWindow(new IntPtr(w.Current.NativeWindowHandle));
            Thread.Sleep(100);
            System.Windows.Forms.SendKeys.SendWait(keys);
        }

        public int ForegroundProcess()
        {
            GetWindowThreadProcessId(GetForegroundWindow(), out uint pid);
            return (int)pid;
        }

        public string Dump(string window)
        {
            var b = new StringBuilder();
            void Walk(AutomationElement e, int depth)
            {
                if (depth > 8) return;
                b.Append(' ', depth * 2).AppendLine(Describe(e));
                foreach (AutomationElement c in e.FindAll(TreeScope.Children, Condition.TrueCondition)) Walk(c, depth + 1);
            }
            Walk(El(window), 0);
            return b.ToString();
        }

        static string Describe(AutomationElement e)
        {
            var c = e.Current;
            var r = c.BoundingRectangle;
            return $"{c.ControlType.ProgrammaticName.Replace("ControlType.", "")} \"{c.Name}\" id={c.AutomationId} class={c.ClassName} [{(int)r.X},{(int)r.Y},{(int)r.Width}x{(int)r.Height}]";
        }

        /// <summary>The coordinate fallback: a mouse click on the control's clickable point.</summary>
        static void Click(AutomationElement e)
        {
            Log.Write($"ui click at the point of {Describe(e)}");
            var pt = e.TryGetClickablePoint(out System.Windows.Point p) ? p : new System.Windows.Point(e.Current.BoundingRectangle.X + e.Current.BoundingRectangle.Width / 2, e.Current.BoundingRectangle.Y + e.Current.BoundingRectangle.Height / 2);
            SetCursorPos((int)pt.X, (int)pt.Y);
            mouse_event(0x0002, 0, 0, 0, UIntPtr.Zero);
            mouse_event(0x0004, 0, 0, 0, UIntPtr.Zero);
        }

        /// <summary>Text typed as it is (SendKeys treats + ^ % ~ ( ) { } [ ] as keys).</summary>
        public static string Escape(string text) => Regex.Replace(text, @"[+^%~(){}\[\]]", m => "{" + m.Value + "}");

        [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
        [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr hWnd);
        [DllImport("user32.dll")] static extern bool SetCursorPos(int x, int y);
        [DllImport("user32.dll")] static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extra);
    }
}
