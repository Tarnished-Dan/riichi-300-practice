#!/usr/bin/env python3
"""Crop all 300 exercises from the user's original Japanese source PDF.

Source JPEGs are extracted directly, at their original 1089 x 1600 size.
Q and A badges locate each exercise. Printed horizontal separators give
independent answer boundaries; all 100 spreads are checked before exporting.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image
from pypdf import PdfReader

GROUP_START_PAGES = [12, 34, 56, 78, 98, 120, 142, 164, 184, 206]


def spans(rows: np.ndarray) -> list[np.ndarray]:
    return [group for group in np.split(rows, np.flatnonzero(np.diff(rows) > 1) + 1) if len(group)]


def question_badges(pixels: np.ndarray) -> list[int]:
    dark = pixels.mean(axis=2) < 100
    groups = spans(np.flatnonzero(dark[:, 120:273].sum(axis=1) > 60))
    return [int(group[0]) for group in groups if 35 < len(group) < 80]


def answer_badges(pixels: np.ndarray) -> list[int]:
    p = pixels.astype(float)
    red, green, blue = p[:, :, 0], p[:, :, 1], p[:, :, 2]
    pink = (red > 100) & (green < 120) & (blue > 60) & (red > green * 1.4)
    groups = spans(np.flatnonzero(pink[:, 800:980].sum(axis=1) > 60))
    return [int(group[0]) for group in groups if 35 < len(group) < 80]


def answer_separators(pixels: np.ndarray) -> list[int]:
    dark = pixels.mean(axis=2) < 150
    groups = spans(np.flatnonzero(dark[:, 115:980].sum(axis=1) > 800))
    return [int(group[0]) for group in groups]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", type=Path, default=Path("何切300.pdf"))
    parser.add_argument("--output", type=Path, default=Path("tmp/pdfs/original-structure.json"))
    parser.add_argument("--raw", type=Path, default=Path("tmp/pdfs/original-assets"))
    parser.add_argument("--pages", type=Path, default=Path("tmp/pdfs/original-pages"))
    parser.add_argument("--web", type=Path, default=Path("dist/assets"))
    args = parser.parse_args()
    for directory in (args.raw, args.pages, args.web / "questions", args.web / "answers"):
        directory.mkdir(parents=True, exist_ok=True)
    reader = PdfReader(args.pdf)
    results = []
    page_checks = []
    for group_number, first_page in enumerate(GROUP_START_PAGES):
        for group_offset in range(0, 30, 3):
            question_page = first_page + 2 * (group_offset // 3)
            answer_page = question_page + 1
            q_object = reader.pages[question_page - 1].images[0]
            a_object = reader.pages[answer_page - 1].images[0]
            question_image = q_object.image.convert("RGB")
            answer_image = a_object.image.convert("RGB")
            assert question_image.size == answer_image.size == (1089, 1600)
            q_pixels, a_pixels = np.asarray(question_image), np.asarray(answer_image)
            q_badges = question_badges(q_pixels)
            a_badges = answer_badges(a_pixels)
            separators = answer_separators(a_pixels)
            assert len(q_badges) == 3, (question_page, q_badges)
            assert len(a_badges) == 3, (answer_page, a_badges)
            assert len(separators) == 2, (answer_page, separators)
            assert a_badges[0] < separators[0] < a_badges[1] < separators[1] < a_badges[2]
            q_page_path = args.pages / f"question-page{question_page:03d}.jpg"
            a_page_path = args.pages / f"answer-page{answer_page:03d}.jpg"
            q_page_path.write_bytes(q_object.data)
            a_page_path.write_bytes(a_object.data)
            page_checks.append(
                {
                    "questionPage": question_page,
                    "answerPage": answer_page,
                    "questionBadgeTops": q_badges,
                    "answerBadgeTops": a_badges,
                    "answerSeparators": separators,
                }
            )
            for slot in range(3):
                number = group_number * 30 + group_offset + slot + 1
                # Right edge 997 also retains open melds (e.g. Q151).
                q_rect = [112, q_badges[slot] - 8, 997, q_badges[slot] + 242]
                a_top = a_badges[slot] - 8
                if slot < 2:
                    a_bottom = separators[slot] - 6
                else:
                    # Exclude printed page number at y1530; trim trailing blank.
                    region = a_pixels[a_top:1495, 112:990]
                    ink_rows = np.flatnonzero((region.min(axis=2) < 180).sum(axis=1) > 2)
                    a_bottom = a_top + int(ink_rows[-1]) + 8
                a_rect = [112, a_top, 990, a_bottom]
                q_crop = question_image.crop(tuple(q_rect))
                a_crop = answer_image.crop(tuple(a_rect))
                q_png = args.raw / f"question-{number:03d}.png"
                a_png = args.raw / f"answer-{number:03d}.png"
                q_webp = args.web / "questions" / f"{number:03d}.webp"
                a_webp = args.web / "answers" / f"{number:03d}.webp"
                q_crop.save(q_png)
                a_crop.save(a_png)
                # Preserve small printed characters and tile artwork losslessly.
                q_crop.save(q_webp, "WEBP", lossless=True, method=4)
                a_crop.save(a_webp, "WEBP", lossless=True, method=4)
                results.append(
                    {
                        "id": number,
                        "sourcePage": question_page,
                        "answerPage": answer_page,
                        "sourcePrintedPage": question_page - 5,
                        "answerPrintedPage": answer_page - 5,
                        "questionImage": f"assets/questions/{number:03d}.webp",
                        "answerImages": [f"assets/answers/{number:03d}.webp"],
                        "questionPng": q_png.as_posix(),
                        "answerPng": a_png.as_posix(),
                        "questionPageImage": q_page_path.as_posix(),
                        "answerPageImage": a_page_path.as_posix(),
                        "questionCropRect": q_rect,
                        "answerCropRect": a_rect,
                        "questionBadgeTop": q_badges[slot],
                        "answerBadgeTop": a_badges[slot],
                    }
                )
    assert [item["id"] for item in results] == list(range(1, 301))
    output = {
        "source": {
            "file": args.pdf.name,
            "sha256": hashlib.sha256(args.pdf.read_bytes()).hexdigest(),
            "pageCount": len(reader.pages),
            "questionCount": 300,
            "nativeImageSize": [1089, 1600],
            "note": "严格采用日文何切300；何切301.pdf是另一本书，未混用。",
        },
        "questions": results,
        "pageChecks": page_checks,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"output": str(args.output), "questions": len(results), "verifiedSpreads": len(page_checks)}))


if __name__ == "__main__":
    main()
