// The bridge's own tests: JSON, the protocol (one answer per request, progress, errors in plain words, quit)
// and detect on made-up PCs. Run with:  dotnet run --project tools/tia-bridge/tests
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using TiaBridge;

static class Tests
{
    static int _passed;
    static void Test(string name, Action body) { body(); _passed++; Console.WriteLine($"  ok  {name}"); }
    static void Eq(object want, object got, string what = "") { if (!Equals(want, got)) throw new Exception($"{what}: expected {want}, got {got}"); }
    static void True(bool ok, string what) { if (!ok) throw new Exception(what); }

    sealed class FakePc : IMachine
    {
        public Dictionary<string, string[]> Keys = new Dictionary<string, string[]>();
        public Dictionary<string, string> Values = new Dictionary<string, string>();
        public HashSet<string> Files = new HashSet<string>();
        public List<string> Groups = new List<string>();
        public string[] SubKeys(string path) => Keys.TryGetValue(path, out var k) ? k : new string[0];
        public string Value(string path, string name) => Values.TryGetValue($@"{path}|{name}", out var v) ? v : null;
        public bool FileExists(string path) => Files.Contains(path);
        public string ProgramFiles => @"C:\Program Files";
        public string UserName => @"PC1\tech";
        public IEnumerable<string> UserGroups() => Groups;
    }

    sealed class EngineeringSecurityException : Exception { public EngineeringSecurityException() : base("Access denied") { } }

    /// <summary>A TIA Portal in memory: what the commands asked of it, and what it answers.</summary>
    sealed class FakeTia : IEngineering
    {
        public List<string> Calls = new List<string>();
        public List<PortalInfo> Running = new List<PortalInfo>();
        public string Project;
        public PlcInfo Plc;
        public Dictionary<string, List<string>> Catalog = new Dictionary<string, List<string>> { ["6ES7214-1AG40-0XB0"] = new List<string> { "V4.6", "V4.5", "V4.4" }, ["6ES7221-1BH32-0XB0"] = new List<string> { "V2.2" } };
        public Dictionary<string, TagRow> Tags = new Dictionary<string, TagRow>();
        public bool Refuse;
        public IList<PortalInfo> Portals() { Calls.Add("portals"); return Running; }
        public void Attach(int id) { Calls.Add($"attach {id}"); if (Refuse) throw new System.Reflection.TargetInvocationException(new EngineeringSecurityException()); Project = Running.First(r => r.ProcessId == id).ProjectPath; }
        public void Start() { Calls.Add("start"); Project = null; }
        public string OpenProject() => Project;
        public string OpenOrCreate(string dir, string name) { Calls.Add($"openOrCreate {dir} {name}"); return Project = $@"{dir}\{name}\{name}.ap19"; }
        public IList<string> Firmware(string order) => Catalog.TryGetValue(order.Replace(" ", ""), out var v) ? v : new List<string>();
        public PlcInfo FindPlc() => Plc;
        public PlcInfo AddPlc(string order, string fw, string name, IList<ModuleRow> modules, Action<string> problem)
        {
            Calls.Add($"addPlc {order} {fw} {name} {string.Join(",", modules.Select(m => $"{m.OrderNumber}@{m.Slot}"))}");
            foreach (var m in modules) if (Firmware(m.OrderNumber).Count == 0) problem($"{m.OrderNumber}: not in this TIA Portal's hardware catalog");
            return Plc = new PlcInfo { Name = name, OrderNumber = Opennessish(order), Firmware = fw };
        }
        static string Opennessish(string o) => Openness.TypeOrder(o);
        public int WriteTags(string table, IList<TagRow> tags, Action<string, string> failed)
        {
            Calls.Add($"tags {table} {tags.Count}");
            int created = 0;
            foreach (var t in tags)
            {
                if (t.Address == "%Q999.0") { failed(t.Name, "The address is outside the CPU's range."); continue; }
                if (!Tags.ContainsKey(t.Name)) created++;
                Tags[t.Name] = t;
            }
            return created;
        }
        public void Save() => Calls.Add("save");
    }

    static FakePc ReadyPc() { var pc = WithTia(19); pc.Groups.Add("Siemens TIA Openness"); return pc; }

    static FakePc WithTia(params int[] versions)
    {
        var pc = new FakePc();
        pc.Keys[Detect.OpennessKey] = versions.Select(v => $"{v}.0").ToArray();
        foreach (int v in versions)
        {
            pc.Files.Add(Path.Combine(@"C:\Program Files", "Siemens", "Automation", $"Portal V{v}", "Bin", "Siemens.Automation.Portal.exe"));
            string api = $@"{Detect.OpennessKey}\{v}.0\PublicAPI";
            pc.Keys[api] = new[] { $"{v}.0.0.0" };
            string dll = $@"C:\Program Files\Siemens\Automation\Portal V{v}\PublicAPI\V{v}\Siemens.Engineering.dll";
            pc.Values[$@"{api}\{v}.0.0.0|Siemens.Engineering"] = dll;
            pc.Values[$@"{api}\{v}.0.0.0|PublicKeyToken"] = "d29ec89bac048f84";
            pc.Files.Add(dll);
        }
        return pc;
    }

    static List<Dictionary<string, object>> Talk(Protocol p, StringWriter output, params string[] lines)
    {
        foreach (var l in lines) if (!p.Handle(l)) break;
        return output.ToString().Split('\n').Where(l => l.Trim().Length > 0).Select(l => (Dictionary<string, object>)Json.Parse(l)).ToList();
    }

    static int Main()
    {
        Test("JSON: parse and write round-trip, escapes and unicode", () =>
        {
            var v = (Dictionary<string, object>)Json.Parse("{\"a\":[1,2.5,-3e2],\"s\":\"q\\\"\\\\\\n\\u00e9\",\"t\":true,\"n\":null,\"o\":{}}");
            Eq(-300.0, ((List<object>)v["a"])[2]);
            Eq("q\"\\\né", v["s"]);
            Eq("{\"a\":[1,2.5,-300],\"s\":\"q\\\"\\\\\\né\",\"t\":true,\"n\":null,\"o\":{}}", Json.Write(v));
            True(Json.Write("\u0001").Contains("\\u0001"), "control characters escaped");
            try { Json.Parse("{\"a\":}"); throw new Exception("no error"); } catch (FormatException) { }
        });

        Test("protocol: ready line, one answer per request with its id, progress before it", () =>
        {
            var output = new StringWriter();
            var p = new Protocol(output).On("work", (args, progress) => { progress("half way"); return new Dictionary<string, object> { ["got"] = args["x"] }; });
            p.Run(new StringReader("{\"id\":1,\"cmd\":\"work\",\"args\":{\"x\":\"y\"}}\n\n{\"id\":2,\"cmd\":\"quit\"}\n{\"id\":3,\"cmd\":\"work\"}\n"), "0.1.0");
            var m = output.ToString().Split('\n').Where(l => l.Trim().Length > 0).Select(l => (Dictionary<string, object>)Json.Parse(l)).ToList();
            Eq(true, m[0]["ready"]); Eq(1.0, m[0]["protocol"]);
            Eq("half way", m[1]["progress"]); Eq(1.0, m[1]["id"]);
            Eq(true, m[2]["ok"]); Eq("y", ((Dictionary<string, object>)m[2]["result"])["got"]);
            Eq(2.0, m[3]["id"]); Eq(true, m[3]["ok"]);
            Eq(4, m.Count, "nothing after quit");
        });

        Test("protocol: unknown command, bad JSON and a failing command answer in plain words; the bridge goes on", () =>
        {
            var output = new StringWriter();
            var p = new Protocol(output)
                .On("fails", (a, pr) => throw new BridgeError("Open TIA Portal first."))
                .On("crashes", (a, pr) => throw new InvalidOperationException("outer", new InvalidOperationException("The project is read-only.")));
            var m = Talk(p, output, "{\"id\":1,\"cmd\":\"nope\"}", "not json", "{\"id\":3,\"cmd\":\"fails\"}", "{\"id\":4,\"cmd\":\"crashes\"}", "{\"id\":5,\"cmd\":\"quit\"}");
            Eq(false, m[0]["ok"]); True(((string)m[0]["error"]).Contains("no command \"nope\""), "unknown command");
            Eq(false, m[1]["ok"]); Eq(null, m[1]["id"]); True(((string)m[1]["error"]).Contains("could not read"), "bad JSON");
            Eq("Open TIA Portal first.", m[2]["error"]);
            Eq("TIA Portal reported: The project is read-only.", m[3]["error"]);
            Eq(true, m[4]["ok"]);
        });

        Test("detect: no TIA Portal at all", () =>
        {
            var r = Detect.Run(new FakePc());
            Eq(false, r.Ready);
            True(r.Steps.Single().Contains("not installed"), string.Join("|", r.Steps));
        });

        Test("detect: TIA Portal without Openness", () =>
        {
            var pc = WithTia(19);
            pc.Keys.Remove(Detect.OpennessKey);
            var r = Detect.Run(pc);
            Eq("V19", r.Installed.Single());
            Eq(0, r.Openness.Count);
            True(r.Steps.Single().Contains("tick \"TIA Openness\""), "how to add Openness");
        });

        Test("detect: Openness installed, user not in the group: the steps say how to add the user", () =>
        {
            var r = Detect.Run(WithTia(18, 20));
            Eq("V20", r.Openness[0].Version, "newest first");
            Eq(@"C:\Program Files\Siemens\Automation\Portal V20\PublicAPI\V20\Siemens.Engineering.dll", r.Openness[0].DllPath);
            Eq("d29ec89bac048f84", r.Openness[0].PublicKeyToken);
            Eq(false, r.InOpennessGroup);
            True(r.Steps.Any(s => s.Contains("net localgroup \"Siemens TIA Openness\" \"PC1\\tech\" /add")), "the command");
            True(r.Steps.Any(s => s.Contains("sign out")), "sign out");
        });

        Test("detect: ready when the user is in the group (local group name with the PC's prefix)", () =>
        {
            var pc = WithTia(19);
            pc.Groups.Add(@"PC1\Siemens TIA Openness");
            var r = Detect.Run(pc);
            Eq(true, r.Ready); Eq(0, r.Steps.Count);
            var j = r.ToJson();
            Eq(true, j["ready"]);
            True(Json.Write(j).Contains("\"version\":\"V19\""), Json.Write(j));
        });

        Test("detect: a registry entry whose DLL is gone, and versions the bridge does not know, are skipped", () =>
        {
            var pc = WithTia(19);
            pc.Files.RemoveWhere(f => f.EndsWith("Siemens.Engineering.dll"));
            pc.Keys[Detect.OpennessKey] = new[] { "19.0", "15.1", "junk" };
            Eq(0, Detect.Run(pc).Openness.Count);
        });

        Test("the detect command reports progress and returns the result", () =>
        {
            var output = new StringWriter();
            var pc = WithTia(17); pc.Groups.Add("Siemens TIA Openness");
            var m = Talk(Commands.Register(new Protocol(output), pc), output, "{\"id\":9,\"cmd\":\"detect\"}");
            True(((string)m[0]["progress"]).Contains("Looking for TIA Portal"), "progress");
            Eq(true, ((Dictionary<string, object>)m[1]["result"])["ready"]);
        });

        Test("open: refused when the PC is not ready (the detect steps), started TIA Portal creates the project", () =>
        {
            var output = new StringWriter();
            var tia = new FakeTia();
            var m = Talk(Commands.Register(new Protocol(output), WithTia(19), api => tia), output, "{\"id\":1,\"cmd\":\"open\",\"args\":{}}");
            True(((string)m[0]["error"]).Contains("Siemens TIA Openness"), "not in the group");
            output = new StringWriter();
            m = Talk(Commands.Register(new Protocol(output), ReadyPc(), api => tia), output,
                "{\"id\":2,\"cmd\":\"open\",\"args\":{\"dir\":\"C:\\\\TIA\",\"name\":\"Bottle line: 2\"}}");
            True(((string)m[0]["progress"]).Contains("Starting TIA Portal V19") && ((string)m[0]["progress"]).Contains("answer Yes"), "progress says to answer Yes");
            var r = (Dictionary<string, object>)m.Last()["result"];
            Eq("V19", r["version"]);
            Eq(@"C:\TIA\Bottle line_ 2\Bottle line_ 2.ap19", r["project"]);
            Eq(null, r["plc"]);
            Eq("start|openOrCreate C:\\TIA Bottle line_ 2", string.Join("|", tia.Calls));
            // no folder given: Documents\ISA Auto Programmer\TIA
            output = new StringWriter();
            m = Talk(Commands.Register(new Protocol(output), ReadyPc(), api => new FakeTia()), output, "{\"id\":3,\"cmd\":\"open\",\"args\":{\"name\":\"L\"}}");
            True(((string)((Dictionary<string, object>)m.Last()["result"])["project"]).StartsWith(Commands.DefaultDir()), "default folder");
            True(Commands.DefaultDir().EndsWith(Path.Combine("ISA Auto Programmer", "TIA")), Commands.DefaultDir());
        });

        Test("open: attach to a running TIA Portal keeps its open project; a refusal says what to do", () =>
        {
            var output = new StringWriter();
            var tia = new FakeTia();
            tia.Running.Add(new PortalInfo { ProcessId = 4242, ProjectPath = @"D:\Line\Line.ap19" });
            var p = Commands.Register(new Protocol(output), ReadyPc(), api => tia);
            var m = Talk(p, output, "{\"id\":1,\"cmd\":\"portals\"}", "{\"id\":2,\"cmd\":\"open\",\"args\":{\"processId\":4242}}");
            Eq(4242.0, ((Dictionary<string, object>)((List<object>)((Dictionary<string, object>)m[0]["result"])["portals"])[0])["processId"]);
            Eq(@"D:\Line\Line.ap19", ((Dictionary<string, object>)m.Last()["result"])["project"]);
            True(!tia.Calls.Any(c => c.StartsWith("openOrCreate")), "no new project");
            tia.Refuse = true;
            output = new StringWriter();
            m = Talk(Commands.Register(new Protocol(output), ReadyPc(), api => tia), output, "{\"id\":3,\"cmd\":\"open\",\"args\":{\"processId\":4242}}");
            True(((string)m.Last()["error"]).StartsWith("TIA Portal did not allow ISA Auto Programmer"), (string)m.Last()["error"]);
        });

        Test("plc: newest firmware by default, modules with theirs; a module not in the catalog is a problem, not a failure", () =>
        {
            var output = new StringWriter();
            var tia = new FakeTia();
            var p = Commands.Register(new Protocol(output), ReadyPc(), api => tia);
            var m = Talk(p, output, "{\"id\":1,\"cmd\":\"plc\",\"args\":{\"orderNumber\":\"6ES7214-1AG40-0XB0\"}}");
            Eq("Open TIA Portal first.", m[0]["error"]);
            output = new StringWriter(); p = Commands.Register(new Protocol(output), ReadyPc(), api => tia);
            m = Talk(p, output,
                "{\"id\":2,\"cmd\":\"open\",\"args\":{\"dir\":\"C:\\\\TIA\",\"name\":\"L\"}}",
                "{\"id\":3,\"cmd\":\"firmware\",\"args\":{\"orderNumber\":\"6ES7214-1AG40-0XB0\"}}",
                "{\"id\":4,\"cmd\":\"plc\",\"args\":{\"orderNumber\":\"6ES7214-1AG40-0XB0\",\"name\":\"PLC_1\",\"modules\":[{\"orderNumber\":\"6ES7221-1BH32-0XB0\",\"slot\":2},{\"orderNumber\":\"6ES7999-0XX00-0XB0\",\"slot\":3}]}}");
            var fw = (Dictionary<string, object>)m.First(x => Equals(x.GetValueOrDefault("id"), 3.0) && x.ContainsKey("result"))["result"];
            Eq("V4.6", ((List<object>)fw["versions"])[0]);
            var plc = (Dictionary<string, object>)m.Last()["result"];
            Eq(true, plc["added"]);
            Eq("V4.6", ((Dictionary<string, object>)plc["plc"])["firmware"]);
            Eq("6ES7 214-1AG40-0XB0", ((Dictionary<string, object>)plc["plc"])["orderNumber"]);
            True(((string)((List<object>)plc["problems"]).Single()).Contains("6ES7999"), "the unknown module");
            True(tia.Calls.Contains("addPlc 6ES7214-1AG40-0XB0 V4.6 PLC_1 6ES7221-1BH32-0XB0@2,6ES7999-0XX00-0XB0@3") && tia.Calls.Last() == "save", string.Join("|", tia.Calls));
            // again: the PLC is there, kept; another CPU in the project is refused in words
            output = new StringWriter(); p = Commands.Register(new Protocol(output), ReadyPc(), api => tia);
            m = Talk(p, output, "{\"id\":5,\"cmd\":\"open\",\"args\":{\"dir\":\"C:\\\\TIA\",\"name\":\"L\"}}", "{\"id\":6,\"cmd\":\"plc\",\"args\":{\"orderNumber\":\"6ES7 214-1AG40-0XB0\",\"firmware\":\"V4.4\"}}");
            Eq(false, ((Dictionary<string, object>)m.Last()["result"])["added"]);
            m = Talk(p, output, "{\"id\":7,\"cmd\":\"plc\",\"args\":{\"orderNumber\":\"6ES7215-1AG40-0XB0\"}}");
            True(((string)m.Last()["error"]).Contains("already has a PLC"), "another CPU");
            tia.Plc = null;
            m = Talk(p, output, "{\"id\":8,\"cmd\":\"plc\",\"args\":{\"orderNumber\":\"6ES7215-1AG40-0XB0\"}}");
            True(((string)m.Last()["error"]).Contains("not in this TIA Portal's hardware catalog"), "no firmware");
        });

        Test("tags: into the app's own table; new and updated counted, a refused tag reported with TIA's reason", () =>
        {
            var output = new StringWriter();
            var tia = new FakeTia();
            var p = Commands.Register(new Protocol(output), ReadyPc(), api => tia);
            const string tags = "[{\"name\":\"Start_PB\",\"dataType\":\"Bool\",\"logicalAddress\":\"%I0.0\",\"comment\":\"Start\"},{\"name\":\"Bad\",\"dataType\":\"Bool\",\"logicalAddress\":\"%Q999.0\"},{\"name\":\"NoType\"}]";
            var m = Talk(p, output, "{\"id\":1,\"cmd\":\"open\",\"args\":{\"dir\":\"C:\\\\TIA\",\"name\":\"L\"}}", $"{{\"id\":2,\"cmd\":\"tags\",\"args\":{{\"tags\":{tags}}}}}", $"{{\"id\":3,\"cmd\":\"tags\",\"args\":{{\"tags\":{tags}}}}}");
            var first = (Dictionary<string, object>)m.First(x => Equals(x.GetValueOrDefault("id"), 2.0) && x.ContainsKey("result"))["result"];
            Eq("ISA Auto Programmer", first["table"]); Eq(1.0 * 1, Convert.ToDouble(first["created"])); Eq(0.0, Convert.ToDouble(first["updated"]));
            Eq("The address is outside the CPU's range.", ((Dictionary<string, object>)((List<object>)first["failed"]).Single())["error"]);
            var second = (Dictionary<string, object>)m.Last()["result"];
            Eq(0.0, Convert.ToDouble(second["created"])); Eq(1.0, Convert.ToDouble(second["updated"]));
            Eq("Start", tia.Tags["Start_PB"].Comment);
            True(tia.Calls.Count(c => c == "tags ISA Auto Programmer 2") == 2, "2 tags with a type each time");
        });

        Test("order numbers and firmware: TIA's spaced form; V4.10 after V4.9", () =>
        {
            Eq("6ES7 214-1AG40-0XB0", Openness.TypeOrder("6es7214-1ag40-0xb0"));
            Eq("6ES7 214-1AG40-0XB0", Openness.TypeOrder("6ES7 214-1AG40-0XB0"));
            Eq("V4.10|V4.9|V4.2", string.Join("|", new[] { "V4.2", "V4.10", "V4.9" }.OrderByDescending(v => v, Openness.Firmware_)));
            Eq("Line_ A_B", Commands.Safe("Line: A/B"));
        });

        Console.WriteLine($"TiaBridge tests: all passed ({_passed})");
        return 0;
    }
}
