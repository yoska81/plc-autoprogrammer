// Every request, answer and Openness call, with the time, in a local file the user can send us (the app passes
// its path: <user data>\logs\tia-bridge.log). Never fails the bridge: a log that cannot be written is skipped.
using System;
using System.IO;

namespace TiaBridge
{
    public static class Log
    {
        static string _path;
        static readonly object Gate = new object();
        /// <summary>Above this size the log starts again (the previous one is kept as .old).</summary>
        const long MaxBytes = 5 * 1024 * 1024;

        public static void Open(string path)
        {
            _path = path;
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(path)));
                if (File.Exists(path) && new FileInfo(path).Length > MaxBytes) File.Copy(path, path + ".old", true);
                if (File.Exists(path) && new FileInfo(path).Length > MaxBytes) File.Delete(path);
            }
            catch (Exception) { /* no log */ }
        }

        public static void Write(string what)
        {
            if (_path == null) return;
            lock (Gate)
            {
                try { File.AppendAllText(_path, $"{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff} {what}{Environment.NewLine}"); }
                catch (Exception) { /* no log */ }
            }
        }
    }
}
