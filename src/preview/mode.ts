/** True in the side-panel preview build (VITE_PREVIEW=1), which can't reach AI APIs or download files. */
export const IS_PREVIEW = import.meta.env.VITE_PREVIEW === '1';

export const PREVIEW_AI_MESSAGE =
  "AI features don't run in the preview window (it can't reach the AI service). Run the app on your PC to generate, fix and import.";
