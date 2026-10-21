// The real PC for Detect: the 64-bit registry (TIA Portal registers there), files and the user's Windows groups.
using System;
using System.Collections.Generic;
using System.IO;
using System.Security.Principal;
using Microsoft.Win32;

#pragma warning disable CA1416 // Windows only: the bridge runs on Windows (the app does not start it elsewhere)
namespace TiaBridge
{
    public sealed class WindowsMachine : IMachine
    {
        static RegistryKey Open(string path) => RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, RegistryView.Registry64).OpenSubKey(path);

        public string[] SubKeys(string path)
        {
            using (var k = Open(path)) return k?.GetSubKeyNames() ?? new string[0];
        }

        public string Value(string path, string name)
        {
            using (var k = Open(path)) return k?.GetValue(name) as string;
        }

        public bool FileExists(string path) => File.Exists(path);

        public string ProgramFiles => Environment.GetEnvironmentVariable("ProgramW6432") ?? Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);

        public string UserName => WindowsIdentity.GetCurrent().Name;

        public IEnumerable<string> UserGroups()
        {
            var groups = WindowsIdentity.GetCurrent().Groups;
            if (groups == null) yield break;
            foreach (var g in groups)
            {
                string name = null;
                try { name = g.Translate(typeof(NTAccount)).Value; } catch (Exception) { /* a group that no longer resolves */ }
                if (name != null) yield return name;
            }
        }
    }
}
