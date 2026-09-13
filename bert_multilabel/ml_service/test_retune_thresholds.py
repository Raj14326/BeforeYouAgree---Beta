import pytest
from .retune_thresholds import compare_policies, TARGETS, check_fresh_holdout
from .multilabel_data import LABEL_DEFINITIONS


def test_only_target_categories_change_and_recall_is_guarded():
    targets = [[float(i < 4)] * 8 for i in range(12)]
    scores = [[s] * 8 for s in [.95,.9,.85,.5,.8,.7,.6,.55,.4,.3,.2,.1]]
    original = [.5] * 8
    mixed, report = compare_policies(targets,scores,original)
    for i, label in enumerate(LABEL_DEFINITIONS):
        assert mixed[i] == (.85 if label['id'] in TARGETS else .5)
    assert report['mixed_f05']['derived_binary_risk']['recall'] == 1.0
    assert report['selected_policy'] == 'mixed_f05'


def test_no_gain_retains_baseline():
    targets = [[float(i < 4)] * 8 for i in range(12)]
    scores = [[s] * 8 for s in [.95,.9,.85,.5,.8,.7,.6,.55,.4,.3,.2,.1]]
    mixed, report = compare_policies(targets,scores,[.85] * 8)
    assert mixed == [.85] * 8
    assert report['selected_policy'] == 'baseline_f1'
    assert not report['selection_checks']['binary_recall_at_least_080']


def test_fresh_holdout_rejects_historical_test_reuse():
    manifest = {'text_hashes':{'train':['train'],'validation':['val']}}
    row = {'hash':'test','label':1,'targets':[1.]*8,'group':'new'}
    with pytest.raises(ValueError,match='historical test'):
        check_fresh_holdout([row],manifest,[{'hash':'test'}])


def test_fresh_holdout_rejects_inconsistent_annotations():
    manifest = {'text_hashes':{'train':['train'],'validation':['val']}}
    row = {'hash':'new','label':0,'targets':[1.]*8,'group':'new'}
    with pytest.raises(ValueError,match='disagree'):
        check_fresh_holdout([row],manifest,[])
