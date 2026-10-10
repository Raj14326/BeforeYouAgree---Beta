# BYA 19-label dataset

`build_unified_19_dataset.py` creates a clause-level, multi-label dataset for
the exact 19 category IDs used by Before You Agree. It intentionally excludes
OPP-115.

## Sources

- LexGLUE `unfair_tos`, pinned and cleaned under `ml/data/lexglue-binary`,
  supplies the official eight unfair-terms labels under CC BY 4.0.
- Open Terms Archive `contrib-versions` supplies modern policy text. The
  database is ODC-By 1.0; rights in underlying document contents may differ.
  Its privacy labels are high-precision weak supervision, not expert labels.

## Outputs

Run from the repository root:

```powershell
.venv\Scripts\python.exe ml_service\build_unified_19_dataset.py
```

The ignored `ml/data/bya-19-v1` directory contains `train.jsonl`,
`validation.jsonl`, `test.jsonl`, `review_queue.jsonl`, and a checksummed
manifest. Never train on the review queue until a reviewer has resolved it.

Each row includes the display clause (`text`), heading and preceding context,
19 label IDs plus a fixed-order binary vector, document/service grouping,
source URL and licence, annotation method, confidence, and hard-negative
metadata.

## Release gate

The weakly supervised privacy validation and test rows require manual review
before metrics can be presented as model accuracy. Also verify rights in the
underlying archived policy contents before commercial redistribution or model
training. These restrictions are recorded in the generated manifest.
