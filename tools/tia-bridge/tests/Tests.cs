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

        Console.WriteLine($"TiaBridge tests: all passed ({_passed})");
        return 0;
    }
}
