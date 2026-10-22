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

    /// <summary>One file of the program to import: a SimaticML block (xml) or an SCL external source (scl).</summary>
    public sealed class BlockFile
    {
        public string Name, Kind, Text;
    }

    public sealed class CompileMessage
    {
        /// <summary>"error" / "warning".</summary>
        public string Severity;
        /// <summary>Where TIA Portal says it is ("PLC_1 > Program blocks > Conveyor > Network 3").</summary>
        public string Path;
        public string Text;
        /// <summary>The block and network number read from the path / text (null when it names none).</summary>
        public string Block;
        public int? Network;
    }

    public sealed class CompileResult
    {
        public int Errors, Warnings;
        public List<CompileMessage> Messages = new List<CompileMessage>();
    }

    /// <summary>A network card of this PC that can reach the PLC (TIA's PC interface), with the PLC's interfaces it reaches.</summary>
    public sealed class PcInterfaceInfo
    {
        public string Name;
        public int Number;
        public List<string> Targets = new List<string>();
    }

    /// <summary>What the user allowed on the app's confirm screen.</summary>
    public sealed class DownloadChoices
    {
        /// <summary>The PLC may be stopped for the download (TIA asks when it is in RUN).</summary>
        public bool StopAllowed;
        /// <summary>Start the PLC after the download.</summary>
        public bool StartAfter;
        /// <summary>The PLC's access password (null: none given).</summary>
        public string Password;
    }

    public sealed class DownloadOutcome
    {
        /// <summary>"success" / "warning" / "error" / "refused" (the bridge stopped it: a question it does not answer, or not allowed).</summary>
        public string State;
        public int Errors, Warnings;
        public List<string> Messages = new List<string>();
        /// <summary>The questions TIA asked and how they were answered, for the log and the dialog.</summary>
        public List<string> Answers = new List<string>();
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
        /// <summary>Imports the files in order (SimaticML replaces a block of the same name; an SCL source generates its blocks); failed(name, why) for each one TIA refuses.</summary>
        void ImportBlocks(IList<BlockFile> files, Action<string> progress, Action<string, string> failed);
        /// <summary>Compiles the PLC's software (blocks and tags).</summary>
        CompileResult Compile();
        /// <summary>The PC interfaces (PN/IE) that reach the PLC, and the PLC's IP address in the project (null: none set).</summary>
        IList<PcInterfaceInfo> DownloadInterfaces();
        string PlcAddress();
        /// <summary>Every program block of the PLC exported as SimaticML (name, xml), in the project's order; failed(name, why) for one TIA does not export (know-how protected, not compiled). Read only.</summary>
        IList<KeyValuePair<string, string>> ExportBlocks(Action<string> progress, Action<string, string> failed);
        /// <summary>Every PLC tag of every tag table. Read only.</summary>
        IList<TagRow> ReadTags();
        /// <summary>Downloads hardware and software to the PLC through a PC interface; TIA's questions answered by DownloadPolicy.</summary>
        DownloadOutcome Download(string pcInterface, int number, string target, DownloadChoices choices, Action<string> progress);
        void Save();
    }
}
