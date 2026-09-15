"""Convert multi-label model scores into a simple user-facing risk level.

The model scores are independent, uncalibrated category scores.  This module
therefore compares each score with that category's saved decision threshold;
it never presents a raw score as a legal-risk probability.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any


HIGH_CONFIDENCE_MARGIN = 0.15


def classify_risk_level(
    scores: Mapping[str, float],
    thresholds: Mapping[str, float],
    *,
    review_margin: float = 0.08,
    high_confidence_margin: float = HIGH_CONFIDENCE_MARGIN,
) -> dict[str, Any]:
    """Return a risk-level payload for one clause.

    ``high`` means either two or more categories were detected, or one score
    clearly exceeded its own threshold. ``medium`` means at least one category
    was detected, or a score is close enough to a threshold to review. ``low``
    means no category was detected and none is close to its threshold.
    """
    unknown = set(scores) - set(thresholds)
    if unknown:
        raise ValueError(f"Missing thresholds for categories: {sorted(unknown)}")
    if review_margin < 0 or high_confidence_margin < 0:
        raise ValueError("Risk-level margins must be non-negative")

    detected_categories: list[str] = []
    review_categories: list[str] = []
    clearly_detected_categories: list[str] = []

    for category, score in scores.items():
        threshold = thresholds[category]
        if score >= threshold:
            detected_categories.append(category)
        if abs(score - threshold) <= review_margin:
            review_categories.append(category)
        if score >= threshold + high_confidence_margin:
            clearly_detected_categories.append(category)

    if len(detected_categories) >= 2 or clearly_detected_categories:
        level = "high"
        message = "High model-detected risk"
    elif detected_categories or review_categories:
        level = "medium"
        message = "Medium model-detected risk"
    else:
        level = "low"
        message = "Low model-detected risk"

    return {
        "riskLevel": level,
        "riskLevelMessage": message,
        "detectedCategories": detected_categories,
        "reviewCategories": review_categories,
    }


def classify_score_vector(
    labels: Sequence[str], scores: Sequence[float], thresholds: Mapping[str, float], **kwargs: Any
) -> dict[str, Any]:
    """Convenience wrapper for a model output vector in label order."""
    if len(labels) != len(scores):
        raise ValueError("The label and score vectors must have the same length")
    return classify_risk_level(dict(zip(labels, scores)), thresholds, **kwargs)
