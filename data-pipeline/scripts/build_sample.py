import csv
import random
from collections import defaultdict

random.seed(42)

IN_PATH = "ota_clauses.csv"
OUT_PATH = "labeling_sample.csv"
PER_GROUP = 7

with open(IN_PATH, newline="", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))

groups = defaultdict(list)
for r in rows:
    groups[(r["service_name"], r["document_type"])].append(r)

sample = []
for key, group_rows in groups.items():
    n = min(PER_GROUP, len(group_rows))
    sample.extend(random.sample(group_rows, n))

random.shuffle(sample)

fieldnames = list(rows[0].keys()) + ["risk_label"]
with open(OUT_PATH, "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=fieldnames)
    w.writeheader()
    for r in sample:
        r["risk_label"] = ""
        w.writerow(r)

print(f"Sampled {len(sample)} clauses from {len(groups)} (app, doc_type) groups")
print(f"Wrote {OUT_PATH} -- ready for labeling")
