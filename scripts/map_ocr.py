#!/usr/bin/env python3
"""Associate local Vision line OCR with independently detected PDF crop bounds."""
import argparse
import json
import re
from pathlib import Path


def within_crop(lines, rect):
    x0, y0, x1, y1 = rect
    chosen = []
    for line in lines:
        b = line["pixelBoundingBox"]
        cx, cy = b["x"] + b["width"] / 2, b["y"] + b["height"] / 2
        if x0 <= cx < x1 and y0 <= cy < y1:
            item = dict(line)
            item["cropPixelBoundingBox"] = {
                **b,
                "x": b["x"] - x0,
                "y": b["y"] - y0,
            }
            chosen.append(item)
    return sorted(chosen, key=lambda line: (
        round(line["pixelBoundingBox"]["y"] / 8),
        line["pixelBoundingBox"]["x"],
    ))


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--structure", type=Path, default=Path("tmp/pdfs/original-structure.json"))
    p.add_argument("--ocr", type=Path, default=Path("tmp/pdfs/original-ocr.json"))
    p.add_argument("--output", type=Path, default=Path("tmp/pdfs/ocr-by-question.json"))
    args = p.parse_args()
    structure = json.loads(args.structure.read_text())
    ocr = json.loads(args.ocr.read_text())
    images = {str(Path(image["path"]).resolve()): image for image in ocr["images"]}
    errors = [image for image in ocr["images"] if image.get("error")]
    assert not errors, errors
    result = []
    for q in structure["questions"]:
        question = images[str(Path(q["questionPageImage"]).resolve())]
        answer = images[str(Path(q["answerPageImage"]).resolve())]
        q_lines = within_crop(question["results"], q["questionCropRect"])
        a_lines = within_crop(answer["results"], q["answerCropRect"])
        # Printed explanation prose begins below the recommendation and counts.
        prose = [line for line in a_lines if line["cropPixelBoundingBox"]["y"] >= 230]
        context = [
            line["text"] for line in q_lines
            if re.search(r"[東南西北].{0,4}局|[東南西北]家|巡", line["text"])
        ]
        result.append({
            "id": q["id"],
            "sourcePage": q["sourcePage"],
            "answerPage": q["answerPage"],
            "questionPng": q["questionPng"],
            "answerPng": q["answerPng"],
            "contextCandidates": context,
            "questionText": "\n".join(line["text"] for line in q_lines),
            "answerText": "\n".join(line["text"] for line in a_lines),
            "explanationText": "\n".join(line["text"] for line in prose),
            "questionLines": q_lines,
            "answerLines": a_lines,
        })
    assert len(result) == 300
    args.output.write_text(json.dumps({
        "source": structure["source"],
        "ocrNote": "Apple Vision OCR; inline tile graphics may be omitted or misrecognized. Verify against answerPng before translation.",
        "questions": result,
    }, ensure_ascii=False, indent=2) + "\n")
    missing = [q["id"] for q in result if not q["explanationText"]]
    print(json.dumps({"questions": len(result), "emptyExplanations": missing, "output": str(args.output)}))


if __name__ == "__main__":
    main()
