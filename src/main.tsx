import { flushBeforeClose, loadAppStorage, valuesInIdbLeft } from './lib/appStorage'
import { installStorageFullNotice, tellStorageFull } from './lib/storageFull'
import { desktopBridge } from './desktop/bridge'
import { notify } from './store/useNoticeStore'

// The projects are loaded from IndexedDB before any store starts (the stores read their saved state when they
// are created, in ./appMain). Where IndexedDB cannot be opened the app stays on localStorage, and a project too
// big for it is said, not lost quietly. The desktop app waits for the last writes before its window closes.
await loadAppStorage({ onFailure: (_err, key) => tellStorageFull(key) })
  .then(() => { const onFlush = desktopBridge()?.onFlushStorage; if (onFlush) flushBeforeClose(onFlush) })
  .catch(() => {
    installStorageFullNotice()
    if (valuesInIdbLeft()) notify('The app\'s project storage did not open, so a big project kept there is not shown now (it is not lost). Close the app and open it again.')
  })
await import('./appMain')
// The app has started (storage loaded, the stores made, the preview's example seeded): end-to-end tests that reach
// into the stores wait for this (e2e/lib/appModule.cjs).
;(globalThis as { __isaAppReady?: boolean }).__isaAppReady = true
