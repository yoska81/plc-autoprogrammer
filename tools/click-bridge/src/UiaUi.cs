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

        static readonly Condition IsWindow = new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Window);

        /// <summary>The process's windows: each top-level one, then the dialogs inside it at any depth (CLICK 4: main →
        /// Startup → Select a CPU Module), outer first (the tree's order).</summary>
        static IEnumerable<AutomationElement> AllWindows(int pid) =>
            TopWindows(pid).SelectMany(w => new[] { w }.Concat(w.FindAll(TreeScope.Descendants, IsWindow).Cast<AutomationElement>()));

        public IList<string> Windows(int pid)
        {
            // a window may close while it is read (CLICK starting: its splash, its guide): read again
            for (int i = 0; ; i++)
            {
                try { return AllWindows(pid).Select(w => w.Current.Name).ToList(); }
                catch (ElementNotAvailableException) when (i < 5) { Thread.Sleep(200); }
            }
        }

        public void Show(string window)
        {
            var w = El(window);
            var h = new IntPtr(w.Current.NativeWindowHandle);
            Log.Write($"ui show {Describe(w)}");
            if (h == IntPtr.Zero) return;
            if (IsIconic(h)) ShowWindow(h, 9 /* SW_RESTORE */);
            ShowWindow(h, 3 /* SW_MAXIMIZE */);
            ToFront(h);
            Thread.Sleep(300);
        }

        public void Raise(string window)
        {
            var w = El(window);
            var h = new IntPtr(w.Current.NativeWindowHandle);
            Log.Write($"ui raise {Describe(w)}");
            if (h == IntPtr.Zero) { w.SetFocus(); return; }
            if (IsIconic(h)) ShowWindow(h, 9 /* SW_RESTORE */);
            ToFront(h);
        }

        /// <summary>SetForegroundWindow, past Windows' rule that only the program in front may give the front away: the
        /// bridge joins the input of the window in front (the app's, whose button was just pressed) for the call.</summary>
        static void ToFront(IntPtr h)
        {
            uint front = GetWindowThreadProcessId(GetForegroundWindow(), out _);
            uint me = GetCurrentThreadId();
            bool joined = front != 0 && front != me && AttachThreadInput(me, front, true);
            try { BringWindowToTop(h); SetForegroundWindow(h); }
            finally { if (joined) AttachThreadInput(me, front, false); }
        }

        /// <summary>A window's title, or its title and class as "Title [class]": two windows called "Print" (CLICK's
        /// and Windows' printer dialog, class #32770) told apart.</summary>
        static bool Titled(Regex rx, AutomationElement w) => rx.IsMatch(w.Current.Name) || rx.IsMatch($"{w.Current.Name} [{w.Current.ClassName}]");

        public string Window(int pid, string titlePattern, int timeoutMs)
        {
            var rx = new Regex(titlePattern ?? "", RegexOptions.IgnoreCase);
            var until = DateTime.UtcNow.AddMilliseconds(timeoutMs);
            do
            {
                // a dialog may be inside the main window rather than top-level, even inside another dialog
                // a window may close while it is read (CLICK starting: its splash, its guide): look again
                try
                {
                    var w = AllWindows(pid).FirstOrDefault(x => Titled(rx, x));
                    if (w != null) return Keep(w);
                }
                catch (ElementNotAvailableException) { Log.Write("ui: a window closed while it was read; looking again"); }
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
                List<AutomationElement> all;
                try
                {
                    all = root.FindAll(TreeScope.Descendants, Condition.TrueCondition).Cast<AutomationElement>()
                        .Where(e => sel.Matches(e.Current.AutomationId, e.Current.Name, e.Current.ControlType.ProgrammaticName.Replace("ControlType.", "")))
                        .ToList();
                }
                catch (ElementNotAvailableException) { all = new List<AutomationElement>(); } // a control went while read: look again
                if (sel.Order == "left") all = all.OrderBy(e => e.Current.BoundingRectangle.X).ThenBy(e => e.Current.BoundingRectangle.Y).ToList();
                if (all.Count > sel.Index) return Keep(all[sel.Index]);
                // not in UI Automation's tree (CLICK 4's Print dialog: a tab page's controls): the window's child
                // windows by their text
                var hw = sel.Name != null && sel.Id == null && sel.Index == 0 ? ChildByText(root, sel.Name) : null;
                if (hw != null) return Keep(hw);
                Thread.Sleep(250);
            } while (DateTime.UtcNow < until);
            return null;
        }

        public void Invoke(string element)
        {
            var e = El(element);
            Log.Write($"ui press {Describe(e)}");
            if (e.Current.ControlType == ControlType.ListItem) { PickItem(e); return; }
            if (e.TryGetCurrentPattern(InvokePattern.Pattern, out object p)) { ((InvokePattern)p).Invoke(); return; }
            if (e.TryGetCurrentPattern(SelectionItemPattern.Pattern, out p)) { ((SelectionItemPattern)p).Select(); return; }
            if (e.TryGetCurrentPattern(TogglePattern.Pattern, out p)) { ((TogglePattern)p).Toggle(); return; }
            if (e.TryGetCurrentPattern(ExpandCollapsePattern.Pattern, out p)) { ((ExpandCollapsePattern)p).Expand(); return; }
            Click(e);
        }

        /// <summary>A list entry (CLICK's CPU list): shown, then clicked like a user does, so the dialog sees the pick (selecting
        /// it through UI Automation alone does not tell a Delphi list box's OnClick); checked selected after.</summary>
        static void PickItem(AutomationElement e)
        {
            Shown(e);
            e.TryGetCurrentPattern(SelectionItemPattern.Pattern, out object si);
            if (e.TryGetClickablePoint(out System.Windows.Point _)) Click(e);
            else if (si != null) ((SelectionItemPattern)si).Select();
            else throw new BridgeError($"\"{e.Current.Name}\" cannot be picked.");
            Thread.Sleep(200);
            if (si != null && !((SelectionItemPattern)si).Current.IsSelected)
            {
                ((SelectionItemPattern)si).Select();
                Thread.Sleep(100);
                if (!((SelectionItemPattern)si).Current.IsSelected) throw new BridgeError($"\"{e.Current.Name}\" did not get picked in the list.");
            }
            Log.Write($"ui picked \"{e.Current.Name}\"");
        }

        public void Check(string element, bool on)
        {
            var e = El(element);
            if (!e.TryGetCurrentPattern(TogglePattern.Pattern, out object p))
            {
                // a check box UI Automation does not know as one (a Delphi TCheckBox found by its window): Windows'
                // button messages, read and clicked as the box's own click
                var h = new IntPtr(e.Current.NativeWindowHandle);
                if (h == IntPtr.Zero) throw new BridgeError($"\"{e.Current.Name}\" is not a check box.");
                for (int i = 0; i < 2 && (SendMessage(h, 0x00F0 /* BM_GETCHECK */, IntPtr.Zero, IntPtr.Zero) == new IntPtr(1)) != on; i++)
                {
                    SendMessage(h, 0x00F5 /* BM_CLICK */, IntPtr.Zero, IntPtr.Zero);
                    Thread.Sleep(150);
                }
                Log.Write($"ui check (window) {Describe(e)} = {(SendMessage(h, 0x00F0, IntPtr.Zero, IntPtr.Zero) == new IntPtr(1) ? "on" : "off")}");
                return;
            }
            var t = (TogglePattern)p;
            for (int i = 0; i < 3 && (t.Current.ToggleState == ToggleState.On) != on; i++) t.Toggle();
            Log.Write($"ui check {Describe(e)} = {(on ? "on" : "off")}");
        }

        public void Screenshot(string file)
        {
            var b = System.Windows.Forms.SystemInformation.VirtualScreen;
            using (var bmp = new System.Drawing.Bitmap(b.Width, b.Height))
            {
                using (var g = System.Drawing.Graphics.FromImage(bmp)) g.CopyFromScreen(b.Left, b.Top, 0, 0, bmp.Size);
                System.IO.Directory.CreateDirectory(System.IO.Path.GetDirectoryName(file));
                bmp.Save(file, System.Drawing.Imaging.ImageFormat.Png);
            }
            Log.Write($"ui screenshot {file}");
        }

        public void MouseClick(string element)
        {
            var e = El(element);
            Log.Write($"ui mouse-click {Describe(e)}");
            Click(e);
            Thread.Sleep(150);
        }

        public void DoubleClick(string element)
        {
            var e = El(element);
            Log.Write($"ui double-click {Describe(e)}");
            Shown(e);
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
            ToFront(new IntPtr(w.Current.NativeWindowHandle));
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
        /// <summary>A list entry scrolled into its list's view, if the list scrolls.</summary>
        static void Shown(AutomationElement e)
        {
            if (e.TryGetCurrentPattern(ScrollItemPattern.Pattern, out object sc)) { try { ((ScrollItemPattern)sc).ScrollIntoView(); Thread.Sleep(100); } catch (InvalidOperationException) { /* already shown */ } }
        }

        static void Click(AutomationElement e)
        {
            Log.Write($"ui click at the point of {Describe(e)}");
            var r = e.Current.BoundingRectangle;
            var pt = e.TryGetClickablePoint(out System.Windows.Point p) ? p : new System.Windows.Point(r.X + r.Width / 2, r.Y + r.Height / 2);
            // an entry half under its list's edge (CLICK's Instruction List, "End" at the bottom): its shown part, never
            // the edge (a double-click there undocked the list)
            try
            {
                var parent = TreeWalker.ControlViewWalker.GetParent(e);
                var box = parent == null ? System.Windows.Rect.Empty : parent.Current.BoundingRectangle;
                if (!box.IsEmpty && box.Width > 0 && !box.Contains(pt))
                {
                    var shown = System.Windows.Rect.Intersect(r, box);
                    if (!shown.IsEmpty && shown.Height >= 2) pt = new System.Windows.Point(shown.X + shown.Width / 2, shown.Y + shown.Height / 2);
                }
            }
            catch (ElementNotAvailableException) { /* clicked where it was */ }
            SetCursorPos((int)pt.X, (int)pt.Y);
            mouse_event(0x0002, 0, 0, 0, UIntPtr.Zero);
            mouse_event(0x0004, 0, 0, 0, UIntPtr.Zero);
        }

        /// <summary>Text typed as it is (SendKeys treats + ^ % ~ ( ) { } [ ] as keys).</summary>
        public static string Escape(string text) => Regex.Replace(text, @"[+^%~(){}\[\]]", m => "{" + m.Value + "}");

        /// <summary>A child window (any depth) of the element's window whose text matches, as an element.</summary>
        static AutomationElement ChildByText(AutomationElement root, string pattern)
        {
            var top = new IntPtr(root.Current.NativeWindowHandle);
            if (top == IntPtr.Zero) return null;
            var rx = new Regex(pattern, RegexOptions.IgnoreCase);
            IntPtr found = IntPtr.Zero;
            EnumChildWindows(top, (h, _) =>
            {
                var sb = new StringBuilder(256);
                GetWindowText(h, sb, sb.Capacity);
                if (IsWindowVisible(h) && sb.Length > 0 && rx.IsMatch(sb.ToString())) { found = h; return false; }
                return true;
            }, IntPtr.Zero);
            if (found == IntPtr.Zero) return null;
            try { return AutomationElement.FromHandle(found); } catch (ElementNotAvailableException) { return null; }
        }

        delegate bool EnumProc(IntPtr h, IntPtr l);
        [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr parent, EnumProc f, IntPtr l);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder sb, int max);
        [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
        [DllImport("user32.dll")] static extern IntPtr SendMessage(IntPtr h, uint msg, IntPtr w, IntPtr l);
        [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
        [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr hWnd);
        [DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr hWnd);
        [DllImport("user32.dll")] static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool attach);
        [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
        [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr hWnd, int cmd);
        [DllImport("user32.dll")] static extern bool IsIconic(IntPtr hWnd);
        [DllImport("user32.dll")] static extern bool SetCursorPos(int x, int y);
        [DllImport("user32.dll")] static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extra);
    }
}
