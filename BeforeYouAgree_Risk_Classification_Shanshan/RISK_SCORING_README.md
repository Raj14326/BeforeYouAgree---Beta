# BeforeYouAgree — Iteration 1 Risk Classification Baseline

This folder contains the Iteration 1 machine-learning baseline for classifying
Open Terms Archive clauses as **Low**, **Medium**, or **High** risk.

## Main file

Open and run `BeforeYouAgree_Risk_Classification.ipynb`. The notebook contains
the complete modelling workflow:

1. load the prepared training, validation, and test datasets;
2. convert clause text into unigram and bigram features with `CountVectorizer`;
3. transform word counts into TF-IDF features;
4. compare Logistic Regression settings on the validation set;
5. evaluate the selected model on the held-out test set;
6. calculate a 0–100 risk score from class probabilities; and
7. save the trained model, predictions, and evaluation metrics.

## Required data

The notebook expects the following relative paths:

```text
outputs/ota_weak_labelled_v1/ota_train_balanced.csv
outputs/ota_weak_labelled_v1/ota_val_balanced.csv
outputs/ota_weak_labelled_v1/ota_test_balanced.csv
```

Keep the existing folder structure when downloading or moving this project.

## Baseline results

- Test accuracy: **71.11%**
- Test balanced accuracy: **66.67%**
- Test Macro-F1: **70.85%**

Macro-F1 and balanced accuracy are included because the three risk classes do
not contain the same number of examples, particularly the High-risk class.

## Output files

Running the notebook creates `outputs/ota_machine_learning_risk_model/` and
saves:

- `risk_classification_model.pkl`
- `test_predictions.csv`
- `validation_model_comparison.csv`
- `test_metrics.json`

The `.pkl` file contains the fitted CountVectorizer, TF-IDF transformer,
Logistic Regression model, class names, and risk-score mapping.

## Important limitation

The initial risk labels were generated automatically using predefined risk
rules and have not all been independently reviewed by legal experts. Therefore,
the reported metrics primarily show how consistently the baseline reproduces
the current labelling scheme. They should not be interpreted as verified legal
risk accuracy or legal advice.

Future iterations should use a larger manually reviewed dataset, especially for
Medium- and High-risk clauses.
