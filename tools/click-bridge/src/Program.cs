// ISA Auto Programmer's bridge to CLICK Programming Software (AutomationDirect publishes no API): it drives the
// program's windows through Windows UI Automation while the user watches. Started by the desktop app
// (electron/clickBridge.cjs) as  ClickBridge.exe --log "<user data>\logs\click-bridge.log"  and spoken to over
// stdin / stdout (tools/tia-bridge/src/Protocol.cs, shared).
using System;
using System.IO;
using System.Reflection;
using System.Text;
using TiaBridge;

namespace ClickBridge
{
    public static class Program
    {
        [STAThread]
        public static int Main(string[] args)
        {
            string logDir = null;
            for (int i = 0; i + 1 < args.Length; i++) if (args[i] == "--log") { Log.Open(args[i + 1]); logDir = Path.GetDirectoryName(Path.GetFullPath(args[i + 1])); }
            string version = Assembly.GetExecutingAssembly().GetName().Version.ToString(3);
            Log.Write($"click bridge {version} started");
            var utf8 = new UTF8Encoding(false);
            var output = new StreamWriter(Console.OpenStandardOutput(), utf8) { AutoFlush = true };
            var input = new StreamReader(Console.OpenStandardInput(), utf8);
            Commands.Register(new Protocol(output), new WindowsPc(), new UiaUi(), StopKey.Watch, logDir).Run(input, version);
            Log.Write("click bridge stopped");
            return 0;
        }
    }
}
