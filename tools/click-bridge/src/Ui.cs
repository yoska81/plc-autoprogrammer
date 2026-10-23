// What the bridge does to CLICK Programming Software's windows, as an interface: the real one is Windows UI
// Automation (UiaUi.cs, on the PC); the tests use a fake. Elements are found by their UI Automation id, name and
// control type, as the app's step plans name them (src/plc/click/clickPlan.ts).
using System.Collections.Generic;
using System.Text.RegularExpressions;

namespace ClickBridge
{
    /// <summary>How a step names a control: any of its UI Automation id, its name (a pattern), its control type; the nth match.</summary>
    public sealed class Selector
    {
        public string Id;
        public string Name;
        public string Type;
        public int Index;
        /// <summary>"left": the matches counted left to right on the screen (CLICK 4's Startup buttons have no names).</summary>
        public string Order;

        public bool Matches(string id, string name, string type) =>
            (Id == null || id == Id) && (Type == null || string.Equals(type, Type, System.StringComparison.OrdinalIgnoreCase)) && (Name == null || Regex.IsMatch(name ?? "", Name, RegexOptions.IgnoreCase));

        public override string ToString() => string.Join(" ", new[] { Type, Id == null ? null : $"id={Id}", Name == null ? null : $"\"{Name}\"", Index > 0 ? $"#{Index}" : null, Order != null ? $"({Order}most)" : null }).Trim().Replace("  ", " ");
    }

    public interface IUi
    {
        /// <summary>Starts the program; returns its process id.</summary>
        int Start(string exe);
        /// <summary>The window of the process whose title matches, top-level or a dialog at any depth inside one (CLICK 4's CPU
        /// dialog opens inside its Startup window); its title, or "title [class]", matched; waits up to timeoutMs (0 = only
        /// now); null when none comes.</summary>
        string Window(int pid, string titlePattern, int timeoutMs);
        /// <summary>The control in the window (waits up to timeoutMs); null when none comes.</summary>
        string Find(string window, Selector sel, int timeoutMs);
        /// <summary>Presses a button, ticks a box, picks a list or menu item (by its pattern, else by a click on it).</summary>
        void Invoke(string element);
        void SetText(string element, string text);
        /// <summary>Sets a check box on or off (nothing when it already is).</summary>
        void Check(string element, bool on);
        /// <summary>A real mouse click on the control, as a user's (CLICK's own dialogs: a press through UI Automation's pattern
        /// did not take their OK as the user's).</summary>
        void MouseClick(string element);
        /// <summary>Double-clicks the control (an Instruction List entry opens its dialog that way).</summary>
        void DoubleClick(string element);
        /// <summary>Opens a combo box / list and picks the item whose name matches.</summary>
        void Select(string element, string itemPattern);
        /// <summary>Opens a menu path in the window's menu bar; each part is a pattern of the item's name ("File", "New Project", "Nick ?Names?").</summary>
        void Menu(string window, IList<string> path);
        /// <summary>Brings the window to the front and types keys (SendKeys syntax: {ENTER}, ^c …).</summary>
        void Keys(string window, string keys);
        /// <summary>The process id of the window in front.</summary>
        int ForegroundProcess();
        /// <summary>The window's controls as text, one per line, indented (for the log: how to name them in a plan).</summary>
        string Dump(string window);
        /// <summary>The titles of the process's windows: top-level ones and the dialogs inside them at any depth, outer first
        /// (to say what is open, to record them, to close what a failed run opened).</summary>
        IList<string> Windows(int pid);
        /// <summary>Restores the window (a minimized CLICK has no place on the screen to click), maximizes it, brings it to the front.</summary>
        void Show(string window);
        /// <summary>A screenshot of the whole screen into the file (a PNG): the record of a step while the keys are fitted.</summary>
        void Screenshot(string file);
        /// <summary>Brings the window to the front as it is (no maximize): a run started from the app finds the app in front.</summary>
        void Raise(string window);
    }
}
