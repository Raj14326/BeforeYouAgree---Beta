from .risk_level import classify_risk_level, classify_score_vector


THRESHOLDS = {"a": 0.80, "b": 0.60}


def test_high_for_a_clear_detection():
    result = classify_risk_level({"a": 0.96, "b": 0.10}, THRESHOLDS)
    assert result["riskLevel"] == "high"
    assert result["detectedCategories"] == ["a"]


def test_high_for_multiple_detected_categories():
    result = classify_risk_level({"a": 0.81, "b": 0.61}, THRESHOLDS)
    assert result["riskLevel"] == "high"


def test_medium_for_one_detected_or_near_threshold_category():
    detected = classify_risk_level({"a": 0.81, "b": 0.10}, THRESHOLDS)
    review = classify_risk_level({"a": 0.74, "b": 0.10}, THRESHOLDS)
    assert detected["riskLevel"] == "medium"
    assert review["riskLevel"] == "medium"
    assert review["reviewCategories"] == ["a"]


def test_low_when_no_category_is_detected_or_needs_review():
    result = classify_score_vector(["a", "b"], [0.30, 0.10], THRESHOLDS)
    assert result["riskLevel"] == "low"
