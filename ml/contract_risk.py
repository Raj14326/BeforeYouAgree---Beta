import re


RULES = {
    "Limitation of liability": (
        r"\b(not|never)\b.{0,30}\b(liable|responsible)\b",
        r"\b(no|without)\b.{0,30}\b(liability|responsibility)\b",
        r"\b(exclude|disclaim|limit|maximum|aggregate)\b.{0,80}\b(liability|liable|damages)\b",
        r"\bin no event\b.{0,100}\b(liable|liability|damages)\b",
    ),
    "Unilateral termination": (
        r"\b(we|service|company|provider)\b.{0,30}\b(terminate|suspend|disable|close)\b.{0,100}\b(at any time|without (?:prior )?notice|sole discretion|for any reason|without cause)\b",
        r"\b(at any time|without (?:prior )?notice|sole discretion|for any reason|without cause)\b.{0,100}\b(terminate|suspend|disable|close)\b.{0,40}\b(account|access|service|agreement)\b",
        r"\bmay\b.{0,20}\b(terminate|suspend|disable|close)\b.{0,100}\b(at any time|without (?:prior )?notice|sole discretion|for any reason|without cause)\b",
    ),
    "Unilateral change": (
        r"\b(we|service|company|provider)\b.{0,30}\b(change|modify|revise|update)\b.{0,100}\b(at any time|without (?:prior )?notice|sole discretion)\b",
        r"\b(change|modify|revise|update)\b.{0,80}\b(terms|agreement|service)\b.{0,80}\b(at any time|without (?:prior )?notice|sole discretion)\b",
        r"\bmay\b.{0,20}\b(change|modify|revise|update)\b.{0,80}\b(terms|agreement|service)\b.{0,80}\b(at any time|without (?:prior )?notice|sole discretion)\b",
    ),
    "Content removal": (
        r"\b(we|service|company|provider)\b.{0,40}\b(remove|delete|take down)\b.{0,100}\b(content|material|post|purchase)\b.{0,80}\b(without (?:prior )?notice|sole discretion|at any time|for any reason)\b",
        r"\b(without (?:prior )?notice|sole discretion|at any time|for any reason)\b.{0,100}\b(remove|delete|take down)\b.{0,60}\b(content|material|post|purchase)\b",
    ),
    "Arbitration": (
        r"\b(binding|mandatory|individual)\b.{0,30}\barbitration\b",
        r"\b(arbitration|arbitrate)\b.{0,100}\b(waive|waiver|no right)\b.{0,60}\b(jury|court|class action)\b",
        r"\bwaive\b.{0,80}\b(jury trial|class action)\b",
    ),
}


def filter_contract_risks(text, detected_categories):
    normalized = re.sub(r"\s+", " ", text).lower()
    findings = []
    for category in detected_categories:
        if category not in RULES:
            continue
        if category == "Unilateral termination" and re.match(
            r"^(you|users?|customers?)\b.{0,30}\b(may|can)\b.{0,20}\b(terminate|close|cancel)",
            normalized,
        ):
            continue
        if any(re.search(pattern, normalized, re.IGNORECASE) for pattern in RULES[category]):
            findings.append(category)
    return findings
