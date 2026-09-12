# Leo BERT delivery: review entry points

This directory is additive to Leo and preserves the branch's existing NB files.
It contains the eight-label trained-model pipeline and a runnable website integration
example. Final weights are a separate Release asset, not normal Git history.

- [Mentor review (English)](docs/MENTOR_REVIEW.en.md)
- [Training method and results (English)](docs/TRAINING_METHOD.en.md)


Eight-label test macro-F1 0.7469, micro-F1 0.7479. Website any-positive risk
precision 0.8047, recall 0.8095, F1 0.8071. See limitations before deployment.

---

<p align="center">
  <img src="src/assets/BYA_logo.png"
       alt="Before You Agree logo"
       width="180">
</p>

<h1 align="left">Before You Agree</h1>

Before You Agree retrieves terms and privacy policies, splits them into sentences,
then uses a native eight-label LEGAL-BERT classifier to identify potentially unfair terms.

**BERT integration:** Analysis now requires the separate Python inference service
and a fine-tuned checkpoint. Start with [the Chinese setup, training and evaluation guide](BERT_GUIDE.zh-CN.md).
The npm commands below start the website/API only; they do not train or start BERT.

**Public-label training (no new manual labels):** see [MULTILABEL_TRAINING_REPORT.zh-CN.md](MULTILABEL_TRAINING_REPORT.zh-CN.md)
for the pinned LexGLUE import, full LEGAL-BERT-Base fine-tuning and independent thresholds.

The trained 438 MB checkpoint is intentionally excluded from normal Git history.
See [MODEL_WEIGHTS.md](MODEL_WEIGHTS.md) to attach it to a GitHub Release or use Git LFS.

## Run with npm

Requirements: Node.js 22–26 and npm.

```sh
npm install
npm run dev:full
```

The website runs at `http://localhost:5173` and the API runs at
`http://127.0.0.1:8787`.

To run the frontend and API separately:

```sh
npm run dev
npm run dev:server
```

For a production build:

```sh
npm ci
npm run build
npm run server
```


## Deployment

Deploy the repository root as a Node.js application with:

```text
Build command: npm ci && npm run build
Start command: npm run server
Health check: /api/health
```

## API endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Check Node API availability (Python `/health` checks model readiness) |
| `GET` | `/api/services` | List available services |
| `GET` | `/api/services?search=github` | Search for a service |
| `GET` | `/api/service/:serviceId` | Get a service and its documents |
| `GET` | `/api/versions/:serviceId/:documentId` | List archived document versions |
| `GET` | `/api/version/:serviceId/:documentId/latest` | Retrieve the latest document text |
| `GET` | `/api/version/:serviceId/:documentId/:commitSha` | Retrieve an archived document version |
| `POST` | `/api/analyze` | Classify document clauses with the BERT service |

Example analysis request:

```json
{
  "content": "We may terminate your account without notice.",
  "serviceName": "Example",
  "documentType": "terms"
}
```

## Model

The application calls a separately hosted LEGAL-BERT-Base classifier. Each sentence
can receive zero or more of the eight UNFAIR-ToS categories. Each category uses a
threshold selected from the validation split; a sentence is flagged when any
category reaches its own threshold.

Node integration is in `server/bert-model.ts`; Python inference, training and
evaluation are in `ml_service/`. The trained BERT checkpoint defaults to
`ml/models/bert-multilabel-base-v1`. `serviceName` and `documentType` remain
accepted for API compatibility but are not used as model features.

The website runtime uses BERT only. The NB experiment remains only in offline
comparison reports and is never loaded by the API.
See [BERT_GUIDE.zh-CN.md](BERT_GUIDE.zh-CN.md) for dataset requirements, training,
startup, deployment and limitations.

The results are automated predictions and are not legal advice.
