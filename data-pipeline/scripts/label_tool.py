import csv
import os

IN_PATH = "labeling_sample.csv"

LABELS = {"1": "Low", "2": "Medium", "3": "High", "s": ""}

HELP_TEXT = """
  1 = Low     (neutral / informational / protects the user)
  2 = Medium  (some risk, but disclosed clearly / fairly standard)
  3 = High    (clearly unfavorable -- waives rights, broad sharing,
               unilateral termination, arbitration, liability limits)
  s = skip (leave blank, come back to it later)
  q = quit and save
"""


def save_rows(rows, fieldnames):
    with open(IN_PATH, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)


def main():
    with open(IN_PATH, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        rows = list(reader)

    total = len(rows)
    already_done = sum(1 for r in rows if r["risk_label"].strip())
    print(f"\n{already_done}/{total} already labeled. Let's continue.\n")
    print(HELP_TEXT)

    labeled_this_session = 0
    try:
        for i, row in enumerate(rows):
            if row["risk_label"].strip():
                continue

            os.system("clear" if os.name != "nt" else "cls")
            print(f"[{i+1}/{total}]  ({already_done + labeled_this_session}/{total} done so far)\n")
            print(f"App: {row['service_name']}  |  Doc: {row['document_type']}")
            print(f"Section: {row['section_heading']}\n")
            print(f"CLAUSE:\n  {row['clause_text']}\n")
            print(HELP_TEXT)

            while True:
                choice = input("Your answer (1/2/3/s/q): ").strip().lower()
                if choice == "q":
                    raise KeyboardInterrupt
                if choice in LABELS:
                    row["risk_label"] = LABELS[choice]
                    if choice != "s":
                        labeled_this_session += 1
                        save_rows(rows, fieldnames)
                    break
                print("Didn't understand that -- type 1, 2, 3, s, or q")

    except KeyboardInterrupt:
        pass

    save_rows(rows, fieldnames)
    done_now = sum(1 for r in rows if r["risk_label"].strip())
    print(f"\n\nSaved. {done_now}/{total} labeled overall ({labeled_this_session} labeled this session).")
    print(f"Run 'python3 label_tool.py' again anytime to continue where you left off.")


if __name__ == "__main__":
    main()
