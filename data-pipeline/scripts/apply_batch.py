import csv
import sys

IN_PATH = "labeling_sample.csv"
LABEL_MAP = {"1": "Low", "2": "Medium", "3": "High", "s": ""}

if len(sys.argv) < 2:
    print("Usage: python3 apply_batch.py 2,1,3,1,2,...")
    sys.exit(1)

answers = [a.strip().lower() for a in sys.argv[1].split(",")]
for a in answers:
    if a not in LABEL_MAP:
        print(f"ERROR: '{a}' isn't valid -- use only 1, 2, 3, or s")
        sys.exit(1)

with open(IN_PATH, newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    fieldnames = reader.fieldnames
    rows = list(reader)

unlabeled_indices = [i for i, r in enumerate(rows) if not r["risk_label"].strip()]
if len(answers) > len(unlabeled_indices):
    answers = answers[:len(unlabeled_indices)]

applied = 0
for idx, ans in zip(unlabeled_indices, answers):
    if ans != "s":
        rows[idx]["risk_label"] = LABEL_MAP[ans]
        applied += 1

with open(IN_PATH, "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=fieldnames)
    w.writeheader()
    w.writerows(rows)

done_now = sum(1 for r in rows if r["risk_label"].strip())
print(f"Applied {applied} label(s). {done_now}/{len(rows)} total labeled.")
