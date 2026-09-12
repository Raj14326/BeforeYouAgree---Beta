"""Write reproducible model documentation after independent evaluation."""
import argparse
import hashlib
import json
import platform
import shutil
from pathlib import Path


def finalize(model_dir, report_dir):
    model_dir, report_dir = Path(model_dir), Path(report_dir)
    manifest = json.loads((model_dir / 'risk_config.json').read_text(encoding='utf-8'))
    if manifest['revision'] != '0e23f7a9a39f59768ea7e09766d8ee308580fb17':
        raise ValueError('This documentation generator is for the pinned LEGAL-BERT-Small run only')
    report = json.loads((report_dir / 'metrics.json').read_text(encoding='utf-8'))
    if report['model'] != manifest['model_id'] or report['test_sha256'] != manifest['split_file_sha256']['test']:
        raise ValueError('Model and evaluation do not match')
    source = Path('ml/pretrained/legal-bert-small/README.md')
    if source.exists():
        shutil.copyfile(source, model_dir / 'UPSTREAM_MODEL_CARD.md')
    card = f'''---
language: en
license: cc-by-sa-4.0
base_model: nlpaueb/legal-bert-small-uncased
datasets:
- coastalcph/lex_glue
pipeline_tag: text-classification
---

# Before You Agree — public-label BERT v1

This is a real fully fine-tuned LEGAL-BERT-Small binary classifier, not the random
miniature test fixture used by software tests. Training ran locally on CPU using
the original public annotations; no new team manual labels or LLM pseudolabels
were used. This is a research/prototype checkpoint, not a legal determination.

Base model revision: `0e23f7a9a39f59768ea7e09766d8ee308580fb17`.
Dataset revision: `c23fdff1a6bf74e0e1a71cb86f1e781d37da888c`.
Label mapping: 0 = not_risky; 1 = risky. A nonempty original eight-category
UNFAIR-ToS annotation is mapped to risky. Empty annotations do not establish
that a clause is safe in every respect or jurisdiction.

Training: {manifest['training_args']['epochs']} epochs, seed 5120, weighted loss,
full encoder fine-tuning, max window {manifest['max_length']} tokens, overlap
{manifest['stride']} tokens, max-logit pooling. The selected checkpoint is epoch
{manifest['validation']['epoch']}. Saved decision threshold: {manifest['threshold']:.8f}.
Validation-only selection targets recall >= 0.70 and then maximizes precision.
The model score is not calibrated as a probability of legal risk.

Held-out cleaned test set: {report['rows']} sentences.
Risk precision: {report['risky_precision']:.6f}; risk recall: {report['risky_recall']:.6f};
macro-F1: {report['macro_f1']:.6f}; false-positive rate: {report['false_positive_rate']:.6f}.
Confusion counts: {json.dumps(report['confusion'])}.

Exact duplicates and binary-label conflicts were removed while retaining
official split membership. This differs from the original LexGLUE leaderboard.
The parquet release has no document IDs, so independent document grouping
could not be verified. English sentence-level benchmark performance does not
establish performance for privacy policies, Chinese text, new websites or long
paragraphs. Max pooling can increase false positives on long text and does not
resolve cross-section references. Actual website evaluation is still needed.

Run with `ml_service.model.RiskModel` to reproduce the saved threshold and
window aggregation. Generic Hugging Face pipelines do not automatically apply
these settings. Keep this whole directory when deploying, including tokenizer
and `risk_config.json`.

Sources and attribution:
- https://huggingface.co/nlpaueb/legal-bert-small-uncased
- https://huggingface.co/datasets/coastalcph/lex_glue
- Chalkidis et al. (2020), LEGAL-BERT: The Muppets straight out of Law School.
- Chalkidis et al. (2022), LexGLUE: A Benchmark Dataset for Legal Language Understanding in English.
- Lippi et al. (2019), CLAUDETTE / UNFAIR-ToS.

Changes from the upstream pretrained model: replaced the pretraining head with
a two-label classifier and updated encoder/classifier weights using the public
training split. Upstream model license: CC-BY-SA-4.0; this derived checkpoint is
distributed under CC-BY-SA-4.0. Dataset card states CC-BY-4.0. Preserve attribution.
License links: https://creativecommons.org/licenses/by-sa/4.0/ and
https://creativecommons.org/licenses/by/4.0/ .
'''
    (model_dir / 'README.md').write_text(card, encoding='utf-8')
    checksums = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in model_dir.iterdir()
                 if p.is_file() and p.name != 'checksums.json'}
    (model_dir / 'checksums.json').write_text(json.dumps(checksums, indent=2), encoding='utf-8')
    print(f'Wrote model card and {len(checksums)} checksums')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--model', default='ml/models/bert-public-v1')
    parser.add_argument('--report', default='ml/reports/bert-public-v1')
    args = parser.parse_args()
    finalize(args.model, args.report)
