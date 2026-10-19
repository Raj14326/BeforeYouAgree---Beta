# Before You Agree — Handover Completion Checklist

Use this checklist to convert the repository-based drafts into the final controlled handover package.

## Documents and evidence

- [ ] Product Document reviewed and approved.
- [ ] Support Document reviewed through a clean-user walkthrough.
- [ ] Maintenance Document tested by deploying from a clean checkout.
- [ ] Ethics Canvas completed and linked.
- [ ] ACS Code of Professional Conduct mapping reviewed and linked.
- [ ] Current security plan and VAPT report included, with unresolved risks identified.
- [ ] Product demonstration video linked and access-tested.
- [ ] Screenshots/visual aids added where they materially clarify operation or maintenance.
- [ ] Test and production smoke-test evidence included.

## Ownership and access

- [ ] Future sponsor and product owner named.
- [ ] Team names, approved email addresses, and LinkedIn links verified.
- [ ] Production frontend and API URLs recorded.
- [ ] Repository and Project Governance Portfolio/Google Drive links recorded.
- [ ] Sponsor/support/technical/security escalation contacts recorded.
- [ ] Repository, cloud, DNS, storage, and provider ownership transferred.
- [ ] Secrets transferred through an approved secure channel and rotated after transfer.
- [ ] Model artefacts transferred separately and restoration tested.

## Technical readiness

- [ ] Production platform selected; obsolete deployment configurations removed or clearly marked.
- [ ] `ALLOWED_ORIGINS`, `VITE_API_URL`, model path, and optional integrations verified.
- [x] `npm run build` and `npm run test:unit` pass (verified 15 October 2026: 22 test files and 87 tests passed).
- [ ] Repeat `npm ci`, `npm run build`, and `npm run test:unit` on a clean checkout and retain the output as final evidence.
- [ ] Acceptance/smoke tests pass against the final deployment.
- [ ] Backup and restore test completed.
- [ ] Monitoring, logs, retention, alerting, and incident response locations documented.
- [ ] Rollback process tested and previous stable release identified.
- [ ] Known defects, limitations, and accepted security risks recorded.

## Formal handover

- [ ] Moodle sign-off template adapted for Before You Agree.
- [ ] Industry mentor acceptance captured if applicable.
- [ ] Monash mentor sign-off captured separately.
- [ ] Final package uses a meaningful folder structure and all links work for the recipient.
- [ ] Package placed in the Project Governance Portfolio Repository.
- [ ] Required Google Drive link supplied.
- [ ] Moodle plagiarism quiz completed.
- [ ] Final submission receipt retained.

## Suggested package structure

```text
Before You Agree - Handover/
├── 01 Product/
│   ├── Product Document.pdf
│   ├── Product Video Link.pdf
│   └── Ethics and ACS/
├── 02 Support/
│   ├── Support Document.pdf
│   └── User Visuals/
├── 03 Maintenance/
│   ├── Maintenance Document.pdf
│   ├── Architecture and Deployment/
│   ├── Test Evidence/
│   └── Security and VAPT/
├── 04 Source and Access/
│   ├── Repository Link.pdf
│   └── Access Transfer Record.pdf
└── 05 Acceptance/
    ├── Industry Mentor Sign-off.pdf
    └── Monash Mentor Sign-off.pdf
```

Do not place passwords, API keys, private model weights, or unrestricted personal data in this folder. Record the secure transfer method instead.
