// Learning another maker's software before the app drives it (Yaskawa MPE720 first): read only. What is installed
// (the Uninstall list), what runs, and every window of it with its controls and a screenshot, recorded to the bridge's
// folder for the user to send. Nothing is clicked, typed or changed.
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using TiaBridge;

namespace ClickBridge
{
    public static class Learn
    {
        /// <summary>The software the app may learn, by the name in Windows' list of programs and of its processes.</summary>
        public static readonly Dictionary<string, string> Targets = new Dictionary<string, string>
        {
            ["mpe720"] = "MPE720",
        };

        /// <summary>Programs installed whose name matches: name, version, folder, its .exe files.</summary>
        public static List<Dictionary<string, object>> Installs(IPc pc, string pattern)
        {
            var rx = new Regex(pattern, RegexOptions.IgnoreCase);
            var found = new List<Dictionary<string, object>>();
            foreach (bool wow in new[] { false, true })
                foreach (string key in pc.SubKeys(ClickDetect.Uninstall, wow))
                {
                    string path = $@"{ClickDetect.Uninstall}\{key}";
                    string name = pc.Value(path, "DisplayName", wow);
                    if (name == null || !rx.IsMatch(name)) continue;
                    string folder = pc.Value(path, "InstallLocation", wow) ?? "";
                    string icon = pc.Value(path, "DisplayIcon", wow) ?? "";
                    found.Add(new Dictionary<string, object>
                    {
                        ["name"] = name, ["version"] = pc.Value(path, "DisplayVersion", wow) ?? "", ["folder"] = folder, ["icon"] = icon,
                        ["exes"] = (folder.Length > 0 ? pc.Programs(folder) : new string[0]).Cast<object>().ToList(),
                    });
                }
            return found;
        }

        /// <summary>
        /// Every window of the running program (its processes by name or window title) with its controls, into
        /// learn-&lt;label&gt;-&lt;time&gt;.txt, and the screen into a .png next to it.
        /// </summary>
        public static Dictionary<string, object> Record(IPc pc, IUi ui, string folder, string target, string label)
        {
            if (!Targets.TryGetValue(target ?? "", out string pattern)) throw new BridgeError($"The app cannot learn \"{target}\".");
            string safe = Regex.Replace(label ?? "", @"[^\w-]+", "_").Trim('_');
            if (safe.Length == 0) safe = "now";
            if (safe.Length > 40) safe = safe.Substring(0, 40);
            var installs = Installs(pc, pattern);
            var procs = pc.Matching(pattern);
            var text = new StringBuilder();
            text.AppendLine($"learn {target} \"{label}\" {DateTime.Now:yyyy-MM-dd HH:mm:ss}");
            foreach (var i in installs) text.AppendLine($"installed: {i["name"]} {i["version"]} in {i["folder"]} ({string.Join(", ", (List<object>)i["exes"])}) icon {i["icon"]}");
            foreach (var p in procs) text.AppendLine($"running: process {p.Key} \"{p.Value}\"");
            var windows = new List<object>();
            foreach (var p in procs)
            {
                IList<string> titles;
                try { titles = ui.Windows(p.Key); }
                catch (Exception e) { text.AppendLine($"process {p.Key}: {e.Message}"); continue; }
                foreach (string t in titles.Distinct())
                {
                    windows.Add(t);
                    string w = null;
                    try { w = ui.Window(p.Key, "^" + Regex.Escape(t) + "$", 2000); } catch (Exception e) { text.AppendLine($"window \"{t}\": {e.Message}"); }
                    text.AppendLine();
                    text.AppendLine($"=== process {p.Key}, window \"{t}\"");
                    text.AppendLine(w == null ? "(closed while read)" : ui.Dump(w));
                }
            }
            Directory.CreateDirectory(folder);
            string stamp = DateTime.Now.ToString("yyyyMMdd-HHmmss");
            string file = Path.Combine(folder, $"learn-{target}-{safe}-{stamp}.txt");
            File.WriteAllText(file, text.ToString(), new UTF8Encoding(false));
            string shot = Path.Combine(folder, $"learn-{target}-{safe}-{stamp}.png");
            try { ui.Screenshot(shot); } catch (Exception e) { Log.Write($"learn: no screenshot: {e.Message}"); shot = null; }
            Log.Write($"learn {target} \"{label}\": {procs.Count} process(es), {windows.Count} window(s) → {file}");
            return new Dictionary<string, object>
            {
                ["installed"] = installs.Cast<object>().ToList(),
                ["running"] = procs.Select(p => (object)new Dictionary<string, object> { ["processId"] = p.Key, ["title"] = p.Value }).ToList(),
                ["windows"] = windows, ["file"] = file, ["shot"] = shot, ["folder"] = folder,
            };
        }
    }
}
