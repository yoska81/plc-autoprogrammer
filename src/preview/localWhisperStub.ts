/** Preview build: no on-device speech model (the side panel can't download it); dictation uses the browser's own. */
export interface ModelProgress { loaded: number; total: number; file: string }

export function loadModel(): Promise<never> {
  return Promise.reject(new Error('Speech on this computer is not available in the preview. Use Chrome or Edge, or the desktop app.'));
}

export function runModel(): Promise<string> {
  return Promise.reject(new Error('Speech on this computer is not available in the preview.'));
}
