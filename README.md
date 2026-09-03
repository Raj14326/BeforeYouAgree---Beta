<p align="center">
  <img src="src/assets/BYA_logo.png"
       alt="Before You Agree logo"
       width="180">
</p>

<h1 align="left">Before You Agree</h1>

Before You Agree retrieves terms and privacy policies, then classifies each clause as
`risky` or `not_risky`.

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
| `GET` | `/api/health` | Check API availability and active model |
| `GET` | `/api/services` | List available services |
| `GET` | `/api/services?search=github` | Search for a service |
| `GET` | `/api/service/:serviceId` | Get a service and its documents |
| `GET` | `/api/versions/:serviceId/:documentId` | List archived document versions |
| `GET` | `/api/version/:serviceId/:documentId/latest` | Retrieve the latest document text |
| `GET` | `/api/version/:serviceId/:documentId/:commitSha` | Retrieve an archived document version |
| `POST` | `/api/analyze` | Classify document clauses with M006 |

Example analysis request:

```json
{
  "content": "We may terminate your account without notice.",
  "serviceName": "Example",
  "documentType": "terms"
}
```

## Model

The application uses a character 3–5 gram Multinomial Naive Bayes
classifier. It predicts one of two labels for each clause:

- `risky`
- `not_risky`

The inference code is in `server/m006-model.ts`. The trained parameters are stored in
`ml/M006_best_model_package/M006_model.json` and are loaded directly by the Node API.

The results are automated predictions and are not legal advice.
