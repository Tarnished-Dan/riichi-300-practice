#!/usr/bin/env python3
"""Extract the user-provided 301 book without OCR or lossy PDF rendering.

Questions and answers use recognizable Q / A badge layouts. The question
number comes from their verified source order, cross-checked against chapter
headings. Chinese prose is associated by document position (including page
breaks), not by the page number alone.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path

import numpy as np
import pdfplumber
from PIL import Image
from pypdf import PdfReader


def question_badges(image: Image.Image) -> list[tuple[int, int]]:
    pixels = np.asarray(image.convert("RGB"))
    # The black question number box occupies the first 95 source pixels.
    dark = pixels[:, : min(95, image.width)].mean(axis=2) < 90
    rows = np.flatnonzero(dark.sum(axis=1) > 30)
    groups = np.split(rows, np.flatnonzero(np.diff(rows) > 1) + 1)
    return [(int(g[0]), int(g[-1])) for g in groups if 20 <= len(g) <= 45]


def is_answer_image(image: Image.Image) -> bool:
    pixels = np.asarray(image.convert("RGB")).astype(float)
    r, g, b = pixels[:, :, 0], pixels[:, :, 1], pixels[:, :, 2]
    pink = (r > 110) & (g < 120) & (b > 70) & (r > g * 1.5)
    # A badges are magenta rectangles in the upper right.
    return pink[: min(40, image.height), int(image.width * 0.7) :].sum() > 300


def crop_question(
    image: Image.Image, badges: list[tuple[int, int]], position: int
) -> tuple[Image.Image, list[int]]:
    y0 = max(0, badges[position][0] - 4)
    y1 = badges[position + 1][0] - 4 if position + 1 < len(badges) else image.height
    band = image.crop((0, y0, image.width, y1)).convert("RGB")
    ink = np.asarray(band).min(axis=2) < 215
    ys, xs = np.where(ink)
    box = [
        max(0, int(xs.min()) - 3),
        y0,
        min(image.width, int(xs.max()) + 4),
        min(y1, y0 + int(ys.max()) + 4),
    ]
    return image.crop(tuple(box)), box


def source_location(page_number: int, geometry: dict) -> dict:
    return {
        "page": page_number,
        "pdfRect": [geometry[k] for k in ("x0", "top", "x1", "bottom")],
    }


def extract(pdf: Path, output: Path, asset_dir: Path, limit_pages: int | None) -> dict:
    reader = PdfReader(pdf)
    document = pdfplumber.open(pdf)
    asset_dir.mkdir(parents=True, exist_ok=True)
    records: dict[int, dict] = {}
    current_answer: int | None = None
    next_question = 1
    next_answer = 1
    source_images = []
    heading_checks = []
    current_section = None

    def record(number: int) -> dict:
        return records.setdefault(
            number,
            {"id": number, "question": None, "answer": None, "explanation": []},
        )

    def write_image(image: Image.Image, name: str) -> str:
        target = asset_dir / name
        image.save(target)
        return target.as_posix()

    for page_index, page in enumerate(document.pages):
        page_number = page_index + 1
        if limit_pages and page_number > limit_pages:
            break
        if page_number <= 4:
            continue  # Foreword and usage example are not numbered exercises.
        extracted = {item.name.rsplit(".", 1)[0]: item for item in reader.pages[page_index].images}
        events = []
        for line in page.extract_text_lines(return_chars=False):
            events.append((line["top"], 1, "text", line))
        for geometry in page.images:
            events.append((geometry["top"], 0, "image", geometry))
        for _top, _order, kind, payload in sorted(events, key=lambda e: (e[0], e[1])):
            if kind == "text":
                text = payload["text"].strip()
                if not text or text == "本文禁止转载或摘编":
                    continue
                # Every numbered article heading starts a new source section.
                if re.match(r"^\d{2}\s", text):
                    current_answer = None
                    current_section = text
                    answer_range = re.search(r"(\d{3})-(\d{3})解答", text)
                    question_range = re.search(r"(\d{3})-(\d{3})问", text)
                    for label, match, next_id in (
                        ("answer", answer_range, next_answer),
                        ("question", question_range, next_question),
                    ):
                        if match:
                            expected = int(match[1])
                            heading_checks.append(
                                {"page": page_number, "kind": label, "expected": expected, "actual": next_id}
                            )
                            assert expected == next_id, (
                                f"Page {page_number}: {label} expected {expected}, got {next_id}"
                            )
                    continue
                if current_answer:
                    record(current_answer)["explanation"].append(
                        {"type": "text", "text": text, "page": page_number, "top": payload["top"]}
                    )
                continue

            geometry = payload
            item = extracted[geometry["name"]]
            image = item.image.convert("RGB")
            source = source_location(page_number, geometry)
            source["imageName"] = item.name
            source["imageSize"] = list(image.size)
            if is_answer_image(image):
                number = next_answer
                next_answer += 1
                current_answer = number
                path = write_image(image, f"answer-{number:03d}.png")
                record(number)["answer"] = {"image": path, **source}
                record(number)["section"] = current_section
                source_images.append({"kind": "answer", "id": number, **source})
            else:
                badges = question_badges(image)
                if badges:
                    current_answer = None
                    for position in range(len(badges)):
                        number = next_question
                        next_question += 1
                        cropped, crop_box = crop_question(image, badges, position)
                        path = write_image(cropped, f"question-{number:03d}.png")
                        record(number)["question"] = {"image": path, "cropRect": crop_box, **source}
                        source_images.append({"kind": "question", "id": number, "cropRect": crop_box, **source})
                elif current_answer:
                    entry = record(current_answer)
                    figure_number = sum(part["type"] == "image" for part in entry["explanation"]) + 1
                    path = write_image(image, f"figure-{current_answer:03d}-{figure_number}.png")
                    entry["explanation"].append({"type": "image", "image": path, **source})

    if not limit_pages:
        assert next_question == 302, f"Expected 301 questions, got {next_question-1}"
        assert next_answer == 302, f"Expected 301 answers, got {next_answer-1}"
        assert all(item["question"] and item["answer"] for item in records.values())
        assert all(any(part["type"] == "text" for part in item["explanation"]) for item in records.values())
    # Join line wrapping into text paragraphs while preserving inserted figures.
    for item in records.values():
        parts = []
        for part in item["explanation"]:
            if part["type"] == "text" and parts and parts[-1]["type"] == "text":
                previous = parts[-1]
                previous["text"] += part["text"]
                previous["pages"] = sorted(set(previous["pages"] + [part["page"]]))
            elif part["type"] == "text":
                parts.append({"type": "text", "text": part["text"], "pages": [part["page"]]})
            else:
                parts.append(part)
        item["explanation"] = parts

    result = {
        "source": {
            "file": pdf.name,
            "sha256": hashlib.sha256(pdf.read_bytes()).hexdigest(),
            "pages": len(document.pages),
            "book": "301问（与何切300.pdf并非同一本书）",
        },
        "counts": {
            "questions": next_question - 1,
            "answers": next_answer - 1,
            "records": len(records),
            "figures": sum(p["type"] == "image" for r in records.values() for p in r["explanation"]),
        },
        "headingChecks": heading_checks,
        "questions": list(records.values()),
        "sourceImages": source_images,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    document.close()
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", type=Path, default=Path("何切301.pdf"))
    parser.add_argument("--output", type=Path, default=Path("tmp/pdfs/chinese-structure.json"))
    parser.add_argument("--assets", type=Path, default=Path("public/assets/source301"))
    parser.add_argument("--limit-pages", type=int)
    options = parser.parse_args()
    result = extract(options.pdf, options.output, options.assets, options.limit_pages)
    print(json.dumps({"output": str(options.output), **result["counts"]}, ensure_ascii=False))
