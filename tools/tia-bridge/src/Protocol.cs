// The bridge's conversation with the app (electron/tiaBridge.cjs): one JSON object per line.
//   bridge → app, once at start:  {"ready":true,"protocol":1,"version":"…"}
//   app → bridge:                 {"id":7,"cmd":"detect","args":{…}}
//   bridge → app, while working:  {"id":7,"progress":"Opening TIA Portal V19…"}
//   bridge → app, at the end:     {"id":7,"ok":true,"result":{…}}  or  {"id":7,"ok":false,"error":"plain words"}
// Requests run one at a time, in order (Openness is not to be called from two threads), on a worker thread;
// an urgent command (Stop) is answered at once on the reading thread, even while a long request runs.
using System;
using System.Collections.Generic;
using System.Linq;
using System.Collections.Concurrent;
using System.IO;
using System.Threading;

namespace TiaBridge
{
    /// <summary>A command: its arguments and a way to report progress; returns the result (any JSON value).</summary>
    public delegate object Command(Dictionary<string, object> args, Action<string> progress);

    /// <summary>A failure the user can act on: its message goes to the app as it is.</summary>
    public sealed class BridgeError : Exception
    {
        public BridgeError(string message) : base(message) { }
    }

    public sealed class Protocol
    {
        public const int Version = 1;
        readonly Dictionary<string, Command> _commands = new Dictionary<string, Command>(StringComparer.Ordinal);
        readonly HashSet<string> _urgent = new HashSet<string>(StringComparer.Ordinal);
        readonly TextWriter _out;
        readonly object _gate = new object();

        public Protocol(TextWriter output) { _out = output; }

        public Protocol On(string name, Command run) { _commands[name] = run; return this; }

        /// <summary>A command answered as soon as it arrives, while other requests run (e.g. stop).</summary>
        public Protocol OnUrgent(string name, Command run) { _commands[name] = run; _urgent.Add(name); return this; }

        bool Urgent(string line)
        {
            if (_urgent.Count == 0) return false;
            try { return Json.Parse(line) is Dictionary<string, object> r && r.TryGetValue("cmd", out object c) && c is string s && _urgent.Contains(s); }
            catch (FormatException) { return false; }
        }

        void Send(Dictionary<string, object> message)
        {
            string line = Json.Write(message);
            lock (_gate) { _out.WriteLine(line); _out.Flush(); }
        }

        /// <summary>Reads requests until the input ends or "quit"; answers each one.</summary>
        public void Run(TextReader input, string bridgeVersion)
        {
            Send(new Dictionary<string, object> { ["ready"] = true, ["protocol"] = Version, ["version"] = bridgeVersion });
            var queue = new BlockingCollection<string>();
            var done = new ManualResetEventSlim();
            var worker = new Thread(() =>
            {
                foreach (var l in queue.GetConsumingEnumerable()) if (!Handle(l)) break;
                done.Set();
            }) { IsBackground = true, Name = "requests" };
            // Openness, UI Automation and SendKeys want a single-threaded apartment (Windows only)
#pragma warning disable CA1416 // Windows only; elsewhere (the tests) it throws and the default is kept
            try { worker.SetApartmentState(ApartmentState.STA); } catch (PlatformNotSupportedException) { /* not Windows: the tests */ }
#pragma warning restore CA1416
            worker.Start();
            string line;
            while (!done.IsSet && (line = input.ReadLine()) != null)
            {
                if (line.Trim().Length == 0) continue;
                if (Urgent(line)) Handle(line); else queue.Add(line);
            }
            queue.CompleteAdding();
            worker.Join();
        }

        /// <summary>Answers one request line; false after "quit".</summary>
        /// <summary>A request's arguments as the log keeps them: a password never (shown as "***").</summary>
        public static Dictionary<string, object> ForLog(Dictionary<string, object> args) =>
            args.ToDictionary(kv => kv.Key, kv => kv.Key.IndexOf("password", StringComparison.OrdinalIgnoreCase) >= 0 && kv.Value != null ? "***" : kv.Value);

        public bool Handle(string line)
        {
            object id = null;
            string cmd = null;
            try
            {
                if (!(Json.Parse(line) is Dictionary<string, object> req)) throw new BridgeError("The request is not a JSON object.");
                req.TryGetValue("id", out id);
                cmd = req.TryGetValue("cmd", out object c) ? c as string : null;
                var args = req.TryGetValue("args", out object a) && a is Dictionary<string, object> d ? d : new Dictionary<string, object>();
                Log.Write($"→ {id} {cmd} {Json.Write(ForLog(args))}");
                if (cmd == "quit") { Send(new Dictionary<string, object> { ["id"] = id, ["ok"] = true, ["result"] = null }); return false; }
                if (cmd == null || !_commands.TryGetValue(cmd, out Command run)) throw new BridgeError($"The bridge has no command \"{cmd}\" (update the app).");
                object result = run(args, (text) => { Log.Write($"… {id} {text}"); Send(new Dictionary<string, object> { ["id"] = id, ["progress"] = text }); });
                Log.Write($"← {id} ok");
                Send(new Dictionary<string, object> { ["id"] = id, ["ok"] = true, ["result"] = result });
            }
            catch (Exception err)
            {
                Log.Write($"← {id} {cmd} failed: {err}");
                Send(new Dictionary<string, object> { ["id"] = id, ["ok"] = false, ["error"] = Plain(err) });
            }
            return true;
        }

        /// <summary>The message the user sees: a BridgeError as it is; anything else with the innermost cause.</summary>
        public static string Plain(Exception err)
        {
            if (err is BridgeError) return err.Message;
            if (err is FormatException) return $"The app sent a request the bridge could not read ({err.Message}).";
            var inner = err;
            while (inner.InnerException != null) inner = inner.InnerException;
            if (inner is BridgeError) return inner.Message;
            // TIA Portal refused the connection: the user answered No, or is not allowed to use Openness
            if (inner.GetType().Name == "EngineeringSecurityException")
                return "TIA Portal did not allow ISA Auto Programmer to connect. When TIA Portal asks whether to allow it, answer Yes; and check that your Windows user is in the \"Siemens TIA Openness\" group (Check this PC).";
            // Openness itself missing from TIA Portal (a version the bridge does not know)
            if (inner is MissingMethodException || inner is MissingMemberException)
                return $"This TIA Portal version does not offer what the app needs ({inner.Message}). Send us the log (Send to TIA Portal shows where it is).";
            return $"TIA Portal reported: {inner.Message}";
        }
    }
}
