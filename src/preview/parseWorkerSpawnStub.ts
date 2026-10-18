/** Preview build: one file, no worker file beside it; parsing runs on the page (src/lib/parseWorker.ts). */
export const spawnParseWorker = (): Worker => { throw new Error('no parse worker in the preview'); };
