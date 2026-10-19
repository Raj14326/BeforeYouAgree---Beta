# Before You Agree — Support Document

**Document status:** Handover draft based on repository state at 15 October 2026  
**Audience:** Sponsor support staff and product administrators

> Complete every item marked **[PROJECT OWNER TO COMPLETE]** before submission.

## 1. Purpose and service boundaries

This document explains how to operate and support Before You Agree. BYA analyses policy wording; it does not give legal advice and does not verify how a company behaves in practice. Results should always be read with the highlighted source clause.

## 2. Supported user workflows

### Analyse a catalogue document

1. Open the landing page and search for a service.
2. Select the service and choose one of its available policy documents.
3. Select **Analyse risks**.
4. Review the document score, category summary, individual clauses, and highlighted original text.
5. Use **History** when archived versions are available.

### Analyse a user-supplied document

1. Select the upload option on the landing page.
2. Choose **Paste text**, **Upload a file**, or **From URL**.
3. For file upload, use `.txt`, `.pdf`, or `.docx`, up to 10 MB. Scanned PDFs without a text layer may not produce usable text.
4. Paste or extracted text must contain at least 120 characters and cannot exceed 500,000 characters.
5. Select **Analyze document** and review the findings.

Files are parsed in the browser. Only extracted text is sent to the BYA API for analysis, and the current implementation does not persist that text server-side.

### Compare documents

1. From a reviewed document, select **Add to compare**.
2. Add other current or historical documents.
3. Open **Compare** to see document summaries and category results side by side.
4. If comparison summaries are enabled, request a summary. For an uploaded/private document, confirm the consent notice before excerpts are sent to Groq.

### Personalise risk priorities

Open risk preferences from the application header, enable relevant categories, and order their priority. The interface then displays personalised scores. These preferences alter presentation, not the underlying classifier output.

## 3. Routine service checks

Perform these checks after every deployment and during incident investigation:

1. Open `GET /api/health`; confirm HTTP 200 and `status: "ok"`.
2. Load the frontend and search for a known service.
3. Retrieve and analyse one catalogue document.
4. Paste a short test policy of at least 120 characters and confirm analysis completes.
5. Verify comparison, theme, risk preferences, and version history where available.
6. Review application-host logs for model-loading, upstream, memory, or rate-limit errors.

**Production monitoring location:** [PROJECT OWNER TO COMPLETE]  
**Support mailbox/escalation channel:** [PROJECT OWNER TO COMPLETE]

## 4. Data and integrations

| Dependency | Purpose | Expected failure effect |
| --- | --- | --- |
| ToS;DR API | Service catalogue and current policy references | Catalogue search/retrieval may fail |
| Open Terms Archive/GitHub | Historical document versions | History may be unavailable |
| Australian Privacy Score | Australian entity catalogue/policies | Regional catalogue entries may be unavailable |
| Local LEGAL-BERT model | Terms classification | Analysis endpoint cannot operate |
| Groq API (optional) | Natural-language comparison summary | Core analysis remains available; summary fails |
| AWS S3 (optional) | Supplies private model files when absent locally | API startup fails if neither local files nor S3 configuration is available |

The server uses in-memory upstream caching. Restarting the server clears that cache. No application database is present in the current repository.

## 5. Security and confidential information

- Keep `.env` out of version control. The repository intentionally tracks only `.env.example`.
- Store `GROQ_API_KEY`, `GITHUB_TOKEN`, AWS credentials, and any future API secrets in the hosting platform's secret manager.
- Configure `ALLOWED_ORIGINS` with only the production frontend origin. Localhost is permitted for development.
- The API enforces per-IP rate limiting, request-size limits, JSON content-type validation, an origin allow-list, and security response headers.
- Public URL fetching is mediated by the backend and must retain the protections in `server/policy-url.ts` against unsafe destinations and redirects.
- Uploaded files are processed client-side, but extracted text is sent to the analysis API. Do not claim that text never leaves the user's device.
- Optional Groq summaries send selected excerpts externally only after the relevant user consent flow.
- Never include passwords or secrets in the handover package; transfer them through an approved secure channel and rotate them after transfer.

Known limitations and residual risks are documented in the VAPT and security-plan files under `docs/`. The sponsor should review those documents, record acceptance or remediation of open findings, and avoid treating the presence of controls as a guarantee of security.

## 6. Backup and recovery

### Source and configuration

The Git repository is the source-of-truth for code and non-secret configuration. Protect the remote repository with multifactor authentication, least-privilege access, branch protection, and a second authorised owner. Back up release tags and handover documents to the governance portfolio.

### Model

The model weights are intentionally excluded from Git. Maintain an access-controlled copy of the full model directory, including `onnx/model.onnx`, tokenizer/configuration files, and `risk_config.json`. If S3 is used, enable bucket versioning, encryption, restricted IAM access, and tested restoration.

### Secrets

Maintain a secure inventory of secret names, owners, expiry/rotation dates, and recovery contacts. Do not back up secret values into Git or general-purpose documents.

### Restore test

At least once per release, deploy from a fresh clone using the documented model source and secret configuration, run the health check, and complete the smoke tests in section 3.

## 7. Common incidents

| Symptom | Likely cause | Response |
| --- | --- | --- |
| Frontend loads but all API actions fail | Incorrect `VITE_API_URL`, CORS origin, API outage, or mixed-content configuration | Check browser network errors, API health, frontend build variable, and `ALLOWED_ORIGINS` |
| API fails during startup | Model files missing or inaccessible | Verify `BERT_MODEL_DIR`, required model files, or S3 bucket/prefix and credentials |
| Analysis returns 413 | Document exceeds the size limit | Reduce the document to 500,000 characters or fewer |
| File contains too little text | Scanned/image PDF or extraction failure | Use a text-based file, OCR it through an approved tool, or paste text manually |
| URL import fails | Site blocks retrieval, content is not public HTML/text, or URL safety validation rejects it | Paste the policy text directly; do not weaken URL-fetch security controls |
| Catalogue/history fails | Upstream ToS;DR or GitHub outage/rate limit | Retry later, inspect upstream status and server logs, and configure `GITHUB_TOKEN` if appropriate |
| AI comparison is unavailable | `GROQ_API_KEY` absent or Groq request failed | Core comparison remains usable; verify secret and provider status |
| HTTP 429 | Per-IP request limit exceeded | Wait for the one-minute window; investigate automation or abuse before changing limits |
| Stale display after release | Browser/static-host cache | Verify deployed asset version, invalidate the hosting cache, then reload |

## 8. API reference

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Service health and active model description |
| GET | `/api/services` | List/search services |
| GET | `/api/service/:serviceId` | Retrieve service metadata and documents |
| GET | `/api/australian-policy/:slug` | Retrieve an Australian catalogue policy |
| GET | `/api/versions/:serviceId/:documentId` | List archived versions |
| GET | `/api/version/:serviceId/:documentId/latest` | Retrieve current document text |
| GET | `/api/version/:serviceId/:documentId/:commitSha` | Retrieve an archived version |
| POST | `/api/analyze` | Analyse document text |
| POST | `/api/fetch-policy` | Fetch and extract a public policy URL |
| POST | `/api/compare-summary` | Generate an optional comparison summary |

## 9. Support ownership

**Service owner:** [PROJECT OWNER TO COMPLETE]  
**First-line support:** [PROJECT OWNER TO COMPLETE]  
**Technical escalation:** [PROJECT OWNER TO COMPLETE]  
**Security incident contact:** [PROJECT OWNER TO COMPLETE]  
**Upstream/provider account owners:** [PROJECT OWNER TO COMPLETE]

