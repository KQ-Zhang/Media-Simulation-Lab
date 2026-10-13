import json
import math
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(r"C:\Users\asus\Desktop\Codex\媒体原始数据\第二次采集—返回传播前200事件的账号")


def iter_array_lines(path):
    with path.open("r", encoding="utf-8-sig", errors="replace") as f:
        for line_no, line in enumerate(f, 1):
            s = line.strip()
            if not s or s in ("[", "]", "[]"):
                continue
            if s.endswith(","):
                s = s[:-1]
            try:
                yield json.loads(s)
            except Exception as exc:
                yield {"__parse_error__": f"{path}:{line_no}:{exc}"}


def pct(values, p):
    if not values:
        return None
    xs = sorted(values)
    k = (len(xs)-1)*p
    lo, hi = math.floor(k), math.ceil(k)
    return xs[lo] if lo == hi else xs[lo]*(hi-k)+xs[hi]*(k-lo)


def stats(values):
    return {
        "count": len(values), "min": min(values) if values else None,
        "p25": pct(values,.25), "median": pct(values,.5), "p75": pct(values,.75),
        "p90": pct(values,.9), "p99": pct(values,.99), "max": max(values) if values else None,
        "mean": sum(values)/len(values) if values else None,
    }


event_dirs = sorted(p for p in ROOT.iterdir() if p.is_dir() and not p.name.startswith("."))
account_total = video_total = 0
account_file_bytes = video_file_bytes = summary_bytes = 0
account_ids_global = Counter()
video_ids_global = Counter()
event_account_counts = []
event_video_counts = []
event_rows = []
empty_accounts = []
empty_videos = []
parse_errors = []
account_sites = Counter()
video_sites = Counter()
account_fields = Counter()
video_fields = Counter()
summary_fields = Counter()
summary_examples = []
event_local_unlinked_video_authors = 0
event_local_linked_video_authors = 0
all_video_authors = Counter()
all_account_ids = set()
has_title = has_asr = has_ocr = has_cover_text = 0
publish_years = Counter()

for idx, event_dir in enumerate(event_dirs, 1):
    account_files = sorted(p for p in event_dir.glob("accounts_part_*.json") if not p.name.startswith("._"))
    video_files = sorted(p for p in event_dir.glob("videos_part_*.json") if not p.name.startswith("._"))
    summary_path = event_dir / "summary.json"
    local_accounts = set()
    local_video_authors = set()
    ac = vc = 0
    for path in account_files:
        account_file_bytes += path.stat().st_size
        for obj in iter_array_lines(path):
            if "__parse_error__" in obj:
                parse_errors.append(obj["__parse_error__"]); continue
            ac += 1; account_total += 1
            account_fields.update(obj.keys())
            aid = obj.get("dc_author_id") or obj.get("es_id")
            if aid:
                local_accounts.add(aid); all_account_ids.add(aid); account_ids_global[aid] += 1
            account_sites[str(obj.get("site_name") or obj.get("dc_site_id") or "未知")] += 1
    for path in video_files:
        video_file_bytes += path.stat().st_size
        for obj in iter_array_lines(path):
            if "__parse_error__" in obj:
                parse_errors.append(obj["__parse_error__"]); continue
            vc += 1; video_total += 1
            vid = obj.get("dc_resource_id")
            if vid: video_ids_global[vid] += 1
            info = obj.get("video_info") or {}
            if isinstance(info, dict):
                aids = obj.get("dc_author_ids") or []
                if not isinstance(aids, list):
                    aids = [aids]
                if not aids and info.get("dc_author_id"):
                    aids = [info.get("dc_author_id")]
                for aid in filter(None, aids):
                    local_video_authors.add(aid); all_video_authors[aid] += 1
                video_fields.update(info.keys())
                video_sites[str(info.get("site_name") or info.get("dc_site_id") or "未知")] += 1
                has_title += bool(info.get("title"))
                has_asr += bool(info.get("asr"))
                has_ocr += bool(info.get("ocr_paragraph"))
                has_cover_text += bool(info.get("cover_content_text"))
                if info.get("publish_year") not in (None, ""):
                    publish_years[str(info.get("publish_year"))] += 1
    summary = None
    if summary_path.exists():
        summary_bytes += summary_path.stat().st_size
        try:
            summary = json.loads(summary_path.read_text(encoding="utf-8-sig", errors="replace"))
            if isinstance(summary, dict):
                summary_fields.update(summary.keys())
                if len(summary_examples) < 3:
                    summary_examples.append(summary)
        except Exception as exc:
            parse_errors.append(f"{summary_path}:{exc}")
    linked = len(local_video_authors & local_accounts)
    unlinked = len(local_video_authors - local_accounts)
    event_local_linked_video_authors += linked
    event_local_unlinked_video_authors += unlinked
    event_account_counts.append(ac); event_video_counts.append(vc)
    if ac == 0: empty_accounts.append(event_dir.name)
    if vc == 0: empty_videos.append(event_dir.name)
    event_rows.append({
        "event": event_dir.name, "accounts": ac, "unique_accounts": len(local_accounts),
        "videos": vc, "unique_video_authors": len(local_video_authors),
        "linked_video_authors": linked, "unlinked_video_authors": unlinked,
        "summary": summary,
    })
    if idx % 25 == 0 or idx == len(event_dirs):
        print(f"processed {idx}/{len(event_dirs)}", flush=True)

top_by_accounts = sorted(event_rows, key=lambda x: x["accounts"], reverse=True)[:15]
top_by_videos = sorted(event_rows, key=lambda x: x["videos"], reverse=True)[:15]
account_repeat_dist = Counter(account_ids_global.values())
video_repeat_dist = Counter(video_ids_global.values())

result = {
    "files": {
        "event_directories": len(event_dirs),
        "account_files": sum(len([p for p in d.glob('accounts_part_*.json') if not p.name.startswith('._')]) for d in event_dirs),
        "video_files": sum(len([p for p in d.glob('videos_part_*.json') if not p.name.startswith('._')]) for d in event_dirs),
        "summary_files": sum((d/'summary.json').exists() for d in event_dirs),
        "account_bytes": account_file_bytes, "video_bytes": video_file_bytes, "summary_bytes": summary_bytes,
    },
    "events": {
        "account_counts": stats(event_account_counts), "video_counts": stats(event_video_counts),
        "empty_account_events": empty_accounts, "empty_video_events": empty_videos,
        "top_by_accounts": top_by_accounts, "top_by_videos": top_by_videos,
    },
    "accounts": {
        "records": account_total, "unique_ids_global": len(account_ids_global),
        "repeated_across_events": sum(v > 1 for v in account_ids_global.values()),
        "repeat_frequency_distribution": account_repeat_dist,
        "sites": account_sites, "field_presence": account_fields,
    },
    "videos": {
        "records": video_total, "unique_ids_global": len(video_ids_global),
        "duplicate_occurrences": video_total - len(video_ids_global),
        "repeated_across_events": sum(v > 1 for v in video_ids_global.values()),
        "repeat_frequency_distribution": video_repeat_dist,
        "unique_authors_global": len(all_video_authors),
        "authors_present_in_any_account_file": len(set(all_video_authors) & all_account_ids),
        "authors_absent_from_all_account_files": len(set(all_video_authors) - all_account_ids),
        "event_local_linked_author_sum": event_local_linked_video_authors,
        "event_local_unlinked_author_sum": event_local_unlinked_video_authors,
        "sites": video_sites, "publish_years": publish_years,
        "title_count": has_title, "asr_count": has_asr, "ocr_count": has_ocr, "cover_text_count": has_cover_text,
        "field_presence": video_fields,
    },
    "summaries": {"field_presence": summary_fields, "examples": summary_examples},
    "parse_errors": parse_errors[:100],
    "event_rows": event_rows,
}

out = ROOT / "second_collection_analysis.json"
out.write_text(json.dumps(result, ensure_ascii=False, indent=2, default=lambda x: dict(x)), encoding="utf-8")
print(f"WROTE {out}")
