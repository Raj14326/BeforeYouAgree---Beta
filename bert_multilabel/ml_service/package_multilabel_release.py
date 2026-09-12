"""Create source/weight release archives and SHA-256 checksums."""
import hashlib
import json
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT.parents[1] / "output"
MODEL = ROOT / "ml/models/bert-multilabel-base-v1"
SOURCE_ZIP = OUTPUT / "BeforeYouAgree-Multilabel-BERT-Source.zip"
WEIGHTS_ZIP = OUTPUT / "BeforeYouAgree-Multilabel-LEGAL-BERT-Base-Weights.zip"
EXCLUDED_PARTS = {".git", ".venv", "node_modules", "dist", "__pycache__", ".pytest_cache",
                  ".playwright-browsers", ".npm-cache", "playwright-report", "test-results"}


def source_files():
    for path in sorted(ROOT.rglob("*")):
        relative = path.relative_to(ROOT)
        if not path.is_file() or path.suffix == ".joblib" or any(part in EXCLUDED_PARTS for part in relative.parts):
            continue
        if relative.parts[:2] in (("ml", "pretrained"), ("ml", "models")):
            continue
        if relative.parts[:3] == ("ml", "data", "lexglue-raw"):
            continue
        yield path, Path("BeforeYouAgree---Beta-Prototype") / relative


def make_zip(target, files, compression):
    if target.exists():
        target.unlink()
    kwargs = {"compression": compression}
    if compression == zipfile.ZIP_DEFLATED:
        kwargs["compresslevel"] = 6
    with zipfile.ZipFile(target, "w", **kwargs) as archive:
        for path, name in files:
            archive.write(path, name.as_posix())
    with zipfile.ZipFile(target) as archive:
        failed = archive.testzip()
        if failed:
            raise ValueError(f"Archive integrity failed at {failed}")


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main():
    if not (MODEL / "model.safetensors").exists() or not (MODEL / "risk_config.json").exists():
        raise FileNotFoundError("Complete trained multi-label checkpoint is required")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    make_zip(SOURCE_ZIP, list(source_files()), zipfile.ZIP_DEFLATED)
    model_files = [(path, Path("bert-multilabel-base-v1") / path.relative_to(MODEL))
                   for path in sorted(MODEL.rglob("*")) if path.is_file()]
    make_zip(WEIGHTS_ZIP, model_files, zipfile.ZIP_STORED)
    result = {path.name: {"bytes": path.stat().st_size, "sha256": sha256(path)}
              for path in (SOURCE_ZIP, WEIGHTS_ZIP)}
    checksums = OUTPUT / "BeforeYouAgree-Multilabel-BERT-checksums.json"
    checksums.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
