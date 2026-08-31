import csv
import sys

IN_PATH = "labeling_sample.csv"
N = int(sys.argv[1]) if len(sys.argv) > 1 else 10

with open(IN_PATH, newline="", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))

unlabeled = [(i, r) for i, r in enumerate(rows) if not r["risk_label"].strip()]
batch = unlabeled[:N]

if not batch:
    print("Nothing left to label -- all rows are done!")
else:
    for n, (i, r) in enumerate(batch, 1):
        print(f"--- #{n} ---")
        print(f"App: {r['service_name']}  |  Doc: {r['document_type']}")
        print(f"Section: {r['section_heading']}")
        print(f"Clause: {r['clause_text']}")
        print()
    print(f"({len(unlabeled)} total remaining)")
