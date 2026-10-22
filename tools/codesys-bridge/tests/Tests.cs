// The CODESYS bridge's tests: detect on made-up PCs, a job through a fake CODESYS (the job file in, progress and the
// result out; a missing answer, an error, Stop), and the commands. Run with:  dotnet run --project tools/codesys-bridge/tests
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using CodesysBridge;
using TiaBridge;

static class Tests
{
    static int _passed;
    static void Test(string name, Action body) { body(); _passed++; Console.WriteLine($"  ok  {name}"); }
    static void Eq(object want, object got, string what = "") { if (!Equals(want, got)) throw new Exception($"{what}: expected {want}, got {got}"); }
    static void True(bool ok, string what) { if (!ok) throw new Exception(what); }
    static T Throws<T>(Action a) where T : Exception { try { a(); } catch (T e) { return e; } throw new Exception($"no {typeof(T).Name}"); }

    sealed class FakeProc : IProc
    {
        public bool Exited { get; set; } = true;
        public int ExitCode { get; set; }
        public bool Killed;
        public void Kill() { Killed = true; Exited = true; }
    }

    /// <summary>A PC with folders and files in memory; Start runs `Codesys` (the fake CODESYS) on the job.</summary>
    sealed class FakePc : IMachine
    {
        public List<string> Roots = new List<string> { @"C:\Program Files", @"C:\Program Files (x86)" };
        public HashSet<string> Folders = new HashSet<string>(), Present = new HashSet<string>();
        public List<string> Started = new List<string>(), Opened = new List<string>();
        public Func<string, IProc> Codesys;
        public IList<string> ProgramFiles => Roots;
        public string[] Dirs(string path) => Folders.Where(f => f.StartsWith(path + @"\") && !f.Substring(path.Length + 1).Contains('\\')).ToArray();
        public string[] Files(string path, string pattern) => Present.Where(f => f.StartsWith(path + @"\") && f.EndsWith(pattern.TrimStart('*'))).ToArray();
        public bool Exists(string file) => Present.Contains(file) || File.Exists(file);
        public IProc Start(string exe, string args, IDictionary<string, string> env) { Started.Add($"{exe} {args}"); return Codesys(env["ISA_CODESYS_JOB"]); }
        public void Open(string file) => Opened.Add(file);

        public FakePc With(string root, string folder, params string[] profiles)
        {
            string dir = $@"{root}\{folder}";
            Folders.Add(dir);
            Present.Add($@"{dir}\CODESYS\Common\CODESYS.exe");
            foreach (var p in profiles) Present.Add($@"{dir}\CODESYS\Profiles\{p}.profile.xml");
            return this;
        }
    }

    /// <summary>A fake CODESYS that answers a job like the script does (progress lines, then result.json).</summary>
    static Func<string, IProc> Answers(string resultJson, params string[] progress) => job =>
    {
        string dir = Path.GetDirectoryName(job);
        File.WriteAllLines(Path.Combine(dir, "progress.txt"), progress);
        if (resultJson != null) File.WriteAllText(Path.Combine(dir, "result.json"), resultJson);
        return new FakeProc();
    };

    static string TempDir() { var d = Path.Combine(Path.GetTempPath(), "codesys-test-" + Guid.NewGuid().ToString("N")); Directory.CreateDirectory(d); return d; }
    static string Script(string dir) { var s = Path.Combine(dir, "isa_job.py"); File.WriteAllText(s, "# the job script"); return s; }

    static List<Dictionary<string, object>> Talk(Protocol p, StringWriter output, params string[] lines)
    {
        foreach (var l in lines) if (!p.Handle(l)) break;
        return output.ToString().Split('\n').Where(l => l.Trim().Length > 0).Select(l => (Dictionary<string, object>)Json.Parse(l)).ToList();
    }
    static Dictionary<string, object> Answer(List<Dictionary<string, object>> m, int id) => m.First(x => x.TryGetValue("id", out object v) && Equals(v, (double)id) && x.ContainsKey("ok"));

    static int Main()
    {
        Test("detect: CODESYS folders under Program Files with the program and a profile, newest first", () =>
        {
            var pc = new FakePc()
                .With(@"C:\Program Files", "CODESYS 3.5.17.30", "CODESYS V3.5 SP17 Patch 3")
                .With(@"C:\Program Files", "CODESYS 3.5.19.20", "CODESYS V3.5 SP19 Patch 2")
                .With(@"C:\Program Files (x86)", "CODESYS 3.5.9.0", "CODESYS V3.5 SP9");
            pc.Folders.Add(@"C:\Program Files\CODESYS Gateway");   // not a development system
            pc.Folders.Add(@"C:\Program Files\CODESYS 3.5.20.0");  // no program in it
            var all = CodesysDetect.Find(pc);
            Eq("3.5.19.20,3.5.17.30,3.5.9.0", string.Join(",", all.Select(i => i.Version)));
            Eq("CODESYS V3.5 SP19 Patch 2", all[0].Profile);
            Eq(@"C:\Program Files\CODESYS 3.5.19.20\CODESYS\Common\CODESYS.exe", all[0].Exe);
            Eq(0, CodesysDetect.Find(new FakePc()).Count);
        });

        Test("job: CODESYS started headless with the profile and the script, the job in its folder, progress passed on, the result", () =>
        {
            var dir = TempDir();
            var pc = new FakePc().With(@"C:\Program Files", "CODESYS 3.5.19.20", "CODESYS V3.5 SP19 Patch 2");
            string seenJob = null;
            pc.Codesys = job => { seenJob = File.ReadAllText(job); return Answers("{\"ok\":true,\"result\":{\"errors\":0,\"project\":\"x\"}}", "Writing Main", "Building")(job); };
            var said = new List<string>();
            var r = new Jobs(pc, dir, Script(dir)) { PollMs = 1 }.Run(CodesysDetect.Find(pc)[0], new Dictionary<string, object> { ["cmd"] = "build", ["objects"] = new List<object>() }, said.Add, CancellationToken.None);
            Eq(0.0, r["errors"]);
            True(pc.Started[0].StartsWith(@"C:\Program Files\CODESYS 3.5.19.20\CODESYS\Common\CODESYS.exe --profile=""CODESYS V3.5 SP19 Patch 2"" --noUI --runscript=""") && pc.Started[0].EndsWith(@"isa_job.py"""), pc.Started[0]);
            True(seenJob.Contains("\"cmd\":\"build\""), seenJob);
            Eq("Writing Main|Building", string.Join("|", said));
        });

        Test("job: CODESYS's error in one sentence; no answer at all; the script missing", () =>
        {
            var dir = TempDir();
            var pc = new FakePc().With(@"C:\Program Files", "CODESYS 3.5.19.20", "CODESYS V3.5 SP19");
            var inst = CodesysDetect.Find(pc)[0];
            var jobs = new Jobs(pc, dir, Script(dir)) { PollMs = 1 };
            pc.Codesys = Answers("{\"ok\":false,\"error\":\"The CODESYS project has no application: open it in CODESYS.\"}", "Traceback (most recent call last):", "  File x", "Opening Line.project");
            var said = new List<string>();
            Eq("The CODESYS project has no application: open it in CODESYS.", Throws<BridgeError>(() => jobs.Run(inst, new Dictionary<string, object>(), said.Add, CancellationToken.None)).Message);
            Eq("Opening Line.project", string.Join("|", said), "a traceback goes to the log only");
            pc.Codesys = _ => new FakeProc { ExitCode = 3 };
            True(Throws<BridgeError>(() => jobs.Run(inst, new Dictionary<string, object>(), _ => { }, CancellationToken.None)).Message.StartsWith("CODESYS ended without an answer (exit code 3)"), "no answer");
            True(Throws<BridgeError>(() => new Jobs(pc, dir, Path.Combine(dir, "gone.py")).Run(inst, new Dictionary<string, object>(), _ => { }, CancellationToken.None)).Message.Contains("missing its script"), "no script");
        });

        Test("job: Stop closes CODESYS at once; so does the time limit", () =>
        {
            var dir = TempDir();
            var pc = new FakePc().With(@"C:\Program Files", "CODESYS 3.5.19.20", "CODESYS V3.5 SP19");
            var inst = CodesysDetect.Find(pc)[0];
            var running = new FakeProc { Exited = false };
            pc.Codesys = _ => running;
            using (var cts = new CancellationTokenSource())
            {
                cts.Cancel();
                var e = Throws<BridgeError>(() => new Jobs(pc, dir, Script(dir)) { PollMs = 1 }.Run(inst, new Dictionary<string, object>(), _ => { }, cts.Token));
                True(e.Message.StartsWith("Stopped, as you asked") && running.Killed, e.Message);
            }
            running = new FakeProc { Exited = false };
            pc.Codesys = _ => running;
            True(Throws<BridgeError>(() => new Jobs(pc, dir, Script(dir)) { PollMs = 1, TimeoutMs = 5 }.Run(inst, new Dictionary<string, object>(), _ => { }, CancellationToken.None)).Message.Contains("did not finish") && running.Killed, "time limit");
        });

        Test("commands: detect; build on the user's project makes the app's copy next to it (theirs untouched); a new project in the projects folder; open", () =>
        {
            var dir = TempDir();
            var pc = new FakePc().With(@"C:\Program Files", "CODESYS 3.5.19.20", "CODESYS V3.5 SP19 Patch 2");
            Dictionary<string, object> job = null;
            pc.Codesys = j => { job = (Dictionary<string, object>)Json.Parse(File.ReadAllText(j)); return Answers("{\"ok\":true,\"result\":{\"project\":\"done\",\"errors\":1}}")(j); };
            string user = Path.Combine(dir, "Line.project");
            File.WriteAllText(user, "");
            var output = new StringWriter();
            var p = Commands.Register(new Protocol(output), pc, new Jobs(pc, Path.Combine(dir, "jobs"), Script(dir)) { PollMs = 1 }, Path.Combine(dir, "projects"));
            var m = Talk(p, output, "{\"id\":1,\"cmd\":\"detect\"}",
                "{\"id\":2,\"cmd\":\"build\",\"args\":{\"project\":" + Json.Write(user) + ",\"name\":\"Conveyor\",\"main\":\"Main\",\"objects\":[{\"kind\":\"program\",\"name\":\"Main\",\"declaration\":\"PROGRAM Main\",\"implementation\":\"\"}]}}");
            var d = (Dictionary<string, object>)Answer(m, 1)["result"];
            Eq(true, d["ready"]);
            Eq("CODESYS V3.5 SP19 Patch 2", ((Dictionary<string, object>)((List<object>)d["installs"])[0])["profile"]);
            Eq(1.0, ((Dictionary<string, object>)Answer(m, 2)["result"])["errors"]);
            Eq(user, job["project"]);
            Eq(Path.Combine(dir, "Line_ISA.project"), job["copy"]);
            Eq("Main", job["main"]);
            Eq("CODESYS Control Win V3", job["device"]);

            output = new StringWriter();
            p = Commands.Register(new Protocol(output), pc, new Jobs(pc, Path.Combine(dir, "jobs"), Script(dir)) { PollMs = 1 }, Path.Combine(dir, "projects"));
            m = Talk(p, output, "{\"id\":3,\"cmd\":\"build\",\"args\":{\"name\":\"Bottle: line/2\",\"objects\":[]}}",
                "{\"id\":4,\"cmd\":\"build\",\"args\":{\"project\":\"C:\\\\gone\\\\x.project\",\"objects\":[]}}",
                "{\"id\":5,\"cmd\":\"build\",\"args\":{\"name\":\"x\"}}",
                "{\"id\":6,\"cmd\":\"open\",\"args\":{\"project\":" + Json.Write(user) + "}}");
            Eq(null, job["project"]);
            Eq(Path.Combine(dir, "projects", "Bottle_ line_2", "Bottle_ line_2.project"), job["copy"]);
            True(((string)Answer(m, 4)["error"]).StartsWith("There is no CODESYS project at"), (string)Answer(m, 4)["error"]);
            True(((string)Answer(m, 5)["error"]).Contains("no program"), (string)Answer(m, 5)["error"]);
            Eq(user, pc.Opened.Single());
        });

        Test("commands: no CODESYS says how to get it", () =>
        {
            var output = new StringWriter();
            var pc = new FakePc();
            var p = Commands.Register(new Protocol(output), pc, new Jobs(pc, TempDir(), "x"), TempDir());
            var m = Talk(p, output, "{\"id\":1,\"cmd\":\"detect\"}", "{\"id\":2,\"cmd\":\"build\",\"args\":{\"objects\":[]}}");
            Eq(false, ((Dictionary<string, object>)Answer(m, 1)["result"])["ready"]);
            True(((string)Answer(m, 2)["error"]).StartsWith("CODESYS is not installed on this PC"), (string)Answer(m, 2)["error"]);
        });

        Console.WriteLine($"CodesysBridge tests: all passed ({_passed})");
        return 0;
    }
}
