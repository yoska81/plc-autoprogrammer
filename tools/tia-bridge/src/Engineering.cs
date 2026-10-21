// What the bridge asks of TIA Portal, as an interface (the commands are tested against a fake) and its real
// implementation, Openness, called by reflection: the bridge is compiled without Siemens.Engineering.dll and
// loads the one of the user's TIA Portal (Loader).
using System;
using System.Collections.Generic;

namespace TiaBridge
{
    public sealed class PortalInfo
    {
        public int ProcessId;
        /// <summary>The project open in it (null: none).</summary>
        public string ProjectPath;
    }

    public sealed class PlcInfo
    {
        public string Name;
        public string OrderNumber;
        public string Firmware;
    }

    public sealed class TagRow
    {
        public string Name, DataType, Address, Comment;
    }

    public sealed class ModuleRow
    {
        public string OrderNumber, Firmware;
        public int Slot;
    }

    public interface IEngineering
    {
        /// <summary>The TIA Portals running now (of the loaded version).</summary>
        IList<PortalInfo> Portals();
        /// <summary>Connects to a running TIA Portal (TIA asks the user once whether to allow it).</summary>
        void Attach(int processId);
        /// <summary>Starts a TIA Portal with its window.</summary>
        void Start();
        /// <summary>The project open in the connected TIA Portal (path), or null.</summary>
        string OpenProject();
        /// <summary>Opens the project at dir\name (creating it when it is not there); returns its file.</summary>
        string OpenOrCreate(string dir, string name);
        /// <summary>The firmware versions TIA Portal's hardware catalog has for an order number, newest first.</summary>
        IList<string> Firmware(string orderNumber);
        /// <summary>The project's PLC, or null.</summary>
        PlcInfo FindPlc();
        /// <summary>Adds a PLC (and its local modules) to the project.</summary>
        PlcInfo AddPlc(string orderNumber, string firmware, string name, IList<ModuleRow> modules, Action<string> problem);
        /// <summary>Writes tags into a tag table of the PLC (created when missing); returns how many were new.</summary>
        int WriteTags(string table, IList<TagRow> tags, Action<string, string> failed);
        void Save();
    }
}
