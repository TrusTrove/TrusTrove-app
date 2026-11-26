#!/usr/bin/env python3
"""Read-only scan for repository-borne editor and build malware indicators.

This scanner never imports or executes files from the tree it inspects. In CI it
must be run from a trusted checkout against the untrusted PR checkout.
"""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path


# Published by StepSecurity for the PolinRider loader (26 November 2026).
KNOWN_BAD_SHA256 = {
    "b02a81974810532fff8f76903e09b20431857bfaff00f2473421f4a4fb8162b5",
    "41a69ba3946396d2d1c15f2e43be705f0793e8773dee0f3dda89a541d31c00d9",
    "3ae470cabb9412bf5f0e64e1f71b458e14eb10b19070845597d5b8230b27d552",
}

FONT_MAGIC = {".woff": b"wOFF", ".woff2": b"wOF2", ".ttf": b"\x00\x01\x00\x00", ".otf": b"OTTO"}
EXECUTABLE_SUFFIXES = {".js", ".mjs", ".cjs", ".ts", ".tsx", ".py", ".sh", ".ps1", ".bat", ".cmd", ".json", ".toml", ".yml", ".yaml"}
SUSPICIOUS_ASSET_SUFFIXES = {".lkf", ".lfk", ".orc", ".llf"}
HIDDEN_LOADER = re.compile(rb"(?:^|[;})])[^\S\r\n]{100,}\S", re.MULTILINE)
FOLDER_OPEN = re.compile(rb"[\"']?runOn[\"']?\s*:\s*[\"']folderOpen[\"']", re.IGNORECASE)
AUTO_TASKS = re.compile(rb"[\"']?task\.allowAutomaticTasks[\"']?\s*:\s*(?:true|[\"']on[\"'])", re.IGNORECASE)
NODE_API_HOOK = re.compile(rb"\bnode\s+(?:\./)?api\.js\s*&&", re.IGNORECASE)
POLIN_MARKERS = (
    b"_$_" + b"1e42",
    b"global[" + b"'!'" + b"]",
    b"hello" + b"ipbot!!",
    b"0x1eef0849eda15d87" + b"f64e51c73c8442cf3c8bcef3",
    b"0xa322e5f3d311d308" + b"0e6f0121063e9adc2490ef1a",
)
LOADER_TOOL_NAMES = {"branch_structure.json", "temp_auto_push.bat", "temp_interactive_push.bat"}
MAX_SCANNED_BYTES = 20_000_000


def tracked_paths(root: Path) -> list[Path]:
    result = subprocess.run(
        ["git", "-C", str(root), "ls-files", "-z"],
        check=True,
        capture_output=True,
    )
    return [Path(item.decode("utf-8", "surrogateescape")) for item in result.stdout.split(b"\0") if item]


def scan(root: Path) -> list[str]:
    findings: list[str] = []
    for relative in tracked_paths(root):
        name = relative.name.lower()
        parts = tuple(part.lower() for part in relative.parts)
        location = root / relative
        label = relative.as_posix()

        if location.is_symlink():
            findings.append(f"{label}: tracked symlink needs manual review")
            continue
        if not location.is_file():
            findings.append(f"{label}: tracked file is missing or not regular")
            continue

        # This repository has no tracked editor startup configuration. Adding
        # one is a security policy change requiring review.
        if ".vscode" in parts or relative.suffix.lower() == ".code-workspace":
            findings.append(f"{label}: VS Code workspace configuration is prohibited")
        if any(part in {".claude", ".cursor", ".devcontainer", ".gemini", ".opencode"} for part in parts) or label.lower() in {
            ".mcp.json", ".cargo/config", ".cargo/config.toml",
        }:
            findings.append(f"{label}: executable workspace configuration needs manual review")
        if name == "build.rs":
            findings.append(f"{label}: new build entry point needs manual review")
        if name in LOADER_TOOL_NAMES or relative.suffix.lower() in SUSPICIOUS_ASSET_SUFFIXES:
            findings.append(f"{label}: filename matches a published loader artifact")

        if location.stat().st_size > MAX_SCANNED_BYTES:
            findings.append(f"{label}: file exceeds 20 MB static scan limit")
            continue
        data = location.read_bytes()
        if hashlib.sha256(data).hexdigest() in KNOWN_BAD_SHA256:
            findings.append(f"{label}: SHA-256 matches a published PolinRider payload")

        suffix = relative.suffix.lower()
        if suffix in FONT_MAGIC and not data.startswith(FONT_MAGIC[suffix]):
            findings.append(f"{label}: font extension has invalid file signature")

        if suffix not in EXECUTABLE_SUFFIXES and suffix not in SUSPICIOUS_ASSET_SUFFIXES and name != ".gitignore":
            continue

        if FOLDER_OPEN.search(data) or AUTO_TASKS.search(data):
            findings.append(f"{label}: automatic folder-open task configuration")
        if NODE_API_HOOK.search(data):
            findings.append(f"{label}: node api.js build hook matches campaign behavior")
        if any(marker in data for marker in POLIN_MARKERS):
            findings.append(f"{label}: published PolinRider loader marker")
        if suffix in {".js", ".mjs", ".cjs", ".ts", ".tsx"} and HIDDEN_LOADER.search(data):
            findings.append(f"{label}: executable code hidden after 100+ horizontal whitespace characters")
        if name == ".gitignore" and any(tool.encode() in data for tool in LOADER_TOOL_NAMES):
            findings.append(f"{label}: ignores published PolinRider tooling filenames")
        if name == "package.json":
            try:
                manifest = json.loads(data)
            except (ValueError, UnicodeDecodeError):
                findings.append(f"{label}: invalid package manifest")
            else:
                scripts = manifest.get("scripts", {}) if isinstance(manifest, dict) else {}
                if isinstance(scripts, dict) and any(key in scripts for key in ("preinstall", "postinstall", "prepare")):
                    findings.append(f"{label}: npm lifecycle execution requires manual review")
                if isinstance(scripts, dict) and any(re.search(r"\bnode\s+-e\b", str(command)) for command in scripts.values()):
                    findings.append(f"{label}: inline Node execution in package script needs manual review")
        if name in {"package-lock.json", "components.json"}:
            try:
                json.loads(data)
            except (ValueError, UnicodeDecodeError):
                findings.append(f"{label}: JSON file has invalid or appended content")

    return sorted(set(findings))


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: scan_repo.py <checkout-directory>", file=sys.stderr)
        return 2
    root = Path(sys.argv[1]).resolve()
    if not root.is_dir():
        print(f"not a directory: {root}", file=sys.stderr)
        return 2
    try:
        findings = scan(root)
    except (OSError, subprocess.CalledProcessError) as exc:
        print(f"scan failed: {exc}", file=sys.stderr)
        return 2
    for finding in findings:
        print(f"::error::{finding}")
    if findings:
        print(f"Malware guard: {len(findings)} finding(s). Review the PR before running its code.")
        return 1
    print(f"Malware guard: clean ({len(tracked_paths(root))} tracked files scanned; no code executed).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
