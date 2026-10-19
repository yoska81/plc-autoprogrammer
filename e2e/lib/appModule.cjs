// Tests reach into the app with page.evaluate(() => appImport('/src/store/…')), never a bare import('/src/…').
// A Vite dev server that was running while source files changed serves the app those modules as
// '/src/…?t=<time>'; a bare import from the test then loads a second, separate instance whose stores the app
// never sees (writes are lost, reads are stale). appImport(path) imports the instance the app itself loaded:
// the URL in the page's resource timing with that path (the '?t=' one when there is one), else the path.
// It also waits until the app has started (src/main.tsx loads the storage first, then the app): a store a test
// reaches earlier is not loaded yet, and the preview's example project is not there yet (a cold dev server takes
// seconds to serve the app's modules).

/** Runs in the page before its own scripts: a large resource-timing buffer (the dev app loads hundreds of modules) and appImport. */
function appImportInit() {
  try { performance.setResourceTimingBufferSize(100000); } catch { /* not supported: the default buffer */ }
  window.appImport = async (path) => {
    for (const t0 = Date.now(); !window.__isaAppReady && Date.now() - t0 < 30000;) await new Promise((r) => setTimeout(r, 20));
    const loaded = performance.getEntriesByType('resource').map((e) => e.name).filter((n) => { try { return new URL(n).pathname === path; } catch { return false; } });
    const appCopy = loaded.filter((n) => new URL(n).search).pop() ?? loaded[0];
    return import(appCopy ?? path);
  };
}

/** Gives `appImport` to every page this page or context opens (call it before the first goto). */
async function useAppModules(pageOrContext) {
  await pageOrContext.addInitScript(appImportInit);
}

module.exports = { useAppModules, appImportInit };
