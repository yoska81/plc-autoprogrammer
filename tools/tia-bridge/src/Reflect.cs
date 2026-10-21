// Calls into Siemens.Engineering by name (the bridge has no compile-time reference to it). Every call is logged.
using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;

namespace TiaBridge
{
    public static class R
    {
        /// <summary>A type of Siemens.Engineering by its full name.</summary>
        public static Type T(string fullName) =>
            Loader.Engineering.GetType(fullName) ?? throw new BridgeError($"This TIA Openness version has no {fullName}.");

        public static object Get(object o, string prop)
        {
            var p = o.GetType().GetProperty(prop, BindingFlags.Public | BindingFlags.Instance) ?? throw new MissingMemberException(o.GetType().FullName, prop);
            return p.GetValue(o, null);
        }

        public static void Set(object o, string prop, object value)
        {
            Log.Write($"openness set {o.GetType().Name}.{prop}");
            var p = o.GetType().GetProperty(prop, BindingFlags.Public | BindingFlags.Instance) ?? throw new MissingMemberException(o.GetType().FullName, prop);
            p.SetValue(o, value, null);
        }

        /// <summary>A public method by name whose parameters take these arguments.</summary>
        public static object Call(object o, string method, params object[] args) => Invoke(o.GetType(), o, method, args);

        public static object CallStatic(Type t, string method, params object[] args) => Invoke(t, null, method, args);

        static object Invoke(Type t, object target, string method, object[] args)
        {
            Log.Write($"openness {t.Name}.{method}({string.Join(", ", args.Select(a => a?.ToString() ?? "null"))})");
            var flags = BindingFlags.Public | (target == null ? BindingFlags.Static : BindingFlags.Instance) | BindingFlags.FlattenHierarchy;
            var m = t.GetMethods(flags).FirstOrDefault(x => x.Name == method && !x.IsGenericMethodDefinition && Fits(x.GetParameters(), args))
                ?? throw new MissingMethodException(t.FullName, method);
            return m.Invoke(target, args);
        }

        static bool Fits(ParameterInfo[] ps, object[] args) =>
            ps.Length == args.Length && ps.Zip(args, (p, a) => a == null ? !p.ParameterType.IsValueType : p.ParameterType.IsInstanceOfType(a)).All(x => x);

        /// <summary>obj.GetService&lt;T&gt;() for a service type of Siemens.Engineering (null when the object has none).</summary>
        public static object Service(object o, string serviceType)
        {
            var m = o.GetType().GetMethods(BindingFlags.Public | BindingFlags.Instance).FirstOrDefault(x => x.Name == "GetService" && x.IsGenericMethodDefinition && x.GetParameters().Length == 0);
            return m?.MakeGenericMethod(T(serviceType)).Invoke(o, null);
        }

        public static IEnumerable<object> Items(object composition) => ((IEnumerable)composition).Cast<object>();

        /// <summary>An enum value of Siemens.Engineering by name.</summary>
        public static object Enum(string type, string value) => System.Enum.Parse(T(type), value);

        /// <summary>An attribute of an engineering object (GetAttribute), or null when it has none.</summary>
        public static object Attribute(object o, string name)
        {
            try { return Call(o, "GetAttribute", name); } catch (Exception) { return null; }
        }

        /// <summary>The innermost exception of a reflection call.</summary>
        public static Exception Inner(Exception e) { while ((e is TargetInvocationException || e.InnerException != null) && e.InnerException != null) e = e.InnerException; return e; }
    }
}
