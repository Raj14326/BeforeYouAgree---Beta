"""Fixed-weight validation-only comparison of F1 vs two-label F0.5 thresholds."""
import argparse
import csv
import hashlib
import json
import shutil
from pathlib import Path

import torch
from .model import RiskModel
from .multilabel_data import LABEL_DEFINITIONS, choose_independent_thresholds, multilabel_metrics, read_multilabel_rows

TARGETS = {'content_removal', 'arbitration'}


def sha(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def compare_policies(targets, scores, original, min_recall=.7):
    optimized, _ = choose_independent_thresholds(targets, scores, min_recall, .5)
    mixed = [optimized[i] if label['id'] in TARGETS else original[i]
             for i, label in enumerate(LABEL_DEFINITIONS)]
    baseline = multilabel_metrics(targets, scores, original)
    candidate = multilabel_metrics(targets, scores, mixed)
    def objective(report):
        values = []
        for category in TARGETS:
            p = report['per_category'][category]['precision']
            r = report['per_category'][category]['recall']
            values.append(1.25 * p * r / (.25 * p + r) if p + r else 0)
        return sum(values) / len(values)
    # Predeclared guards avoid choosing on test results or accuracy alone.
    checks = {'target_f05_improves': objective(candidate) > objective(baseline),
              'binary_false_positives_do_not_increase': candidate['derived_binary_risk']['confusion']['fp'] <= baseline['derived_binary_risk']['confusion']['fp'],
              'binary_recall_at_least_080': candidate['derived_binary_risk']['recall'] >= .8,
              'macro_f1_drop_at_most_001': candidate['macro_f1'] >= baseline['macro_f1'] - .01}
    return mixed, {'baseline_f1': baseline, 'mixed_f05': candidate,
                   'target_average_f05': {'baseline': objective(baseline), 'mixed': objective(candidate)},
                   'selection_checks': checks,
                   'selected_policy': 'mixed_f05' if all(checks.values()) else 'baseline_f1'}


def score_rows(model, rows):
    scores = []
    for start in range(0, len(rows), 16):
        batch = rows[start:start + 16]
        response = model.predict([{'clauseId': row['id'], 'text': row['text']} for row in batch])
        scores.extend([[c['score'] for c in f['categories']] for f in response['findings']])
    return scores


def write_scores(path, rows, scores):
    with path.open('w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['clause_id','text','text_sha256','original_labels'] + [x['id'] for x in LABEL_DEFINITIONS])
        for row, values in zip(rows, scores):
            writer.writerow([row['id'],row['text'],row['hash'],json.dumps(row['label_ids'])] + values)


def check_fresh_holdout(holdout, manifest, historical_rows):
    used = set(manifest['text_hashes']['train'] + manifest['text_hashes']['validation'])
    used.update(row['hash'] for row in historical_rows)
    if any(row['hash'] in used for row in holdout):
        raise ValueError('Fresh holdout overlaps train, validation or historical test')
    if any(bool(row['label']) != any(row['targets']) for row in holdout):
        raise ValueError('Fresh holdout binary labels disagree with original eight labels')
    groups = set(g for values in manifest.get('group_hashes',{}).values() for g in values)
    if any(row['group'] and hashlib.sha256(row['group'].encode()).hexdigest() in groups for row in holdout):
        raise ValueError('Fresh holdout service/document overlaps known groups')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--model', default='ml/models/bert-multilabel-small-256-macrof1-v1')
    parser.add_argument('--validation', default='ml/data/lexglue-binary/validation.csv')
    parser.add_argument('--historical-test', default='ml/data/lexglue-binary/test.csv', help='Used only to reject overlap with a fresh holdout, never scored')
    parser.add_argument('--holdout', help='Optional genuinely new, reliably labelled CSV; not used for tuning')
    parser.add_argument('--output', default='ml/reports/small-256-thresholds-v1')
    parser.add_argument('--export-model', default='ml/models/bert-multilabel-small-256-threshold-v1')
    parser.add_argument('--device', default='cuda')
    args = parser.parse_args()
    output, export, source = Path(args.output), Path(args.export_model), Path(args.model)
    if output.exists() or export.exists():
        raise ValueError('Use new output and export directories; originals are never overwritten')
    manifest = json.loads((source/'risk_config.json').read_text(encoding='utf-8'))
    if sha(args.validation) != manifest['split_file_sha256']['validation']:
        raise ValueError('Validation CSV differs from the checkpoint provenance')
    weight_sha = sha(source/'model.safetensors')
    config_sha = sha(source/'risk_config.json')
    rows = read_multilabel_rows(args.validation)
    old_thresholds = [manifest['thresholds'][d['id']] for d in LABEL_DEFINITIONS]
    torch.set_num_threads(8)
    model = RiskModel(source, args.device)
    scores = score_rows(model, rows)
    mixed, report = compare_policies([row['targets'] for row in rows], scores, old_thresholds)
    output.mkdir(parents=True)
    write_scores(output/'validation_scores.csv', rows, scores)
    report.update({'model_id': manifest['model_id'], 'weights_sha256': weight_sha,
                   'validation_sha256': sha(args.validation), 'rows': len(rows),
                   'selection_data': 'validation only', 'changed_categories': sorted(TARGETS),
                   'fresh_holdout_status': 'not supplied; independent confirmation pending',
                   'candidate_thresholds': {d['id']:mixed[i] for i,d in enumerate(LABEL_DEFINITIONS)},
                   'original_thresholds': manifest['thresholds']})
    if args.holdout:
        holdout = read_multilabel_rows(args.holdout)
        check_fresh_holdout(holdout, manifest, read_multilabel_rows(args.historical_test))
        holdout_scores = score_rows(model, holdout)
        report['fresh_holdout'] = {'sha256':sha(args.holdout),'rows':len(holdout),
            'baseline':multilabel_metrics([r['targets'] for r in holdout],holdout_scores,old_thresholds),
            'mixed':multilabel_metrics([r['targets'] for r in holdout],holdout_scores,mixed)}
        report['fresh_holdout_status'] = 'evaluated after validation policy selection; no retuning'
        write_scores(output/'fresh_holdout_scores.csv',holdout,holdout_scores)
    shutil.copytree(source,export)
    tuned = dict(manifest)
    tuned['model_id'] += '-THRESHOLD-MIXED'
    tuned['thresholds'] = report['candidate_thresholds']
    tuned['threshold_tuning'] = {'parent_model_id':manifest['model_id'],'weights_sha256':weight_sha,
        'validation_sha256':sha(args.validation),'categories_beta':{c:.5 for c in sorted(TARGETS)},
        'other_thresholds':'unchanged','min_category_recall':.7,'comparison_report':str(output),
        'recommended_policy_on_validation':report['selected_policy'],
        'independent_confirmation':report['fresh_holdout_status']}
    tuned['original_training_validation'] = tuned.pop('validation')
    tuned['validation'] = report['mixed_f05']
    (export/'risk_config.json').write_text(json.dumps(tuned,indent=2),encoding='utf-8')
    assert sha(export/'model.safetensors') == weight_sha
    assert sha(source/'model.safetensors') == weight_sha and sha(source/'risk_config.json') == config_sha
    report['original_weights_and_config_unchanged'] = True
    (output/'comparison.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report,indent=2))


if __name__=='__main__':
    main()
