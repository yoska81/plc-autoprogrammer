import { desktopBridge } from './bridge';

/** "Check for updates" (Help menu): the update banner shows the answer. */
export function checkForUpdatesNow(): void {
  void desktopBridge()?.update?.check();
}

/** The desktop app, which can update itself (false in a browser and the preview). */
export function canUpdate(): boolean {
  return Boolean(desktopBridge()?.update);
}
