import re


RISK_RULES = (
    {
        "category": "Indefinite or post-deletion retention",
        "practices": {"Data retention"},
        "patterns": (
            r"\b(retain|keep|store|preserve)\b.{0,100}\b(indefinitely|without (?:a |any )?time limit|permanently)\b",
            r"\b(retain|keep|store|preserve)\b.{0,120}\bafter\b.{0,50}\b(account|profile|data)\b.{0,30}\b(delet|clos|terminat)",
            r"\bafter\b.{0,50}\b(account|profile|data)\b.{0,30}\b(delet|clos|terminat).{0,120}\b(retain|keep|store|preserve)\b",
        ),
        "description": "Allows information to be kept indefinitely or after account/data deletion.",
    },
    {
        "category": "Advertising sale or sharing",
        "practices": {"Third-party sharing and collection"},
        "patterns": (
            r"\b(sell|sale of)\b.{0,100}\b(personal|user|customer|account|location|browsing)\b.{0,30}\b(data|information|activity)",
            r"\b(share|disclose|provide|transfer)\b.{0,100}\b(advertisers?|advertising partners?|data brokers?)\b",
            r"\b(advertisers?|advertising partners?|data brokers?)\b.{0,100}\b(share|receive|collect|access)\b",
        ),
        "description": "Describes selling data or sharing it with advertising or data-broker partners.",
    },
    {
        "category": "Sensitive-data collection",
        "practices": {"Data collection and use"},
        "patterns": (
            r"\b(collect|store|process|record|access|use)\b.{0,120}\b(precise location|biometric|facial recognition|faceprint|fingerprint|health|medical|genetic|financial account|credit card|voice recording|racial|ethnic|religious|political opinion|sexual orientation|address book|contacts list|private messages?)\b",
            r"\b(precise location|biometric|facial recognition|faceprint|fingerprint|health|medical|genetic|financial account|credit card|voice recording|racial|ethnic|religious|political opinion|sexual orientation|address book|contacts list|private messages?)\b.{0,120}\b(collect|store|process|record|access|use)\b",
        ),
        "description": "Describes collection or processing of sensitive personal information.",
    },
    {
        "category": "Sharing without meaningful control",
        "practices": {"Third-party sharing and collection", "User choice and control"},
        "patterns": (
            r"\b(share|disclose|transfer|provide)\b.{0,120}\b(personal|user|customer|account)\b.{0,30}\b(data|information)\b.{0,100}\b(without (?:your )?consent|without (?:an )?opt[- ]out|whether or not you consent)\b",
            r"\bwithout (?:your )?consent\b.{0,120}\b(share|disclose|transfer|provide)\b",
        ),
        "description": "Allows personal information to be shared without meaningful consent or opt-out.",
    },
    {
        "category": "Broad or undisclosed data use",
        "practices": {"Data collection and use"},
        "patterns": (
            r"\b(use|process)\b.{0,100}\b(personal|user|customer)\b.{0,30}\b(data|information)\b.{0,80}\b(for any purpose|for any lawful purpose|purposes? not (?:listed|described|disclosed)|other purposes? without notice)\b",
            r"\b(for any purpose|for any lawful purpose)\b.{0,100}\b(personal|user|customer)\b.{0,30}\b(data|information)\b",
        ),
        "description": "Permits broad or unspecified uses of personal information.",
    },
    {
        "category": "Cross-service tracking or profiling",
        "practices": {"Data collection and use", "Third-party sharing and collection"},
        "patterns": (
            r"\b(track|monitor|follow|combine)\b.{0,120}\b(across|third-party|other)\b.{0,40}\b(sites?|websites?|apps?|services?|devices?)\b",
            r"\b(activity|browsing|interactions?)\b.{0,100}\b(across|on)\b.{0,40}\b(third-party|other)\b.{0,30}\b(sites?|apps?|services?)\b",
            r"\b(build|create|develop|infer)\b.{0,60}\b(profile|inferences?|interests?|characteristics?)\b.{0,100}\b(advertis|target|personaliz)",
            r"\b(automated decision|automated processing|profiling)\b.{0,100}\b(eligibility|access|price|advertis|target|personaliz)",
        ),
        "description": "Describes tracking or profiling across other sites, apps, services, or devices.",
    },
    {
        "category": "Restricted privacy control",
        "practices": {"User choice and control", "Data access and deletion"},
        "patterns": (
            r"\b(cannot|can't|may not|unable to|no right to)\b.{0,100}\b(delete|remove|access|correct|opt out|object|withdraw)\b",
            r"\b(delete|access|correction|opt[- ]out|objection|withdrawal)\b.{0,100}\b(not available|not permitted|not allowed|may be denied|may refuse)\b",
        ),
        "description": "Restricts access, correction, deletion, objection, or opt-out rights.",
    },
    {
        "category": "Policy changes without notice",
        "practices": {"Policy changes"},
        "patterns": (
            r"\b(change|modify|update|revise)\b.{0,100}\b(without (?:prior )?notice|without notifying|at any time)\b",
            r"\bwithout (?:prior )?notice\b.{0,100}\b(change|modify|update|revise)\b",
        ),
        "description": "Allows privacy-policy changes without meaningful advance notification.",
    },
    {
        "category": "Security responsibility limitation",
        "practices": {"Data security"},
        "patterns": (
            r"\b(cannot|can't|do not|does not)\b.{0,60}\b(guarantee|ensure|warrant)\b.{0,100}\b(security|secure|confidentiality)",
            r"\b(no method|nothing)\b.{0,80}\b(100%|completely|perfectly)\b.{0,40}\bsecure\b",
        ),
        "description": "Limits or disclaims responsibility for protecting submitted information.",
    },
    {
        "category": "Do Not Track ignored",
        "practices": {"Do Not Track"},
        "patterns": (
            r"\b(do not|does not|don't|doesn't)\b.{0,60}\b(respond to|honou?r|recognize)\b.{0,40}\bdo not track\b",
            r"\bdo not track\b.{0,80}\b(not respond|not honou?r|not recognize|unsupported)\b",
        ),
        "description": "States that browser Do Not Track signals are not honoured.",
    },
)


def detect_privacy_risks(text, detected_practices):
    normalized = re.sub(r"\s+", " ", text).lower()
    practices = set(detected_practices)
    findings = []
    for rule in RISK_RULES:
        if any(re.search(pattern, normalized, re.IGNORECASE) for pattern in rule["patterns"]):
            supporting_practices = practices.intersection(rule["practices"])
            findings.append({
                "category": rule["category"],
                "description": rule["description"],
                "confidence": (
                    max(detected_practices[practice] for practice in supporting_practices)
                    if supporting_practices
                    else None
                ),
            })
    return findings
