import unittest

from labels import CONCRETE_RISK_LABELS


class ConcreteRiskLabelTests(unittest.TestCase):
    def test_keeps_concrete_risks(self):
        self.assertIn("Unilateral change", CONCRETE_RISK_LABELS)
        self.assertIn("Arbitration", CONCRETE_RISK_LABELS)

    def test_excludes_boilerplate_categories(self):
        self.assertNotIn("Contract by using", CONCRETE_RISK_LABELS)
        self.assertNotIn("Choice of law", CONCRETE_RISK_LABELS)
        self.assertNotIn("Jurisdiction", CONCRETE_RISK_LABELS)


if __name__ == "__main__":
    unittest.main()
