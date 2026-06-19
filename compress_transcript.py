#!/usr/bin/env python3
"""Compress transcript by text-deduplication while preserving occurrence counts & timestamps."""
import json, sys

for vid in ["ltflhuS4Zr4", "enTYTbE8HKs", "dwlafs0odbQ"]:
    with open(f"/tmp/transcript-{vid}.json") as f:
        bundle = json.load(f)

    # Group segments by normalized text (strip, lowercase for matching)
    text_map = {}
    for seg in bundle["segments"]:
        key = seg["text"].strip()
        if not key:
            continue
        if key not in text_map:
            text_map[key] = {
                "text": seg["text"].strip(),
                "count": 0,
                "timestamps": [],
                "first_index": seg["segment_index"]
            }
        text_map[key]["count"] += 1
        text_map[key]["timestamps"].append(seg["start_time"])

    # Build compressed version
    compressed = {
        "video": bundle["video"],
        "total_segments": len(bundle["segments"]),
        "unique_texts": len(text_map),
        "compressed_segments": sorted(
            [{"text": v["text"], "occurrence_count": v["count"],
              "timestamps": v["timestamps"], "first_segment_index": v["first_index"]}
             for v in text_map.values()],
            key=lambda x: x["first_segment_index"]
        )
    }

    out_path = f"/tmp/compressed-{vid}.json"
    with open(out_path, 'w') as f:
        json.dump(compressed, f, ensure_ascii=False)
    print(f"{vid}: {bundle['video']['title'][:60]} | {len(bundle['segments'])} seg → {len(text_map)} unique | {out_path}")
