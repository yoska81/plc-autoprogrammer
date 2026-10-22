// IEngineering on the real TIA Portal, through TIA Openness (Siemens.Engineering, by reflection: R).
// Names as in the Openness API: TiaPortal.GetProcesses / TiaPortalProcess.Attach, new TiaPortal(TiaPortalMode),
// Projects.Create / Open, HardwareCatalog.Find, Devices.CreateWithItem, DeviceItem.PlugNew,
// GetService<SoftwareContainer>().Software (PlcSoftware), TagTableGroup.TagTables, PlcTagTable.Tags,
// CPU.GetService<DownloadProvider>(): Configuration.Modes.Find("PN/IE").PcInterfaces / TargetInterfaces, Download;
// PlcBlock.Export (SimaticML, ExportOptions.WithDefaults) through BlockGroup.Blocks / Groups for the read back.
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;

namespace TiaBridge
{
    public sealed class Openness : IEngineering
    {
        readonly OpennessApi _api;
        object _portal;
        object _project;

        public Openness(OpennessApi api) { _api = api; Loader.Load(api); }

        /// <summary>"V19" → 19: TIA project files are .ap19.</summary>
        int Major => int.Parse(_api.Version.TrimStart('V'));

        object Portal => _portal ?? throw new BridgeError("TIA Portal is not open yet.");
        object Project => _project ?? throw new BridgeError("No TIA Portal project is open yet.");

        public IList<PortalInfo> Portals() =>
            R.Items(R.CallStatic(R.T("Siemens.Engineering.TiaPortal"), "GetProcesses"))
                .Select(p => new PortalInfo { ProcessId = (int)R.Get(p, "Id"), ProjectPath = (R.Get(p, "ProjectPath") as FileInfo)?.FullName })
                .ToList();

        public void Attach(int processId)
        {
            var proc = R.Items(R.CallStatic(R.T("Siemens.Engineering.TiaPortal"), "GetProcesses")).FirstOrDefault(p => (int)R.Get(p, "Id") == processId)
                ?? throw new BridgeError("That TIA Portal is no longer running. Check again.");
            _portal = R.Call(proc, "Attach");
            _project = R.Items(R.Get(_portal, "Projects")).FirstOrDefault();
        }

        public void Start()
        {
            _portal = Activator.CreateInstance(R.T("Siemens.Engineering.TiaPortal"), R.Enum("Siemens.Engineering.TiaPortalMode", "WithUserInterface"));
            _project = null;
        }

        public string OpenProject() => _project == null ? null : (R.Get(_project, "Path") as FileInfo)?.FullName;

        public string OpenOrCreate(string dir, string name)
        {
            var projects = R.Get(Portal, "Projects");
            var file = new FileInfo(Path.Combine(dir, name, $"{name}.ap{Major}"));
            _project = file.Exists ? R.Call(projects, "Open", file) : R.Call(projects, "Create", new DirectoryInfo(dir), name);
            return (R.Get(_project, "Path") as FileInfo)?.FullName ?? file.FullName;
        }

        public IList<string> Firmware(string orderNumber)
        {
            var catalog = R.Get(Portal, "HardwareCatalog");
            return R.Items(R.Call(catalog, "Find", TypeOrder(orderNumber)))
                .Select(e => R.Get(e, "TypeIdentifier") as string)
                .Where(t => t != null && t.StartsWith("OrderNumber:" + TypeOrder(orderNumber) + "/", StringComparison.OrdinalIgnoreCase))
                .Select(t => t.Substring(t.LastIndexOf('/') + 1))
                .Distinct()
                .OrderByDescending(v => v, Firmware_)
                .ToList();
        }

        public PlcInfo FindPlc()
        {
            foreach (var device in R.Items(R.Get(Project, "Devices")))
                foreach (var item in AllItems(device))
                {
                    var sw = R.Service(item, "Siemens.Engineering.HW.Features.SoftwareContainer");
                    if (sw == null || R.Get(sw, "Software")?.GetType().Name != "PlcSoftware") continue;
                    return new PlcInfo { Name = R.Get(item, "Name") as string, OrderNumber = R.Attribute(item, "OrderNumber") as string, Firmware = R.Attribute(item, "FirmwareVersion") as string };
                }
            return null;
        }

        public PlcInfo AddPlc(string orderNumber, string firmware, string name, IList<ModuleRow> modules, Action<string> problem)
        {
            var device = R.Call(R.Get(Project, "Devices"), "CreateWithItem", $"OrderNumber:{TypeOrder(orderNumber)}/{firmware}", name, name);
            var rack = R.Items(R.Get(device, "DeviceItems")).First();
            foreach (var m in modules)
            {
                string fw = m.Firmware ?? Firmware(m.OrderNumber).FirstOrDefault();
                if (fw == null) { problem($"{m.OrderNumber}: not in this TIA Portal's hardware catalog (install its HSP or update TIA Portal), not added."); continue; }
                string type = $"OrderNumber:{TypeOrder(m.OrderNumber)}/{fw}";
                try
                {
                    if (!(bool)R.Call(rack, "CanPlugNew", type, $"{m.OrderNumber} ({m.Slot})", m.Slot)) { problem($"{m.OrderNumber} does not fit slot {m.Slot}, not added."); continue; }
                    R.Call(rack, "PlugNew", type, $"{m.OrderNumber} ({m.Slot})", m.Slot);
                }
                catch (Exception e) { problem($"{m.OrderNumber} in slot {m.Slot}: {R.Inner(e).Message}"); }
            }
            return FindPlc() ?? throw new BridgeError("TIA Portal added the CPU but it has no PLC program part (check the order number).");
        }

        object PlcSoftware()
        {
            foreach (var device in R.Items(R.Get(Project, "Devices")))
                foreach (var item in AllItems(device))
                {
                    var sw = R.Service(item, "Siemens.Engineering.HW.Features.SoftwareContainer");
                    var soft = sw == null ? null : R.Get(sw, "Software");
                    if (soft?.GetType().Name == "PlcSoftware") return soft;
                }
            throw new BridgeError("The TIA Portal project has no PLC yet.");
        }

        public int WriteTags(string table, IList<TagRow> tags, Action<string, string> failed)
        {
            var tables = R.Get(R.Get(PlcSoftware(), "TagTableGroup"), "TagTables");
            var t = R.Call(tables, "Find", table) ?? R.Call(tables, "Create", table);
            var list = R.Get(t, "Tags");
            int created = 0;
            foreach (var row in tags)
            {
                try
                {
                    var tag = R.Call(list, "Find", row.Name);
                    if (tag == null) { tag = R.Call(list, "Create", row.Name, row.DataType, row.Address); created++; }
                    else { R.Set(tag, "DataTypeName", row.DataType); R.Set(tag, "LogicalAddress", row.Address); }
                    if (!string.IsNullOrEmpty(row.Comment))
                    {
                        var item = R.Items(R.Get(R.Get(tag, "Comment"), "Items")).FirstOrDefault();
                        if (item != null) R.Set(item, "Text", row.Comment);
                    }
                }
                catch (Exception e) { failed(row.Name, R.Inner(e).Message); }
            }
            return created;
        }

        public void ImportBlocks(IList<BlockFile> files, Action<string> progress, Action<string, string> failed)
        {
            var sw = PlcSoftware();
            // the files go through a folder of their own (Openness imports from files), removed afterwards
            string dir = Path.Combine(Path.GetTempPath(), "isa-tia-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(dir);
            try
            {
                foreach (var f in files)
                {
                    progress($"Importing {f.Name}…");
                    string file = Path.Combine(dir, Path.GetFileName(f.Name));
                    File.WriteAllText(file, f.Text, new System.Text.UTF8Encoding(true));
                    try
                    {
                        if (f.Kind == "scl")
                        {
                            var sources = R.Get(R.Get(sw, "ExternalSourceGroup"), "ExternalSources");
                            var old = R.Call(sources, "Find", f.Name);
                            if (old != null) R.Call(old, "Delete");
                            var source = R.Call(sources, "CreateFromFile", f.Name, file);
                            R.Call(source, "GenerateBlocksFromSource");
                        }
                        else R.Call(R.Get(R.Get(sw, "BlockGroup"), "Blocks"), "Import", new FileInfo(file), R.Enum("Siemens.Engineering.ImportOptions", "Override"));
                    }
                    catch (Exception e) { failed(f.Name, R.Inner(e).Message); }
                }
            }
            finally { try { Directory.Delete(dir, true); } catch (Exception) { /* a temp folder */ } }
        }

        public CompileResult Compile()
        {
            var service = R.Service(PlcSoftware(), "Siemens.Engineering.Compiler.ICompilable") ?? throw new BridgeError("This TIA Portal cannot compile the PLC from another program.");
            var result = R.Call(service, "Compile");
            var r = new CompileResult { Errors = Convert.ToInt32(R.Get(result, "ErrorCount")), Warnings = Convert.ToInt32(R.Get(result, "WarningCount")) };
            void Walk(object messages, string path)
            {
                foreach (var m in R.Items(messages))
                {
                    string here = R.Get(m, "Path") as string;
                    string at = string.IsNullOrEmpty(here) ? path : here;
                    var inner = R.Get(m, "Messages");
                    bool leaf = !R.Items(inner).Any();
                    string state = R.Get(m, "State")?.ToString();
                    if (leaf && (state == "Error" || state == "Warning")) r.Messages.Add(CompileText.Message(state == "Error" ? "error" : "warning", at, R.Get(m, "Description") as string ?? ""));
                    Walk(inner, at);
                }
            }
            Walk(R.Get(result, "Messages"), "");
            return r;
        }

        /// <summary>The CPU (the device item holding the PLC software).</summary>
        object Cpu()
        {
            foreach (var device in R.Items(R.Get(Project, "Devices")))
                foreach (var item in AllItems(device))
                {
                    var sw = R.Service(item, "Siemens.Engineering.HW.Features.SoftwareContainer");
                    if (sw != null && R.Get(sw, "Software")?.GetType().Name == "PlcSoftware") return item;
                }
            throw new BridgeError("The TIA Portal project has no PLC yet.");
        }

        // The download provider the interfaces were listed from: its target interfaces belong to it, so the download
        // uses the same one (a new GetService<DownloadProvider>() would silently fall back to the default interface).
        object _download;

        object Mode()
        {
            _download = R.Service(Cpu(), "Siemens.Engineering.Download.DownloadProvider") ?? throw new BridgeError("This PLC cannot be downloaded from another program.");
            return R.Call(R.Get(R.Get(_download, "Configuration"), "Modes"), "Find", "PN/IE") ?? throw new BridgeError("This PC has no Ethernet (PN/IE) interface TIA Portal can use to reach the PLC.");
        }

        public IList<PcInterfaceInfo> DownloadInterfaces() =>
            R.Items(R.Get(Mode(), "PcInterfaces")).Select(i => new PcInterfaceInfo
            {
                Name = R.Get(i, "Name") as string,
                Number = Convert.ToInt32(R.Get(i, "Number")),
                Targets = R.Items(R.Get(i, "TargetInterfaces")).Select(t => R.Get(t, "Name") as string).ToList(),
            }).ToList();

        public string PlcAddress()
        {
            try
            {
                foreach (var item in AllItems(Cpu()))
                {
                    var ni = R.Service(item, "Siemens.Engineering.HW.Features.NetworkInterface");
                    var node = ni == null ? null : R.Items(R.Get(ni, "Nodes")).FirstOrDefault();
                    if (node != null && R.Attribute(node, "Address") is string a && a.Length > 0) return a;
                }
            }
            catch (Exception e) { Log.Write($"plc address: {R.Inner(e).Message}"); }
            return null;
        }

        public DownloadOutcome Download(string pcInterface, int number, string target, DownloadChoices choices, Action<string> progress)
        {
            if (_download == null) DownloadInterfaces();
            var pc = R.Items(R.Get(R.Call(R.Get(R.Get(_download, "Configuration"), "Modes"), "Find", "PN/IE"), "PcInterfaces"))
                .FirstOrDefault(i => R.Get(i, "Name") as string == pcInterface && Convert.ToInt32(R.Get(i, "Number")) == number)
                ?? throw new BridgeError($"The PC interface \"{pcInterface}\" is gone (a cable or adapter changed?). Check again.");
            var to = R.Items(R.Get(pc, "TargetInterfaces")).FirstOrDefault(t => target == null || R.Get(t, "Name") as string == target)
                ?? throw new BridgeError($"The PLC is not reachable through \"{pcInterface}\".");
            var outcome = new DownloadOutcome();
            string refused = null;
            var handler = new Answerer(choices, outcome, why => refused = refused ?? why);
            var del = R.T("Siemens.Engineering.Download.DownloadConfigurationDelegate");
            var method = typeof(Answerer).GetMethod(nameof(Answerer.Answer));
            var pre = Delegate.CreateDelegate(del, handler, method);
            var post = Delegate.CreateDelegate(del, handler, method);
            var optType = R.T("Siemens.Engineering.Download.DownloadOptions");
            var options = System.Enum.ToObject(optType, Convert.ToInt32(System.Enum.Parse(optType, "Hardware")) | Convert.ToInt32(System.Enum.Parse(optType, "Software")));
            progress("Downloading to the PLC…");
            object result;
            try { result = R.Call(_download, "Download", to, pre, post, options); }
            catch (Exception e)
            {
                if (refused == null) throw;
                Log.Write($"download stopped by the bridge: {R.Inner(e).Message}");
                result = null;
            }
            if (refused != null) { outcome.State = "refused"; outcome.Messages.Insert(0, refused); return outcome; }
            string state = R.Get(result, "State")?.ToString() ?? "";
            outcome.State = state == "Error" ? "error" : state == "Warning" ? "warning" : "success";
            outcome.Errors = Convert.ToInt32(Try(() => R.Get(result, "ErrorCount")) ?? 0);
            outcome.Warnings = Convert.ToInt32(Try(() => R.Get(result, "WarningCount")) ?? 0);
            void Walk(object messages)
            {
                foreach (var m in R.Items(messages))
                {
                    var inner = Try(() => R.Get(m, "Messages"));
                    bool leaf = inner == null || !R.Items(inner).Any();
                    string st = Try(() => R.Get(m, "State"))?.ToString();
                    if (leaf && (st == "Error" || st == "Warning")) outcome.Messages.Add($"{st}: {Try(() => R.Get(m, "Message"))}");
                    if (!leaf) Walk(inner);
                }
            }
            if (Try(() => R.Get(result, "Messages")) is object msgs) Walk(msgs);
            return outcome;
        }

        static object Try(Func<object> f) { try { return f(); } catch (Exception) { return null; } }

        /// <summary>Answers each configuration TIA Portal hands the download delegates (DownloadPolicy); a refusal stops the download.</summary>
        public sealed class Answerer
        {
            readonly DownloadChoices _c; readonly DownloadOutcome _o; readonly Action<string> _refuse;
            public Answerer(DownloadChoices c, DownloadOutcome o, Action<string> refuse) { _c = c; _o = o; _refuse = refuse; }

            public void Answer(object configuration)
            {
                string type = configuration.GetType().Name;
                var sel = configuration.GetType().GetProperty("CurrentSelection");
                var names = sel != null && sel.PropertyType.IsEnum ? System.Enum.GetNames(sel.PropertyType) : new string[0];
                string message = Try(() => R.Get(configuration, "Message"))?.ToString();
                var a = DownloadPolicy.Decide(type, names, message, _c);
                Log.Write($"download asks {type} [{string.Join(", ", names)}] {message} → {a.Kind} {a.Value}{a.Why}");
                if (a.Kind == "select") { sel.SetValue(configuration, System.Enum.Parse(sel.PropertyType, a.Value), null); _o.Answers.Add($"{type}: {a.Value}"); return; }
                if (a.Kind == "password")
                {
                    var pw = new System.Security.SecureString();
                    foreach (char ch in _c.Password) pw.AppendChar(ch);
                    R.Call(configuration, "SetPassword", pw);
                    _o.Answers.Add($"{type}: password given");
                    return;
                }
                _refuse(a.Why);
                throw new BridgeError(a.Why);
            }
        }

        public IList<KeyValuePair<string, string>> ExportBlocks(Action<string> progress, Action<string, string> failed)
        {
            var sw = PlcSoftware();
            var outList = new List<KeyValuePair<string, string>>();
            string dir = Path.Combine(Path.GetTempPath(), "isa-tia-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(dir);
            try
            {
                void Group(object g)
                {
                    foreach (var b in R.Items(R.Get(g, "Blocks")))
                    {
                        string name = R.Get(b, "Name") as string;
                        progress($"Reading {name}…");
                        try
                        {
                            if (Try(() => R.Get(b, "IsKnowHowProtected")) is bool kh && kh) { failed(name, "know-how protected: TIA Portal does not give its content to other programs"); continue; }
                            var file = new FileInfo(Path.Combine(dir, $"{outList.Count:D4}.xml"));
                            R.Call(b, "Export", file, R.Enum("Siemens.Engineering.ExportOptions", "WithDefaults"));
                            outList.Add(new KeyValuePair<string, string>(name, File.ReadAllText(file.FullName)));
                        }
                        catch (Exception e) { failed(name, $"{R.Inner(e).Message} (compile the PLC in TIA Portal, then read again)"); }
                    }
                    foreach (var sub in R.Items(R.Get(g, "Groups"))) Group(sub);
                }
                Group(R.Get(sw, "BlockGroup"));
            }
            finally { try { Directory.Delete(dir, true); } catch (Exception) { /* a temp folder */ } }
            return outList;
        }

        public IList<TagRow> ReadTags()
        {
            var rows = new List<TagRow>();
            void Group(object g)
            {
                foreach (var t in R.Items(R.Get(g, "TagTables")))
                    foreach (var tag in R.Items(R.Get(t, "Tags")))
                        rows.Add(new TagRow
                        {
                            Name = R.Get(tag, "Name") as string,
                            DataType = R.Get(tag, "DataTypeName") as string,
                            Address = R.Get(tag, "LogicalAddress") as string,
                            Comment = Try(() => R.Get(R.Items(R.Get(R.Get(tag, "Comment"), "Items")).FirstOrDefault() ?? new object(), "Text")) as string ?? "",
                        });
                foreach (var sub in R.Items(R.Get(g, "Groups"))) Group(sub);
            }
            Group(R.Get(PlcSoftware(), "TagTableGroup"));
            return rows;
        }

        public void Save() => R.Call(Project, "Save");

        static IEnumerable<object> AllItems(object parent)
        {
            foreach (var item in R.Items(R.Get(parent, "DeviceItems")))
            {
                yield return item;
                foreach (var sub in AllItems(item)) yield return sub;
            }
        }

        /// <summary>"6ES7214-1AG40-0XB0" → "6ES7 214-1AG40-0XB0" (TIA's order numbers have the space).</summary>
        public static string TypeOrder(string orderNumber)
        {
            string o = orderNumber.Trim().ToUpperInvariant();
            return o.Length > 4 && o[4] != ' ' && o.StartsWith("6ES7", StringComparison.Ordinal) ? $"{o.Substring(0, 4)} {o.Substring(4)}" : o;
        }

        /// <summary>Firmware versions by number ("V4.10" after "V4.9").</summary>
        public static readonly IComparer<string> Firmware_ = Comparer<string>.Create((a, b) =>
        {
            int[] x = Nums(a), y = Nums(b);
            for (int i = 0; i < Math.Max(x.Length, y.Length); i++)
            {
                int c = (i < x.Length ? x[i] : 0).CompareTo(i < y.Length ? y[i] : 0);
                if (c != 0) return c;
            }
            return 0;
        });

        static int[] Nums(string v) => v.TrimStart('V', 'v').Split('.').Select(s => int.TryParse(s, out int n) ? n : 0).ToArray();
    }
}
