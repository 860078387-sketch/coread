import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import { aiReadingSeconds, recomputeAiReadingRows } from '../lib/reading-stats.mjs';
import { initDb, getDb } from '../lib/db.mjs';

const Database = createRequire(import.meta.url)('better-sqlite3');

test('AI reading time uses the real gap, capped by the chars estimate', () => {
  assert.equal(aiReadingSeconds(4000, 90), 90);
  assert.equal(aiReadingSeconds(4000, 3600), 600);
  assert.equal(aiReadingSeconds(4000, -5), 0);
  assert.equal(aiReadingSeconds(4000, null), 60);
  assert.equal(aiReadingSeconds(200, null), 30);
});

test('recompute rewrites old chars estimates and leaves posted seconds alone', () => {
  const rows = [
    { id: 1, session_id: 's', chars: 40000, seconds: 6000, created_at: '2026-10-03 01:00:00' },
    { id: 2, session_id: 's', chars: 40000, seconds: 6000, created_at: '2026-10-03 01:02:00' },
    { id: 3, session_id: 's', chars: 40000, seconds: 45, created_at: '2026-10-03 01:03:00' },
    { id: 4, session_id: 't', chars: 400, seconds: 60, created_at: '2026-10-03 01:03:00' },
  ];
  assert.deepEqual(recomputeAiReadingRows(rows), [
    { id: 1, seconds: 60 },
    { id: 2, seconds: 120 },
  ]);
});

test('initDb recomputes old AI rows once', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coread-aitime-'));
  const dbFile = path.join(dir, 'test.db');
  initDb(dbFile);
  let db = new Database(dbFile);
  db.prepare('DELETE FROM config WHERE key = ?').run('ai_reading_time_real_gap_v1');
  const insert = db.prepare(`INSERT INTO reading_log (reader, session_id, book_id, reading_date, chars, seconds, created_at)
    VALUES (?, 's', 1, '2026-10-03', 40000, 6000, ?)`);
  insert.run('ai', '2026-10-03 01:00:00');
  insert.run('ai', '2026-10-03 01:05:00');
  insert.run('human', '2026-10-03 01:06:00');
  db.close();

  initDb(dbFile);
  db = getDb(true);
  assert.deepEqual(db.prepare('SELECT reader, seconds FROM reading_log ORDER BY id').all(), [
    { reader: 'ai', seconds: 60 },
    { reader: 'ai', seconds: 300 },
    { reader: 'human', seconds: 6000 },
  ]);
  db.close();

  db = new Database(dbFile);
  db.prepare('UPDATE reading_log SET seconds = 6000 WHERE id = 1').run();
  db.close();
  initDb(dbFile);
  db = getDb(true);
  assert.equal(db.prepare('SELECT seconds FROM reading_log WHERE id = 1').get().seconds, 6000);
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});
