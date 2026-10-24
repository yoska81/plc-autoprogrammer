// A job for Rockwell's Logix Designer SDK: the job file and the script (isa_logix_job.py) into a fresh folder, the
// SDK's Python started with them  (<python> [-3.13] "<folder>\isa_logix_job.py" "<folder>\job.json"), its progress
// lines passed on as they come, its result read when it ends. Stop ends it.
using System;
using System.Collections.Generic;
using System.IO;
using System.Threading;
using TiaBridge;

namespace Studio5000Bridge
{
    public sealed class Jobs
    {
        readonly IMachine _pc;
        readonly string _folder, _script;
        public int PollMs = 300;
        public int TimeoutMs = 30 * 60 * 1000;

        public Jobs(IMachine pc, string folder, string script) { _pc = pc; _folder = folder; _script = script; }

        public Dictionary<string, object> Run(SdkPython python, Dictionary<string, object> job, Action<string> progress, CancellationToken stop)
        {
            if (!File.Exists(_script)) throw new BridgeError("The Studio 5000 bridge is missing its script (isa_logix_job.py): reinstall the app.");
            string dir = Path.Combine(_folder, $"job-{DateTime.Now:yyyyMMdd-HHmmss}-{Guid.NewGuid().ToString("N").Substring(0, 6)}");
            Directory.CreateDirectory(dir);
            string jobFile = Path.Combine(dir, "job.json"), script = Path.Combine(dir, "isa_logix_job.py");
            File.WriteAllText(jobFile, Json.Write(job), new System.Text.UTF8Encoding(false));
            File.Copy(_script, script, true);
            string args = $"{python.Prefix} \"{script}\" \"{jobFile}\"".Trim();
            Log.Write($"logix sdk: \"{python.Exe}\" {args}");
            try { return Wait(_pc.Start(python.Exe, args, new Dictionary<string, string> { ["PYTHONIOENCODING"] = "utf-8" }), dir, progress, stop); }
            finally { try { File.Delete(jobFile); } catch (IOException) { /* still open */ } }
        }

        Dictionary<string, object> Wait(IProc proc, string dir, Action<string> progress, CancellationToken stop)
        {
            string progressFile = Path.Combine(dir, "progress.txt");
            int seen = 0, waited = 0;
            void Pass()
            {
                if (!File.Exists(progressFile)) return;
                string[] lines;
                try { lines = File.ReadAllLines(progressFile); } catch (IOException) { return; /* being written */ }
                for (; seen < lines.Length; seen++) { Log.Write($"logix sdk: {lines[seen]}"); if (!lines[seen].StartsWith("Traceback") && !lines[seen].StartsWith(" ") && lines[seen].Length > 0) progress(lines[seen]); }
            }
            while (!proc.Exited)
            {
                Pass();
                if (stop.IsCancellationRequested) { proc.Kill(); throw new BridgeError("Stopped, as you asked. Your own Studio 5000 project was not changed."); }
                if (waited >= TimeoutMs) { proc.Kill(); throw new BridgeError($"The Logix Designer SDK did not finish within {TimeoutMs / 60000} minutes: it was stopped. Your own project was not changed."); }
                Thread.Sleep(PollMs);
                waited += PollMs;
            }
            Pass();
            string resultFile = Path.Combine(dir, "result.json");
            if (!File.Exists(resultFile))
            {
                Log.Write($"logix sdk ended without result.json, exit code {proc.ExitCode}");
                throw new BridgeError("The Logix Designer SDK ended without an answer: close Studio 5000 and try again.");
            }
            var r = Json.Parse(File.ReadAllText(resultFile)) as Dictionary<string, object> ?? throw new BridgeError("The SDK's answer could not be read: send us the log.");
            Log.Write($"logix sdk result: {Json.Write(r)}");
            if (!(r.TryGetValue("ok", out object ok) && ok is bool b && b)) throw new BridgeError(r.TryGetValue("error", out object e) && e is string s ? s : "The Logix Designer SDK reported a problem: send us the log.");
            return r.TryGetValue("result", out object res) && res is Dictionary<string, object> d ? d : new Dictionary<string, object>();
        }
    }
}
