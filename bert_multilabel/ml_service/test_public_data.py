import csv
import json

import pyarrow as pa
import pyarrow.parquet as pq
import pytest

from .data import audit_splits, read_rows
from .prepare_public_data import prepare
from .train_nb import select_log_threshold


def test_import_keeps_public_provenance_and_removes_leakage(tmp_path):
    raw = tmp_path / 'raw' / 'unfair_tos'
    raw.mkdir(parents=True)
    fixtures = {
        'train': [('normal training', []), ('risk training', [1]), ('repeated clause', [2]),
                  ('conflict clause', []), ('conflict clause', [0])],
        'validation': [('normal validation', []), ('risk validation', [0])],
        'test': [('normal test', []), ('repeated clause', [2])],
    }
    for split, rows in fixtures.items():
        pq.write_table(pa.table({'text': [r[0] for r in rows], 'labels': [r[1] for r in rows]}),
                       raw / f'{split}-00000-of-00001.parquet')
    output = tmp_path / 'prepared'
    prepare(raw.parent, output, download=False)
    splits = {name: read_rows(output / f'{name}.csv') for name in fixtures}
    audit = audit_splits(splits)
    assert len(splits['train']) == 2
    assert audit['train']['public_dataset_labels'] == 2
    assert not audit['train']['group_ids_available']
    assert not any(row['human'] for rows in splits.values() for row in rows)
    assert all(row['trusted'] for rows in splits.values() for row in rows)
    with (output / 'train.csv').open('a', encoding='utf-8') as handle:
        handle.write('\n')
    with pytest.raises(ValueError, match='checksum'):
        read_rows(output / 'train.csv')


def test_public_source_column_alone_cannot_bypass_review_check(tmp_path):
    path = tmp_path / 'unverified.csv'
    path.write_text('document_id,text,label,label_source\na,normal,not_risky,public_dataset\na,risk,risky,public_dataset\n')
    with pytest.raises(ValueError, match='human_reviewed'):
        read_rows(path)


def test_nb_threshold_handles_extreme_log_odds_without_rounding():
    threshold, report = select_log_threshold([0, 0, 1, 1], [-1000, 800, 900, 1200], 1.0)
    assert threshold == 900
    assert report['risky_precision'] == 1
    assert json.loads(json.dumps(report))['confusion']['tp'] == 2
