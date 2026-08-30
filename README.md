# BeforeYouAgree — Risk Classification Baseline

## Overview

This branch contains the Iteration 1 machine-learning baseline for the BeforeYouAgree risk classification feature.

The model analyses Terms of Service and Privacy Policy clauses and classifies them into three risk levels:

- **Low** — no major risk signal was identified
- **Medium** — the clause may require user attention
- **High** — the clause contains a more serious risk signal and should be prioritised for review

It also generates a **0–100 risk score** and a prediction confidence value.

## Location

The risk classification work is located in:

```text
BeforeYouAgree_Risk_Classification_Baseline/
```

The main file is:

```text
BeforeYouAgree_Risk_Classification_Baseline/
└── BeforeYouAgree_Risk_Classification.ipynb
```

## Files

```text
BeforeYouAgree_Risk_Classification_Baseline/
├── BeforeYouAgree_Risk_Classification.ipynb
├── RISK_SCORING_README.md
└── outputs/
    └── ota_weak_labelled_v1/
        ├── ota_train_balanced.csv
        ├── ota_val_balanced.csv
        └── ota_test_balanced.csv
```

- `BeforeYouAgree_Risk_Classification.ipynb` contains the complete model workflow.
- `RISK_SCORING_README.md` provides a more detailed explanation.
- The three CSV files are the prepared training, validation, and test datasets required by the Notebook.

## Method

The baseline uses:

1. **CountVectorizer** to extract words and two-word phrases
2. **TF-IDF** to convert clause text into weighted numerical features
3. **Logistic Regression** to predict Low, Medium, or High risk
4. **Validation Macro-F1** to select the best model settings
5. Class probabilities to calculate a 0–100 risk score

The selected model uses:

```text
C = 10.0
class_weight = balanced
```

## Dataset

| Dataset | Low | Medium | High | Total |
|---|---:|---:|---:|---:|
| Training | 240 | 188 | 48 | 476 |
| Validation | 40 | 33 | 6 | 79 |
| Test | 45 | 36 | 9 | 90 |

The datasets were separated by service to reduce the possibility of highly similar clauses from the same service appearing in both training and testing data.

## Results

| Metric | Result |
|---|---:|
| Test accuracy | 71.11% |
| Test balanced accuracy | 66.67% |
| Test Macro-F1 | 70.85% |

The High-risk class contains fewer examples, so its performance is less stable than the Low- and Medium-risk classes.

## How to Run

1. Open `BeforeYouAgree_Risk_Classification.ipynb`.
2. Keep the existing folder structure unchanged.
3. Run all Notebook cells from top to bottom.

The Notebook will train the model, evaluate it, calculate risk scores, and save the model and prediction results.

## Limitations

The initial risk labels were generated automatically using predefined risk rules and have not all been independently reviewed by legal experts.

Therefore, the current results mainly show how well the baseline reproduces the existing labelling approach. They should not be interpreted as verified legal-risk accuracy or legal advice.

Future iterations should include more manually reviewed Medium- and High-risk clauses and a larger independently reviewed test set.
