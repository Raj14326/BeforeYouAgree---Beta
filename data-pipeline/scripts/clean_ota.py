import re, csv, hashlib, os, json, glob

REPO_DIR = "contrib-versions-main"
OUT_PATH = "ota_clauses.csv"

TARGET_SERVICES = {
    "Discord": "Discord",
    "Facebook": "Facebook",
    "GitHub": "GitHub",
    "Google": "Google",
    "Instagram": "Instagram",
    "Netflix": "Netflix",
    "PayPal": "PayPal",
    "Pinterest": "Pinterest",
    "Reddit": "Reddit",
    "Steam": "Steam",
    "TikTok": "TikTok",
    "WhatsApp": "WhatsApp",
    "YouTube": "YouTube",
    "Amazon.com": "Amazon",
    "Twitter": "X (Twitter)",
}

DOC_FILENAME_MAP = {
    "terms of service.md": "terms_of_service",
    "terms of use.md": "terms_of_service",
    "terms & conditions.md": "terms_of_service",
    "conditions of use.md": "terms_of_service",
    "privacy policy.md": "privacy_policy",
    "privacy notice.md": "privacy_policy",
}

MIN_WORDS = 6
MAX_WORDS = 180
STANDALONE_HEADING_MAX_WORDS = 12

BOILERPLATE = re.compile(r"^(home|menu|search|log ?in|sign ?up|cookie settings|back to top)$", re.IGNORECASE)
HEADING_RE = re.compile(r'^(\d+(?:\.\d+)*)\.\s+([A-Z][^.]{2,80}?)\.\s+(.*)$')
DASH_LINE_RE = re.compile(r'^[-=]{3,}\s*$')
TERMINAL_PUNCT = (".", "!", "?", ";", ":")
MD_ESCAPE_RE = re.compile(r'\\([!"#$%&\'()*+,\-./:;<=>?@\[\]^_`{|}~\\])')


def strip_markdown(text):
    text = re.sub(r"\[([^\]]*)\]\(([^)]*)\)", r"\1", text)
    text = re.sub(r"[*_]{1,3}", "", text)
    return text


def normalize(text):
    text = text.replace("\u200b", "")
    for _ in range(5):
        new_text = MD_ESCAPE_RE.sub(r"\1", text)
        if new_text == text:
            break
        text = new_text
    return text


def clean_line(line):
    return re.sub(r"^\s*([-*•]|\d+[.)])\s+", "", line).strip()


def clause_id(service, doc_type, text):
    norm = " ".join(text.lower().split())
    return hashlib.sha1(f"{service}:{doc_type}:{norm}".encode()).hexdigest()[:16]


def looks_like_standalone_heading(para: str) -> bool:
    wc = len(para.split())
    if wc == 0 or wc > STANDALONE_HEADING_MAX_WORDS:
        return False
    if para.rstrip().endswith(TERMINAL_PUNCT):
        return False
    return True


def segment(text):
    results, buffer = [], []
    current_heading, seen_any_heading = "", False

    def flush(is_list_item_flush=False):
        nonlocal current_heading, seen_any_heading
        if not buffer:
            return
        para = " ".join(buffer).strip()
        para = re.sub(r"\s+", " ", strip_markdown(normalize(para)))
        buffer.clear()
        if not para:
            return

        m = HEADING_RE.match(para)
        if m:
            current_heading = f"{m.group(1)}. {m.group(2)}"
            seen_any_heading = True
            results.append((current_heading, para))
            return

        if not is_list_item_flush and looks_like_standalone_heading(para):
            current_heading = para
            seen_any_heading = True
            return

        wc = len(para.split())
        if wc < MIN_WORDS:
            return
        this_heading = current_heading if seen_any_heading else "Preamble"
        if wc <= MAX_WORDS:
            results.append((this_heading, para))
            return
        sentences = re.split(r"(?<=[.!?])\s+(?=[A-Z0-9])", para)
        chunk, cw = [], 0
        for s in sentences:
            sw = len(s.split())
            if chunk and cw + sw > MAX_WORDS:
                results.append((this_heading, " ".join(chunk)))
                chunk, cw = [], 0
            chunk.append(s); cw += sw
        if cw >= MIN_WORDS:
            results.append((this_heading, " ".join(chunk)))

    lines = text.splitlines()
    i = 0
    while i < len(lines):
        raw_line = lines[i]
        stripped = raw_line.strip()
        if (i + 1 < len(lines) and DASH_LINE_RE.match(lines[i + 1].strip())
                and stripped and not BOILERPLATE.match(stripped)):
            flush()
            current_heading = strip_markdown(normalize(stripped)).strip()
            seen_any_heading = True
            i += 2
            continue
        heading_match = re.match(r"^(#{1,6})\s*(.+?)\s*#*$", stripped)
        if heading_match:
            flush()
            current_heading = strip_markdown(normalize(heading_match.group(2))).strip()
            seen_any_heading = True
            i += 1
            continue
        is_list_item = bool(re.match(r"^\s*([-*•]|\d+\))\s+", raw_line))
        cleaned = clean_line(raw_line)
        if not cleaned:
            flush(); i += 1; continue
        if BOILERPLATE.match(cleaned) or len(cleaned) < 3:
            i += 1; continue
        if is_list_item:
            flush()
            buffer.append(cleaned)
            flush(is_list_item_flush=True)
            i += 1; continue
        buffer.append(cleaned)
        i += 1
    flush()
    return results


def fallback_source_url(output_service_name):
    slug = re.sub(r"[^a-z0-9]+", "_", output_service_name.lower()).strip("_")
    for candidate in glob.glob(f"*{slug}*_raw.json") + glob.glob(f"{slug}*_raw.json"):
        try:
            with open(candidate, encoding="utf-8") as f:
                data = json.load(f)
            urls = data.get("urls", [])
            if urls:
                return f"https://{urls[0]}"
        except Exception:
            pass
    return ""


def main():
    if not os.path.isdir(REPO_DIR):
        print(f"ERROR: {REPO_DIR} not found.")
        return

    rows = []
    found, missing = [], []

    for folder_name, output_name in TARGET_SERVICES.items():
        service_dir = os.path.join(REPO_DIR, folder_name)
        if not os.path.isdir(service_dir):
            missing.append(folder_name)
            continue
        found.append(folder_name)

        doc_files = {f.lower(): f for f in os.listdir(service_dir)}
        matched_any = False
        for fname_lower, doc_type in DOC_FILENAME_MAP.items():
            if fname_lower not in doc_files:
                continue
            matched_any = True
            path = os.path.join(service_dir, doc_files[fname_lower])
            with open(path, encoding="utf-8", errors="replace") as f:
                text = f.read()
            source_url = fallback_source_url(output_name)
            clauses = segment(text)
            for heading, clause_text in clauses:
                rows.append({
                    "clause_id": clause_id(output_name, doc_type, clause_text),
                    "service_name": output_name,
                    "document_type": doc_type,
                    "section_heading": heading,
                    "clause_text": clause_text,
                    "source_url": source_url,
                })
            print(f"  {output_name} / {doc_type}: {len(clauses)} clauses")
        if not matched_any:
            print(f"  {output_name} ({folder_name}): folder found but no Terms/Privacy file matched")

    print(f"\n{len(found)}/{len(TARGET_SERVICES)} target folders found in the repo")
    if missing:
        print(f"NOT FOUND: {missing}")

    seen = set()
    unique_rows = []
    for r in rows:
        key = (r["service_name"], r["document_type"], r["clause_text"].lower())
        if key in seen:
            continue
        seen.add(key)
        unique_rows.append(r)

    with open(OUT_PATH, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["clause_id", "service_name", "document_type",
                                           "section_heading", "clause_text", "source_url"])
        w.writeheader()
        w.writerows(unique_rows)

    n_no_url = sum(1 for r in unique_rows if not r["source_url"])
    print(f"\nTotal: {len(unique_rows)} clauses written to {OUT_PATH}")
    if n_no_url:
        print(f"NOTE: {n_no_url} row(s) have no source_url.")


if __name__ == "__main__":
    main()
