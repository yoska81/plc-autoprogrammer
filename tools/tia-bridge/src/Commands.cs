// The commands the bridge answers. This first version: detect (what the PC has) and ping (is it alive).
using System.Collections.Generic;

namespace TiaBridge
{
    public static class Commands
    {
        public static Protocol Register(Protocol p, IMachine machine)
        {
            p.On("ping", (args, progress) => new Dictionary<string, object> { ["pong"] = true });
            p.On("detect", (args, progress) =>
            {
                progress("Looking for TIA Portal and TIA Openness…");
                var r = Detect.Run(machine);
                foreach (var o in r.Openness) Log.Write($"openness {o.Version} {o.AssemblyVersion} {o.DllPath}");
                Log.Write($"user {r.User} in group: {r.InOpennessGroup}");
                return r.ToJson();
            });
            return p;
        }
    }
}
