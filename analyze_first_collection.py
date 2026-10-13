import json
import math
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(r"C:\Users\asus\Desktop\Codex\媒体原始数据\第一次采集—返回前10w的头部账号")


def iter_array_lines(path):
    with path.open("r", encoding="utf-8-sig", errors="replace") as f:
        for line_no, line in enumerate(f, 1):
            s = line.strip()
            if not s or s in ("[", "]"):
                continue
            if s.endswith(","):
                s = s[:-1]
            try:
                yield json.loads(s)
            except Exception as exc:
                yield {"__parse_error__": f"{path.name}:{line_no}:{exc}"}


def number(value):
    try:
        if value in (None, "", "-1"):
            return None
        return float(value)
    except Exception:
        return None


def percentile(values, p):
    if not values:
        return None
    xs = sorted(values)
    k = (len(xs) - 1) * p
    lo, hi = math.floor(k), math.ceil(k)
    return xs[lo] if lo == hi else xs[lo] * (hi-k) + xs[hi] * (k-lo)


account_files = sorted(p for p in (ROOT / "accounts").glob("*.json") if not p.name.startswith("._"))
video_files = sorted(p for p in (ROOT / "videos").glob("*.json") if not p.name.startswith("._"))

account_count = 0
account_errors = []
account_ids = set()
account_dupes = 0
account_sites = Counter()
account_fields = Counter()
account_missing = Counter()
fans_values = []
top_accounts = []
account_crawl_times = []

for path in account_files:
    for obj in iter_array_lines(path):
        if "__parse_error__" in obj:
            account_errors.append(obj["__parse_error__"])
            continue
        account_count += 1
        account_fields.update(obj.keys())
        aid = obj.get("dc_author_id") or obj.get("es_id")
        if aid in account_ids:
            account_dupes += 1
        elif aid:
            account_ids.add(aid)
        account_sites[str(obj.get("site_name") or obj.get("dc_site_id") or "未知")] += 1
        for field in ("author_name", "intro", "gender", "birthday", "ip_place", "province_code", "city_code", "fans_num", "works_num", "avatar_url"):
            if obj.get(field) in (None, "", -1, "-1", []):
                account_missing[field] += 1
        fans = number(obj.get("fans_num"))
        if fans is not None:
            fans_values.append(fans)
            top_accounts.append((fans, obj.get("author_name"), aid, obj.get("site_name")))
        if obj.get("crawl_time"):
            account_crawl_times.append(str(obj["crawl_time"]))

top_accounts = sorted(top_accounts, reverse=True)[:15]

video_count = 0
video_errors = []
video_ids = set()
video_dupes = 0
video_authors = Counter()
video_sites = Counter()
video_outer_fields = Counter()
video_fields = Counter()
publish_years = Counter()
publish_times = []
has_title = has_asr = has_ocr = has_cover_text = 0
duration_values = []
read_values = []
like_values = []
comment_values = []
per_file_counts = {}

for idx, path in enumerate(video_files, 1):
    file_count = 0
    for obj in iter_array_lines(path):
        if "__parse_error__" in obj:
            video_errors.append(obj["__parse_error__"])
            continue
        video_count += 1
        file_count += 1
        video_outer_fields.update(obj.keys())
        vid = obj.get("dc_resource_id")
        if vid in video_ids:
            video_dupes += 1
        elif vid:
            video_ids.add(vid)
        aid = obj.get("dc_author_id")
        if aid:
            video_authors[aid] += 1
        info = obj.get("video_info") or {}
        if isinstance(info, dict):
            video_fields.update(info.keys())
            video_sites[str(info.get("site_name") or info.get("dc_site_id") or "未知")] += 1
            year = info.get("publish_year")
            if year not in (None, ""):
                publish_years[str(year)] += 1
            ts = number(info.get("publish_time"))
            if ts is not None:
                if ts > 10_000_000_000:
                    ts /= 1000
                if 0 < ts < 5_000_000_000:
                    publish_times.append(ts)
            has_title += bool(info.get("title"))
            has_asr += bool(info.get("asr"))
            has_ocr += bool(info.get("ocr_paragraph"))
            has_cover_text += bool(info.get("cover_content_text"))
            for field, target in (("duration", duration_values), ("read_num", read_values), ("like_num", like_values), ("comment_num", comment_values)):
                val = number(info.get(field))
                if val is not None and val >= 0:
                    target.append(val)
    per_file_counts[path.name] = file_count
    print(f"processed {idx}/{len(video_files)} {path.name}: {file_count}", flush=True)

linked_authors = set(video_authors) & account_ids
unlinked_video_authors = set(video_authors) - account_ids
accounts_without_videos = account_ids - set(video_authors)

def summary(values):
    return {
        "count": len(values),
        "min": min(values) if values else None,
        "p25": percentile(values, .25),
        "median": percentile(values, .5),
        "p75": percentile(values, .75),
        "p90": percentile(values, .9),
        "p99": percentile(values, .99),
        "max": max(values) if values else None,
        "mean": sum(values)/len(values) if values else None,
    }

result = {
    "files": {
        "account_files": len(account_files),
        "account_bytes": sum(p.stat().st_size for p in account_files),
        "video_files": len(video_files),
        "video_bytes": sum(p.stat().st_size for p in video_files),
        "video_records_per_file": per_file_counts,
    },
    "accounts": {
        "records": account_count,
        "unique_ids": len(account_ids),
        "duplicate_ids": account_dupes,
        "parse_errors": account_errors[:20],
        "sites": account_sites,
        "fans": summary(fans_values),
        "top_accounts": top_accounts,
        "missing_counts": account_missing,
        "field_presence": account_fields,
        "crawl_time_min": min(account_crawl_times) if account_crawl_times else None,
        "crawl_time_max": max(account_crawl_times) if account_crawl_times else None,
    },
    "videos": {
        "records": video_count,
        "unique_ids": len(video_ids),
        "duplicate_ids": video_dupes,
        "parse_errors": video_errors[:20],
        "unique_authors": len(video_authors),
        "linked_authors": len(linked_authors),
        "unlinked_video_authors": len(unlinked_video_authors),
        "accounts_without_videos": len(accounts_without_videos),
        "sites": video_sites,
        "publish_years": publish_years,
        "publish_time_min": datetime.fromtimestamp(min(publish_times), timezone.utc).isoformat() if publish_times else None,
        "publish_time_max": datetime.fromtimestamp(max(publish_times), timezone.utc).isoformat() if publish_times else None,
        "title_count": has_title,
        "asr_count": has_asr,
        "ocr_count": has_ocr,
        "cover_text_count": has_cover_text,
        "duration_ms": summary(duration_values),
        "read_num": summary(read_values),
        "like_num": summary(like_values),
        "comment_num": summary(comment_values),
        "videos_per_author": summary(list(video_authors.values())),
        "outer_field_presence": video_outer_fields,
        "video_info_field_presence": video_fields,
    },
}

out = ROOT / "first_collection_analysis.json"
out.write_text(json.dumps(result, ensure_ascii=False, indent=2, default=lambda x: dict(x)), encoding="utf-8")
print(f"WROTE {out}")
