"""Convert the two remote Parquet snapshots into the compact JSON build input.

Requires the optional ``duckdb`` Python package. The generated JSON is consumed
by the dependency-free Node/SQLite database builder.
"""
from pathlib import Path

import duckdb


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "source"
OUTPUT = SOURCE / "event-catalog.json"

connection = duckdb.connect()
topics = str(SOURCE / "event_topics.parquet").replace("'", "''")
summary = str(SOURCE / "event_summary.parquet").replace("'", "''")
output = str(OUTPUT).replace("'", "''")
connection.execute(
    f"""
    COPY (
      SELECT t.*, s.start_time AS first_seen, s.end_time AS last_seen,
             s.post_count AS retained_count, s.account_count
      FROM read_parquet('{topics}') t
      LEFT JOIN read_parquet('{summary}') s USING (event_id)
    ) TO '{output}' (FORMAT JSON, ARRAY true)
    """
)
print(OUTPUT)
