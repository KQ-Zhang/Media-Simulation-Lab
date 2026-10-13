import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const root = path.resolve(import.meta.dirname, '..');
const db = new DatabaseSync(path.join(root, 'database', 'background-events.sqlite'), { readOnly: true });
const term = process.argv.slice(2).join(' ').trim();
const words = term.split(/\s+/).filter(Boolean);
const conditions = words.map(() => '(event_name LIKE ? OR brief LIKE ?)').join(' AND ');
const parameters = words.flatMap((word) => [`%${word}%`, `%${word}%`]);
const rows = words.length
  ? db.prepare(`SELECT event_id,event_name,brief,first_seen,heat_tier,
      verification_status,post_count FROM simulation_candidates
      WHERE ${conditions} ORDER BY post_count DESC LIMIT 10`).all(...parameters)
  : db.prepare(`SELECT event_id,event_name,brief,first_seen,heat_tier,verification_status,post_count
      FROM simulation_candidates ORDER BY RANDOM() LIMIT 10`).all();
console.table(rows);
db.close();
