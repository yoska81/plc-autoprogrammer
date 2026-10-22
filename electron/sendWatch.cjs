// A project handed over from the web page, in any browser: "Send to the desktop app" there saves the project as
// <name>.isa-send.zip into Downloads (a .zip is a type the page may save; it is the .isap file as it is). While the
// app is open it watches Downloads for such a file, and when it starts it looks for one saved shortly before (the
// page says: open the app, it picks up the file); it asks in its own window before it opens one (main.cjs), each
// file once, also across restarts; nothing is sent to the PLC software until the user presses Send there.
// Main process only.
const fs = require('node:fs');
const path = require('node:path');

const PATTERN = /\.isa-send\.zip$/i;
/** A browser writes a download under another name and renames it when done; then the size must hold this long. */
const SETTLE_MS = 400;

/** "Line 1.isa-send (2).zip" (a browser's second copy) counts as well. */
const handedOver = (name) => PATTERN.test(name) || /\.isa-send \(\d+\)\.zip$/i.test(name);
/** The project's name for the app: "Line 1.isa-send.zip" → "Line 1.isap". */
const projectName = (name) => name.replace(/\.isa-send( \(\d+\))?\.zip$/i, '.isap');

/** How long before the app started a handed-over file is still offered (the user opened the app after saving it). */
const RECENT_MS = 30 * 60000;

/**
 * Watches `dir`, and looks at what is there now; calls `onFile(file)` once per handed-over file that is complete and
 * newer than `since`. `seen` remembers the files offered (its keys can be kept across restarts). Returns a function
 * that stops watching.
 */
function watchSends({ dir, since = Date.now() - RECENT_MS, onFile, settleMs = SETTLE_MS, log = () => undefined, seen = new Set() }) {
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
    // saved before the app started (the page says: open the app)
    for (const name of fs.readdirSync(dir)) consider(name);
  } catch (e) {
    log(`cannot watch ${dir}: ${e.message}`);
  }
  return () => { try { watcher?.close(); } catch { /* closed */ } for (const t of timers.values()) clearTimeout(t); timers.clear(); };
}

/** The files offered, kept in `file` (the app's own data) so a restart does not ask again; the last 100. */
function seenStore(file) {
  let keys = [];
  try { keys = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* none yet */ }
  const set = new Set(Array.isArray(keys) ? keys : []);
  return {
    has: (k) => set.has(k),
    add: (k) => {
      set.add(k);
      try { fs.writeFileSync(file, JSON.stringify([...set].slice(-100))); } catch { /* not kept: asked again after a restart */ }
    },
  };
}

module.exports = { watchSends, seenStore, handedOver, projectName, RECENT_MS };
