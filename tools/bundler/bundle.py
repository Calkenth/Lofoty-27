#!/usr/bin/env python3
"""Skleja modułową stronę w jeden samodzielny plik HTML.

Wynik (domyślnie dist/lofoty.html) służy do publikacji jako artefakt w Claude
i do wysyłania jako plik, który działa bez serwera i bez internetu
(poza czcionkami Google, które mają zapasowe kroje systemowe).

Co robi:
  1. Wkleja lokalne arkusze CSS (<link rel="stylesheet">) jako <style>.
  2. Osadza wszystkie pliki *.json z features/ i shared/ w window.__BUNDLE_DATA__,
     skąd odczytuje je shared/js/data.js zamiast fetch.
  3. Zamienia moduły ES (import/export) na jeden zwykły skrypt.

Obsługiwane formy modułów (celowo tylko te, których używa projekt):
  import { a, b as c } from './plik.js';
  export function f() {}   export async function f() {}   export const x = ...;

Użycie:
  python3 tools/bundler/bundle.py [--root KATALOG] [--out PLIK]
"""
import argparse
import json
import re
import sys
from pathlib import Path

IMPORT_RE = re.compile(r"^import\s*\{([^}]*)\}\s*from\s*['\"]([^'\"]+)['\"];?[ \t]*$", re.M)
EXPORT_RE = re.compile(r"^export\s+(?:(async\s+)?function\s+(\w+)|(const|let|class)\s+(\w+))", re.M)
ANY_IMPORT_EXPORT_RE = re.compile(r"^\s*(import|export)\b", re.M)
LINK_RE = re.compile(r'[ \t]*<link rel="stylesheet" href="(?!https?:)([^"]+)">\n?')
MODULE_TAG_RE = re.compile(r'<script type="module" src="([^"]+)"></script>')
DATA_DIRS = ("features", "shared")


class BundleError(Exception):
    pass


def inline_css(html: str, root: Path) -> str:
    links = list(LINK_RE.finditer(html))
    if not links:
        return html
    parts = []
    for m in links:
        css_path = root / m.group(1)
        parts.append(f"/* {m.group(1)} */\n{css_path.read_text(encoding='utf-8').strip()}\n")
    style = "  <style>\n" + "\n".join(parts) + "  </style>\n"
    # Pierwszy link zastępujemy całym blokiem stylów, pozostałe usuwamy (kolejność zachowana).
    out = html[: links[0].start()] + style + html[links[0].end():]
    return LINK_RE.sub("", out)


def collect_data(root: Path) -> dict:
    data = {}
    for folder in DATA_DIRS:
        for path in sorted((root / folder).rglob("*.json")):
            rel = path.relative_to(root).as_posix()
            try:
                data[rel] = json.loads(path.read_text(encoding="utf-8"))
            except json.JSONDecodeError as e:
                raise BundleError(f"Niepoprawny JSON w {rel}: {e}") from e
    return data


def resolve(spec: str, importer: Path, root: Path) -> Path:
    if not spec.startswith("."):
        raise BundleError(f"{importer.relative_to(root)}: obsługiwane są tylko ścieżki względne, a jest '{spec}'")
    target = (importer.parent / spec).resolve()
    if not target.is_file():
        raise BundleError(f"{importer.relative_to(root)}: nie ma pliku {spec}")
    return target


def transform_module(path: Path, root: Path):
    src = path.read_text(encoding="utf-8")
    deps = []

    def repl_import(m):
        dep = resolve(m.group(2), path, root)
        deps.append(dep)
        names = []
        for part in m.group(1).split(","):
            part = part.strip()
            if not part:
                continue
            if " as " in part:
                orig, alias = [p.strip() for p in part.split(" as ")]
                names.append(f"{orig}: {alias}")
            else:
                names.append(part)
        return f"const {{ {', '.join(names)} }} = __modules[{json.dumps(key(dep, root))}];"

    code = IMPORT_RE.sub(repl_import, src)
    exports = []

    def repl_export(m):
        if m.group(2):
            exports.append(m.group(2))
            return f"{m.group(1) or ''}function {m.group(2)}"
        exports.append(m.group(4))
        return f"{m.group(3)} {m.group(4)}"

    code = EXPORT_RE.sub(repl_export, code)
    leftover = ANY_IMPORT_EXPORT_RE.search(code)
    if leftover:
        line = code[: leftover.start()].count("\n") + 1
        raise BundleError(f"{key(path, root)}:{line}: nieobsługiwana forma import/export")
    return code, deps, exports


def key(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()


def bundle_js(entry: Path, root: Path) -> str:
    ordered, seen, active = [], set(), set()

    def visit(path: Path):
        if path in seen:
            return
        if path in active:
            raise BundleError(f"Cykliczny import: {key(path, root)}")
        active.add(path)
        code, deps, exports = transform_module(path, root)
        for dep in deps:
            visit(dep)
        active.discard(path)
        seen.add(path)
        ordered.append((path, code, exports))

    visit(entry)
    blocks = []
    for path, code, exports in ordered:
        blocks.append(
            f"// ---- {key(path, root)} ----\n"
            f"__modules[{json.dumps(key(path, root))}] = (function () {{\n{code.rstrip()}\n"
            f"return {{ {', '.join(exports)} }};\n}})();"
        )
    return '(function () {\n"use strict";\nconst __modules = {};\n' + "\n\n".join(blocks) + "\n})();"


def safe_for_script(text: str) -> str:
    return text.replace("</", "<\\/")


def build(root: Path, out: Path) -> Path:
    html = (root / "index.html").read_text(encoding="utf-8")
    html = inline_css(html, root)
    m = MODULE_TAG_RE.search(html)
    if not m:
        raise BundleError("W index.html brakuje <script type=\"module\" src=...>")
    data = collect_data(root)
    js = bundle_js((root / m.group(1)).resolve(), root)
    data_js = "window.__BUNDLE_DATA__ = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";"
    scripts = (
        "<!-- Wygenerowano przez tools/bundler/bundle.py. Nie edytuj ręcznie: zmiany wprowadzaj w plikach źródłowych. -->\n"
        f"<script>\n{safe_for_script(data_js)}\n</script>\n<script>\n{safe_for_script(js)}\n</script>"
    )
    html = html[: m.start()] + scripts + html[m.end():]
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    return out


def main():
    here = Path(__file__).resolve()
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--root", type=Path, default=here.parents[2], help="katalog główny strony")
    parser.add_argument("--out", type=Path, default=None, help="plik wynikowy (domyślnie dist/lofoty.html)")
    args = parser.parse_args()
    root = args.root.resolve()
    out = (args.out or root / "dist" / "lofoty.html").resolve()
    try:
        path = build(root, out)
    except BundleError as e:
        print(f"Błąd: {e}", file=sys.stderr)
        sys.exit(1)
    print(f"Zapisano {path} ({path.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
