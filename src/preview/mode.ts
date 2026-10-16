/** True in the side-panel preview build (VITE_PREVIEW=1): AI runs on the viewer's Claude account, files save through the viewer. */
export const IS_PREVIEW = import.meta.env?.VITE_PREVIEW === '1'; // env is undefined in node unit tests

export const PREVIEW_AI_MESSAGE =
  "AI features don't run in the preview window (it can't reach the AI service). Run the app on your PC to generate, fix and import.";

/** Stand-in for an API key in the preview, where the viewer's Claude account is used instead. */
export const PREVIEW_ACCOUNT_KEY = 'claude-account';
