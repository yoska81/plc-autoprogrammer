// Where CODESYS is: the CODESYS Development System's folders under Program Files ("CODESYS 3.5.19.20"), with the
// program (CODESYS\Common\CODESYS.exe) and its profiles (CODESYS\Profiles\*.profile.xml: the name CODESYS is
// started with, "CODESYS V3.5 SP19 Patch 2"). Newest first.
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;

namespace CodesysBridge
{
    /// <summary>The parts of the PC the bridge reads and starts (faked in the tests).</summary>
    public interface IMachine
    {
        /// <summary>The Program Files folders (64- and 32-bit).</summary>
        IList<string> ProgramFiles { get; }
        /// <summary>Subfolders (full paths); empty when the folder is missing.</summary>
        string[] Dirs(string path);
        /// <summary>Files matching a pattern in a folder (full paths); empty when the folder is missing.</summary>
        string[] Files(string path, string pattern);
        bool Exists(string file);
        /// <summary>Starts a program with arguments and extra environment variables.</summary>
        IProc Start(string exe, string args, IDictionary<string, string> env);
        /// <summary>Opens a file with the program Windows has for it (a .project: CODESYS).</summary>
        void Open(string file);
    }

    public interface IProc
    {
        bool Exited { get; }
        int ExitCode { get; }
        void Kill();
    }

    public sealed class CodesysInstall
    {
        public string Name, Version, Folder, Exe, Profile;
    }

    public static class CodesysDetect
    {
        static readonly Regex Folder = new Regex(@"^CODESYS\s*([\d.]+)$", RegexOptions.IgnoreCase);

        public static List<CodesysInstall> Find(IMachine pc)
        {
            var found = new List<CodesysInstall>();
            foreach (var root in pc.ProgramFiles.Distinct(StringComparer.OrdinalIgnoreCase))
                foreach (var dir in pc.Dirs(root))
                {
                    var m = Folder.Match(Name(dir));
                    if (!m.Success) continue;
                    string exe = Join(dir, "CODESYS", "Common", "CODESYS.exe");
                    if (!pc.Exists(exe)) continue;
                    // the profile CODESYS starts with: the one named like the version ("CODESYS V3.5 SP19 Patch 2"), newest first
                    var profiles = pc.Files(Join(dir, "CODESYS", "Profiles"), "*.profile.xml").Select(f => Name(f).Replace(".profile.xml", "")).OrderByDescending(p => p, StringComparer.OrdinalIgnoreCase).ToList();
                    if (profiles.Count == 0) continue;
                    found.Add(new CodesysInstall { Name = profiles[0], Version = m.Groups[1].Value, Folder = dir, Exe = exe, Profile = profiles[0] });
                }
            return found.OrderByDescending(i => i.Version, Comparer<string>.Create(CompareVersions)).ToList();
        }

        /// <summary>A path joined with the separator the base has (Windows paths stay Windows paths on any OS: the tests).</summary>
        static string Join(string root, params string[] parts) { char sep = root.Contains('\\') ? '\\' : Path.DirectorySeparatorChar; return string.Join(sep.ToString(), new[] { root.TrimEnd('\\', '/') }.Concat(parts)); }

        /// <summary>The last part of a path, whichever separator it has (the tests run on any OS).</summary>
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
