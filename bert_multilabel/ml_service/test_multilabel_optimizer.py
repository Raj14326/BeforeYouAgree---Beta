import random
import pytest
from .multilabel_data import binary_metrics, choose_independent_thresholds


@pytest.mark.parametrize('beta', [0.5, 1.0])
def test_sweep_matches_exhaustive_with_ties(beta):
    rng = random.Random(5120)
    targets = [[float(rng.random() < .3) for _ in range(8)] for _ in range(80)]
    scores = [[rng.choice([.1, .2, .4, .7, .9]) for _ in range(8)] for _ in targets]
    expected = []
    for j in range(8):
        options = []
        for threshold in sorted({r[j] for r in scores}):
            m = binary_metrics([bool(r[j]) for r in targets], [r[j] >= threshold for r in scores])
            p, r = m['precision'], m['recall']
            fbeta = (1 + beta**2) * p * r / (beta**2 * p + r) if p + r else 0
            if r >= .7:
                options.append((fbeta, p, threshold))
        expected.append(max(options)[2])
    thresholds, report = choose_independent_thresholds(targets, scores, .7, beta)
    assert thresholds == expected
    assert all(m['recall'] >= .7 for m in report['per_category'].values())


def test_precision_objective_can_reduce_false_positives():
    targets = [[float(i < 4)] * 8 for i in range(12)]
    scores = [[s] * 8 for s in [.95, .9, .85, .5, .8, .7, .6, .55, .4, .3, .2, .1]]
    thresholds, report = choose_independent_thresholds(targets, scores, .7, .5)
    assert thresholds == [.85] * 8
    assert report['per_category']['arbitration']['confusion']['fp'] == 0
    assert report['per_category']['arbitration']['recall'] == .75


def test_missing_positive_category_is_rejected():
    with pytest.raises(ValueError, match='No validation threshold'):
        choose_independent_thresholds([[0.] * 8], [[.5] * 8])
