#!/usr/bin/env python3
"""Extract candidate Japanese content words from compressed transcript, filter noise."""
import json, sys, re

# Unicode ranges for Japanese
HIRAGANA = set(range(0x3040, 0x30A0))
KATAKANA = set(range(0x30A0, 0x3100))
KANJI = set(range(0x4E00, 0x9FFF))
CJK = HIRAGANA | KATAKANA | KANJI

def has_japanese(text: str) -> bool:
    return any(ord(c) in CJK for c in text)

def extract_japanese_words(text: str) -> list[str]:
    """Extract Japanese word tokens from text, keeping only CJK sequences."""
    # Split on non-CJK boundaries to extract Japanese word sequences
    tokens = []
    current = []
    for c in text:
        if ord(c) in CJK:
            current.append(c)
        else:
            if current:
                word = ''.join(current)
                if len(word) >= 1:  # accept single kana too, filter later
                    tokens.append(word)
                current = []
    if current:
        tokens.append(''.join(current))
    return tokens

for vid in ["ltflhuS4Zr4", "enTYTbE8HKs", "dwlafs0odbQ"]:
    with open(f"/tmp/compressed-{vid}.json") as f:
        data = json.load(f)

    # Count word frequencies across all segments
    word_freq = {}  # word -> {count, timestamps[], contexts[]}
    jp_segments = 0
    total_segments = 0

    for seg in data["compressed_segments"]:
        total_segments += 1
        text = seg["text"]
        if not has_japanese(text):
            continue
        jp_segments += 1
        words = extract_japanese_words(text)
        for w in words:
            # Filter very short single hiragana (particles)
            if len(w) == 1 and ord(w[0]) in HIRAGANA:
                # Keep only content-worthy single kana, skip particles
                if w in 'はがをにへでともかやよねわの':
                    continue
            if w not in word_freq:
                word_freq[w] = {"count": 0, "timestamps": [], "contexts": []}
            word_freq[w]["count"] += seg["occurrence_count"]
            word_freq[w]["timestamps"].extend(seg["timestamps"])
            if len(word_freq[w]["contexts"]) < 3:
                word_freq[w]["contexts"].append(text)

    # Sort by frequency, take top 250
    sorted_words = sorted(word_freq.items(), key=lambda x: x[1]["count"], reverse=True)

    # Build candidate list for the agent
    candidates = []
    for word, info in sorted_words[:250]:
        candidates.append({
            "word": word,
            "occurrence_count": info["count"],
            "contexts": info["contexts"][:2]  # first 2 context snippets
        })

    out_path = f"/tmp/candidates-{vid}.json"
    output = {
        "video": data["video"],
        "stats": {
            "total_unique_segments": total_segments,
            "japanese_segments": jp_segments,
            "unique_japanese_words_found": len(word_freq),
            "top_candidates": len(candidates)
        },
        "candidates": candidates
    }
    with open(out_path, 'w') as f:
        json.dump(output, f, ensure_ascii=False)
    print(f"{vid}: {jp_segments}/{total_segments} JP segs, {len(word_freq)} unique words, top {len(candidates)} candidates → {out_path}")
    # Show top 20
    for w, info in sorted_words[:20]:
        print(f"  {w} ({info['count']}x)")
