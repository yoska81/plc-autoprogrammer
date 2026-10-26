// The real PC for ClickDetect and the Stop hotkey: the registry, folders, processes, and the Pause key registered
// for the whole desktop (pressed anywhere, it stops a run).
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Threading;
using Microsoft.Win32;
using TiaBridge;

namespace ClickBridge
{
    public sealed class WindowsPc : IPc
    {
        static RegistryKey Open(string path, bool wow32) => RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, wow32 ? RegistryView.Registry32 : RegistryView.Registry64).OpenSubKey(path);

        public string[] SubKeys(string path, bool wow32) { using (var k = Open(path, wow32)) return k?.GetSubKeyNames() ?? new string[0]; }
        public string Value(string path, string name, bool wow32) { using (var k = Open(path, wow32)) return k?.GetValue(name) as string; }
        public string[] Programs(string folder) => Directory.Exists(folder) ? Directory.GetFiles(folder, "*.exe") : new string[0];

        public IList<KeyValuePair<int, string>> Running(string exePath)
        {
            string name = Path.GetFileNameWithoutExtension(exePath);
            return Process.GetProcessesByName(name).Select(p => new KeyValuePair<int, string>(p.Id, p.MainWindowTitle)).ToList();
        }

        public IList<KeyValuePair<int, string>> Matching(string pattern)
        {
            var rx = new System.Text.RegularExpressions.Regex(pattern, System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            var found = new List<KeyValuePair<int, string>>();
            foreach (var p in Process.GetProcesses())
            {
                try { if (rx.IsMatch(p.ProcessName) || rx.IsMatch(p.MainWindowTitle ?? "")) found.Add(new KeyValuePair<int, string>(p.Id, p.MainWindowTitle)); }
                catch (InvalidOperationException) { /* ended while read */ }
                catch (System.ComponentModel.Win32Exception) { /* a system process */ }
            }
            return found;
        }
    }

    /// <summary>The Pause key, for the whole desktop, while a run goes: pressing it stops the run.</summary>
    public static class StopKey
    {
        const int WM_HOTKEY = 0x0312, VK_PAUSE = 0x13;

        /// <summary>Registers the key on a thread of its own and calls `pressed` each time; false when another program holds it.</summary>
        public static bool Watch(Action pressed)
        {
            bool ok = false;
            var registered = new ManualResetEventSlim();
            var t = new Thread(() =>
            {
                ok = RegisterHotKey(IntPtr.Zero, 1, 0, VK_PAUSE);
                registered.Set();
                if (!ok) return;
                while (GetMessage(out MSG m, IntPtr.Zero, 0, 0) > 0)
                    if (m.message == WM_HOTKEY) { Log.Write("Pause key: stop"); pressed(); }
            }) { IsBackground = true, Name = "stop key" };
            t.Start();
            registered.Wait(2000);
            Log.Write(ok ? "Pause key registered (stops a run)" : "the Pause key is taken by another program; Stop in the app still works");
            return ok;
        }

        [StructLayout(LayoutKind.Sequential)] struct MSG { public IntPtr hwnd; public uint message; public IntPtr wParam, lParam; public uint time; public int x, y; }
        [DllImport("user32.dll")] static extern bool RegisterHotKey(IntPtr hWnd, int id, uint modifiers, uint vk);
        [DllImport("user32.dll")] static extern int GetMessage(out MSG msg, IntPtr hWnd, uint min, uint max);
    }
}
