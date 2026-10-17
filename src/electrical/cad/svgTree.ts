/**
 * A minimal SVG / XML element tree, parsed from markup (react-dom/server output of the drawing sheets).
 * Enough for the CAD export: elements with attributes, nested children and text content.
 */

export interface SvgNode {
  tag: string;
  attrs: Record<string, string>;
  children: SvgNode[];
  /** Text directly inside the element (text / tspan). */
  text: string;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Parses SVG markup into an element tree (comments and processing instructions are skipped). */
export function parseSvg(markup: string): SvgNode {
  const root: SvgNode = { tag: '#root', attrs: {}, children: [], text: '' };
  const stack: SvgNode[] = [root];
  const re = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>|<\/([\w:-]+)\s*>|<([\w:-]+)((?:\s+[\w:-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'))?)*)\s*(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markup))) {
    const top = stack[stack.length - 1];
    if (m[1] !== undefined) top.text += m[1];
    else if (m[2]) {
      // closing tag: pop to the matching element (tolerates stray closers)
      for (let i = stack.length - 1; i > 0; i--) if (stack[i].tag === m[2]) { stack.length = i; break; }
    } else if (m[3]) {
      const attrs: Record<string, string> = {};
      const ar = /([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/g;
      let a: RegExpExecArray | null;
      while ((a = ar.exec(m[4] ?? ''))) attrs[a[1]] = decodeEntities(a[2] ?? a[3] ?? '');
      const node: SvgNode = { tag: m[3], attrs, children: [], text: '' };
      top.children.push(node);
      if (!m[5]) stack.push(node);
    } else if (m[6] !== undefined && !/^\s*$/.test(m[6])) top.text += decodeEntities(m[6]);
  }
  return root.children.find((c) => c.tag === 'svg') ?? root;
}

/** All text of an element and its tspans, in order. */
export function textOf(n: SvgNode): string {
  return n.text + n.children.map(textOf).join('');
}
