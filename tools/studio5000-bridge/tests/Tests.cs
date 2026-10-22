// The Studio 5000 bridge's tests: detect on made-up PCs (Logix Designer, the SDK folder, a Python with the SDK's
// client), a job through a fake SDK Python (progress and the result out; an error, no answer, Stop), the commands.
// Run with:  dotnet run --project tools/studio5000-bridge/tests
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using Studio5000Bridge;
using TiaBridge;

static class Tests
{
    static int _passed;
    static void Test(string name, Action body) { body(); _passed++; Console.WriteLine($"  ok  {name}"); }
    static void Eq(object want, object got, string what = "") { if (!Equals(want, got)) throw new Exception($"{what}: expected {want}, got {got}"); }
    static void True(bool ok, string what) { if (!ok) throw new Exception(what); }
    static T Throws<T>(Action a) where T : Exception { try { a(); } catch (T e) { return e; } throw new Exception($"no {typeof(T).Name}"); }

    sealed class FakeProc : IProc { public bool Exited { get; set; } = true; public int ExitCode { get; set; } public bool Killed; public void Kill() { Killed = true; Exited = true; } }

    sealed class FakePc : IMachine
    {
        public Dictionary<string, string[]> Keys = new Dictionary<string, string[]>();
        public Dictionary<string, string> Values = new Dictionary<string, string>();
        public HashSet<string> Folders = new HashSet<string>(), Present = new HashSet<string>();
        /// <summary>The Pythons (exe + prefix) that can import logix_designer_sdk.</summary>
        public HashSet<string> WithSdk = new HashSet<string>();
        public List<string> Ran = new List<string>(), Started = new List<string>(), Opened = new List<string>();
        public Func<string, IProc> Sdk;
        public string PublicDocuments => @"C:\Users\Public\Documents";
        public IList<string> PathDirs { get; set; } = new List<string> { @"C:\Windows", @"C:\Python313" };
        public string[] SubKeys(string path, bool wow32) => Keys.TryGetValue($"{wow32}|{path}", out var k) ? k : new string[0];
        public string Value(string path, string name, bool wow32) => Values.TryGetValue($"{wow32}|{path}|{name}", out var v) ? v : null;
        public string[] Dirs(string path) => Folders.Where(f => f.StartsWith(path + @"\") && !f.Substring(path.Length + 1).Contains('\\')).ToArray();
        public bool Exists(string file) => Present.Contains(file) || File.Exists(file);
        public int RunQuick(string exe, string args, int timeoutMs) { Ran.Add($"{exe} {args}"); return WithSdk.Any(w => $"{exe} {args}".StartsWith(w + " ")) ? 0 : 1; }
        public IProc Start(string exe, string args, IDictionary<string, string> env) { Started.Add($"{exe} {args}"); return Sdk(args.Substring(args.LastIndexOf(" \"") + 2).TrimEnd('"')); }
        public void Open(string file) => Opened.Add(file);

        public FakePc Logix(string version)
        {
            string key = $"{{logix-{version}}}";
            Keys[$"True|{StudioDetect.Uninstall}"] = SubKeys(StudioDetect.Uninstall, true).Concat(new[] { key }).ToArray();
            Values[$"True|{StudioDetect.Uninstall}\\{key}|DisplayName"] = $"Studio 5000 Logix Designer v{version.Split('.')[0]}";
            Values[$"True|{StudioDetect.Uninstall}\\{key}|DisplayVersion"] = version;
            return this;
        }
        public FakePc SdkFolder() { Folders.Add(@"C:\Users\Public\Documents\Studio 5000"); Folders.Add(@"C:\Users\Public\Documents\Studio 5000\Logix Designer SDK"); Folders.Add(@"C:\Users\Public\Documents\Studio 5000\Logix Designer SDK\python"); return this; }
    }

    static Func<string, IProc> Answers(string resultJson, params string[] progress) => job =>
    {
        string dir = Path.GetDirectoryName(job);
        File.WriteAllLines(Path.Combine(dir, "progress.txt"), progress);
        if (resultJson != null) File.WriteAllText(Path.Combine(dir, "result.json"), resultJson);
        return new FakeProc();
    };
    static string TempDir() { var d = Path.Combine(Path.GetTempPath(), "s5k-test-" + Guid.NewGuid().ToString("N")); Directory.CreateDirectory(d); return d; }
    static string Script(string dir) { var s = Path.Combine(dir, "isa_logix_job.py"); File.WriteAllText(s, "# the job script"); return s; }
    static List<Dictionary<string, object>> Talk(Protocol p, StringWriter output, params string[] lines)
    {
        foreach (var l in lines) if (!p.Handle(l)) break;
        return output.ToString().Split('\n').Where(l => l.Trim().Length > 0).Select(l => (Dictionary<string, object>)Json.Parse(l)).ToList();
    }
    static Dictionary<string, object> Answer(List<Dictionary<string, object>> m, int id) => m.First(x => x.TryGetValue("id", out object v) && Equals(v, (double)id) && x.ContainsKey("ok"));
    const string Venv = @"C:\Users\Public\Documents\Studio 5000\Logix Designer SDK\python\.venv\Scripts\python.exe";

    static int Main()
    {
        Test("detect: Logix Designer, newest first (not the SDK's own entry); the SDK; its Python: the SDK's venv before py and python", () =>
        {
            var pc = new FakePc().Logix("33.01.00").Logix("36.00.02").SdkFolder();
            pc.Keys[$"True|{StudioDetect.Uninstall}"] = pc.SubKeys(StudioDetect.Uninstall, true).Concat(new[] { "{sdk}" }).ToArray();
            pc.Values[$"True|{StudioDetect.Uninstall}\\{{sdk}}|DisplayName"] = "Studio 5000 Logix Designer SDK";
            pc.Present.Add(Venv); pc.Present.Add(@"C:\Windows\py.exe"); pc.Present.Add(@"C:\Python313\python.exe");
            pc.WithSdk.Add(Venv); pc.WithSdk.Add(@"C:\Windows\py.exe -3.13");
            var f = StudioDetect.Find(pc);
            Eq("36.00.02,33.01.00", string.Join(",", f.Logix.Select(l => l.Version)));
            Eq(@"C:\Users\Public\Documents\Studio 5000\Logix Designer SDK", f.SdkFolder);
            Eq(Venv, f.Python.Exe); Eq("", f.Python.Prefix);
            True(f.Ready && f.Steps.Count == 0, string.Join(" ", f.Steps));
            True(pc.Ran[0] == Venv + " -c \"import logix_designer_sdk\"", pc.Ran[0]);
            // no venv with the SDK: the py launcher's 3.13 that has it
            pc.WithSdk.Remove(Venv);
            f = StudioDetect.Find(pc);
            Eq(@"C:\Windows\py.exe", f.Python.Exe); Eq("-3.13", f.Python.Prefix);
        });

        Test("detect: no SDK, or no Python client, says what to install and offers the .L5X in Studio 5000 meanwhile", () =>
        {
            var f = StudioDetect.Find(new FakePc().Logix("36.00.02"));
            True(!f.Ready && f.Steps[0].StartsWith("Rockwell's Logix Designer SDK is not installed") && f.Steps.Last().Contains("Open the .L5X in Studio 5000"), string.Join(" | ", f.Steps));
            f = StudioDetect.Find(new FakePc().Logix("36.00.02").SdkFolder());
            True(!f.Ready && f.Steps[0].StartsWith("The SDK's Python client is not installed") && f.Steps[0].Contains("pip install"), string.Join(" | ", f.Steps));
            f = StudioDetect.Find(new FakePc().SdkFolder());
            True(!f.Ready && f.Steps[0] == "Studio 5000 Logix Designer is not installed on this PC.", string.Join(" | ", f.Steps));
        });

        Test("job: the SDK's Python with the script and the job, progress passed on (not a traceback), the result; errors; Stop", () =>
        {
            var dir = TempDir();
            var pc = new FakePc();
            var py = new SdkPython { Exe = @"C:\Windows\py.exe", Prefix = "-3.13" };
            var jobs = new Jobs(pc, dir, Script(dir)) { PollMs = 1 };
            string seen = null;
            pc.Sdk = j => { seen = File.ReadAllText(j); return Answers("{\"ok\":true,\"result\":{\"project\":\"x\"}}", "Copying Line.ACD", "Traceback (most recent call last):", "  File x", "Saving")(j); };
            var said = new List<string>();
            Eq("x", jobs.Run(py, new Dictionary<string, object> { ["cmd"] = "import" }, said.Add, CancellationToken.None)["project"]);
            True(pc.Started[0].StartsWith(@"C:\Windows\py.exe -3.13 """) && pc.Started[0].Contains(@"isa_logix_job.py"" """) && pc.Started[0].EndsWith(@"job.json"""), pc.Started[0]);
            True(seen.Contains("\"cmd\":\"import\""), seen);
            Eq("Copying Line.ACD|Saving", string.Join("|", said));
            pc.Sdk = Answers("{\"ok\":false,\"error\":\"Import failed: Controller/Tags not found\"}");
            Eq("Import failed: Controller/Tags not found", Throws<BridgeError>(() => jobs.Run(py, new Dictionary<string, object>(), _ => { }, CancellationToken.None)).Message);
            pc.Sdk = _ => new FakeProc { ExitCode = 2 };
            True(Throws<BridgeError>(() => jobs.Run(py, new Dictionary<string, object>(), _ => { }, CancellationToken.None)).Message.StartsWith("The Logix Designer SDK ended without an answer (exit code 2)"), "no answer");
            var running = new FakeProc { Exited = false };
            pc.Sdk = _ => running;
            using (var cts = new CancellationTokenSource())
            {
                cts.Cancel();
                True(Throws<BridgeError>(() => jobs.Run(py, new Dictionary<string, object>(), _ => { }, cts.Token)).Message.StartsWith("Stopped, as you asked") && running.Killed, "stop");
            }
        });

        Test("commands: writeL5x into the projects folder; import makes the copy next to the user's ACD (theirs only read); info; open only an .ACD / .L5X; SDK missing in words", () =>
        {
            var dir = TempDir();
            var pc = new FakePc().Logix("36.00.02").SdkFolder();
            pc.Present.Add(Venv); pc.WithSdk.Add(Venv);
            Dictionary<string, object> job = null;
            pc.Sdk = j => { job = (Dictionary<string, object>)Json.Parse(File.ReadAllText(j)); return Answers(job["cmd"] as string == "info" ? "{\"ok\":true,\"result\":{\"commPath\":\"AB_ETH-1\\\\10.0.0.5\\\\Backplane\\\\0\"}}" : "{\"ok\":true,\"result\":{\"project\":\"c\",\"imported\":[\"Controller/Tags\"]}}")(j); };
            string acd = Path.Combine(dir, "Line.ACD");
            File.WriteAllText(acd, "");
            var output = new StringWriter();
            var p = Commands.Register(new Protocol(output), pc, new Jobs(pc, Path.Combine(dir, "jobs"), Script(dir)) { PollMs = 1 }, Path.Combine(dir, "projects"));
            var m = Talk(p, output,
                "{\"id\":1,\"cmd\":\"detect\"}",
                "{\"id\":2,\"cmd\":\"writeL5x\",\"args\":{\"name\":\"Bottle: line\",\"text\":\"<RSLogix5000Content/>\"}}",
                "{\"id\":3,\"cmd\":\"import\",\"args\":{\"acd\":" + Json.Write(acd) + ",\"l5x\":\"C:\\\\x.L5X\",\"xpaths\":[\"Controller/Tags\"]}}",
                "{\"id\":4,\"cmd\":\"info\",\"args\":{\"project\":" + Json.Write(acd) + "}}",
                "{\"id\":5,\"cmd\":\"open\",\"args\":{\"file\":" + Json.Write(acd) + "}}",
                "{\"id\":6,\"cmd\":\"import\",\"args\":{\"acd\":\"C:\\\\gone.ACD\",\"l5x\":\"x\",\"xpaths\":[\"a\"]}}",
                "{\"id\":7,\"cmd\":\"open\",\"args\":{\"file\":" + Json.Write(Script(dir)) + "}}");
            var d = (Dictionary<string, object>)Answer(m, 1)["result"];
            Eq(true, d["ready"]); Eq("the SDK's virtual environment", d["python"]);
            string l5x = (string)((Dictionary<string, object>)Answer(m, 2)["result"])["path"];
            Eq(Path.Combine(dir, "projects", "Bottle_ line.L5X"), l5x);
            Eq("<RSLogix5000Content/>", File.ReadAllText(l5x));
            Eq("c", ((Dictionary<string, object>)Answer(m, 3)["result"])["project"]);
            Eq("AB_ETH-1\\10.0.0.5\\Backplane\\0", ((Dictionary<string, object>)Answer(m, 4)["result"])["commPath"]);
            Eq(acd, pc.Opened.Single());
            True(((string)Answer(m, 6)["error"]).StartsWith("There is no Studio 5000 project at"), (string)Answer(m, 6)["error"]);
            True(((string)Answer(m, 7)["error"]).StartsWith("Only a Studio 5000 project"), (string)Answer(m, 7)["error"]);

            // the import job: the user's ACD, the copy next to it, the L5X, the parts
            output = new StringWriter();
            p = Commands.Register(new Protocol(output), pc, new Jobs(pc, Path.Combine(dir, "jobs"), Script(dir)) { PollMs = 1 }, Path.Combine(dir, "projects"));
            Talk(p, output, "{\"id\":8,\"cmd\":\"import\",\"args\":{\"acd\":" + Json.Write(acd) + ",\"l5x\":\"C:\\\\x.L5X\",\"xpaths\":[\"Controller/DataTypes\",\"Controller/Tags\"]}}");
            Eq(acd, job["acd"]); Eq(Path.Combine(dir, "Line_ISA.ACD"), job["copy"]); Eq("C:\\x.L5X", job["l5x"]); Eq(2, ((List<object>)job["xpaths"]).Count);

            // no SDK: the import says what to install (and the .L5X way), the SDK is not started
            var bare = new FakePc().Logix("36.00.02");
            output = new StringWriter();
            p = Commands.Register(new Protocol(output), bare, new Jobs(bare, Path.Combine(dir, "jobs"), Script(dir)), Path.Combine(dir, "projects"));
            m = Talk(p, output, "{\"id\":9,\"cmd\":\"import\",\"args\":{\"acd\":" + Json.Write(acd) + ",\"l5x\":\"x\",\"xpaths\":[\"a\"]}}");
            True(((string)Answer(m, 9)["error"]).StartsWith("Rockwell's Logix Designer SDK is not installed") && bare.Started.Count == 0, (string)Answer(m, 9)["error"]);
        });

        Test("download: never without the confirm screen, leave for Program mode, a path; the choices to the job", () =>
        {
            var dir = TempDir();
            var pc = new FakePc().Logix("36.00.02").SdkFolder();
            pc.Present.Add(Venv); pc.WithSdk.Add(Venv);
            Dictionary<string, object> job = null;
            pc.Sdk = j => { job = (Dictionary<string, object>)Json.Parse(File.ReadAllText(j)); return Answers("{\"ok\":true,\"result\":{\"mode\":\"run\"}}")(j); };
            string copy = Path.Combine(dir, "Line_ISA.ACD");
            File.WriteAllText(copy, "");
            string P = Json.Write(copy), path = Json.Write("AB_ETH-1\\10.0.0.5\\Backplane\\0");
            var output = new StringWriter();
            var p = Commands.Register(new Protocol(output), pc, new Jobs(pc, Path.Combine(dir, "jobs"), Script(dir)) { PollMs = 1 }, dir);
            var m = Talk(p, output,
                "{\"id\":1,\"cmd\":\"download\",\"args\":{\"project\":" + P + ",\"commPath\":" + path + ",\"programAllowed\":true}}",
                "{\"id\":2,\"cmd\":\"download\",\"args\":{\"confirmed\":\"yes\",\"project\":" + P + ",\"commPath\":" + path + ",\"programAllowed\":true}}",
                "{\"id\":3,\"cmd\":\"download\",\"args\":{\"confirmed\":true,\"project\":" + P + ",\"commPath\":" + path + "}}",
                "{\"id\":4,\"cmd\":\"download\",\"args\":{\"confirmed\":true,\"project\":" + P + ",\"programAllowed\":true}}",
                "{\"id\":5,\"cmd\":\"download\",\"args\":{\"confirmed\":true,\"project\":" + P + ",\"commPath\":" + path + ",\"programAllowed\":true,\"runAfter\":true}}");
            True(((string)Answer(m, 1)["error"]).Contains("confirm screen") && ((string)Answer(m, 2)["error"]).Contains("confirm screen"), "no confirm, no download");
            True(((string)Answer(m, 3)["error"]).Contains("needs the controller in Program mode"), (string)Answer(m, 3)["error"]);
            True(((string)Answer(m, 4)["error"]).StartsWith("Enter the path to the controller"), (string)Answer(m, 4)["error"]);
            Eq(1, pc.Started.Count, "the SDK started once, for the confirmed one");
            Eq("run", ((Dictionary<string, object>)Answer(m, 5)["result"])["mode"]);
            Eq("download", job["cmd"]); Eq(true, job["confirmed"]); Eq(true, job["programAllowed"]); Eq(true, job["runAfter"]); Eq("AB_ETH-1\\10.0.0.5\\Backplane\\0", job["commPath"]);
        });

        Console.WriteLine($"Studio5000Bridge tests: all passed ({_passed})");
        return 0;
    }
}
