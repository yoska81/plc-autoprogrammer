// ISA Auto Programmer's bridge to the CODESYS Development System: it runs the user's CODESYS headless with a job
// script (CODESYS ScriptEngine) to put the program into a project and build it. Started by the desktop app
// (electron/codesysBridge.cjs) as  CodesysBridge.exe --log "<user data>\logs\codesys-bridge.log"  and spoken to
// over stdin / stdout (tools/tia-bridge/src/Protocol.cs, shared).
using System;
using System.IO;
using System.Reflection;
using System.Text;
using TiaBridge;

namespace CodesysBridge
{
    public static class Program
    {
        public static int Main(string[] args)
        {
            for (int i = 0; i + 1 < args.Length; i++) if (args[i] == "--log") Log.Open(args[i + 1]);
            string version = Assembly.GetExecutingAssembly().GetName().Version.ToString(3);
            Log.Write($"codesys bridge {version} started");
            var utf8 = new UTF8Encoding(false);
            var output = new StreamWriter(Console.OpenStandardOutput(), utf8) { AutoFlush = true };
            var input = new StreamReader(Console.OpenStandardInput(), utf8);
            var pc = new WindowsMachine();
            string script = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "isa_job.py");
            var jobs = new Jobs(pc, Path.Combine(Path.GetTempPath(), "isa-codesys"), script);
            string projects = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "ISA Auto Programmer", "CODESYS");
            Commands.Register(new Protocol(output), pc, jobs, projects).Run(input, version);
            Log.Write("codesys bridge stopped");
            return 0;
        }
    }
}
