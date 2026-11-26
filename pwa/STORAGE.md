# Local research storage contract

IndexedDB `galiciana-de-peto`, object store `state`, single `preferences` record. Every mutation reads and writes the entire typed Android preference map in one readwrite transaction; notifications follow transaction completion. No documents, scans, PDFs or OCR caches are stored. Unknown preference names and their Android types/strings are preserved.

`store` (async singleton, storage.ts):
- `snapshot()` → `{hits, notes, folders, searches, recent, draft, reading}`. `notes` includes orphan notes and deletion tombstones.
- `subscribe(listener)` → unsubscribe. React callers refresh after notification.
- `isSaved(hit)`, `toggleSaved(hit)`, `saveNote(hit,text)` (4000 chars; nonempty note adds page), `removeSaved(keys)`; key = `path|position`.
- `foldersFor(hit)`, `setFolders(hit,names)`, `createFolder(name)`, `deleteFolder(name)`.
- `saveSearch(preset)`, `removeSearch(id)`, `rememberSearch(preset)`, `saveDraft(preset)`, `rememberReading(hit)`.
- `preferences()` returns preserved typed map; `replacePreferences(map, expectedFingerprint?)` imports atomically, rejects stale preview.

`backup.ts`: `exportBackup(preferences)` → ZIP Uint8Array; `readBackup(bytes)` validates the Android v1 manifest and checksum; `previewBackup(incoming,current)` computes counts, typed merge, conflicts and snapshot fingerprint; `mergePreferences` resolves versions, and `store.replacePreferences(next, preview.fingerprint)` commits atomically after checking the preview is current.

ZIP wire format is exactly Android `manifest.json` (one entry), format `galiciana-peto-preferences`, version 1, integer createdAt, typed preferences `{type,values:string[]}`, sha256. Canonical JSON keys are sorted by UTF-16 order; encoding is UTF-8 and control-character escaping follows Android BackupJson. LONG values remain strings inside preferences, avoiding precision loss. Manifest JSON is parsed strictly (duplicate keys/depth/size), bounded to 8MiB uncompressed/20,000 preferences; extra ZIP entries are rejected.

`Archive` props: `{view:'saved'|'history'|'backup', onOpen(hit), onSearch(preset), onBack()}`.
`NoteEditor` props: `{hit,onClose,onSaved?}`; full-screen accessible editor, exact label «Nota de referencia», dirty-close and deletion confirmation.

`favoritesBrowse()` / `saveFavoritesBrowse({folder,query,notesOnly,sort,ascending})` read and update Android's exact `favorites_browse` STRING JSON. Sort uses native enum names `Titulo`, `Autor`, `Fecha`, `Relevancia`; ascending is boolean. Unknown fields and native scroll fields (`index`, `offset`, `folderIndex`, `folderOffset`) are retained unchanged. The PWA restores filter context asynchronously once before persisting, avoiding overwriting interaction that begins during hydration. Android list indices are preserved for Android import; the web does not claim to convert them into browser scroll positions. Import invalidates hydration so the imported context is read on returning to Guardados.

Archive filter matching delegates to `/api/archive/filter` (the native Kotlin authority, including canonical notes as searchable snippets). In-memory decisions are keyed by exact query and local content. A new query without authority access displays an explicit “without filter” notice and retains the local page list; it does not silently substitute a different matcher. `webAnchor` extends `favorites_browse` with page identity, viewport-relative offset, and filter context; native indices and unknown fields remain unchanged.
