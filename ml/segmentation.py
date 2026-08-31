import re


def is_heading(text: str):
    stripped = text.strip()
    if stripped.endswith("?"):
        return True
    if (
        re.match(r"^#{1,6}\s", stripped)
        or re.fullmatch(r"[-=_*]{3,}", stripped)
        or (len(stripped) < 80 and stripped.isupper())
    ):
        return True

    words = re.findall(r"[A-Za-z']+", stripped)
    if len(words) > 10 or re.search(r"[.!;]$", stripped):
        return False
    if stripped.endswith(":"):
        return True

    normalized = stripped.lower()
    operative = re.search(
        r"\b(is|are|was|were|may|might|will|must|can|cannot|collect(?:s|ed)?|use(?:s|d)?|"
        r"share(?:s|d)?|retain(?:s|ed)?|store(?:s|d)?|process(?:es|ed)?|sell(?:s|sold)?|"
        r"delete(?:s|d)?|remove(?:s|d)?|disclose(?:s|d)?|provide(?:s|d)?)\b",
        normalized,
    )
    if not operative and (
        re.match(r"^your\s+", normalized)
        or (len(words) <= 8 and ("&" in stripped or re.search(r"\s+and\s+", normalized)))
    ):
        return True
    if re.match(r"^(why|how|what|when|where|who)\b", normalized):
        return True
    if re.match(r"^[a-z]+ing\b", normalized) and not re.search(
        r"\b(is|are|was|were|may|might|will|must|can|cannot|not)\b", normalized
    ):
        return True
    if re.match(
        r"^(information|personal information|data|personal data)\s+"
        r"(?:\w+\s+){0,3}(?:collect(?:s|ed)?|use(?:s|d)?|share(?:s|d)?|retain(?:s|ed)?|"
        r"store(?:s|d)?|process(?:es|ed)?)(?:\s+.{1,50})?$",
        normalized,
    ):
        return True
    return bool(
        re.match(
            r"^(information|personal information|data|personal data|privacy|security)\b",
            normalized,
        )
        and not re.search(
            r"\b(we|you|your|our|may|might|will|must|can|cannot|don't|doesn't|not)\b",
            normalized,
        )
    )


def clean_policy_text(text: str):
    """Remove common residual website controls from already flattened policy text."""
    cleaned = re.sub(r"\s+", " ", text).strip()
    control_prefixes = (
        r"(?:go to\s+)?(?:activity controls|ad settings|cookie settings|privacy settings|manage settings)\s+",
        r"(?:open|view|visit)\s+(?:settings|controls|preferences)\s+",
    )
    changed = True
    while changed:
        changed = False
        for pattern in control_prefixes:
            updated = re.sub(rf"^{pattern}", "", cleaned, count=1, flags=re.IGNORECASE)
            if updated != cleaned:
                cleaned = updated.strip()
                changed = True
    return cleaned


def sentence_segments(content: str):
    segments = []
    paragraph_pattern = re.compile(r"[^\n]+")
    sentence_pattern = re.compile(r".+?(?:[.!?](?=\s|$)|$)", re.DOTALL)

    for paragraph_match in paragraph_pattern.finditer(content):
        paragraph = paragraph_match.group(0)
        stripped = paragraph.strip()
        if is_heading(stripped):
            continue
        for sentence_match in sentence_pattern.finditer(paragraph):
            raw = sentence_match.group(0)
            leading = len(raw) - len(raw.lstrip())
            text = clean_policy_text(raw)
            if len(text) < 20 or not re.search(r"[A-Za-z]", text) or is_heading(text):
                continue
            start = paragraph_match.start() + sentence_match.start() + leading
            end = paragraph_match.start() + sentence_match.end()
            segments.append({"text": text, "start": start, "end": end})
    return segments


def paragraph_segments(content: str, max_characters=1600):
    """Return policy-sized passages while preserving source offsets."""
    segments = []
    for match in re.finditer(r"[^\n]+(?:\n(?!\s*\n)[^\n]+)*", content):
        raw = match.group(0)
        leading = len(raw) - len(raw.lstrip())
        text = clean_policy_text(raw)
        if len(text) < 20 or not re.search(r"[A-Za-z]", text) or is_heading(text):
            continue
        start = match.start() + leading
        while len(text) > max_characters:
            split = text.rfind(". ", 0, max_characters)
            if split < max_characters // 2:
                split = text.rfind(" ", 0, max_characters)
            split = split + 1 if split > 0 else max_characters
            part = text[:split].strip()
            segments.append({"text": part, "start": start, "end": start + len(part)})
            consumed = len(text[:split])
            text = text[split:].lstrip()
            start += consumed
        if text:
            segments.append({"text": text, "start": start, "end": start + len(text)})
    return segments
