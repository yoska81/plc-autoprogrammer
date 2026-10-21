// What this PC has for TIA Portal Openness: the TIA Portal versions installed, the Openness API of each
// (Siemens.Engineering.dll, from the registry key Siemens documents:
// HKLM\SOFTWARE\Siemens\Automation\Openness\<TIA version>\PublicAPI\<assembly version>, values
// "Siemens.Engineering" = the DLL path and "PublicKeyToken"), and whether the Windows user is in the
// "Siemens TIA Openness" group (Openness refuses everyone else). What is missing comes back as plain steps.
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;

namespace TiaBridge
{
    /// <summary>The parts of the PC detect reads (the registry, files, the user's groups): faked in the tests.</summary>
    public interface IMachine
    {
        /// <summary>Subkey names of an HKLM key (empty when the key is missing).</summary>
        string[] SubKeys(string path);
        /// <summary>A string value of an HKLM key (null when missing).</summary>
        string Value(string path, string name);
        bool FileExists(string path);
        string ProgramFiles { get; }
        /// <summary>The Windows user ("PC\name").</summary>
        string UserName { get; }
        /// <summary>The names of the groups the user is in (local groups by their name).</summary>
        IEnumerable<string> UserGroups();
    }

    public sealed class OpennessApi
    {
        /// <summary>"V19".</summary>
        public string Version;
        /// <summary>The registry's assembly version ("19.0.0.0").</summary>
        public string AssemblyVersion;
        public string DllPath;
        public string PublicKeyToken;
    }

    public sealed class DetectResult
    {
        public List<string> Installed = new List<string>();
        public List<OpennessApi> Openness = new List<OpennessApi>();
        public bool InOpennessGroup;
        public string User;
        public List<string> Steps = new List<string>();
        public bool Ready => Openness.Count > 0 && InOpennessGroup;

        public Dictionary<string, object> ToJson() => new Dictionary<string, object>
        {
            ["ready"] = Ready,
            ["installed"] = Installed,
            ["openness"] = Openness.Select(o => (object)new Dictionary<string, object> { ["version"] = o.Version, ["assemblyVersion"] = o.AssemblyVersion, ["dll"] = o.DllPath }).ToList(),
            ["inOpennessGroup"] = InOpennessGroup,
            ["user"] = User,
            ["steps"] = Steps,
        };
    }

    public static class Detect
    {
        public const string OpennessKey = @"SOFTWARE\Siemens\Automation\Openness";
        public const string OpennessGroup = "Siemens TIA Openness";
        /// <summary>The TIA Portal versions the bridge works with.</summary>
        public static readonly int[] Supported = { 16, 17, 18, 19, 20 };

        public static DetectResult Run(IMachine m)
        {
            var r = new DetectResult { User = m.UserName };
            foreach (int v in Supported)
            {
                string portal = Path.Combine(m.ProgramFiles, "Siemens", "Automation", $"Portal V{v}", "Bin", "Siemens.Automation.Portal.exe");
                if (m.FileExists(portal)) r.Installed.Add($"V{v}");
            }
            foreach (string ver in m.SubKeys(OpennessKey))
            {
                if (!double.TryParse(ver, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out double major) || !Supported.Contains((int)major)) continue;
                string api = $@"{OpennessKey}\{ver}\PublicAPI";
                // the newest assembly version of that TIA version first
                foreach (string asm in m.SubKeys(api).OrderByDescending(a => a, StringComparer.Ordinal))
                {
                    string dll = m.Value($@"{api}\{asm}", "Siemens.Engineering");
                    if (string.IsNullOrEmpty(dll) || !m.FileExists(dll)) continue;
                    r.Openness.Add(new OpennessApi { Version = $"V{(int)major}", AssemblyVersion = asm, DllPath = dll, PublicKeyToken = m.Value($@"{api}\{asm}", "PublicKeyToken") });
                    break;
                }
            }
            r.Openness.Sort((a, b) => string.CompareOrdinal(b.Version.PadLeft(4), a.Version.PadLeft(4)));
            r.InOpennessGroup = m.UserGroups().Any(g => string.Equals(g, OpennessGroup, StringComparison.OrdinalIgnoreCase) || g.EndsWith(@"\" + OpennessGroup, StringComparison.OrdinalIgnoreCase));

            if (r.Installed.Count == 0 && r.Openness.Count == 0)
                r.Steps.Add("TIA Portal (V16 to V20) is not installed on this PC. Install it, with the option \"TIA Openness\", then try again.");
            else if (r.Openness.Count == 0)
                r.Steps.Add($"TIA Portal {string.Join(", ", r.Installed)} is installed without TIA Openness. Run the TIA Portal setup again, choose Modify, tick \"TIA Openness\" under Options, finish, and restart the PC.");
            if (r.Openness.Count > 0 && !r.InOpennessGroup)
            {
                r.Steps.Add($"Your Windows user ({r.User}) is not in the \"{OpennessGroup}\" group, so TIA Portal does not let other programs control it.");
                r.Steps.Add($"Add it (needs an administrator): open Computer Management › Local Users and Groups › Groups › {OpennessGroup} › Add…, type your user name, OK. Or in an administrator command prompt: net localgroup \"{OpennessGroup}\" \"{r.User}\" /add");
                r.Steps.Add("Then sign out of Windows and sign in again (the group counts from the next sign-in).");
            }
            return r;
        }
    }
}
