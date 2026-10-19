# Before You Agree — Product Document

**Document status:** Handover draft based on repository state at 15 October 2026  
**Version:** 1.0  
**Audience:** Potential sponsors, product owners, and organisational decision-makers

> Complete every item marked **[PROJECT OWNER TO COMPLETE]** before submission.

## 1. Product overview

Before You Agree (BYA) is a web application that helps people inspect Terms of Service and privacy policies before accepting them. It retrieves public policy documents, accepts user-provided documents, separates them into clauses, and presents potentially concerning wording in accessible language.

The product combines a locally hosted, fine-tuned LEGAL-BERT classifier for eight Terms of Service categories with auditable rules for eleven privacy categories. Results include clause-level findings, a document-level risk overview, personalised risk preferences, highlighted source text, historical policy versions, and comparisons between documents.

BYA is a decision-support and digital-literacy tool. Its output is automated and must not be represented as legal advice, a statement about an organisation's actual conduct, or a substitute for reading the source document.

## 2. Problem and intended audience

Online agreements are usually lengthy and difficult to compare. Consumers can accept provisions about termination, liability, dispute resolution, data collection, sharing, and retention without understanding their practical effect. BYA makes those provisions easier to locate and review.

Primary users are consumers who want a quick, understandable review of an online agreement. Secondary audiences include consumer advocates, educators, researchers, and organisations wishing to improve policy transparency.

## 3. User value

BYA allows a user to:

- search a public catalogue for a service and select an available document;
- paste policy text, upload a `.txt`, `.pdf`, or `.docx` file, or retrieve a public policy URL;
- analyse clauses and see potentially risky or near-threshold findings;
- view the original text with relevant passages highlighted;
- personalise category priorities and resulting risk scores;
- inspect archived versions when history is available;
- compare selected documents and category results; and
- request an optional AI-generated comparison summary after explicit consent when private uploaded text is involved.

## 4. Scope and capabilities

### Terms of Service categories

The LEGAL-BERT model classifies limitation of liability, unilateral termination, unilateral change, content removal, contract by using, choice of law, jurisdiction, and arbitration.

### Privacy categories

Auditable rules identify broad data collection, location tracking, cross-service profiling, personalised advertising, content or audio analysis, third-party sharing, government disclosure, administrator access and control, extended retention, international transfer, and business-transfer disclosure.

### Risk presentation

Model scores are independent category scores and are not legal-risk probabilities. Each score is compared with its category-specific threshold. A clause is shown as high risk when at least two categories are detected or one category clearly exceeds its threshold; medium risk covers one detection or a near-threshold result; low risk means no category is detected or close to its threshold. The interface also calculates an explainable document score and can adjust presentation according to a user's selected priorities.

## 5. Product architecture

The application has three main layers:

1. A Vue 3 and TypeScript single-page interface built with Vite.
2. A Node.js HTTP API that validates requests, retrieves public documents, performs local model inference, and mediates all external services.
3. A fine-tuned LEGAL-BERT Small model stored outside Git and loaded locally through Hugging Face Transformers/ONNX.

External data and service dependencies are ToS;DR, Open Terms Archive on GitHub, Australian Privacy Score, and optional Groq comparison summaries. The frontend communicates only with the BYA API.

## 6. Resources required

### People

Ongoing ownership should include:

- a product owner responsible for scope, user communication, and disclaimers;
- a full-stack developer familiar with Vue, TypeScript, Node.js, and REST APIs;
- a machine-learning maintainer familiar with transformer classification, ONNX, threshold calibration, and model evaluation; and
- a security/privacy reviewer for dependency, data-flow, and vulnerability review.

### Technical resources

- Node.js 22.22.2 or newer within the versions allowed by `package.json`;
- npm and the locked dependencies in `package-lock.json`;
- static frontend hosting and a Node-compatible API host;
- sufficient API memory to load the approximately 134 MB FP32 ONNX model;
- the private model artefacts listed in `server/model-storage.ts`;
- optional AWS S3 storage for deployment-time model retrieval; and
- credentials for optional Groq and GitHub integrations.

## 7. Ethics and professional conduct

The product supports public understanding by presenting evidence from source documents and explaining automated findings. Current safeguards include clear non-legal-advice positioning, retaining source context, distinguishing near-threshold findings, local classification, no server-side persistence of uploaded documents, user consent before sending private excerpts to Groq, and validation of inputs and model categories.

Risks requiring continued governance include false positives, false negatives, model bias, outdated source policies, over-reliance on a single score, third-party outages, and users mistaking policy wording for evidence of company behaviour. Sponsors should preserve transparency, human review, privacy minimisation, accessibility, and honest communication about limitations.

**Ethics Canvas:** [PROJECT OWNER TO COMPLETE: add the approved Project Governance Portfolio link]  
**ACS Code of Professional Conduct mapping:** [PROJECT OWNER TO COMPLETE: add the approved artefact link or reviewed mapping]

## 8. Future opportunities

Potential future work includes formal accessibility auditing, broader browser/device testing, multilingual policy support, improved rule/model evaluation datasets, monitored model drift, authenticated saved comparisons with explicit retention controls, expanded policy sources, and sponsor-approved analytics that do not expose document content.

## 9. Ownership and handover contacts

**Future sponsor:** [PROJECT OWNER TO COMPLETE]  
**Product owner:** [PROJECT OWNER TO COMPLETE]  
**Technical contact:** [PROJECT OWNER TO COMPLETE]  
**Team members, email addresses, and LinkedIn profiles:** [PROJECT OWNER TO COMPLETE AND VERIFY]

## 10. Product access

**Production URL:** [PROJECT OWNER TO COMPLETE]  
**Repository/governance portfolio:** [PROJECT OWNER TO COMPLETE]  
**Product demonstration video:** [PROJECT OWNER TO COMPLETE]  
**Credentials or access process:** [PROJECT OWNER TO COMPLETE; transfer securely, never place passwords in this document]

