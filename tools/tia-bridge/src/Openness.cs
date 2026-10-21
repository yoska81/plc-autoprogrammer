// IEngineering on the real TIA Portal, through TIA Openness (Siemens.Engineering, by reflection: R).
// Names as in the Openness API: TiaPortal.GetProcesses / TiaPortalProcess.Attach, new TiaPortal(TiaPortalMode),
// Projects.Create / Open, HardwareCatalog.Find, Devices.CreateWithItem, DeviceItem.PlugNew,
// GetService<SoftwareContainer>().Software (PlcSoftware), TagTableGroup.TagTables, PlcTagTable.Tags.
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
