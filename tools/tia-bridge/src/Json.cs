// The small JSON the bridge speaks with the app (one object per line): objects are Dictionary<string, object>,
// arrays List<object>, numbers double, plus string, bool and null. No package: the bridge ships as one exe.
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace TiaBridge
{
    public static class Json
    {
        public static object Parse(string text)
        {
            int i = 0;
            object v = Value(text, ref i);
            Space(text, ref i);
            if (i != text.Length) throw new FormatException($"Unexpected '{text[i]}' at {i}.");
            return v;
        }

        static void Space(string s, ref int i) { while (i < s.Length && char.IsWhiteSpace(s[i])) i++; }

        static object Value(string s, ref int i)
        {
            Space(s, ref i);
            if (i >= s.Length) throw new FormatException("Unexpected end of JSON.");
            char c = s[i];
            if (c == '{')
            {
                var o = new Dictionary<string, object>();
                i++; Space(s, ref i);
                if (i < s.Length && s[i] == '}') { i++; return o; }
                while (true)
                {
                    Space(s, ref i);
                    if (i >= s.Length || s[i] != '"') throw new FormatException($"Expected a property name at {i}.");
                    string key = Str(s, ref i);
                    Space(s, ref i);
                    if (i >= s.Length || s[i] != ':') throw new FormatException($"Expected ':' at {i}.");
                    i++;
                    o[key] = Value(s, ref i);
                    Space(s, ref i);
                    if (i < s.Length && s[i] == ',') { i++; continue; }
                    if (i < s.Length && s[i] == '}') { i++; return o; }
                    throw new FormatException($"Expected ',' or '}}' at {i}.");
                }
            }
            if (c == '[')
            {
                var a = new List<object>();
                i++; Space(s, ref i);
                if (i < s.Length && s[i] == ']') { i++; return a; }
                while (true)
                {
                    a.Add(Value(s, ref i));
                    Space(s, ref i);
                    if (i < s.Length && s[i] == ',') { i++; continue; }
                    if (i < s.Length && s[i] == ']') { i++; return a; }
                    throw new FormatException($"Expected ',' or ']' at {i}.");
                }
            }
            if (c == '"') return Str(s, ref i);
            if (Word(s, ref i, "true")) return true;
            if (Word(s, ref i, "false")) return false;
            if (Word(s, ref i, "null")) return null;
            int start = i;
            while (i < s.Length && "+-0123456789.eE".IndexOf(s[i]) >= 0) i++;
            if (start == i) throw new FormatException($"Unexpected '{c}' at {i}.");
            return double.Parse(s.Substring(start, i - start), NumberStyles.Float, CultureInfo.InvariantCulture);
        }

        static bool Word(string s, ref int i, string w)
        {
            if (string.CompareOrdinal(s, i, w, 0, w.Length) != 0) return false;
            i += w.Length;
            return true;
        }

        static string Str(string s, ref int i)
        {
            var b = new StringBuilder();
            i++; // opening quote
            while (i < s.Length)
            {
                char c = s[i++];
                if (c == '"') return b.ToString();
                if (c != '\\') { b.Append(c); continue; }
                if (i >= s.Length) break;
                char e = s[i++];
                switch (e)
                {
                    case 'n': b.Append('\n'); break;
                    case 'r': b.Append('\r'); break;
                    case 't': b.Append('\t'); break;
                    case 'b': b.Append('\b'); break;
                    case 'f': b.Append('\f'); break;
                    case 'u':
                        if (i + 4 > s.Length) throw new FormatException("Bad \\u escape.");
                        b.Append((char)int.Parse(s.Substring(i, 4), NumberStyles.HexNumber, CultureInfo.InvariantCulture));
                        i += 4;
                        break;
                    default: b.Append(e); break;
                }
            }
            throw new FormatException("Unterminated string.");
        }

        public static string Write(object v)
        {
            var b = new StringBuilder();
            Write(b, v);
            return b.ToString();
        }

        static void Write(StringBuilder b, object v)
        {
            switch (v)
            {
                case null: b.Append("null"); break;
                case bool x: b.Append(x ? "true" : "false"); break;
                case string x: Quote(b, x); break;
                case int x: b.Append(x.ToString(CultureInfo.InvariantCulture)); break;
                case long x: b.Append(x.ToString(CultureInfo.InvariantCulture)); break;
                case double x: b.Append(x.ToString("R", CultureInfo.InvariantCulture)); break;
                case IDictionary<string, object> o:
                    b.Append('{');
                    bool first = true;
                    foreach (var kv in o) { if (!first) b.Append(','); first = false; Quote(b, kv.Key); b.Append(':'); Write(b, kv.Value); }
                    b.Append('}');
                    break;
                case System.Collections.IEnumerable a:
                    b.Append('[');
                    bool f = true;
                    foreach (var x in a) { if (!f) b.Append(','); f = false; Write(b, x); }
                    b.Append(']');
                    break;
                default: Quote(b, v.ToString()); break;
            }
        }

        static void Quote(StringBuilder b, string s)
        {
            b.Append('"');
            foreach (char c in s)
            {
                switch (c)
                {
                    case '"': b.Append("\\\""); break;
                    case '\\': b.Append("\\\\"); break;
                    case '\n': b.Append("\\n"); break;
                    case '\r': b.Append("\\r"); break;
                    case '\t': b.Append("\\t"); break;
                    default:
                        if (c < 0x20) b.Append("\\u").Append(((int)c).ToString("x4", CultureInfo.InvariantCulture));
                        else b.Append(c);
                        break;
                }
            }
            b.Append('"');
        }
    }
}
