// A job for the user's CODESYS: the job file and the script (isa_job.py) into a fresh folder, CODESYS started
// headless with them  (CODESYS.exe --profile="<profile>" --noUI --runscript="<folder>\isa_job.py", the job in
// ISA_CODESYS_JOB), its progress lines passed on as they come, its result read when it ends. Stop ends CODESYS.
using System;
using System.Collections.Generic;
using System.IO;
using System.Threading;
using TiaBridge;

namespace CodesysBridge
{
    public sealed class Jobs
    {
        readonly IMachine _pc;
        readonly string _folder, _script;
        public int PollMs = 300;
        public int TimeoutMs = 30 * 60 * 1000;

        public Jobs(IMachine pc, string folder, string script) { _pc = pc; _folder = folder; _script = script; }

        public Dictionary<string, object> Run(CodesysInstall install, Dictionary<string, object> job, Action<string> progress, CancellationToken stop)
        {
            if (!File.Exists(_script)) throw new BridgeError("The CODESYS bridge is missing its script (isa_job.py): reinstall the app.");
            string dir = Path.Combine(_folder, $"job-{DateTime.Now:yyyyMMdd-HHmmss}-{Guid.NewGuid().ToString("N").Substring(0, 6)}");
            Directory.CreateDirectory(dir);
            string jobFile = Path.Combine(dir, "job.json"), script = Path.Combine(dir, "isa_job.py");
            File.WriteAllText(jobFile, Json.Write(job), new System.Text.UTF8Encoding(false));
            File.Copy(_script, script, true);
            string args = $"--profile=\"{install.Profile}\" --noUI --runscript=\"{script}\"";
            Log.Write($"codesys: \"{install.Exe}\" {args} (job {jobFile})");
            try { return Wait(_pc.Start(install.Exe, args, new Dictionary<string, string> { ["ISA_CODESYS_JOB"] = jobFile }), dir, progress, stop); }
            // the job file may hold the PLC's password: gone as soon as CODESYS has read it and ended
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
                for (; seen < lines.Length; seen++) { Log.Write($"codesys: {lines[seen]}"); if (!lines[seen].StartsWith("Traceback") && !lines[seen].StartsWith("  ")) progress(lines[seen]); }
            }
            while (!proc.Exited)
            {
                Pass();
                if (stop.IsCancellationRequested) { proc.Kill(); throw new BridgeError("Stopped, as you asked: CODESYS was closed. Your own project was not changed."); }
                if (waited >= TimeoutMs) { proc.Kill(); throw new BridgeError($"CODESYS did not finish within {TimeoutMs / 60000} minutes: it was closed. Your own project was not changed."); }
                Thread.Sleep(PollMs);
                waited += PollMs;
            }
            Pass();
            string resultFile = Path.Combine(dir, "result.json");
            if (!File.Exists(resultFile))
                throw new BridgeError($"CODESYS ended without an answer (exit code {proc.ExitCode}). Close every CODESYS window and try again; if it happens again, send us the log.");
            var r = Json.Parse(File.ReadAllText(resultFile)) as Dictionary<string, object> ?? throw new BridgeError("CODESYS's answer could not be read: send us the log.");
            Log.Write($"codesys result: {Json.Write(r)}");
            if (!(r.TryGetValue("ok", out object ok) && ok is bool b && b)) throw new BridgeError(r.TryGetValue("error", out object e) && e is string s ? s : "CODESYS reported a problem: send us the log.");
            return r.TryGetValue("result", out object res) && res is Dictionary<string, object> d ? d : new Dictionary<string, object>();
        }
    }
}
