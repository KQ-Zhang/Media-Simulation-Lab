import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const root = path.resolve(import.meta.dirname, '..');
const sourcePath = path.join(root, 'data', 'source', 'event-catalog.json');
const browserPath = path.join(root, 'data', 'source', 'event-browser-final.json');
const enrichmentRoot = path.join(root, 'data', 'source', 'enrichment');
const outputPath = path.join(root, 'database', 'background-events.sqlite');

const clean = (value, limit = 220) => String(value ?? '')
  .replace(/https?:\/\/\S+/g, '')
  .replace(/\s+/g, ' ')
  .replace(/^\[(?:正文|标题|综合文字|封面文字)\]\s*/u, '')
  .trim().slice(0, limit);
const json = (value) => JSON.stringify(value ?? []);
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function loadEnrichment() {
  const records = new Map();
  for (const tier of ['top', 'medium', 'low']) {
    const dir = path.join(enrichmentRoot, tier);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith('.json') || ['progress.json', 'failures.json'].includes(name)) continue;
      try {
        const item = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
        if (item.event_id) records.set(item.event_id, { ...item, heat_tier: tier });
      } catch (error) {
        console.warn(`Skipping ${name}: ${error.message}`);
      }
    }
  }
  return records;
}

function desiredUpdateCount(postCount) {
  if (postCount <= 5) return 1;
  if (postCount <= 30) return 2;
  if (postCount <= 200) return 3;
  return 5;
}

function selectSamples(event) {
  const samples = [...(event.kept_samples ?? [])]
    .filter((sample) => sample.published_at && clean(sample.display_text || sample.title, 500).length >= 8)
    .sort((a, b) => String(a.published_at).localeCompare(String(b.published_at)));
  if (!samples.length) return [];
  const count = Math.min(desiredUpdateCount(number(event.retained_count)), samples.length);
  if (count === 1) return [samples[0]];
  const selected = [];
  for (let i = 0; i < count; i += 1) {
    const index = Math.round(i * (samples.length - 1) / (count - 1));
    const candidate = samples[index];
    const text = clean(candidate.display_text || candidate.title);
    if (!selected.some((item) => clean(item.display_text || item.title) === text)) selected.push(candidate);
  }
  return selected;
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
if (!fs.existsSync(sourcePath)) throw new Error(`Missing source: ${sourcePath}`);
if (fs.existsSync(outputPath)) fs.rmSync(outputPath);

const catalog = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const browser = fs.existsSync(browserPath) ? JSON.parse(fs.readFileSync(browserPath, 'utf8')) : { events: [] };
const browserEvents = new Map((browser.events ?? []).map((event) => [event.event_id, event]));
const enrichment = loadEnrichment();
const db = new DatabaseSync(outputPath);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE events (
    event_id TEXT PRIMARY KEY, canonical_event_id TEXT NOT NULL, event_name TEXT NOT NULL,
    brief TEXT NOT NULL, keywords_json TEXT NOT NULL DEFAULT '[]',
    event_kind TEXT NOT NULL CHECK(event_kind IN ('event','topic','noise')),
    first_seen TEXT, last_seen TEXT, event_start TEXT, event_end TEXT,
    location_json TEXT NOT NULL DEFAULT '[]',
    heat_tier TEXT NOT NULL CHECK(heat_tier IN ('top','medium','low','unranked')),
    verification_status TEXT NOT NULL, confidence REAL NOT NULL DEFAULT 0,
    post_count INTEGER NOT NULL DEFAULT 0, account_count INTEGER NOT NULL DEFAULT 0,
    platforms_json TEXT NOT NULL DEFAULT '[]',
    simulation_eligible INTEGER NOT NULL CHECK(simulation_eligible IN (0,1)),
    source_kind TEXT NOT NULL, created_at TEXT NOT NULL
  );
  CREATE TABLE event_updates (
    update_id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(event_id),
    sequence_no INTEGER NOT NULL, release_time TEXT, headline TEXT NOT NULL, brief TEXT NOT NULL,
    information_level TEXT NOT NULL, platform TEXT, source_resource_id TEXT,
    source_author_id TEXT, confidence REAL NOT NULL DEFAULT 0, UNIQUE(event_id, sequence_no)
  );
  CREATE TABLE event_sources (
    event_id TEXT NOT NULL REFERENCES events(event_id), resource_id TEXT NOT NULL,
    author_id TEXT, published_at TEXT, platform TEXT, title TEXT, display_text TEXT,
    semantic_relevance REAL, llm_confidence REAL, duplicate_count INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY(event_id, resource_id)
  );
  CREATE TABLE event_aliases (
    event_id TEXT NOT NULL REFERENCES events(event_id), alias TEXT NOT NULL,
    PRIMARY KEY(event_id, alias)
  );
  CREATE INDEX idx_events_simulation ON events(simulation_eligible, event_kind, first_seen);
  CREATE INDEX idx_events_heat ON events(heat_tier, post_count DESC);
  CREATE INDEX idx_updates_release ON event_updates(release_time, event_id);
  CREATE INDEX idx_sources_event_time ON event_sources(event_id, published_at);
  CREATE VIRTUAL TABLE event_search USING fts5(event_id UNINDEXED, event_name, brief, keywords);
  CREATE VIEW simulation_candidates AS SELECT * FROM events
    WHERE simulation_eligible = 1 AND event_kind IN ('event','topic');
`);

const insertEvent = db.prepare('INSERT INTO events VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
const insertUpdate = db.prepare('INSERT INTO event_updates VALUES (?,?,?,?,?,?,?,?,?,?,?)');
const insertSource = db.prepare('INSERT OR IGNORE INTO event_sources VALUES (?,?,?,?,?,?,?,?,?,?)');
const insertAlias = db.prepare('INSERT OR IGNORE INTO event_aliases VALUES (?,?)');
const insertSearch = db.prepare('INSERT INTO event_search VALUES (?,?,?,?)');
const createdAt = new Date().toISOString();

db.exec('BEGIN');
try {
  for (const baseEvent of catalog) {
    const event = { ...baseEvent, ...(browserEvents.get(baseEvent.event_id) ?? {}) };
    const rich = enrichment.get(event.event_id);
    const kind = event.is_concrete_event ? 'event' : number(event.retained_count) > 0 ? 'topic' : 'noise';
    const name = clean(rich?.canonical_event_name || event.event_name || '未命名事件', 120);
    const fallback = event.kept_samples?.find((x) => x.display_text || x.title)?.display_text
      || event.event_definition || name;
    const brief = clean(rich?.factual_description || fallback, 220);
    const keywords = rich?.distinctive_entities?.slice(0, 12)
      || event.required_facts?.map((x) => clean(x, 40)).filter(Boolean).slice(0, 12) || [];
    const verification = rich?.verification_status || 'cluster_only';
    const confidence = rich ? number(rich.confidence, number(event.avg_confidence)) : number(event.avg_confidence);
    const eligible = kind !== 'noise' && verification !== 'conflicting' && number(event.retained_count) > 0 ? 1 : 0;
    insertEvent.run(event.event_id, event.event_id, name, brief, json(keywords), kind,
      event.first_seen ?? null, event.last_seen ?? null, rich?.event_time?.start ?? null,
      rich?.event_time?.end ?? null, json(rich?.locations), rich?.heat_tier || 'unranked',
      verification, confidence, number(event.retained_count), number(event.account_count),
      json(event.platforms), eligible, rich ? 'cluster+web_enrichment' : 'cluster', createdAt);
    insertSearch.run(event.event_id, name, brief, keywords.join(' '));
    for (const alias of rich?.aliases ?? []) insertAlias.run(event.event_id, clean(alias, 120));
    const samples = selectSamples(event);
    samples.forEach((sample, index) => {
      const text = clean(sample.display_text || sample.title, 220);
      const headline = clean(sample.title || text, 90) || name;
      const level = index === 0 ? 'initial' : index === samples.length - 1 ? 'follow_up' : 'developing';
      const resourceId = String(sample.dc_resource_id || `${event.event_id}-${index + 1}`);
      insertUpdate.run(`${event.event_id}_u${String(index + 1).padStart(2, '0')}`, event.event_id,
        index + 1, sample.published_at ?? event.first_seen ?? null, headline, text, level,
        sample.platform ?? null, resourceId, sample.dc_author_id ?? null,
        number(sample.llm_confidence, confidence));
      insertSource.run(event.event_id, resourceId, sample.dc_author_id ?? null,
        sample.published_at ?? null, sample.platform ?? null, clean(sample.title, 180) || null,
        text, number(sample.semantic_relevance), number(sample.llm_confidence),
        number(sample.duplicate_count, 1));
    });
    if (!samples.length) {
      insertUpdate.run(`${event.event_id}_u01`, event.event_id, 1,
        event.first_seen ?? null, name, clean(event.event_definition || brief, 220), 'initial',
        null, null, null, confidence);
    }
  }
  const meta = db.prepare('INSERT INTO metadata VALUES (?,?)');
  meta.run('schema_version', '1');
  meta.run('generated_at', createdAt);
  meta.run('source_file', 'data/source/event-catalog.json');
  meta.run('source_event_count', String(catalog.length));
  meta.run('description', 'Lightweight social-media background event candidate library');
  db.exec('COMMIT');
} catch (error) {
  db.exec('ROLLBACK'); db.close(); throw error;
}

db.exec('PRAGMA optimize; VACUUM;');
const count = (sql) => Number(db.prepare(sql).get().n);
const stats = {
  database: 'database/background-events.sqlite', bytes: fs.statSync(outputPath).size,
  events: count('SELECT COUNT(*) n FROM events'),
  eligible: count('SELECT COUNT(*) n FROM simulation_candidates'),
  concrete: count("SELECT COUNT(*) n FROM events WHERE event_kind='event'"),
  topics: count("SELECT COUNT(*) n FROM events WHERE event_kind='topic'"),
  updates: count('SELECT COUNT(*) n FROM event_updates'),
  sources: count('SELECT COUNT(*) n FROM event_sources'),
  enriched: count("SELECT COUNT(*) n FROM events WHERE source_kind='cluster+web_enrichment'"),
};
fs.writeFileSync(path.join(root, 'database', 'build-report.json'), `${JSON.stringify(stats, null, 2)}\n`);
console.log(JSON.stringify(stats, null, 2));
db.close();
