import { loadAppStorage } from './lib/appStorage'
import { installStorageFullNotice, tellStorageFull } from './lib/storageFull'

// The projects are loaded from IndexedDB before any store starts (the stores read their saved state when they
// are created, in ./appMain). Where IndexedDB cannot be opened the app stays on localStorage, and a project too
// big for it is said, not lost quietly.
await loadAppStorage({ onFailure: tellStorageFull }).catch(() => installStorageFullNotice())
await import('./appMain')
