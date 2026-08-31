import unittest

from contract_risk import filter_contract_risks


class ContractRiskTests(unittest.TestCase):
    def test_provider_termination_is_kept(self):
        text = "Discord may terminate your account at any time without prior notice."
        self.assertEqual(
            filter_contract_risks(text, {"Unilateral termination": 0.9}),
            ["Unilateral termination"],
        )

    def test_user_termination_is_not_a_provider_risk(self):
        text = "You may terminate your account at any time."
        self.assertEqual(
            filter_contract_risks(text, {"Unilateral termination": 0.9}),
            [],
        )

    def test_generic_acceptance_is_not_a_risk(self):
        self.assertEqual(
            filter_contract_risks(
                "By using this service you agree to these terms.",
                {"Unilateral change": 0.85},
            ),
            [],
        )

    def test_binding_arbitration_is_kept(self):
        self.assertEqual(
            filter_contract_risks(
                "All disputes must be resolved through binding arbitration.",
                {"Arbitration": 0.92},
            ),
            ["Arbitration"],
        )


if __name__ == "__main__":
    unittest.main()
