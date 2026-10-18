/** Starts the parse worker (its own module so the single-file preview build can swap it for a stub and ship no worker file). */
export const spawnParseWorker = (): Worker => new Worker(new URL('../workers/parse.worker.ts', import.meta.url), { type: 'module' });
