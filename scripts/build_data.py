#!/usr/bin/env python3
"""Merge visually checked tile data, source coordinates and Chinese translations."""
import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("--preview", action="store_true")
args = parser.parse_args()
load = lambda p: json.loads((ROOT / p).read_text())
source = load("data/source-structure.json")
tiles = {q["id"]: q for q in load("data/tile-data.json")}
ocr = {q["id"]: q for q in load("data/question-contexts.json")["questions"]}
translations = {}
for path in sorted((ROOT / "data").glob("translations-*.json")):
    for q in json.loads(path.read_text()):
        assert q["id"] not in translations, f"重复译文 {q['id']}"
        translations[q["id"]] = q["explanation"].replace("一盃口", "一杯口")
if not args.preview:
    assert set(translations) == set(range(1, 301)), f"译文缺失：{set(range(1, 301)) - set(translations)}"
questions = []
for s in source["questions"]:
    i = s["id"]
    t = tiles[i]
    text = " ".join(ocr[i]["contextCandidates"])
    round_match = re.search(r"([東南西北])([1-4])局", text)
    seat_match = re.search(r"([東南西北])家", text)
    turn_match = re.search(r"(\d+)巡", text)
    assert round_match and turn_match, (i, text)
    assert seat_match or i == 297, (i, text)
    chinese = lambda v: v.replace("東", "东")
    q = {
        "id": i,
        "round": chinese(round_match.group(0)),
        "seat": chinese(seat_match.group(0)) if seat_match else "西家",
        "turn": turn_match.group(1) + "巡",
        "dora": t["dora"],
        "tiles": t["tiles"],
        "answer": t["answer"],
        "action": "ankan" if i == 132 else "discard",
        "explanation": translations.get(i, ""),
        "questionImage": s["questionImage"],
        "answerImages": s["answerImages"],
        "sourcePage": s["sourcePage"],
        "answerPage": s["answerPage"],
    }
    if 151 <= i <= 161:
        q["condition"] = "和牌即一位"
    if i == 63:
        q["acceptedAnswers"] = ["8m", "6s"]
        q["answerNote"] = "原书同时明确认可切六索；主要推荐为切八万。"
    if t.get("meldImage"):
        q["meldImage"] = t["meldImage"]
    assert q["answer"] in q["tiles"], (i, q["answer"])
    assert len(q["tiles"]) in (5, 8, 11, 14), i
    for image in [q["questionImage"], *q["answerImages"], *([q["meldImage"]] if q.get("meldImage") else [])]:
        assert (ROOT / "dist" / image).is_file(), image
    questions.append(q)
assert [q["id"] for q in questions] == list(range(1, 301))
meta = {
    "title": "何切练习室",
    "source": "《麻雀 傑作「何切る」300選》",
    "sourceCredit": "依据日文《麻雀 傑作「何切る」300選》原作 300 题翻译整理 · 作者 G・ウザク · 编者 福地诚",
    "language": "zh-CN",
    "sourceSha256": source["source"]["sha256"],
    "questionCount": 300,
    "translationNote": "本站简体中文译解，保留原书题面和答案以便核对。",
}
(ROOT / "data" / "questions.json").write_text(json.dumps({"meta": meta, "questions": questions}, ensure_ascii=False, indent=2))
(ROOT / "dist" / "data.js").write_text("window.MAHJONG_META = " + json.dumps(meta, ensure_ascii=False) + ";\nwindow.MAHJONG_DATA = " + json.dumps(questions, ensure_ascii=False) + ";\n")
print(f"300 题数据完整；中文解析 {len(translations)}/300；所有图片路径有效。")
