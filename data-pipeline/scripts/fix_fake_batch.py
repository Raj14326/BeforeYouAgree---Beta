import csv

IN_PATH = "labeling_sample.csv"
KEEP_FIRST_N = 14
CLEAR_NEXT_N = 18

with open(IN_PATH, newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    fieldnames = reader.fieldnames
    rows = list(reader)

labeled_indices = [i for i, r in enumerate(rows) if rows[i]["risk_label"].strip()]
print(f"Currently {len(labeled_indices)} rows are labeled")

to_clear = labeled_indices[KEEP_FIRST_N:KEEP_FIRST_N + CLEAR_NEXT_N]
print(f"Clearing {len(to_clear)} row(s)")

for i in to_clear:
    rows[i]["risk_label"] = ""

with open(IN_PATH, "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=fieldnames)
    w.writeheader()
    w.writerows(rows)

remaining = sum(1 for r in rows if r["risk_label"].strip())
print(f"Done. {remaining}/{len(rows)} labeled now.")ø
