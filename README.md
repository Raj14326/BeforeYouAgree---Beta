<p align="center">
  <img src="src/assets/BYA_logo.png"
       alt="Before You Agree logo"
       width="180">
</p>

<h1 align="left">Before You Agree</h1>

Before You Agree retrieves terms and privacy policies, then uses a fine-tuned
LEGAL-BERT model to classify each clause across eight potentially unfair Terms of
Service categories.

## Run with npm

Requirements: Node.js 22–26 and npm.

```powershell
npm install
```

The Node API loads the ONNX model entirely from
`ml/local-models/bya-legalbert-small-unfair-tos/`. The directory must contain
the tokenizer/config files and `onnx/model.onnx`. The FP32 model is about 134 MB,
remains outside Git, and is packaged into the AWS container image through
`Dockerfile.aws`. Set `BERT_MODEL_DIR` to use a different local directory.
Remote model downloads are disabled at runtime.

Start the website and Node API:

```powershell
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
| `GET` | `/api/health` | Check API availability and active model |
| `GET` | `/api/services` | List available services |
| `GET` | `/api/services?search=github` | Search for a service |
| `GET` | `/api/service/:serviceId` | Get a service and its documents |
| `GET` | `/api/versions/:serviceId/:documentId` | List archived document versions |
| `GET` | `/api/version/:serviceId/:documentId/latest` | Retrieve the latest document text |
| `GET` | `/api/version/:serviceId/:documentId/:commitSha` | Retrieve an archived document version |
| `POST` | `/api/analyze` | Classify document clauses with LEGAL-BERT |

Example analysis request:

```json
{
  "content": "We may terminate your account without notice.",
  "serviceName": "Example",
  "documentType": "terms"
}
```

## Model

The application uses a fine-tuned LEGAL-BERT Small checkpoint. Each clause can
receive any of these labels:

- limitation of liability
- unilateral termination
- unilateral change
- content removal
- contract by using
- choice of law
- jurisdiction
- arbitration

The Node inference code is in `server/bert-model.ts` and loads the local ONNX
checkpoint directly. Model weights remain outside Git and are distributed in
the AWS container image.

The results are automated predictions and are not legal advice.
