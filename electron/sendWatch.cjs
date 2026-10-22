// A project handed over from the web page, in any browser: "Send to the desktop app" there saves the project as
// <name>.isa-send.zip into Downloads (a .zip is a type the page may save; it is the .isap file as it is). While the
// app is open it watches Downloads for such a file, new since it started, and asks in its own window before it
// opens it (main.cjs); nothing is sent to the PLC software until the user presses Send there. Main process only.
const fs = require('node:fs');
const path = require('node:path');

const PATTERN = /\.isa-send\.zip$/i;
/** A browser writes a download under another name and renames it when done; then the size must hold this long. */
const SETTLE_MS = 400;

/** "Line 1.isa-send (2).zip" (a browser's second copy) counts as well. */
const handedOver = (name) => PATTERN.test(name) || /\.isa-send \(\d+\)\.zip$/i.test(name);
/** The project's name for the app: "Line 1.isa-send.zip" → "Line 1.isap". */
const projectName = (name) => name.replace(/\.isa-send( \(\d+\))?\.zip$/i, '.isap');

/**
 * Watches `dir`; calls `onFile(file)` once per handed-over file that is complete and newer than `since`
 * (a file already there when the app started is never offered). Returns a function that stops watching.
 */
function watchSends({ dir, since = Date.now(), onFile, settleMs = SETTLE_MS, log = () => undefined }) {
  const seen = new Set();
  const timers = new Map();
  let watcher;
  const consider = (name) => {
    if (!name || !handedOver(name)) return;
    const file = path.join(dir, name);
    clearTimeout(timers.get(file));
    timers.set(file, setTimeout(() => {
      timers.delete(file);
      let st;
      try { st = fs.statSync(file); } catch { return; } // gone again (a temp name)
      if (!st.isFile() || st.size === 0 || st.mtimeMs < since - 2000) return;
      // once per download: an indexer or virus scanner touching it is not a new one (mtime to the second)
      const key = `${file}|${Math.floor(st.mtimeMs / 1000)}|${st.size}`;
      if (seen.has(key)) return;
      seen.add(key);
      log(`handed over from the web page: ${name} (${st.size} bytes)`);
      onFile(file);
    }, settleMs));
  };
  try {
    watcher = fs.watch(dir, (_event, name) => consider(typeof name === 'string' ? name : name?.toString()));
    watcher.on('error', (e) => log(`watching ${dir} stopped: ${e.message}`));
  } catch (e) {
    log(`cannot watch ${dir}: ${e.message}`);
  }
  return () => { try { watcher?.close(); } catch { /* closed */ } for (const t of timers.values()) clearTimeout(t); timers.clear(); };
}

module.exports = { watchSends, handedOver, projectName };
