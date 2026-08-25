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
