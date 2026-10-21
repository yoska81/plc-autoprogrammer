// Loads Siemens.Engineering.dll of the user's TIA Portal: from the folder the registry names, only when its
// strong name is Siemens' (the registry's PublicKeyToken), with the other Siemens.Engineering.* assemblies it
// needs resolved from the same folder (Siemens' AssemblyResolve pattern).
using System;
using System.IO;
using System.Linq;
using System.Reflection;

namespace TiaBridge
{
    public static class Loader
    {
        static Assembly _engineering;
        static string _dir;

        public static Assembly Engineering => _engineering ?? throw new BridgeError("TIA Portal is not open yet.");

        public static Assembly Load(OpennessApi api)
        {
            if (_engineering != null)
            {
                if (string.Equals(Path.GetDirectoryName(api.DllPath), _dir, StringComparison.OrdinalIgnoreCase)) return _engineering;
                throw new BridgeError($"TIA Portal {api.Version} needs the app restarted (another TIA Portal version was used since it started).");
            }
            _dir = Path.GetDirectoryName(api.DllPath);
            var token = AssemblyName.GetAssemblyName(api.DllPath).GetPublicKeyToken() ?? new byte[0];
            string hex = string.Concat(token.Select(b => b.ToString("x2")));
            if (string.IsNullOrEmpty(api.PublicKeyToken) || !string.Equals(hex, api.PublicKeyToken, StringComparison.OrdinalIgnoreCase))
                throw new BridgeError($"The TIA Openness file {api.DllPath} is not signed by Siemens as the registry says (token {hex}). Repair the TIA Portal installation.");
            AppDomain.CurrentDomain.AssemblyResolve += (sender, e) =>
            {
                string name = new AssemblyName(e.Name).Name;
                if (!name.StartsWith("Siemens.Engineering", StringComparison.Ordinal)) return null;
                string file = Path.Combine(_dir, name + ".dll");
                return File.Exists(file) ? Assembly.LoadFrom(file) : null;
            };
            _engineering = Assembly.LoadFrom(api.DllPath);
            Log.Write($"loaded {_engineering.FullName} from {api.DllPath}");
            return _engineering;
        }
    }
}
