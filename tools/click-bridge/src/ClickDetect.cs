// Where CLICK Programming Software is: the Windows "installed programs" entries (Uninstall keys, 64- and 32-bit
// views) whose name starts with "CLICK Programming Software", with their version and install folder, and the
// program in that folder. AutomationDirect documents no other way to find it.
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;

namespace ClickBridge
{
    /// <summary>The parts of the PC detect reads (faked in the tests).</summary>
    public interface IPc
    {
        /// <summary>Subkey names of an HKLM key (64-bit view, or the 32-bit view with wow32).</summary>
        string[] SubKeys(string path, bool wow32);
        string Value(string path, string name, bool wow32);
        /// <summary>The .exe files directly in a folder (empty when it is missing).</summary>
        string[] Programs(string folder);
        /// <summary>Running processes of a program file: (process id, main window title).</summary>
        IList<KeyValuePair<int, string>> Running(string exePath);
        /// <summary>Running processes whose name or main window title matches: (process id, main window title).</summary>
        IList<KeyValuePair<int, string>> Matching(string pattern);
    }

    public sealed class ClickInstall
    {
        public string Name, Version, Folder, Exe;
    }

    public static class ClickDetect
    {
        public const string Uninstall = @"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall";
        static readonly Regex Product = new Regex(@"^CLICK Programming Software", RegexOptions.IgnoreCase);

        /// <summary>Every CLICK Programming Software installed, newest version first.</summary>
        public static List<ClickInstall> Find(IPc pc)
        {
            var found = new List<ClickInstall>();
            foreach (bool wow in new[] { false, true })
                foreach (string key in pc.SubKeys(Uninstall, wow))
                {
                    string path = $@"{Uninstall}\{key}";
                    string name = pc.Value(path, "DisplayName", wow);
                    if (name == null || !Product.IsMatch(name)) continue;
                    string folder = pc.Value(path, "InstallLocation", wow);
                    string icon = pc.Value(path, "DisplayIcon", wow);
                    if (string.IsNullOrEmpty(folder) && !string.IsNullOrEmpty(icon)) { string f = icon.Split(',')[0].Trim('"'); folder = f.Substring(0, Math.Max(0, f.LastIndexOfAny(Seps))); }
                    if (string.IsNullOrEmpty(folder)) continue;
                    var exes = pc.Programs(folder);
                    // the program itself: CLICK*.exe, not an uninstaller or updater
                    string exe = exes.FirstOrDefault(e => Regex.IsMatch(FileName(e), @"^click.*\.exe$", RegexOptions.IgnoreCase) && !Regex.IsMatch(FileName(e), "unins|update|setup", RegexOptions.IgnoreCase));
                    if (exe == null) continue;
                    if (found.Any(f => string.Equals(f.Exe, exe, StringComparison.OrdinalIgnoreCase))) continue;
                    found.Add(new ClickInstall { Name = name, Version = pc.Value(path, "DisplayVersion", wow) ?? "", Folder = folder, Exe = exe });
                }
            found.Sort((a, b) => Compare(b.Version, a.Version));
            return found;
        }

        static readonly char[] Seps = { '\\', '/' };
        /// <summary>The file name of a Windows path (also where the tests run).</summary>
        static string FileName(string path) => path.Substring(path.LastIndexOfAny(Seps) + 1);

        /// <summary>Versions by number ("3.10" after "3.9").</summary>
        public static int Compare(string a, string b)
        {
            int[] x = Nums(a), y = Nums(b);
            for (int i = 0; i < Math.Max(x.Length, y.Length); i++)
            {
                int c = (i < x.Length ? x[i] : 0).CompareTo(i < y.Length ? y[i] : 0);
                if (c != 0) return c;
            }
            return 0;
        }

        static int[] Nums(string v) => Regex.Matches(v ?? "", @"\d+").Cast<Match>().Select(m => int.Parse(m.Value)).ToArray();
    }
}
