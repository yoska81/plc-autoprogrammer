/** The single-file preview has no worker file beside it: the equivalence check runs on the page there. */
export const spawnEquivalenceWorker = (): Worker => { throw new Error('no equivalence worker in the preview'); };
