/** Starts the equivalence worker (its own module so the single-file preview build can swap it for a stub and ship no worker file). */
export const spawnEquivalenceWorker = (): Worker => new Worker(new URL('./equivalence.worker.ts', import.meta.url), { type: 'module' });
