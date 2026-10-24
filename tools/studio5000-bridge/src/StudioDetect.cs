// What the PC has for "Send to Studio 5000": Studio 5000 Logix Designer (the Windows installed-programs entries
// whose name starts with "Studio 5000 Logix Designer", with their version), Rockwell's Logix Designer SDK (its folder
// in Public Documents, "Studio 5000\Logix Designer SDK"), and a Python that has the SDK's Python client
// (import logix_designer_sdk works): a virtual environment in the SDK folder first (as the SDK guide sets it up),
// then the py launcher (3.13, 3.12), then python on the PATH. Detect answers in seconds on any PC: the Pythons are
// tried only when the SDK is there (without it no Python can have its client), each for 5 s at most and 10 s in all,
// never the Microsoft Store's stubs (WindowsApps); RunQuick gives them no input, so nothing can wait on a question.
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;

namespace Studio5000Bridge
{
    public interface IMachine
    {
        string[] SubKeys(string path, bool wow32);
        string Value(string path, string name, bool wow32);
        string PublicDocuments { get; }
        /// <summary>The folders of the PATH.</summary>
        IList<string> PathDirs { get; }
        string[] Dirs(string path);
        bool Exists(string file);
        /// <summary>Runs a program and waits (up to timeoutMs); its exit code, -1 when it did not end in time.</summary>
        int RunQuick(string exe, string args, int timeoutMs);
        IProc Start(string exe, string args, IDictionary<string, string> env);
        /// <summary>Opens a file with the program Windows has for it (.ACD / .L5X: Studio 5000).</summary>
        void Open(string file);
    }

    public interface IProc
    {
        bool Exited { get; }
        int ExitCode { get; }
        void Kill();
    }

    public sealed class LogixInstall { public string Name, Version; }

    /// <summary>A Python that has the SDK's Python client: the program, and the arguments before the script (py -3.13).</summary>
    public sealed class SdkPython { public string Exe, Prefix, How; }

    public sealed class StudioFound
    {
        public List<LogixInstall> Logix = new List<LogixInstall>();
        public string SdkFolder;
        public SdkPython Python;
        public bool Ready => Logix.Count > 0 && Python != null;
        public List<string> Steps = new List<string>();
    }

    public static class StudioDetect
    {
        public const string Uninstall = @"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall";
        static readonly Regex Product = new Regex(@"^Studio 5000 Logix Designer", RegexOptions.IgnoreCase);
        const string Check = "-c \"import logix_designer_sdk\"";
        /// <summary>Longest one Python may take to try the import, and all of them together.</summary>
        public const int ProbeMs = 5000, ProbesMs = 10000;
        static bool StoreStub(string dir) => Regex.IsMatch(dir, "WindowsApps", RegexOptions.IgnoreCase);

        public static StudioFound Find(IMachine pc)
        {
            var f = new StudioFound();
            foreach (bool wow in new[] { false, true })
                foreach (string key in pc.SubKeys(Uninstall, wow))
                {
                    string path = $@"{Uninstall}\{key}";
                    string name = pc.Value(path, "DisplayName", wow);
                    if (name == null || !Product.IsMatch(name) || Regex.IsMatch(name, "SDK", RegexOptions.IgnoreCase)) continue;
                    string version = pc.Value(path, "DisplayVersion", wow) ?? "";
                    if (!f.Logix.Any(l => l.Name == name && l.Version == version)) f.Logix.Add(new LogixInstall { Name = name.Trim(), Version = version });
                }
            f.Logix = f.Logix.OrderByDescending(l => l.Version, Comparer<string>.Create(CompareVersions)).ToList();

            string sdk = Join(pc.PublicDocuments, "Studio 5000", "Logix Designer SDK");
            if (pc.Dirs(Join(pc.PublicDocuments, "Studio 5000")).Any(d => Name(d).Equals("Logix Designer SDK", StringComparison.OrdinalIgnoreCase))) f.SdkFolder = sdk;

            var candidates = new List<SdkPython>();
            if (f.SdkFolder != null)
            {
                // a virtual environment the SDK guide has the user make in the SDK's python folder (or any folder of it)
                foreach (var dir in new[] { f.SdkFolder }.Concat(pc.Dirs(f.SdkFolder)).Concat(pc.Dirs(f.SdkFolder).SelectMany(pc.Dirs)))
                    foreach (var venv in new[] { ".venv", "venv", "env" })
                    {
                        string exe = Join(dir, venv, "Scripts", "python.exe");
                        if (pc.Exists(exe)) candidates.Add(new SdkPython { Exe = exe, Prefix = "", How = "the SDK's virtual environment" });
                    }
            }
            if (f.SdkFolder != null)
            {
                var dirs = pc.PathDirs.Where(d => !StoreStub(d)).ToList();
                foreach (var dir in dirs)
                {
                    string py = Join(dir, "py.exe");
                    if (pc.Exists(py) && !candidates.Any(c => c.Exe == py)) foreach (var v in new[] { "3.13", "3.12" }) candidates.Add(new SdkPython { Exe = py, Prefix = $"-{v}", How = $"Python {v}" });
                }
                foreach (var dir in dirs)
                {
                    string python = Join(dir, "python.exe");
                    if (pc.Exists(python) && !candidates.Any(c => c.Exe == python)) candidates.Add(new SdkPython { Exe = python, Prefix = "", How = "the Python on the PATH" });
                }
                var clock = System.Diagnostics.Stopwatch.StartNew();
                foreach (var c in candidates)
                {
                    long left = ProbesMs - clock.ElapsedMilliseconds;
                    if (left <= 0) break;
                    if (pc.RunQuick(c.Exe, (c.Prefix + " " + Check).Trim(), (int)Math.Min(ProbeMs, left)) == 0) { f.Python = c; break; }
                }
            }

            if (f.Logix.Count == 0) f.Steps.Add("Studio 5000 Logix Designer is not installed on this PC.");
            if (f.SdkFolder == null) f.Steps.Add("Rockwell's Logix Designer SDK is not installed (it comes with Studio 5000 Professional or the SDK toolkit). Install it, then Check again.");
            else if (f.Python == null) f.Steps.Add($"The SDK's Python client is not installed: in {f.SdkFolder}\\python, make a Python 3.12 or 3.13 virtual environment (.venv) and pip install the SDK's .whl there, as Rockwell's SDK guide says. Then Check again.");
            if (!f.Ready) f.Steps.Add("Until then: Open the .L5X in Studio 5000 (it makes a new project from it).");
            return f;
        }

        public static string Join(string root, params string[] parts) { char sep = root.Contains('\\') ? '\\' : Path.DirectorySeparatorChar; return string.Join(sep.ToString(), new[] { root.TrimEnd('\\', '/') }.Concat(parts)); }
        static string Name(string path) => path.Substring(path.LastIndexOfAny(new[] { '\\', '/' }) + 1);

        static int CompareVersions(string a, string b)
        {
            int[] x = Nums(a), y = Nums(b);
            for (int i = 0; i < Math.Max(x.Length, y.Length); i++)
            {
                int c = (i < x.Length ? x[i] : 0).CompareTo(i < y.Length ? y[i] : 0);
                if (c != 0) return c;
            }
            return 0;
        }

        static int[] Nums(string v) => v.Split('.').Select(s => int.TryParse(s, out int n) ? n : 0).ToArray();
    }
}
