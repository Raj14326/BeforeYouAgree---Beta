import unittest

from segmentation import paragraph_segments, sentence_segments


class SentenceSegmentationTests(unittest.TestCase):
    def test_keeps_sentences_and_offsets(self):
        content = "# Terms\nWe may change these terms without notice. You may cancel your account."
        segments = sentence_segments(content)
        self.assertEqual(len(segments), 2)
        self.assertEqual(content[segments[0]["start"] : segments[0]["end"]], segments[0]["text"])

    def test_keeps_clause_without_terminal_punctuation(self):
        segments = sentence_segments("We may terminate your access at any time without notice")
        self.assertEqual(len(segments), 1)

    def test_ignores_markdown_heading(self):
        self.assertEqual(sentence_segments("## LIMITATION OF LIABILITY"), [])

    def test_paragraph_segments_preserve_offsets(self):
        content = "We collect account information.\n\nWe retain it while your account is active."
        segments = paragraph_segments(content)
        self.assertEqual(len(segments), 2)
        for segment in segments:
            self.assertEqual(content[segment["start"] : segment["end"]], segment["text"])

    def test_ignores_context_only_privacy_headings(self):
        content = (
            "Information Google collects\n\n"
            "Why Google collects data\n\n"
            "Information we collect\n\n"
            "Data we retain\n\n"
            "How we use information"
        )
        self.assertEqual(paragraph_segments(content), [])

    def test_keeps_short_substantive_privacy_clauses(self):
        content = "We collect your location\n\nYour data may be stored indefinitely"
        segments = paragraph_segments(content)
        self.assertEqual([segment["text"] for segment in segments], content.split("\n\n"))

    def test_ignores_gerund_section_heading(self):
        self.assertEqual(paragraph_segments("Keeping your information secure"), [])

    def test_removes_residual_website_controls(self):
        content = (
            "Go to Activity Controls Ad settings Manage your preferences about the ads shown "
            "to you on Google and on partner sites."
        )
        self.assertEqual(
            paragraph_segments(content)[0]["text"],
            "Manage your preferences about the ads shown to you on Google and on partner sites.",
        )

    def test_ignores_context_questions(self):
        content = "Looking to change your privacy settings?\n\nHow does Google collect data?"
        self.assertEqual(sentence_segments(content), [])
        self.assertEqual(paragraph_segments(content), [])

    def test_ignores_short_topic_lists(self):
        content = "Your apps, browsers & devices\n\nYour data and activity"
        self.assertEqual(paragraph_segments(content), [])

    def test_keeps_your_clause_with_an_operative_verb(self):
        content = "Your data is shared with advertising partners."
        self.assertEqual(paragraph_segments(content)[0]["text"], content)


if __name__ == "__main__":
    unittest.main()
