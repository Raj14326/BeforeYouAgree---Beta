import json
import time
import urllib.request
import urllib.parse
import re

APP_NAMES = [
    "Twitter", "Reddit", "Snapchat", "Facebook", "Pinterest",
    "Dropbox", "Slack", "GitHub", "PayPal", "Venmo",
    "Twitch", "Telegram", "Airbnb", "Quizlet", "Steam",
]

SEARCH_URL = "https://api.tosdr.org/search/v5/"
SERVICE_URL = "https://api.tosdr.org/service/v3/"
DELAY_SECONDS = 1.5

def fetch_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "BeforeYouAgree-Pilot/1.0"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))

def slugify(name):
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")

def main():
    passed, failed, not_found = [], [], []
    print(f"Checking {len(APP_NAMES)} app(s) against ToS;DR...\n")
    print(f"{'App':<15} {'ID':<8} {'Reviewed':<10} {'Rating':<8} {'Result'}")
    print("-" * 55)

    for name in APP_NAMES:
        query = urllib.parse.urlencode({"query": name})
        try:
            data = fetch_json(f"{SEARCH_URL}?{query}")
        except Exception as e:
            print(f"{name:<15} -- search failed: {e}")
            not_found.append(name)
            time.sleep(DELAY_SECONDS)
            continue

        services = data.get("services", [])
        if not services:
            print(f"{name:<15} {'--':<8} {'--':<10} {'--':<8} NOT FOUND")
            not_found.append(name)
            time.sleep(DELAY_SECONDS)
            continue

        best = services[0]
        sid = best["id"]
        reviewed = bool(best.get("is_comprehensively_reviewed"))
        rating = best.get("rating") or "N/A"
        ok = reviewed and rating != "N/A"
        result = "PASS" if ok else "fail (filter)"
        print(f"{name:<15} {sid:<8} {str(reviewed):<10} {rating:<8} {result}")

        if ok:
            passed.append((name, sid, best.get("name", name)))
        else:
            failed.append((name, sid, reviewed, rating))
        time.sleep(DELAY_SECONDS)

    print(f"\n{len(passed)} passed, {len(failed)} failed the filter, {len(not_found)} not found\n")

    if passed:
        print("Fetching full risk-point data for the apps that passed...\n")
        eligible_filenames = []
        for name, sid, real_name in passed:
            slug = slugify(real_name)
            fname = f"{slug}_raw.json"
            try:
                data = fetch_json(f"{SERVICE_URL}?id={sid}")
            except Exception as e:
                print(f"  {real_name}: FAILED to fetch ({e})")
                time.sleep(DELAY_SECONDS)
                continue
            with open(fname, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            n_points = len(data.get("points", []))
            print(f"  {real_name} (id {sid}): saved {fname} ({n_points} points)")
            eligible_filenames.append(fname)
            time.sleep(DELAY_SECONDS)

        print("\n--- Paste this into flatten_tosdr.py, replacing the eligible_files line ---")
        print("eligible_files = " + json.dumps(eligible_filenames) + " + [\"tiktok_raw.json\", \"netflix_raw.json\"]")

    if failed:
        print("\nApps that were found but did NOT pass the filter (raw JSON not fetched):")
        for name, sid, reviewed, rating in failed:
            print(f"  {name} (id {sid}): reviewed={reviewed}, rating={rating}")

    if not_found:
        print("\nApps with no match at all on ToS;DR:")
        for name in not_found:
            print(f"  {name}")

if __name__ == "__main__":
    main()
