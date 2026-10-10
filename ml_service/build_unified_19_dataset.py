"""Build the BYA 19-label clause dataset without OPP-115.

Sources:
* the pinned, cleaned LexGLUE UNFAIR-ToS CSVs already stored in this repo;
* the latest Open Terms Archive Contrib snapshot (ODC-By 1.0).

Privacy labels are deliberately limited to high-precision patterns. Ambiguous
privacy clauses are written to a review queue rather than silently used as
negative training examples. The script uses only the Python standard library.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import random
import re
from collections import Counter
from pathlib import Path


LABELS = [
    "limitation_of_liability",
    "unilateral_termination",
    "unilateral_change",
    "content_removal",
    "contract_by_using",
    "choice_of_law",
    "jurisdiction",
    "arbitration",
    "privacy_broad_collection",
    "privacy_location_tracking",
    "privacy_cross_service_profiling",
    "privacy_personalized_ads",
    "privacy_content_analysis",
    "privacy_third_party_sharing",
    "privacy_government_disclosure",
    "privacy_admin_control",
    "privacy_extended_retention",
    "privacy_international_transfer",
    "privacy_business_transfer",
]

PRIVACY_PATTERNS: dict[str, list[str]] = {
    "privacy_broad_collection": [
        r"\b(?:we|the (?:service|company)|[A-Z][\w.-]+) (?:may |also )?(?:collect|gather|store|receive)\b.{0,180}\b(?:personal (?:data|information)|information about you|content|activity|device|browser|identifiers?|IP address|cookies?|communications?|contacts?)\b",
        r"\b(?:personal (?:data|information)|information about you)\b.{0,100}\b(?:is|are|may be) (?:collected|gathered|stored|received)\b",
        r"\b(?:collect|store)\b.{0,120}\b(?:email|photos?|videos?|documents?|messages?|call logs?|search history|browsing history|payment information)\b",
    ],
    "privacy_location_tracking": [
        r"\b(?:collect|receive|track|process|use|share)\b.{0,100}\b(?:precise |approximate )?(?:location|geolocation|GPS coordinates?)\b",
        r"\b(?:location|geolocation|GPS coordinates?)\b.{0,100}\b(?:collect|receive|track|process|use|share|data)\b",
        r"\b(?:Wi-?Fi access points?|cell towers?|Bluetooth)\b.{0,100}\b(?:location|nearby|device)\b",
    ],
    "privacy_cross_service_profiling": [
        r"\b(?:combine|link|associate)\b.{0,140}\b(?:activity|information|data)\b.{0,140}\b(?:across|other|third-party)\b.{0,80}\b(?:services?|sites?|apps?|devices?)\b",
        r"\bacross (?:our )?services? and across (?:your )?devices?\b",
        r"\btrack(?:ing|ed)?\b.{0,100}\b(?:across|other|third-party) (?:websites?|sites?|apps?|services?)\b",
    ],
    "privacy_personalized_ads": [
        r"\b(?:personalized|personalised|targeted|interest-based|behavio(?:u)?ral) (?:advertising|ads?)\b",
        r"\b(?:advertising|ads?)\b.{0,100}\b(?:interests?|activity|profile|personalized|personalised|targeted)\b",
        r"\b(?:personal data|information)\b.{0,100}\bmarketing purposes?\b",
    ],
    "privacy_content_analysis": [
        r"\b(?:automated systems?|algorithms?|artificial intelligence|AI)\b.{0,140}\b(?:analy[sz]e|process|scan|review|train)\b.{0,100}\b(?:content|messages?|audio|voice|photos?|videos?|personal data)\b",
        r"\b(?:analy[sz]e|listen to|review|scan)\b.{0,100}\b(?:your |user )?(?:content|audio|voice|messages?|photos?|videos?)\b",
        r"\b(?:content|personal data)\b.{0,100}\b(?:AI training|automated decision-making|profiling)\b",
    ],
    "privacy_third_party_sharing": [
        r"\b(?:we|the (?:service|company)|[A-Z][\w.-]+) (?:may |also )?(?:share|disclose|provide|transfer|sell)\b.{0,180}\b(?:personal (?:data|information)|information about you|your (?:data|information))\b.{0,120}\b(?:third part|partner|affiliate|service provider|advertiser|vendor|processor)",
        r"\b(?:personal (?:data|information)|information about you|your (?:data|information))\b.{0,120}\b(?:may be |is |are )?(?:shared|disclosed|provided|transferred|sold)\b.{0,120}\b(?:third part|partner|affiliate|service provider|advertiser|vendor|processor)",
        r"\bprovide personal information to (?:our )?affiliates and other trusted\b",
    ],
    "privacy_government_disclosure": [
        r"\b(?:share|disclose|provide|produce|release)\b.{0,160}\b(?:personal (?:data|information)|your (?:data|information)|information about you)\b.{0,160}\b(?:law enforcement|government|governmental request|legal process|court order|subpoena)\b",
        r"\b(?:respond|comply)\b.{0,120}\b(?:law enforcement|governmental request|legal process|court order|subpoena)\b",
    ],
    "privacy_admin_control": [
        r"\b(?:domain|workspace|organization|organisation) administrators?\b.{0,180}\b(?:access|retain|view|change|reset|suspend|terminate|restrict|manage)\b",
        r"\badministrators? (?:may|can|will)\b.{0,160}\b(?:access|retain|view|change|reset|suspend|terminate|restrict|manage)\b.{0,120}\b(?:account|information|data|password|settings)\b",
        r"\badministrators?\b.{0,80}\b(?:has|have|gain|with) access\b.{0,140}\b(?:account|information|data|content|activity|password|settings)\b",
        r"\b(?:employer|organization|organisation|manager organization|account holder)\b.{0,140}\b(?:admin rights|control over|access to|track your usage|close your account)\b.{0,140}\b(?:account|information|data|content|activity|password|settings|stuff)\b",
        r"\bmanaged accounts?\b.{0,160}\b(?:administrator|manager organization)\b.{0,160}\b(?:access|control|close|delete|share|re-assign|disable)\b",
        r"\b(?:recovery|business|family|company) administrators?\b.{0,140}\b(?:access|reset|read|delete|terminate|control)\b.{0,140}\b(?:account|information|data|content|activity|password|logs?|files?)\b",
    ],
    "privacy_extended_retention": [
        r"\b(?:retain|keep|store)\b.{0,100}\b(?:personal (?:data|information)|your (?:data|information)|information about you|data)\b.{0,140}\b(?:for as long as|until|longer|years?|legal|business|security|fraud|backup)\b",
        r"\b(?:personal (?:data|information)|your (?:data|information)|data)\b.{0,100}\b(?:retain|kept|stored)\b.{0,140}\b(?:for as long as|until|longer|years?|legal|business|security|fraud|backup)\b",
        r"\bdelays?\b.{0,80}\bdelete\b.{0,120}\b(?:backup|copies|servers?)\b",
    ],
    "privacy_international_transfer": [
        r"\b(?:transfer|process|store|host)\b.{0,140}\b(?:personal (?:data|information)|your (?:data|information)|information)\b.{0,140}\b(?:outside|other countr|international|worldwide|globally|cross-border)\b",
        r"\bservers? (?:located )?(?:around the world|outside (?:of )?the country)\b",
        r"\b(?:international|cross-border) transfers?\b.{0,120}\b(?:data|information)\b",
    ],
    "privacy_business_transfer": [
        r"\b(?:merger|acquisition|sale of (?:assets|business)|bankruptcy|reorganization|reorganisation)\b.{0,220}\b(?:personal (?:data|information)|your (?:data|information)|information about you|transferred|disclosed)\b",
        r"\b(?:personal (?:data|information)|your (?:data|information))\b.{0,180}\b(?:merger|acquisition|sale of (?:assets|business)|bankruptcy|reorganization|reorganisation)\b",
    ],
}

HARD_NEGATIVES: list[tuple[str, str]] = [
    ("unilateral_termination", r"\b(?:employee|employees|staff|contractor|agent)\b.{0,100}\bterminat(?:e|ed|ion)\b"),
    ("unilateral_termination", r"\byou (?:may|can) terminat(?:e|ion)\b.{0,100}\b(?:account|agreement)\b"),
    ("privacy_broad_collection", r"\b(?:cookie|identifier)\b.{0,100}\b(?:authenticate|security|preferred language|definition|means)\b"),
    ("privacy_third_party_sharing", r"\bwhen you share\b.{0,120}\b(?:publicly|with other users)\b"),
    ("privacy_third_party_sharing", r"\bwe (?:do not|don't|never) (?:sell|share|disclose)\b.{0,120}\bpersonal (?:data|information)\b"),
    ("privacy_personalized_ads", r"\b(?:opt out|turn off|disable)\b.{0,100}\b(?:personalized|personalised|targeted|interest-based) (?:ads?|advertising)\b"),
]

SAFE_PATTERNS = [
    r"\byou (?:may|can) (?:access|download|export|correct|delete|remove)\b.{0,120}\b(?:your )?(?:data|information|account|content)\b",
    r"\bwe (?:do not|don't|never) (?:sell|share|disclose)\b.{0,120}\bpersonal (?:data|information)\b",
    r"\b(?:encrypt|encryption|two-factor authentication|security measures?)\b.{0,140}\b(?:protect|secure|safeguard)\b",
    r"\bask for (?:your )?(?:explicit )?consent\b.{0,120}\b(?:share|use|process)\b",
]

COMPILED_PRIVACY = {
    label: [re.compile(pattern, re.I | re.S) for pattern in patterns]
    for label, patterns in PRIVACY_PATTERNS.items()
}
PRIVACY_EXCLUSIONS = {
    "privacy_broad_collection": [
        re.compile(r"\b(?:we|the (?:service|company)) (?:do not|don't|never) (?:collect|store|receive)\b", re.I),
    ],
    "privacy_location_tracking": [
        re.compile(r"\b(?:we|the (?:service|company)) (?:do not|don't|never) (?:collect|track|use|store)\b.{0,100}\blocation\b", re.I),
    ],
    "privacy_cross_service_profiling": [
        re.compile(r"\b(?:do not|don't|never) track\b.{0,120}\b(?:across|other|third-party)\b", re.I),
    ],
    "privacy_content_analysis": [
        re.compile(r"\b(?:do not|don't|never|cannot|can't) (?:monitor|review|scan|analy[sz]e)\b", re.I),
    ],
    "privacy_third_party_sharing": [
        re.compile(r"\b(?:do not|don't|never) (?:share|disclose|sell|transfer)\b", re.I),
    ],
}
COMPILED_HARD_NEGATIVES = [(label, re.compile(pattern, re.I | re.S)) for label, pattern in HARD_NEGATIVES]
COMPILED_SAFE = [re.compile(pattern, re.I | re.S) for pattern in SAFE_PATTERNS]


def normalize_text(value: str) -> str:
    value = re.sub(r"\[([^]]+)]\([^)]*\)", r"\1", value)
    value = re.sub(r"<[^>]+>", " ", value)
    value = value.replace("-lrb-", "(").replace("-rrb-", ")")
    value = re.sub(r"[`*_~]", "", value)
    return re.sub(r"\s+", " ", value).strip()


def text_key(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()
    return hashlib.sha256(normalized.encode()).hexdigest()


def label_vector(labels: list[str]) -> list[int]:
    active = set(labels)
    return [int(label in active) for label in LABELS]


def privacy_labels(text: str) -> list[str]:
    return [
        label
        for label, patterns in COMPILED_PRIVACY.items()
        if any(pattern.search(text) for pattern in patterns)
        and not any(pattern.search(text) for pattern in PRIVACY_EXCLUSIONS.get(label, []))
    ]


def split_sentences(paragraph: str) -> list[str]:
    pieces = re.split(r"(?<=[.!?])\s+(?=[A-Z0-9*])|\s*[•|]\s*", paragraph)
    return [normalize_text(piece.lstrip("-*0123456789.() ")) for piece in pieces]


def markdown_clauses(path: Path):
    heading = ""
    previous = ""
    paragraph: list[str] = []

    def flush():
        nonlocal previous
        raw = " ".join(paragraph)
        paragraph.clear()
        for clause in split_sentences(raw):
            if 25 <= len(clause) <= 1800 and sum(ch.isalpha() for ch in clause) >= 15:
                yield heading, previous, clause
                previous = clause

    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    for index, line in enumerate(lines):
        stripped = line.strip()
        is_setext = index + 1 < len(lines) and re.fullmatch(r"[=-]{3,}", lines[index + 1].strip())
        if stripped.startswith("#") or is_setext:
            yield from flush()
            heading = normalize_text(stripped.lstrip("# "))
            continue
        if not stripped or re.fullmatch(r"[=-]{3,}", stripped):
            yield from flush()
        elif stripped.startswith(("* ", "- ", "+ ")):
            yield from flush()
            paragraph.append(stripped)
            yield from flush()
        else:
            paragraph.append(stripped)
    yield from flush()


def unfair_rows(source: Path):
    for split in ("train", "validation", "test"):
        with (source / f"{split}.csv").open(encoding="utf-8", newline="") as stream:
            for row in csv.DictReader(stream):
                text = normalize_text(row["text"])
                ids = json.loads(row["original_labels"])
                labels = [LABELS[int(index)] for index in ids]
                labels = sorted(set(labels), key=LABELS.index)
                yield {
                    "id": f"lexglue:{row['clause_id']}",
                    "text": text,
                    "heading": "",
                    "context": "",
                    "labels": labels,
                    "label_vector": label_vector(labels),
                    "split": split,
                    "document_id": f"lexglue:{row['clause_id']}",
                    "document_type": "terms_of_service",
                    "service": "",
                    "source": "coastalcph/lex_glue:unfair_tos",
                    "source_url": "https://huggingface.co/datasets/coastalcph/lex_glue",
                    "source_license": "CC-BY-4.0",
                    "annotation_method": "expert_public_annotation" if ids else "official_no_supported_unfair_label",
                    "annotation_confidence": "expert" if ids else "high",
                    "hard_negative_for": [],
                }


def stable_split(group: str) -> str:
    bucket = int(hashlib.sha256(group.encode()).hexdigest()[:8], 16) % 100
    return "train" if bucket < 80 else "validation" if bucket < 90 else "test"


def ota_rows(root: Path, seed: int):
    rng = random.Random(seed)
    review = []
    rows = []
    paths = sorted(root.rglob("*.md"))
    for path in paths:
        relative = path.relative_to(root).as_posix()
        if relative in {"README.md", "LICENSE.md"} or path.name.lower() in {"readme.md", "license.md"}:
            continue
        service = relative.split("/", 1)[0]
        document_type = path.stem
        document_id = f"ota:{relative}"
        split = stable_split(service.lower())
        for number, (heading, context, text) in enumerate(markdown_clauses(path)):
            labels = privacy_labels(text)
            hard_negative_for = [
                label for label, pattern in COMPILED_HARD_NEGATIVES if pattern.search(text)
            ]
            explicitly_safe = any(pattern.search(text) for pattern in COMPILED_SAFE)
            item = {
                "id": f"{document_id}:{number}",
                "text": text,
                "heading": heading,
                "context": context,
                "labels": labels,
                "label_vector": label_vector(labels),
                "split": split,
                "document_id": document_id,
                "document_type": document_type,
                "service": service,
                "source": "OpenTermsArchive/contrib-versions",
                "source_url": f"https://github.com/OpenTermsArchive/contrib-versions/blob/main/{relative}",
                "source_license": "ODC-By-1.0 database; underlying document rights may differ",
                "annotation_method": "high_precision_pattern" if labels else "explicit_safe_or_hard_negative",
                "annotation_confidence": "high",
                "hard_negative_for": sorted(set(hard_negative_for)),
            }
            if labels:
                rows.append(item)
            elif hard_negative_for or explicitly_safe:
                rows.append(item)
            elif re.search(r"\b(?:privacy|personal data|personal information|cookies?|tracking|location|retain|share|disclos|collect)\b", text, re.I):
                item["annotation_method"] = "requires_review"
                item["annotation_confidence"] = "unreviewed"
                review.append(item)
            elif rng.random() < 0.015:
                item["annotation_method"] = "sampled_unlabelled_requires_review"
                item["annotation_confidence"] = "unreviewed"
                review.append(item)
    return rows, review


def deduplicate(rows: list[dict]) -> tuple[list[dict], int]:
    priority = {"test": 3, "validation": 2, "train": 1}
    retained: dict[str, dict] = {}
    removed = 0
    for row in rows:
        key = text_key(row["text"])
        current = retained.get(key)
        if current is None or priority[row["split"]] > priority[current["split"]]:
            removed += current is not None
            retained[key] = row
        else:
            removed += 1
    return list(retained.values()), removed


def write_jsonl(path: Path, rows: list[dict]):
    with path.open("w", encoding="utf-8", newline="\n") as stream:
        for row in rows:
            stream.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--unfair", type=Path, default=Path("ml/data/lexglue-binary"))
    parser.add_argument("--ota", type=Path, default=Path("ml/data/open-terms-archive/contrib-versions-main"))
    parser.add_argument("--output", type=Path, default=Path("ml/data/bya-19-v1"))
    parser.add_argument("--seed", type=int, default=5120)
    args = parser.parse_args()

    if not args.unfair.is_dir() or not args.ota.is_dir():
        raise SystemExit("Required UNFAIR-ToS or Open Terms Archive source directory is missing")
    args.output.mkdir(parents=True, exist_ok=True)

    contract = list(unfair_rows(args.unfair))
    privacy, review = ota_rows(args.ota, args.seed)
    rows, duplicate_count = deduplicate(contract + privacy)
    rows.sort(key=lambda row: (row["split"], row["document_id"], row["id"]))
    review.sort(key=lambda row: (row["split"], row["document_id"], row["id"]))

    files = {}
    split_counts = {}
    split_label_counts = {}
    label_counts = Counter()
    zero_counts = Counter()
    for split in ("train", "validation", "test"):
        selected = [row for row in rows if row["split"] == split]
        path = args.output / f"{split}.jsonl"
        write_jsonl(path, selected)
        files[path.name] = {"rows": len(selected), "sha256": sha256(path)}
        split_counts[split] = len(selected)
        per_split = Counter()
        zero_counts[split] = sum(not row["labels"] for row in selected)
        for row in selected:
            label_counts.update(row["labels"])
            per_split.update(row["labels"])
        split_label_counts[split] = {label: per_split[label] for label in LABELS}

    review_path = args.output / "review_queue.jsonl"
    write_jsonl(review_path, review)
    files[review_path.name] = {"rows": len(review), "sha256": sha256(review_path)}

    manifest = {
        "schema_version": 1,
        "dataset_id": "bya-19-v1",
        "labels": LABELS,
        "label_count": len(LABELS),
        "task": "multi_label_clause_classification",
        "seed": args.seed,
        "splits": split_counts,
        "zero_label_rows": dict(zero_counts),
        "label_counts": dict(label_counts),
        "split_label_counts": split_label_counts,
        "sources": [
            {
                "id": "coastalcph/lex_glue:unfair_tos",
                "license": "CC-BY-4.0",
                "annotation": "official public eight-label annotations",
            },
            {
                "id": "OpenTermsArchive/contrib-versions",
                "license": "ODC-By-1.0 for the database; underlying document rights may differ",
                "annotation": "high-precision weak supervision; ambiguous rows excluded to review_queue.jsonl",
            },
        ],
        "excluded_sources": ["OPP-115"],
        "deduplicated_rows": duplicate_count,
        "review_queue_rows": len(review),
        "files": files,
        "limitations": [
            "Privacy labels are weakly supervised and require human audit before a final benchmark claim.",
            "The LexGLUE release does not expose document IDs, so its original splits are retained.",
            "Do not train on review_queue.jsonl until its labels have been manually resolved.",
            "Verify rights for underlying archived policy text before commercial redistribution or training.",
        ],
    }
    manifest_path = args.output / "dataset_manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
