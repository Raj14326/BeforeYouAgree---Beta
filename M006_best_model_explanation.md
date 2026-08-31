# M006 Best Model Explanation

## 1. Model Overview

The selected best baseline model is **M006 - NB char 3-5 balanced**.

This model is used to classify Terms and Conditions clauses into two binary labels:

- `risky`: the clause may contain user risk, such as data sharing, tracking, liability limitation, content reuse, refund/cancellation restrictions, or account control.
- `not_risky`: the clause does not show clear risk signals.

The model is a **Naive Bayes baseline classifier** using **character n-gram features** from length 3 to 5. Instead of only learning whole words, it learns small text patterns inside clauses. This helps because Terms and Conditions often use repeated legal wording, such as `refund`, `liability`, `third party`, `arbitration`, `license`, and similar phrase fragments.

## 2. Training Data

The model was trained using the cleaned binary training dataset:

- Training file: `ota_clean_training_binary.csv`
- Validation file: `ota_clean_validation_binary.csv`
- Test file: `ota_clean_test_binary.csv`

Dataset size:

- Train: 361 clauses
- Validation: 69 clauses
- Test: 70 clauses

The target column is:

- `binary_label`

The input text combines:

- `service_name`
- `document_type`
- `section_heading`
- `clause_text_clean`

## 3. Training Process

Eight baseline models were trained and compared:

- M001: Word unigram Naive Bayes
- M002: Word unigram + bigram Naive Bayes
- M003: Keyword-augmented Naive Bayes
- M004: Keyword-heavy Naive Bayes tuned to catch risky clauses
- M005: Bernoulli-style word bigram model
- M006: Character 3-5 n-gram Naive Bayes
- M007: Word bigram model tuned for accuracy
- M008: Keyword-augmented model tuned to catch risky clauses

Each model was evaluated using validation and test data. The final ranking used this score:

`selection_score = 0.50 * test_macro_f1 + 0.30 * test_risky_recall + 0.20 * test_accuracy`

This ranking does not only reward accuracy. It also rewards the model for catching risky clauses and performing reasonably across both labels.

## 4. M006 Results

M006 achieved the best overall ranking:

- Performance rank: `P01`
- Selection score: `0.7597`
- Test accuracy: `0.8143`
- Test macro F1: `0.6359`
- Risky precision: `0.8548`
- Risky recall: `0.9298`
- Risky F1: `0.8908`
- Not risky F1: `0.3810`

## 5. Interpretation

M006 performs well at detecting risky clauses. Its risky recall is `92.98%`, which means it catches most risky clauses in the test set. This is useful for the project because the app should avoid missing potentially harmful terms.

However, the model is still not fully reliable. The `not_risky` F1 score is only `38.10%`, which means the model may incorrectly flag some safe clauses as risky. This is likely caused by the small dataset size and class imbalance.

For the current stage, M006 is suitable as a baseline model for demonstrating the AI pipeline in the web app. It should not yet be presented as a final production-level model.

## 6. Risk Score Calculation

The updated M006 package now includes risk scoring.

The model first predicts `risk_probability`, which is the probability that a clause is risky. Then the system detects explainable risk categories using keyword and pattern rules. Examples include:

- `data_sharing`
- `tracking`
- `content_license`
- `liability_dispute`
- `billing_refund`
- `account_control`

Each clause receives a `clause_risk_score` from 0 to 100.

Formula:

`clause_risk_score = 0.70 * model_probability_score + 0.30 * category_severity_score`

If no risk category is detected, the score is reduced:

`clause_risk_score = 0.85 * model_probability_score`

Risk levels:

- `Low`: 0-39.99
- `Medium`: 40-74.99
- `High`: 75-100

The system also calculates an `overall_risk_score` for a service or document using weighted average:

`overall_risk_score = weighted_average(clause_risk_score, clause_weight)`

High-severity categories have higher weights, so a serious risky clause is not hidden by many low-risk clauses.

Weights:

- High risk category: 1.50
- Medium risk category: 1.20
- Low or no category: 1.00

## 7. Recommended Next Step

To improve the model, the team should:

- Manually review more clauses, especially `not_risky` examples.
- Keep the labels consistent across reviewers.
- Increase the dataset size from around 500 reviewed clauses to at least 1,000-2,000 reviewed clauses.
- Later compare this baseline with TF-IDF Logistic Regression or a small transformer model if the environment supports it.

## 8. Saved Files

This folder contains:

- `M006_model.json`: the trained model
- `M006_metrics.json`: detailed model metrics
- `M006_val_predictions.csv`: validation predictions
- `M006_test_predictions.csv`: test predictions
- `M006_test_service_scores.csv`: service/document-level weighted risk scores
- `experiment_summary.csv`: ranking of all trained baseline models
- `run_report.json`: overall training run summary
- `run_risk_model_experiments.py`: training code
