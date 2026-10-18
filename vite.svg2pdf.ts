import type { Plugin } from 'vite'

/**
 * svg2pdf measures every text with a new canvas and a re-parsed font (`canvasTextMeasure`): most of
 * the time of a 51-sheet drawings PDF. This build step gives it one canvas and remembers each
 * (font, text) width. Same widths, so the same PDF. Warns (and changes nothing) if svg2pdf changes.
 */
const ORIGINAL = 'canvasTextMeasure=function(t,e,r,i,n){var a=document.createElement("canvas").getContext("2d");return null!=a?(a.font=[i,n,r,e].join(" "),a.measureText(t).width):0}'
const FAST = 'canvasTextMeasure=function(t,e,r,i,n){var c=globalThis.__svg2pdfMeasure||(globalThis.__svg2pdfMeasure={w:new Map,ctx:document.createElement("canvas").getContext("2d"),font:""}),f=[i,n,r,e].join(" "),k=f+"\\u0000"+t,h=c.w.get(k);if(h!==void 0)return h;var a=c.ctx;if(null==a)return 0;c.font!==f&&(a.font=f,c.font=f);var w=a.measureText(t).width;c.w.size>2e5&&c.w.clear();c.w.set(k,w);return w}'

export function svg2pdfFastMeasure(): Plugin {
  return {
    name: 'svg2pdf-fast-measure',
    transform(code, id) {
      if (!/svg2pdf\.js[\\/]dist[\\/]svg2pdf\.es\.min\.js/.test(id)) return null
      if (!code.includes(ORIGINAL)) { this.warn('svg2pdf changed: text measuring is not cached (vite.svg2pdf.ts)'); return null }
      return { code: code.replace(ORIGINAL, FAST), map: null }
    },
  }
}
