#!/usr/bin/env python3
"""
Generate FlashcardDeck JSON from vocabulary extraction + original timestamps.
Steps:
1. Read vocabulary JSON (agent output)
2. Read compressed transcript (with timestamps)
3. Match each vocab word to transcript segments
4. Fill in real timestamps and context snippets
5. Build FlashcardDeck matching the contract schema
6. Write output/flashcards-{video_id}.json
"""
import json, sys, re, os
from datetime import datetime, timezone

OUTPUT_DIR = "output"

# Agent outputs are inline in the Claude conversation.
# We'll read them from temp files written after extraction.

# ---- Helper: match a word to transcript text ----
def find_occurrences(word: str, compressed_segments: list[dict]) -> list[dict]:
    """Find segments where `word` appears in the text.
    Returns list of {timestamp, context_text} for each occurrence."""
    results = []
    for seg in compressed_segments:
        text = seg["text"]
        if word in text:
            for ts in seg["timestamps"]:
                results.append({
                    "timestamp": ts,
                    "context": text
                })
    return results

def build_flashcard_deck(vocab_data: dict, compressed_path: str) -> dict:
    """Build a complete FlashcardDeck from vocabulary + transcript."""

    # Load compressed transcript for timestamp matching
    with open(compressed_path) as f:
        compressed = json.load(f)

    video_id = vocab_data["video_id"]
    video_title = vocab_data["video_title"]
    vocab_items = vocab_data["vocabulary"]

    cards = []
    jlpt_counts = {"N5": 0, "N4": 0, "N3": 0, "N/A": 0}

    for i, item in enumerate(vocab_items):
        word = item["word"]
        # Find occurrences in transcript
        occs = find_occurrences(word, compressed.get("compressed_segments", []))
        # Also try reading match
        if not occs and item.get("reading"):
            occs = find_occurrences(item["reading"], compressed.get("compressed_segments", []))

        timestamps = sorted([o["timestamp"] for o in occs])
        # Fall back to placeholder if we didn't have enough context in the prompt
        if not timestamps:
            timestamps = [0.0]

        primary_ts = int(timestamps[0])
        context = occs[0]["context"] if occs else (item.get("context_snippets", [""])[0] if item.get("context_snippets") else "")

        jlpt = item.get("jlpt_level", "N/A")
        if jlpt in jlpt_counts:
            jlpt_counts[jlpt] += 1
        else:
            jlpt_counts["N/A"] += 1

        card_id = f"card-{i+1:03d}"

        card = {
            "id": card_id,
            "front": word,
            "back": {
                "reading": item.get("reading", ""),
                "meaning": item.get("meaning", ""),
                "part_of_speech": item.get("part_of_speech", "unknown"),
                "jlpt_level": jlpt,
                "occurrence_count": item.get("occurrence_count", len(timestamps))
            },
            "jlpt_level": jlpt,
            "youtube_link": f"https://www.youtube.com/watch?v={video_id}&t={primary_ts}s",
            "secondary_links": [
                f"https://www.youtube.com/watch?v={video_id}&t={int(ts)}s"
                for ts in timestamps[1:8]  # cap at 7 extra links
            ],
            "context_snippet": context[:200] if context else ""
        }
        cards.append(card)

    # Build JLPT breakdown (only include non-zero)
    breakdown = {k: v for k, v in jlpt_counts.items() if v > 0}

    deck = {
        "meta": {
            "video_id": video_id,
            "video_title": video_title,
            "youtube_url": f"https://www.youtube.com/watch?v={video_id}",
            "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "total_cards": len(cards),
            "jlpt_breakdown": breakdown
        },
        "cards": cards
    }

    return deck

# ---- Main ----
if __name__ == "__main__":
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Process each vocabulary file
    for vocab_path in sys.argv[1:]:
        with open(vocab_path) as f:
            vocab_data = json.load(f)

        video_id = vocab_data["video_id"]
        compressed_path = f"/tmp/compressed-{video_id}.json"

        if not os.path.exists(compressed_path):
            print(f"WARNING: No compressed transcript for {video_id}, using placeholder timestamps")
            deck = build_flashcard_deck_no_transcript(vocab_data)
        else:
            deck = build_flashcard_deck(vocab_data, compressed_path)

        out_path = os.path.join(OUTPUT_DIR, f"flashcards-{video_id}.json")
        with open(out_path, 'w') as f:
            json.dump(deck, f, ensure_ascii=False, indent=2)

        breakdown_str = ", ".join(f"{k}:{v}" for k, v in deck["meta"]["jlpt_breakdown"].items())
        print(f"{video_id}: {deck['meta']['total_cards']} cards ({breakdown_str}) → {out_path}")
        # Show first 5 cards
        for c in deck["cards"][:5]:
            print(f"  {c['id']}: {c['front']} [{c['jlpt_level']}] — {c['back']['meaning']}")
