# Before You Agree — Maintenance Document

**Document status:** Handover draft based on repository state at 15 October 2026  
**Audience:** Developers, platform engineers, ML maintainers, and security reviewers

> Complete every item marked **[PROJECT OWNER TO COMPLETE]** before submission.

## 1. Technology baseline

- Frontend: Vue 3, TypeScript, Vue Router, Vite, and Motion for Vue.
- Backend: Node.js TypeScript using the built-in HTTP server.
- Model inference: Hugging Face Transformers with a local ONNX LEGAL-BERT Small checkpoint.
- Document extraction: PDF.js, Mammoth, and plain-text parsing.
- Unit/component tests: Vitest and Vue Test Utils.
- End-to-end tests: Playwright.
- Production packaging: static frontend build plus a separately deployed Node API; AWS configuration and alternative Railway metadata are included.

The supported Node engine range is defined in `package.json`. Use the committed `package-lock.json` for reproducible dependency installation.

## 2. Repository map

| Path | Responsibility |
| --- | --- |
| `src/views/` | Landing, document selection, review, and comparison pages |
| `src/components/` | Reusable interface and risk-presentation components |
| `src/composables/` | Shared state and workflows for documents, comparison, preferences, and theme |
| `src/lib/` | API helpers, document extraction, aggregation, scoring, routing, and formatting |
| `server/index.ts` | HTTP server, routes, validation, CORS, caching, and upstream access |
| `server/bert-model.ts` | Model loading, batching, inference, and result construction |
| `server/risk-level.ts` | Threshold-aware low/medium/high clause classification |
| `server/privacy-rules.ts` | Auditable privacy-category rules |
| `server/policy-url.ts` | Safe public policy retrieval and extraction |
| `server/comparison.ts` | Optional Groq comparison generation and validation |
| `server/model-storage.ts` | Local/S3 model availability |
| `ml/` | Model-related assets; local weights are excluded from Git |
| `e2e/` | Acceptance and user-story tests |
| `docs/` | Security plans, VAPT reports, and handover material |

## 3. Local setup

Prerequisites are Git, npm, and a supported Node release (currently Node 22.22.2+, 24.15.0+, or 26+ according to `package.json`).

```powershell
git clone [PROJECT OWNER TO COMPLETE: repository URL]
cd [repository-directory]
npm ci
Copy-Item .env.example .env
```

Place the model at `ml/local-models/bya-legalbert-small-unfair-tos/` or set `BERT_MODEL_DIR`. The directory must contain:

```text
config.json
risk_config.json
special_tokens_map.json
tokenizer_config.json
tokenizer.json
vocab.txt
onnx/model.onnx
```

Start frontend and API together:

```powershell
npm run dev:full
```

The frontend defaults to `http://localhost:5173` and the API to `http://127.0.0.1:8787`.

## 4. Configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | Production frontend | API origin embedded at frontend build time; blank in local development |
| `HOST` | No | API bind address; defaults to `0.0.0.0` |
| `PORT` | No | API port; defaults to `8787` |
| `ALLOWED_ORIGINS` | Production | Comma-separated permitted frontend origins |
| `BERT_MODEL_DIR` | When non-default | Local model path |
| `BERT_RISK_CONFIG` | When non-default | Threshold/configuration file override |
| `BERT_BATCH_SIZE` | No | Inference batch size; container configuration uses 4 |
| `MODEL_S3_BUCKET` | If model is not packaged locally | Private model bucket |
| `MODEL_S3_PREFIX` | No | Model object prefix |
| `GITHUB_TOKEN` | Recommended at scale | Raises GitHub API rate limits for history retrieval |
| `GROQ_API_KEY` | Optional | Enables AI comparison summaries |
| `GROQ_MODEL` | No | Groq model override |
| `AU_PRIVACY_SCORE_API_URL` | No | Australian catalogue API base |
| `AU_PRIVACY_SCORE_API_KEY` | Optional | Server-side API credential if issued |

Do not prefix server secrets with `VITE_`; Vite-prefixed variables are exposed to browser code.

## 5. Build, test, and release

Run before release:

```powershell
npm ci
npm run build
npm run test:unit
npm run test:acceptance:local
```

The build command includes Vue/TypeScript type checking. Acceptance tests start the frontend automatically. Full local analysis tests may also require the API and model, depending on the test scenario.

Recommended release procedure:

1. Review the diff and ensure no `.env`, credentials, uploads, model weights, or generated test artefacts are staged.
2. Run build and automated tests on a clean checkout.
3. Record dependency/audit results and unresolved risks.
4. Create an immutable release tag and release notes.
5. Deploy the API, verify `/api/health`, then deploy the frontend with the correct `VITE_API_URL`.
6. Run the support smoke tests and retain evidence in the governance portfolio.
7. Maintain a rollback target and confirm it before announcing the release.

**Current production platform and pipeline:** [PROJECT OWNER TO COMPLETE AND REMOVE UNUSED DEPLOYMENT OPTIONS]  
**Production URL/API URL:** [PROJECT OWNER TO COMPLETE]  
**Rollback procedure:** [PROJECT OWNER TO COMPLETE FOR THE SELECTED HOST]

## 6. Model maintenance

The model scores are not probabilities. `risk_config.json` supplies per-category thresholds. `server/risk-level.ts` labels a clause high when two or more categories cross threshold or one crosses by the high-confidence margin; it labels a clause medium when one category crosses or any score lies within the review margin.

When replacing or recalibrating the model:

1. Preserve the label-to-index mapping and validate it against the application category IDs.
2. Re-evaluate thresholds using a held-out dataset representative of intended use.
3. Test false positives and false negatives per category rather than only aggregate accuracy.
4. Update model/version descriptions, risk configuration, documentation, and test fixtures together.
5. Run server model, category-validation, clause, risk-level, frontend aggregation, and end-to-end tests.
6. Archive evaluation results and the exact model/configuration checksum.
7. Deploy with a rollback copy and monitor startup memory and inference latency.

Never change `HIGH_CONFIDENCE_MARGIN`, `REVIEW_MARGIN`, or category thresholds solely to make demonstrations look better. Changes require recorded evaluation evidence and review.

## 7. Security maintenance

- Apply least privilege to repository, deployment, S3, GitHub, and Groq access.
- Rotate transferred credentials and after any suspected exposure.
- Keep dependencies current through reviewed lockfile changes and regression tests.
- Preserve URL-fetch protections against private-network access, redirect abuse, oversized responses, and unsupported content.
- Preserve request-size, validation, rate-limit, CORS, and security-header controls in `server/index.ts`.
- Avoid logging policy bodies, uploaded text, API keys, authorization headers, or model inputs.
- Review external processors and privacy disclosures before expanding what is sent off-platform.
- Repeat vulnerability testing after changes to upload/extraction, fetching, API validation, authentication, hosting, or dependencies.
- Review the VAPT and security-plan documents in `docs/` and track each unresolved item to closure or formal risk acceptance.

## 8. Data lifecycle

The current architecture has no application database. Catalogue data and document bodies are cached in process memory. User-uploaded files are parsed in the browser, while extracted text is transmitted to the analysis API without deliberate server persistence. Browser-side preferences and theme may be stored locally.

Because infrastructure logs, reverse proxies, error monitoring, and third-party services can change the effective data lifecycle, the sponsor must validate production logging and retention settings before making privacy claims. Groq receives selected comparison excerpts only through the optional summary flow.

## 9. Troubleshooting for maintainers

### API will not start

Confirm Node version, environment syntax, model directory, all seven model artefact paths, filesystem permissions, and available memory. If S3 retrieval is configured, inspect IAM, region/provider configuration, bucket, prefix, and network access.

### Frontend cannot reach the API

Inspect the built `VITE_API_URL`, request scheme, DNS/TLS, API health, and `ALLOWED_ORIGINS`. Rebuild the frontend after changing Vite environment variables.

### Model output appears incorrect

Record the exact source clause, model artefact checksum, risk configuration, category scores, threshold decision, and application release. Reproduce in a test without changing production thresholds. Determine whether the issue is clause segmentation, tokenisation/truncation, model inference, label mapping, privacy rules, or presentation logic.

### Upstream catalogue/history is unavailable

Check upstream responses and rate limits, then review the server's bounded cache behavior and credentials. Do not silently replace source content with unverified copies.

### Deployment is unhealthy

Review process/container logs, health endpoint output, memory pressure, model load errors, missing environment values, and frontend/API version compatibility. Roll back if the release cannot be made healthy within the sponsor's incident target.

## 10. Change-control checklist

Every material change should include:

- linked requirement or incident;
- code review;
- relevant automated and manual test evidence;
- privacy/security impact assessment;
- documentation and configuration updates;
- model evaluation evidence when ML behavior changes;
- deployment and rollback instructions; and
- named approval and release timestamp.

## 11. Verification status at handover draft

On 15 October 2026, `npm run build` completed successfully, including Vue/TypeScript type checking. Vite reported a non-blocking warning that the landing-page bundle exceeded 500 kB after minification.

`npm run test:unit` completed successfully: all 87 tests in 22 test files passed. The BERT adapter tests mock local transformer inference and verify segmentation, repeated-clause deduplication with retained source offsets, below-threshold results, and integration of deterministic privacy rules.

## 12. Technical ownership

**Repository owner:** [PROJECT OWNER TO COMPLETE]  
**Deployment owner:** [PROJECT OWNER TO COMPLETE]  
**Model artefact owner:** [PROJECT OWNER TO COMPLETE]  
**Security owner:** [PROJECT OWNER TO COMPLETE]  
**Provider billing/account owner:** [PROJECT OWNER TO COMPLETE]

