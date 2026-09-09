#!/usr/bin/env python3
"""Inject the KIE model catalog into plugin.template.js and emit plugin.js.

Input : build/models.json  {image:[...], video:[...], audio:[...], utility:[...], chat:[...]}
Output: plugins/tasks/kie/1.0.0/plugin.js

The marketplace ships a single self-contained plugin.js, so the model lists are
inlined as generated Set literals. Chat models are NOT embedded: KIE exposes
them through synchronous chat endpoints that native new-api channels handle.
"""
import json
import pathlib
import re
import sys

VERSION = "1.0.1"
ROOT = pathlib.Path(__file__).resolve().parent.parent
MODELS_JSON = ROOT / "build" / "models.json"
TEMPLATE = ROOT / "build" / "plugin.template.js"
OUT = ROOT / "plugins" / "tasks" / "kie" / VERSION / "plugin.js"

MODEL_RE = re.compile(r"^[a-z0-9][a-z0-9._/-]*$")


def js_array(values, indent):
    if not values:
        return "[]"
    pad = " " * indent
    return "[\n" + "".join(f'{pad}  "{v}",\n' for v in values) + pad + "]"


def main():
    catalog = json.loads(MODELS_JSON.read_text(encoding="utf-8"))
    generation = (
        catalog.get("image", [])
        + catalog.get("video", [])
        + catalog.get("audio", [])
        + catalog.get("utility", [])
    )

    seen = set()
    duplicates = set()
    for model in generation:
        if model in seen:
            duplicates.add(model)
        else:
            seen.add(model)
    if duplicates:
        sys.exit(f"duplicate model ids: {sorted(duplicates)}")
    invalid = sorted(m for m in generation if not MODEL_RE.match(m))
    if invalid:
        sys.exit(f"invalid model ids: {invalid}")

    ordered = sorted(generation)
    block = (
        "const IMAGE_MODELS = new Set("
        + js_array(sorted(catalog.get("image", [])), 2)
        + ");\n"
        + "const AUDIO_MODELS = new Set("
        + js_array(sorted(catalog.get("audio", [])), 2)
        + ");\n"
        + "const UTILITY_MODELS = new Set("
        + js_array(sorted(catalog.get("utility", [])), 2)
        + ");"
    )

    template = TEMPLATE.read_text(encoding="utf-8")
    rendered = (
        template.replace("__MODEL_LIST__", js_array(ordered, 2))
        .replace("__MODEL_BLOCK__", block)
    )
    if "__MODEL" in rendered:
        sys.exit("unreplaced placeholder remains in template")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(rendered, encoding="utf-8", newline="\n")
    print(f"wrote {OUT.relative_to(ROOT)} ({len(ordered)} generation models)")


if __name__ == "__main__":
    main()
