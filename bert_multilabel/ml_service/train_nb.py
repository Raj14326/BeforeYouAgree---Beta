"""Retrain a character 3–5 gram NB baseline on exactly the public BERT splits."""
import argparse
import csv
import hashlib
import json
import time
from pathlib import Path

import joblib
import numpy as np
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.naive_bayes import MultinomialNB

from .data import audit_splits, metrics, read_rows


def select_log_threshold(labels, scores, min_recall):
    # Work in log odds to avoid the old NB's floating-point saturation at 1.0.
    candidates = [(float(t), metrics(labels, scores, t)) for t in np.unique(scores)]
    eligible = [(t, m) for t, m in candidates if m['risky_recall'] >= min_recall]
    if not eligible:
        raise ValueError('No NB threshold meets validation recall target')
    return max(eligible, key=lambda pair: (pair[1]['risky_precision'], pair[1]['macro_f1']))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('train', 'validation', 'test'):
        parser.add_argument(f'--{name}', required=True)
    parser.add_argument('--output', default='ml/reports/nb-public-v1')
    parser.add_argument('--min-recall', type=float, default=0.7)
    args = parser.parse_args()
    splits = {name: read_rows(getattr(args, name)) for name in ('train', 'validation', 'test')}
    audit = audit_splits(splits)
    output = Path(args.output)
    if output.exists() and any(output.iterdir()):
        raise ValueError('Choose an empty output directory')
    vectorizer = CountVectorizer(analyzer='char', ngram_range=(3, 5), lowercase=True)
    train_x = vectorizer.fit_transform([r['text'] for r in splits['train']])
    validation_x = vectorizer.transform([r['text'] for r in splits['validation']])
    labels = [r['label'] for r in splits['validation']]
    experiments = []
    best = None
    for alpha in (0.1, 1.0, 10.0):
        model = MultinomialNB(alpha=alpha).fit(train_x, [r['label'] for r in splits['train']])
        logs = model.predict_log_proba(validation_x)
        threshold, report = select_log_threshold(labels, logs[:, 1] - logs[:, 0], args.min_recall)
        experiments.append({'alpha': alpha, 'threshold_log_odds': threshold, **report})
        rank = (report['risky_precision'], report['macro_f1'])
        if best is None or rank > best[0]:
            best = (rank, model, threshold, experiments[-1])
    _, model, threshold, validation = best
    started = time.perf_counter()
    logs = model.predict_log_proba(vectorizer.transform([r['text'] for r in splits['test']]))
    scores = logs[:, 1] - logs[:, 0]
    report = {'model': 'NB-public-char-3-5', 'threshold_log_odds': threshold,
              'threshold_note': 'Log odds, not a probability; avoids saturation',
              'rows': len(scores), 'seconds': time.perf_counter() - started,
              'test_sha256': hashlib.sha256(Path(args.test).read_bytes()).hexdigest(),
              'split_file_sha256': {name: hashlib.sha256(Path(getattr(args, name)).read_bytes()).hexdigest() for name in splits},
              'validation': validation, 'validation_experiments': experiments, 'data_audit': audit,
              **metrics([r['label'] for r in splits['test']], scores, threshold)}
    output.mkdir(parents=True, exist_ok=True)
    (output / 'metrics.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    joblib.dump({'vectorizer': vectorizer, 'model': model, 'threshold_log_odds': threshold}, output / 'nb.joblib')
    with (output / 'predictions.csv').open('w', encoding='utf-8-sig', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=['clause_id', 'text', 'actual', 'predicted', 'score', 'error'])
        writer.writeheader()
        for row, score in zip(splits['test'], scores):
            prediction = int(score >= threshold)
            writer.writerow({'clause_id': row['id'], 'text': row['text'], 'actual': row['label'],
                             'predicted': prediction, 'score': float(score),
                             'error': 'false_positive' if prediction > row['label'] else 'false_negative' if prediction < row['label'] else ''})
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
