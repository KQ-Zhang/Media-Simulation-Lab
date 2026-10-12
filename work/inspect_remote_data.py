import glob
import os

import pyarrow.parquet as pq

base = "/mnt/lc_share/zkq/Media-GCN"
os.chdir(base)
for path in sorted(glob.glob("**/*.parquet", recursive=True)):
    try:
        parquet = pq.ParquetFile(path)
        print(
            f"\nFILE {path} rows={parquet.metadata.num_rows} "
            f"groups={parquet.metadata.num_row_groups} size={os.path.getsize(path)}"
        )
        print(parquet.schema_arrow)
    except Exception as exc:
        print(f"ERR {path}: {exc}")
