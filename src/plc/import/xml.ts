/**
 * A small XML reader for PLC export files (L5X, PLCopen, TIA Portal Openness). Works the same in the
 * browser and in node tests (no DOMParser): elements, attributes, text, CDATA, comments, the usual
 * entities. Namespaces are kept in the tag name; `local` gives the name without the prefix.
 */
export interface XNode {
  name: string;
  attrs: Record<string, string>;
  children: XNode[];
  /** Text and CDATA directly inside this element, joined. */
  text: string;
}

const ENT: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };
const decode = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) =>
  e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENT[e] ?? m);

export function parseXml(src: string): XNode {
  const s = src.replace(/^\uFEFF/, '');
  const root: XNode = { name: '#root', attrs: {}, children: [], text: '' };
  const stack: XNode[] = [root];
  let i = 0;
  while (i < s.length) {
    const lt = s.indexOf('<', i);
    if (lt < 0) { stack[stack.length - 1].text += decode(s.slice(i)); break; }
    if (lt > i) stack[stack.length - 1].text += decode(s.slice(i, lt));
    if (s.startsWith('<![CDATA[', lt)) {
      const end = s.indexOf(']]>', lt);
      if (end < 0) throw new Error('XML: unterminated CDATA');
      stack[stack.length - 1].text += s.slice(lt + 9, end);
      i = end + 3;
    } else if (s.startsWith('<!--', lt)) {
      const end = s.indexOf('-->', lt);
      i = end < 0 ? s.length : end + 3;
    } else if (s.startsWith('<?', lt) || s.startsWith('<!', lt)) {
      const end = s.indexOf('>', lt);
      i = end < 0 ? s.length : end + 1;
    } else if (s[lt + 1] === '/') {
      const end = s.indexOf('>', lt);
      const name = s.slice(lt + 2, end).trim();
      // Close up to the matching element (tolerates sloppy files).
      let k = stack.length - 1;
      while (k > 0 && stack[k].name !== name) k--;
      if (k > 0) stack.length = k;
      i = end + 1;
    } else {
      // Start tag: name, attributes (quoted values may contain ">").
      let j = lt + 1;
      const nm = /^[^\s/>]+/.exec(s.slice(j));
      if (!nm) throw new Error(`XML: bad tag at ${lt}`);
      const node: XNode = { name: nm[0], attrs: {}, children: [], text: '' };
      j += nm[0].length;
      const attrRe = /\s*([^\s=/>]+)\s*=\s*("([^"]*)"|'([^']*)')/y;
      for (;;) {
        attrRe.lastIndex = j;
        const m = attrRe.exec(s);
        if (!m) break;
        node.attrs[m[1]] = decode(m[3] ?? m[4] ?? '');
        j = attrRe.lastIndex;
      }
      while (j < s.length && /\s/.test(s[j])) j++;
      const selfClose = s[j] === '/';
      const end = s.indexOf('>', j);
      if (end < 0) throw new Error('XML: unterminated tag');
      stack[stack.length - 1].children.push(node);
      if (!selfClose) stack.push(node);
      i = end + 1;
    }
  }
  return root;
}

export const local = (n: XNode) => n.name.replace(/^.*:/, '');

/** Direct children with this (local) name. */
export const kids = (n: XNode | undefined, name: string) => (n ? n.children.filter((c) => local(c) === name) : []);
export const kid = (n: XNode | undefined, name: string) => kids(n, name)[0];

/** All descendants with this (local) name, in document order. */
export function all(n: XNode | undefined, name: string): XNode[] {
  const out: XNode[] = [];
  const walk = (x: XNode) => { for (const c of x.children) { if (local(c) === name) out.push(c); walk(c); } };
  if (n) walk(n);
  return out;
}

/** Text of the element and everything inside it. */
export function textOf(n: XNode | undefined): string {
  if (!n) return '';
  return n.text + n.children.map(textOf).join('');
}
