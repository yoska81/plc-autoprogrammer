// The answers to TIA Portal's questions during a download (the configurations its pre- and post-download
// delegates are handed), from what the user allowed on the app's confirm screen. Anything the app does not know
// stops the download: the user downloads from TIA Portal itself, where the question is shown in full.
using System;
using System.Collections.Generic;
using System.Linq;

namespace TiaBridge
{
    public sealed class DownloadAnswer
    {
        /// <summary>"select" (CurrentSelection = Value) / "password" / "refuse" (Why).</summary>
        public string Kind;
        public string Value;
        public string Why;
        public static DownloadAnswer Select(string v) => new DownloadAnswer { Kind = "select", Value = v };
        public static DownloadAnswer Refuse(string why) => new DownloadAnswer { Kind = "refuse", Why = why };
    }

    public static class DownloadPolicy
    {
        /// <summary>
        /// The answer to one configuration: its type name (StopModules, StartModules, ConsistentBlocksDownload …),
        /// the selections its enum has, TIA's message, and the user's choices.
        /// </summary>
        public static DownloadAnswer Decide(string type, IList<string> selections, string message, DownloadChoices c)
        {
            DownloadAnswer First(params string[] wanted)
            {
                var v = wanted.FirstOrDefault(w => selections.Contains(w));
                return v != null ? DownloadAnswer.Select(v) : Unknown();
            }
            DownloadAnswer Unknown() => DownloadAnswer.Refuse($"TIA Portal asked something the app does not answer ({type}{(string.IsNullOrWhiteSpace(message) ? "" : $": {message.Trim()}")}). Download from TIA Portal itself (Online › Download to device), where the question is shown in full.");
            switch (type)
            {
                case "StopModules":
                    return c.StopAllowed ? First("StopAll") : DownloadAnswer.Refuse("The PLC is running; the download has to stop it. Tick \"The PLC may be stopped\" on the confirm screen if that is safe, or stop it yourself.");
                case "StartModules":
                    return c.StartAfter ? First("StartModule") : First("NoAction");
                case "ConsistentBlocksDownload":
                case "AlarmTextLibrariesDownload":
                    return First("ConsistentDownload");
                case "AllBlocksDownload":
                    return First("DownloadAllBlocks");
                case "OverwriteSystemData":
                case "OverwriteTargetLanguages":
                    return First("Overwrite", "OverwriteAll");
                case "DownloadPasswordConfiguration":
                case "ModuleReadAccessPassword":
                case "ModuleWriteAccessPassword":
                    return c.Password != null ? new DownloadAnswer { Kind = "password" } : DownloadAnswer.Refuse("The PLC is protected by a password: enter it on the confirm screen (the app does not keep it).");
                default:
                    return Unknown();
            }
        }
    }
}
