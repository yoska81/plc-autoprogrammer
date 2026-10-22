// ISA Auto Programmer's bridge to Studio 5000 Logix Designer, through Rockwell's Logix Designer SDK (the user's
// licence): it runs the SDK's Python client with a job script to put the program into the user's project (a copy)
// and, from the app's confirm screen, download it. Started by the desktop app (electron/studio5000Bridge.cjs) as
// Studio5000Bridge.exe --log "<user data>\logs\studio5000-bridge.log"  and spoken to over stdin / stdout
// (tools/tia-bridge/src/Protocol.cs, shared).
using System;
using System.IO;
using System.Reflection;
using System.Text;
using TiaBridge;

namespace Studio5000Bridge
{
    public static class Program
    {
        public static int Main(string[] args)
        {
            for (int i = 0; i + 1 < args.Length; i++) if (args[i] == "--log") Log.Open(args[i + 1]);
            string version = Assembly.GetExecutingAssembly().GetName().Version.ToString(3);
            Log.Write($"studio 5000 bridge {version} started");
            var utf8 = new UTF8Encoding(false);
            var output = new StreamWriter(Console.OpenStandardOutput(), utf8) { AutoFlush = true };
            var input = new StreamReader(Console.OpenStandardInput(), utf8);
            var pc = new WindowsMachine();
            string script = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "isa_logix_job.py");
            var jobs = new Jobs(pc, Path.Combine(Path.GetTempPath(), "isa-studio5000"), script);
            string projects = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "ISA Auto Programmer", "Studio 5000");
            Commands.Register(new Protocol(output), pc, jobs, projects).Run(input, version);
            Log.Write("studio 5000 bridge stopped");
            return 0;
        }
    }
}
