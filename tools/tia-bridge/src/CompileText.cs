// TIA Portal's compile messages as the app maps them to rungs: the block and the network a message is about,
// read from its path ("PLC_1 > Program blocks > Conveyor > Network 3") or its text ("Network 3: …").
using System.Text.RegularExpressions;

namespace TiaBridge
{
    public static class CompileText
    {
        static readonly Regex NetworkRx = new Regex(@"\b(?:Network|Netzwerk|NW)\s*(\d+)\b", RegexOptions.IgnoreCase);

        public static CompileMessage Message(string severity, string path, string text)
        {
            var m = new CompileMessage { Severity = severity, Path = path ?? "", Text = text ?? "" };
            var parts = m.Path.Split('>');
            for (int i = 0; i < parts.Length; i++)
            {
                var n = NetworkRx.Match(parts[i]);
                if (n.Success) { m.Network = int.Parse(n.Groups[1].Value); if (i > 0) m.Block = Name(parts[i - 1]); break; }
            }
            if (m.Network == null)
            {
                var n = NetworkRx.Match(m.Text);
                if (n.Success) m.Network = int.Parse(n.Groups[1].Value);
                // the last part of the path that is not a folder of TIA's tree is the block
                for (int i = parts.Length - 1; i >= 0 && m.Block == null; i--) { string p = parts[i].Trim(); if (p.Length > 0 && !Regex.IsMatch(p, "^(Program blocks|PLC tags|Programmbausteine|PLC-Variablen)$", RegexOptions.IgnoreCase) && i > 0) m.Block = Name(p); }
            }
            return m;
        }

        /// <summary>"Main (OB1)" → "Main".</summary>
        static string Name(string part) => Regex.Replace(part.Trim(), @"\s*\([A-Z]+\d*\)$", "");
    }
}
