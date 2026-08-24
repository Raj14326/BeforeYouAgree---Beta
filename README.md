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
- `GET /api/services` returns the Open Terms Archive service catalogue.
- `GET /api/service/:name` returns tracked document types and source URLs.
- `GET /api/versions/:name/:termsType` returns paginated Git version history.
- `GET /api/version/:name/:termsType/latest` returns the latest cleaned Markdown.
- `GET /api/version/:name/:termsType/at?month=YYYY-MM` returns a version archived within that month.
- `GET /api/version/:name/:termsType/:commitSha` returns a historical version.

The backend reads the public `OpenTermsArchive/contrib-declarations` and `OpenTermsArchive/contrib-versions` repositories over HTTPS. It validates service and document names against cached repository indexes and never accepts arbitrary upstream URLs.

Unauthenticated GitHub API access is rate limited. For development or deployment, set an optional `GITHUB_TOKEN` environment variable to increase the limit. The token only needs permission to read public repositories.

## Production

The frontend and backend are configured as separate HTTPS services. `amplify.yml` builds the Vue frontend on AWS Amplify, while `railway.json` starts the API on Railway.

### Railway API

1. Create a Railway project from this GitHub repository.
2. Add a service and let Railway use the repository's `railway.json` configuration.
3. Generate a public Railway domain under **Settings > Networking**.
4. Set `GITHUB_TOKEN` to a GitHub token with public-repository read access.
5. After creating the Amplify app, set `ALLOWED_ORIGINS` to its full HTTPS URL. Multiple origins can be comma-separated.

Railway supplies `PORT`. The server binds to `0.0.0.0` by default. Confirm deployment with `https://YOUR-RAILWAY-DOMAIN/api/health`.

### AWS Amplify frontend

1. In AWS Amplify Hosting, choose **New app > Host web app** and connect this GitHub repository.
2. Select the `Prototype` branch. Amplify will detect `amplify.yml` and publish `dist`.
3. Add `VITE_API_URL` under **Hosting > Environment variables**, using the Railway origin without a trailing slash, for example `https://example.up.railway.app`.
4. Redeploy the Amplify branch after adding the variable.

`VITE_API_URL` is embedded during the frontend build and is not a secret. Keep `GITHUB_TOKEN` only in Railway. Local development continues to use Vite's `/api` proxy when `VITE_API_URL` is unset.
