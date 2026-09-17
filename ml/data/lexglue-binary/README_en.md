# Small / Base Actually-Used Cleaned CSV Data

train.csv: 5,378 records; validation.csv: 2,253 records; test.csv: 1,600 records.
These three files match, byte-for-byte, the CSVs used for model training — no re-splitting or label modification was performed.
dataset_manifest.json contains the source version, file SHA-256 hashes, original counts, and cleaning records.
UPSTREAM_DATASET_CARD.md is the upstream documentation saved at download time.

Source: https://huggingface.co/datasets/coastalcph/lex_glue (unfair_tos subset)
Pinned revision: c23fdff1a6bf74e0e1a71cb86f1e781d37da888c
Licensed as CC-BY-4.0 per the upstream data card; citations should retain the original authors and data source.

## CSV Columns

- text: English clause text.
- label: derived binary classification label, risky or not_risky — not the sole target for the 8-label training.
- clause_id: sentence ID formed from the original split and original line number.
- original_split: the original official split.
- original_labels: JSON list of original 8-class label numbers, e.g. [0,1]; [] means no risk within the 8 classes.
- label_source: source of the public data annotation.
- dataset_revision: the pinned dataset version.

8-label training reads original_labels; a single sentence can carry multiple labels:

No.	Label	Description
0	limitation_of_liability	Limitation of liability
1	unilateral_termination	Unilateral termination
2	unilateral_change	Unilateral change
3	content_removal	Content removal
4	contract_by_using	Contract by using (agreement formed by use)
5	choice_of_law	Choice of law
6	jurisdiction	Jurisdiction
7	arbitration	Arbitration

## Cleaning Rules

The official splits were preserved; exact duplicates were checked against normalized text, prioritizing test, then validation, then train for retention.
Removed: 152 duplicate training records, 22 duplicate validation records, 7 duplicate test records, and 2 training records with conflicting binary labels.
The public parquet has no service/document IDs, so service-level independence cannot be proven from it, and near-duplicates were not independently excluded either.

## Usage

If used in an existing project, place the three CSVs together with dataset_manifest.json into
ml/data/lexglue-binary/. The historical directory name contains "binary," but the CSVs retain the 8-label data.
Do not manually modify the CSVs and continue relying on the original checksum values — any re-cleaning should be saved with a new version and provenance record.
test.csv has previously been used for model comparison and must not be renamed into a new blind test set.
