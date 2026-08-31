# Before You Agree

FIT5120 prototype for finding services, retrieving their terms, and preparing clean text for clause analysis.

## Local development

Requirements: Node.js 22-26 and npm.

```sh
npm install
npm run dev:full
```

Open `http://localhost:5173`. The Vue app runs on port `5173`, and the local API runs on `127.0.0.1:8787`.

Run the two processes separately when debugging:

```sh
npm run dev
npm run dev:server
```

## API

- `GET /api/health` checks backend availability.
- `GET /api/services?search=github` searches service names using ToS;DR Search V5.
- `GET /api/services` returns the first page of the ToS;DR service catalogue.
- `GET /api/service/:serviceId` returns a service and its available documents.
- `GET /api/versions/:serviceId/:documentId` returns real archived update dates when a matching Open Terms Archive document exists.
- `GET /api/version/:serviceId/:documentId/latest` returns the current document as cleaned plain text in JSON.
- `GET /api/version/:serviceId/:documentId/:commitSha` returns the selected historical version.

The backend uses ToS;DR's public `search/v5`, `service/v3`, and `document/v1` endpoints for services and current documents. When available, historical revision dates and text come from `OpenTermsArchive/contrib-versions`. Responses are cached locally, document IDs are checked against their service, and HTML elements are removed from current document text before it is returned. Every endpoint responds with JSON so its output can be consumed by the frontend or a later model pipeline.

Unauthenticated GitHub API access is rate limited. Set an optional `GITHUB_TOKEN` on the backend to increase the limit; it only needs access to public repositories.

## Production

The frontend and backend are configured as separate HTTPS services. `amplify.yml` builds the Vue frontend on AWS Amplify, while `railway.json` starts the API on Railway.

### Railway API

1. Create a Railway project from this GitHub repository.
2. Add a service and let Railway use the repository's `railway.json` configuration.
3. Generate a public Railway domain under **Settings > Networking**.
4. After creating the Amplify app, set `ALLOWED_ORIGINS` to its full HTTPS URL. Multiple origins can be comma-separated.

Railway supplies `PORT`. The server binds to `0.0.0.0` by default. Confirm deployment with `https://YOUR-RAILWAY-DOMAIN/api/health`.

### AWS Amplify frontend

1. In AWS Amplify Hosting, choose **New app > Host web app** and connect this GitHub repository.
2. Select the `Prototype` branch. Amplify will detect `amplify.yml` and publish `dist`.
3. Add `VITE_API_URL` under **Hosting > Environment variables**, using the Railway origin without a trailing slash, for example `https://example.up.railway.app`.
4. Redeploy the Amplify branch after adding the variable.

`VITE_API_URL` is embedded during the frontend build and is not a secret. Local development continues to use Vite's `/api` proxy when `VITE_API_URL` is unset.

======================================================================================================================================================
# Risk Classification Baseline Model

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
