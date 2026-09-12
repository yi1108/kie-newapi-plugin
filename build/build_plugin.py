#!/usr/bin/env python3
"""Inject the KIE product-group catalog into plugin.template.js."""
import json
import os
import pathlib
import re
import sys

VERSION = "1.2.4"
ROOT = pathlib.Path(__file__).resolve().parent.parent
CATALOG_JSON = ROOT / "build" / "product-groups.json"
TEMPLATE = ROOT / "build" / "plugin.template.js"
OUT = ROOT / "plugins" / "tasks" / "kie" / VERSION / "plugin.js"

MODEL_RE = re.compile(r"^[a-z0-9][a-z0-9._/-]*$")


def js_array(values, indent):
    if not values:
        return "[]"
    pad = " " * indent
    return "[\n" + "".join(f'{pad}  "{v}",\n' for v in values) + pad + "]"


def js_object(values, indent):
    if not values:
        return "{}"
    pad = " " * indent
    lines = ["{"]
    for key in sorted(values):
        lines.append(f'{pad}  {json.dumps(key)}: {json.dumps(values[key])},')
    lines.append(pad + "}")
    return "\n".join(lines)


def main():
    catalog = json.loads(CATALOG_JSON.read_text(encoding="utf-8"))
    generation = [
        product
        for product in catalog.get("products", [])
        if product.get("kind") == "generation" and product.get("status") == "available"
    ]

    seen = set()
    duplicates = set()
    for product in generation:
        model = product["id"]
        if model in seen:
            duplicates.add(model)
        else:
            seen.add(model)
    if duplicates:
        sys.exit(f"duplicate model ids: {sorted(duplicates)}")
    invalid = sorted(product["id"] for product in generation if not MODEL_RE.match(product["id"]))
    if invalid:
        sys.exit(f"invalid model ids: {invalid}")

    upstream_models = [product["upstreamModel"] for product in generation]
    invalid_upstream = sorted(model for model in upstream_models if not MODEL_RE.match(model))
    if invalid_upstream:
        sys.exit(f"invalid upstream model ids: {invalid_upstream}")
    missing_category = sorted(
        product["id"] for product in generation if product["category"] not in {"image", "video", "audio"}
    )
    if missing_category:
        sys.exit(f"unsupported product categories: {missing_category}")

    ordered = sorted(product["id"] for product in generation)
    upstream_by_product = {product["id"]: product["upstreamModel"] for product in generation}
    upstream_by_category = {
        category: sorted(
            product["upstreamModel"]
            for product in generation
            if product["category"] == category
        )
        for category in ("image", "audio", "utility")
    }
    image_product_models = sorted(
        product["id"]
        for product in generation
        if product["category"] == "image"
    )
    # Current production New API builds validate task protocol names and do
    # not yet recognize openai_images. Keep the implementation available, but
    # leave it out of meta until backend support is deployed.
    optional_image_protocol = ""
    if os.environ.get("KIE_ENABLE_IMAGES_PROTOCOL") == "1":
        optional_image_protocol = (
            '    { name: "openai_images", models: '
            + js_array(image_product_models, 2).replace("\n", "\n    ")
            + " },"
        )
    block = (
        "const PRODUCT_UPSTREAM_MODELS = "
        + js_object(upstream_by_product, 2)
        + ";\n"
        + "const IMAGE_MODELS = new Set("
        + js_array(upstream_by_category["image"], 2)
        + ");\n"
        + "const AUDIO_MODELS = new Set("
        + js_array(upstream_by_category["audio"], 2)
        + ");\n"
        + "const UTILITY_MODELS = new Set("
        + js_array(upstream_by_category["utility"], 2)
        + ");\n"
        + "const IMAGE_PRODUCT_MODELS = new Set("
        + js_array(image_product_models, 2)
        + ");"
    )

    template = TEMPLATE.read_text(encoding="utf-8")
    rendered = (
        template.replace("__VERSION__", VERSION)
        .replace("__MODEL_LIST__", js_array(ordered, 2))
        .replace("__IMAGE_PRODUCT_MODEL_LIST__", js_array(image_product_models, 2))
        .replace("__OPTIONAL_IMAGE_PROTOCOL__", optional_image_protocol)
        .replace("__MODEL_BLOCK__", block)
    )
    if "__MODEL" in rendered:
        sys.exit("unreplaced placeholder remains in template")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8", newline="\n") as file:
        file.write(rendered)
    print(f"wrote {OUT.relative_to(ROOT)} ({len(ordered)} available generation product groups)")


if __name__ == "__main__":
    main()
