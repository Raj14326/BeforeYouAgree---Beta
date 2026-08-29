# LegalBERT analysis service

The model classifies all eight LexGLUE UNFAIR-ToS labels, but the product only returns concrete-risk findings: limitation of liability, unilateral termination, unilateral change, content removal, and arbitration. Boilerplate acceptance, choice-of-law, and jurisdiction classifications are intentionally excluded. An empty result means no configured concrete risk exceeded the threshold; it is not a legal determination that the text is fair.

By default it loads `Agreemind/lexglue-legalbert-small-unfair-tos`, a 35M-parameter LegalBERT checkpoint fine-tuned on the official LexGLUE split. Set `LEGALBERT_MODEL` to use a locally trained artifact or another compatible checkpoint.

## Train

Use Python 3.12 in this directory:

```sh
python -m venv .venv
.venv/Scripts/activate
pip install -r requirements-train.txt
python train.py --output model
```

Training defaults to `nlpaueb/legal-bert-small-uncased`. Pass `--model nlpaueb/legal-bert-base-uncased` to use the larger model. Publish the resulting `model` directory to a private or public Hugging Face model repository for deployment.

## Run

```sh
set LEGALBERT_MODEL=./model
uvicorn service:app --host 127.0.0.1 --port 8080
```

For Railway, create a second service with `/ml` as its root directory and deploy the Dockerfile. `LEGALBERT_MODEL` is optional because the benchmark-aligned small checkpoint is the default.

## Train the OPP-115 privacy-practice model

OPP-115 is kept local because its annotations are licensed for research, teaching, and scholarship. The importer uses the consolidated 0.75-overlap annotations, excludes the generic `Other` category, and splits entire policies between train, validation, and test sets to prevent policy leakage.

```sh
python train_privacy.py --corpus ../OPP-115_v1_0/OPP-115 --output privacy-model
set PRIVACY_MODEL=./privacy-model
uvicorn service:app --host 127.0.0.1 --port 8080
```

The service calibrates a confidence threshold per privacy category from the validation split. OPP-115 detects disclosed privacy practices; those detections must not be presented as proof that a practice is harmful or unlawful.

At inference time, OPP-115 categories remain an internal signal. The API only returns passages that also match a concrete rule in `privacy_risk.py`. Contract predictions receive the equivalent high-precision check in `contract_risk.py`. Results are sentence-sized and normalized duplicate clauses are merged before returning the response.
