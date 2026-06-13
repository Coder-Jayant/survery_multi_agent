"""
GET /api/download/source.zip
------------------------------
Zip the project source for download. Excludes venv, node_modules, .env,
and strips API keys from config.json.
"""
from __future__ import annotations

import io
import json
import os
import zipfile
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/api/download", tags=["download"])

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

_SKIP_DIRS = {
    ".git", ".venv", "venv", "node_modules", "__pycache__",
    ".cursor", "minisense", ".pytest_cache",
}

_SKIP_FILES = {
    ".env", "Assignment.docx", "minisense.zip",
}

_SKIP_SUFFIXES = (".pyc", ".pyo", ".egg-info")


def _should_skip(rel: str, is_dir: bool) -> bool:
    rel = rel.replace("\\", "/").lstrip("./")
    parts = rel.split("/")
    if any(p in _SKIP_DIRS for p in parts):
        return True
    if is_dir:
        return False
    name = parts[-1]
    if name in _SKIP_FILES:
        return True
    if name.startswith(".env") and name != ".env.example":
        return True
    return any(name.endswith(s) for s in _SKIP_SUFFIXES)


def _build_zip() -> io.BytesIO:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for dirpath, dirnames, filenames in os.walk(_ROOT):
            rel_dir = os.path.relpath(dirpath, _ROOT)
            if rel_dir == ".":
                rel_dir = ""

            dirnames[:] = [
                d for d in dirnames
                if not _should_skip(f"{rel_dir}/{d}" if rel_dir else d, True)
            ]

            for fn in filenames:
                rel = f"{rel_dir}/{fn}" if rel_dir else fn
                rel = rel.replace("\\", "/")
                if _should_skip(rel, False):
                    continue

                abs_path = os.path.join(dirpath, fn)

                if rel == "config/config.json":
                    with open(abs_path, encoding="utf-8") as f:
                        cfg = json.load(f)
                    keys = cfg.get("api_keys", {})
                    cfg["api_keys"] = {k: "" for k in keys}
                    zf.writestr(rel, json.dumps(cfg, indent=2) + "\n")
                else:
                    zf.write(abs_path, rel)

    buf.seek(0)
    return buf


@router.get("/source.zip")
def download_source_zip():
    buf = _build_zip()
    filename = "Jayant_Assignment_Minisense.zip"
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/readme")
def get_readme():
    """Return README.md content as plain text for in-browser preview."""
    from fastapi.responses import PlainTextResponse
    readme_path = os.path.join(_ROOT, "README.md")
    try:
        with open(readme_path, encoding="utf-8") as f:
            content = f.read()
        return PlainTextResponse(content)
    except FileNotFoundError:
        return PlainTextResponse("README.md not found.", status_code=404)
