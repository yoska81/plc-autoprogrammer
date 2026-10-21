// The commands the bridge answers:
//   ping · detect · portals · open (attach to a running TIA Portal or start one, open or create the project)
//   · firmware (of an order number, newest first) · plc (add the CPU and its local modules) · tags (PLC tag table).
using System;
using System.Collections.Generic;
using System.Linq;

namespace TiaBridge
{
    public static class Commands
    {
        /// <summary>The tag table the app writes (its own: the user's tables are never touched).</summary>
        public const string TagTable = "ISA Auto Programmer";

        public static Protocol Register(Protocol p, IMachine machine, Func<OpennessApi, IEngineering> connect = null)
        {
            connect = connect ?? (api => new Openness(api));
            IEngineering tia = null;
            string version = null;
            IEngineering Tia() => tia ?? throw new BridgeError("Open TIA Portal first.");

            // The TIA Openness to use: the version asked for, else the newest; only when this PC may use it.
            OpennessApi Api(Dictionary<string, object> args)
            {
                var found = Detect.Run(machine);
                if (!found.Ready) throw new BridgeError(string.Join(" ", found.Steps));
                string want = Str(args, "version");
                return want == null ? found.Openness[0] : found.Openness.FirstOrDefault(o => o.Version == want)
                    ?? throw new BridgeError($"TIA Openness {want} is not installed on this PC (found {string.Join(", ", found.Openness.Select(o => o.Version))}).");
            }
            IEngineering For(OpennessApi api)
            {
                if (tia == null || version != api.Version) { tia = connect(api); version = api.Version; }
                return tia;
            }

            p.On("ping", (args, progress) => new Dictionary<string, object> { ["pong"] = true });
            p.On("detect", (args, progress) =>
            {
                progress("Looking for TIA Portal and TIA Openness…");
                var r = Detect.Run(machine);
                foreach (var o in r.Openness) Log.Write($"openness {o.Version} {o.AssemblyVersion} {o.DllPath}");
                Log.Write($"user {r.User} in group: {r.InOpennessGroup}");
                return r.ToJson();
            });
            p.On("portals", (args, progress) =>
            {
                var api = Api(args);
                return new Dictionary<string, object>
                {
                    ["version"] = api.Version,
                    ["portals"] = For(api).Portals().Select(x => (object)new Dictionary<string, object> { ["processId"] = x.ProcessId, ["project"] = x.ProjectPath }).ToList(),
                };
            });
            p.On("open", (args, progress) =>
            {
                var api = Api(args);
                var e = For(api);
                int? pid = Num(args, "processId");
                if (pid.HasValue)
                {
                    progress($"Connecting to TIA Portal {api.Version}… TIA Portal asks whether to allow ISA Auto Programmer: answer Yes.");
                    e.Attach(pid.Value);
                }
                else
                {
                    progress($"Starting TIA Portal {api.Version} (this takes a minute)… TIA Portal asks whether to allow ISA Auto Programmer: answer Yes.");
                    e.Start();
                }
                string project = e.OpenProject();
                if (project == null)
                {
                    string dir = Str(args, "dir") ?? DefaultDir();
                    string name = Str(args, "name") ?? throw new BridgeError("Give the TIA Portal project a name.");
                    progress($"Opening the project {name}…");
                    project = e.OpenOrCreate(dir, Safe(name));
                }
                return new Dictionary<string, object> { ["version"] = api.Version, ["project"] = project, ["plc"] = Plc(e.FindPlc()) };
            });
            p.On("firmware", (args, progress) =>
            {
                string order = Str(args, "orderNumber") ?? throw new BridgeError("No order number.");
                return new Dictionary<string, object> { ["orderNumber"] = order, ["versions"] = Tia().Firmware(order).Cast<object>().ToList() };
            });
            p.On("plc", (args, progress) =>
            {
                var e = Tia();
                string order = Str(args, "orderNumber") ?? throw new BridgeError("No order number.");
                var have = e.FindPlc();
                if (have != null)
                {
                    if (!SameOrder(have.OrderNumber, order))
                        throw new BridgeError($"The TIA Portal project already has a PLC ({have.Name}, {have.OrderNumber}), not the project's {order}. Open an empty project for this program, or change the PLC on the PLC page.");
                    return new Dictionary<string, object> { ["plc"] = Plc(have), ["added"] = false, ["problems"] = new List<object>() };
                }
                string fw = Str(args, "firmware") ?? e.Firmware(order).FirstOrDefault()
                    ?? throw new BridgeError($"{order} is not in this TIA Portal's hardware catalog. Update TIA Portal or install its hardware support package (HSP).");
                var modules = (args.TryGetValue("modules", out object m) && m is List<object> list ? list : new List<object>())
                    .OfType<Dictionary<string, object>>()
                    .Select(x => new ModuleRow { OrderNumber = Str(x, "orderNumber"), Firmware = Str(x, "firmware"), Slot = Num(x, "slot") ?? 0 })
                    .Where(x => x.OrderNumber != null).ToList();
                var problems = new List<object>();
                progress($"Adding the PLC {order} ({fw}){(modules.Count > 0 ? $" and {modules.Count} module(s)" : "")}…");
                var plc = e.AddPlc(order, fw, Safe(Str(args, "name") ?? "PLC_1"), modules, problems.Add);
                e.Save();
                return new Dictionary<string, object> { ["plc"] = Plc(plc), ["added"] = true, ["problems"] = problems };
            });
            p.On("tags", (args, progress) =>
            {
                var e = Tia();
                var rows = (args.TryGetValue("tags", out object t) && t is List<object> list ? list : new List<object>())
                    .OfType<Dictionary<string, object>>()
                    .Select(x => new TagRow { Name = Str(x, "name"), DataType = Str(x, "dataType"), Address = Str(x, "logicalAddress") ?? "", Comment = Str(x, "comment") })
                    .Where(x => x.Name != null && x.DataType != null).ToList();
                progress($"Writing {rows.Count} PLC tags into the tag table \"{TagTable}\"…");
                var failed = new List<object>();
                int created = e.WriteTags(TagTable, rows, (name, why) => failed.Add(new Dictionary<string, object> { ["name"] = name, ["error"] = why }));
                e.Save();
                return new Dictionary<string, object> { ["table"] = TagTable, ["created"] = created, ["updated"] = rows.Count - created - failed.Count, ["failed"] = failed };
            });
            return p;
        }

        /// <summary>Where new TIA Portal projects go unless the app says otherwise: Documents\ISA Auto Programmer\TIA.</summary>
        public static string DefaultDir() => System.IO.Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "ISA Auto Programmer", "TIA");

        static Dictionary<string, object> Plc(PlcInfo plc) => plc == null ? null : new Dictionary<string, object> { ["name"] = plc.Name, ["orderNumber"] = plc.OrderNumber, ["firmware"] = plc.Firmware };

        static string Str(Dictionary<string, object> a, string k) => a.TryGetValue(k, out object v) && v is string s && s.Trim().Length > 0 ? s.Trim() : null;
        static int? Num(Dictionary<string, object> a, string k) => a.TryGetValue(k, out object v) && v is double d ? (int)d : (int?)null;
        static bool SameOrder(string a, string b) => string.Equals((a ?? "").Replace(" ", ""), (b ?? "").Replace(" ", ""), StringComparison.OrdinalIgnoreCase);

        /// <summary>A name TIA Portal takes for a project or device (no \ / : * ? " &lt; &gt; |).</summary>
        public static string Safe(string name)
        {
            var s = new string(name.Select(c => "\\/:*?\"<>|".IndexOf(c) >= 0 ? '_' : c).ToArray()).Trim();
            return s.Length == 0 ? "Machine" : s.Length > 80 ? s.Substring(0, 80) : s;
        }
    }
}
