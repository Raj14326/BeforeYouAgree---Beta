import json, csv, glob

SKIP_FILES = {"spotify_raw.json"}

rows = []
files = sorted(glob.glob("*_raw.json"))
files = [f for f in files if f not in SKIP_FILES]
print(f"Found {len(files)} raw JSON file(s): {files}\n")

skipped_not_reviewed = []
for fname in files:
    with open(fname, encoding="utf-8") as f:
        d = json.load(f)
    reviewed = bool(d.get("is_comprehensively_reviewed"))
    rating = d.get("rating") or "N/A"
    if not (reviewed and rating != "N/A"):
        skipped_not_reviewed.append((fname, reviewed, rating))
        continue
    n_added = 0
    for pt in d.get("points", []):
        if pt.get("status") != "approved":
            continue
        case = pt.get("case") or {}
        rows.append({
            "service_id": d["id"], "service_name": d["name"],
            "service_rating": d["rating"], "reviewed": d["is_comprehensively_reviewed"],
            "point_title": pt.get("title", ""), "point_description": pt.get("analysis", ""),
            "topic_id": case.get("topic_id", ""), "classification": case.get("classification", ""),
            "weight": case.get("weight", ""), "status": pt.get("status", ""),
        })
        n_added += 1
    print(f"  {fname}: {n_added} approved points added")

if skipped_not_reviewed:
    print(f"\nSkipped (in folder but don't pass filter): {skipped_not_reviewed}")

with open("tosdr_points.csv", "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
    w.writeheader()
    w.writerows(rows)

print(f"\n{len(rows)} rows written to tosdr_points.csv")
