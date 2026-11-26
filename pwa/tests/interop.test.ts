import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readBackup,canonical} from '../src/backup';
test('PWA archive accepted and re-exported by original Kotlin BackupFormat returns unchanged',async()=>{const a=await readBackup(new Uint8Array(await readFile(new URL('./fixtures/pwa-roundtrip.zip',import.meta.url))));const b=await readBackup(new Uint8Array(await readFile(new URL('./fixtures/android-roundtrip.zip',import.meta.url))));assert.equal(canonical(a.preferences),canonical(b.preferences));assert.equal(b.preferences.unknown_future.values[0],'9007199254740999');});
