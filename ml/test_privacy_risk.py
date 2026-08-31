import unittest

from privacy_risk import detect_privacy_risks


class PrivacyRiskTests(unittest.TestCase):
    def test_ordinary_collection_is_not_a_risk(self):
        risks = detect_privacy_risks(
            "We collect your email address when you create an account.",
            {"Data collection and use": 0.92},
        )
        self.assertEqual(risks, [])

    def test_indefinite_retention_is_a_risk(self):
        risks = detect_privacy_risks(
            "We may retain your personal information indefinitely.",
            {"Data retention": 0.88},
        )
        self.assertEqual(risks[0]["category"], "Indefinite or post-deletion retention")

    def test_advertising_sharing_is_a_risk(self):
        risks = detect_privacy_risks(
            "We may share your personal information with advertising partners.",
            {"Third-party sharing and collection": 0.86},
        )
        self.assertEqual(risks[0]["category"], "Advertising sale or sharing")

    def test_explicit_risk_is_not_suppressed_by_a_model_miss(self):
        risks = detect_privacy_risks(
            "We may retain your personal information indefinitely.",
            {"Data security": 0.91},
        )
        self.assertEqual(risks[0]["category"], "Indefinite or post-deletion retention")
        self.assertIsNone(risks[0]["confidence"])

    def test_unannounced_change_is_a_risk(self):
        risks = detect_privacy_risks(
            "We may change this privacy policy at any time without prior notice.",
            {"Policy changes": 0.84},
        )
        self.assertEqual(risks[0]["category"], "Policy changes without notice")


if __name__ == "__main__":
    unittest.main()
