import csv
import hashlib
import os
from collections import Counter, defaultdict

IN_PATH = "tosdr_points.csv"
OUT_DIR = "training_set"
RISKY_LABELS = {"bad", "blocker"}

# With only 12 apps total, a random/hash-based split can get unlucky (it
# did on the first try -- test ended up as a single app). Assigning splits
# by hand guarantees val/test each contain a MIX of apps. Update these two
# sets as you add more apps later.
TEST_APPS = {"YouTube", "Facebook", "Amazon", "Quizlet"}
VAL_APPS = {"Reddit", "Dropbox", "Netflix", "Slack"}


def row_id(service_id, text):
    norm = " ".join(text.lower().split())
    return hashlib.sha1(f"{service_id}:{norm}".encode("utf-8")).hexdigest()[:16]


def assign_split(service_name):
    if service_name in TEST_APPS:
        return "test"
    if service_name in VAL_APPS:
        return "val"
    return "train"


def main():
    with open(IN_PATH, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    print(f"Loaded {len(rows)} rows from {IN_PATH}")

    kept, dropped_missing = [], 0
    for r in rows:
        text = r["point_title"].strip()
        label = r["classification"].strip().lower()
        if not text or not label:
            dropped_missing += 1
            continue
        kept.append(r)
    print(f"Dropped {dropped_missing} row(s) missing text or label")

    seen = set()
    deduped = []
    for r in kept:
        key = (r["service_id"], r["point_title"].strip().lower())
        if key in seen:
            continue
        seen.add(key)
        deduped.append(r)
    print(f"Dropped {len(kept) - len(deduped)} exact duplicate row(s)")

    clean_rows = []
    for r in deduped:
        text = r["point_title"].strip()
        label = r["classification"].strip().lower()
        clean_rows.append({
            "id": row_id(r["service_id"], text),
            "service_id": r["service_id"],
            "service_name": r["service_name"],
            "text": text,
            "label": label,
            "is_risky": int(label in RISKY_LABELS),
            "topic_id": r["topic_id"],
            "split": assign_split(r["service_name"]),
        })

    apps_seen = {r["service_name"] for r in clean_rows}
    missing_from_config = (TEST_APPS | VAL_APPS) - apps_seen
    if missing_from_config:
        print(f"WARNING: names not found in data: {missing_from_config} -- check spelling")

    for field in ("text", "label", "service_name", "split"):
        n_empty = sum(1 for r in clean_rows if not str(r[field]).strip())
        assert n_empty == 0, f"BUG: {n_empty} rows have empty {field}"

    os.makedirs(OUT_DIR, exist_ok=True)
    columns = ["id", "service_id", "service_name", "text", "label", "is_risky", "topic_id", "split"]
    counts = Counter()
    files = {s: open(os.path.join(OUT_DIR, f"{s}.csv"), "w", newline="", encoding="utf-8") for s in ("train", "val", "test")}
    writers = {s: csv.DictWriter(files[s], fieldnames=columns) for s in files}
    for w in writers.values():
        w.writeheader()
    for r in clean_rows:
        writers[r["split"]].writerow(r)
        counts[r["split"]] += 1
    for f in files.values():
        f.close()

    with open(os.path.join(OUT_DIR, "all.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=columns)
        w.writeheader()
        w.writerows(clean_rows)

    total = len(clean_rows)
    print(f"\nFinal clean dataset: {total} rows, ZERO missing values (verified)")
    print(f"Split sizes: train={counts['train']} ({counts['train']/total*100:.0f}%), "
          f"val={counts['val']} ({counts['val']/total*100:.0f}%), "
          f"test={counts['test']} ({counts['test']/total*100:.0f}%)")

    for split in ("train", "val", "test"):
        apps = sorted({r["service_name"] for r in clean_rows if r["split"] == split})
        print(f"  {split}: {apps}")

    print("\nLabel balance (classification), overall:")
    for label, n in Counter(r["label"] for r in clean_rows).most_common():
        print(f"  {label:<10} {n}")

    print("\nLabel balance BY SPLIT:")
    for split in ("train", "val", "test"):
        split_rows = [r for r in clean_rows if r["split"] == split]
        dist = Counter(r["label"] for r in split_rows)
        total_s = len(split_rows)
        pct = {k: f"{v/total_s*100:.0f}%" for k, v in dist.items()}
        print(f"  {split}: {dict(pct)}")

    print(f"\nWrote {OUT_DIR}/{{train,val,test,all}}.csv")


if __name__ == "__main__":
    main()
