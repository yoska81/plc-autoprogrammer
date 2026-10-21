// ISA Auto Programmer's bridge to TIA Portal (Openness). Started by the desktop app (electron/tiaBridge.cjs):
//   TiaBridge.exe --log "<user data>\logs\tia-bridge.log"
// and spoken to over stdin / stdout (Protocol.cs). Siemens.Engineering.dll is never shipped with it: it is loaded
// from the user's own TIA Portal installation when a command needs it.
using System;
using System.IO;
using System.Reflection;
using System.Text;

namespace TiaBridge
{
    public static class Program
    {
        public static int Main(string[] args)
        {
            for (int i = 0; i + 1 < args.Length; i++) if (args[i] == "--log") Log.Open(args[i + 1]);
            string version = Assembly.GetExecutingAssembly().GetName().Version.ToString(3);
            Log.Write($"bridge {version} started");
            var utf8 = new UTF8Encoding(false);
            var output = new StreamWriter(Console.OpenStandardOutput(), utf8) { AutoFlush = true };
            var input = new StreamReader(Console.OpenStandardInput(), utf8);
            Commands.Register(new Protocol(output), new WindowsMachine()).Run(input, version);
            Log.Write("bridge stopped");
            return 0;
        }
    }
}
