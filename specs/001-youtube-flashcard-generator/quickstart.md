# Quickstart: YouTube Japanese Flashcard Generator

**Date**: 2026-06-18

This guide documents how to validate the feature end-to-end once implemented. It describes runnable validation scenarios, not implementation steps.

## Prerequisites

- A Claude Code session with the YouTube MCP tool available
- A desktop web browser (Chrome, Firefox, Safari, or Edge)
- A valid YouTube URL with Japanese captions (manual or auto-generated)
- Internet connection

## Quick Validation (End-to-End Smoke Test)

### 1. Submit a YouTube URL

**Action**: Invoke the top-level skill/command that starts the pipeline with a known-good YouTube URL containing Japanese captions.

**Expected Outcome**:
- System accepts the URL
- Validates it as a valid YouTube URL
- Begins transcript extraction

### 2. Verify Transcript Extraction

**Action**: Observe the transcript output (intermediate checkpoint).

**Expected Outcome**:
- A `TranscriptBundle` is produced containing:
  - Video metadata (URL, video ID, title)
  - Array of transcript segments, each with:
    - Japanese text content
    - Start and end timestamps (in seconds)
    - Segment index
  - Caption source indicated (manual or auto-generated)

**Validation**: Open the YouTube video manually at a random timestamp. Verify the transcript text at that segment matches what is spoken/heard.

### 3. Verify Vocabulary Extraction

**Action**: Observe the vocabulary output (intermediate checkpoint).

**Expected Outcome**:
- A `VocabularyList` is produced containing unique vocabulary items
- Each item has: word, reading (kana), meaning (English), part of speech, JLPT level (N5/N4/N3 only)
- Correct deduplication (each word appears once with occurrence count)
- Timestamps link back to the source transcript
- No N2/N1 vocabulary, no proper nouns, no single-kana particles

**Validation**: Pick 5 vocabulary items at random. For each:
1. Verify the reading is correct hiragana
2. Verify the meaning is a reasonable English gloss
3. Verify the JLPT level matches official JLPT vocabulary lists
4. Click/check the timestamp — confirm the word appears at that point in the video

### 4. Verify Flashcard Generation

**Action**: Observe the flashcard JSON output.

**Expected Outcome**:
- A `FlashcardDeck` JSON file is produced containing:
  - `meta` with video info, generation timestamp, card count, JLPT breakdown
  - `cards` array where each card has:
    - ID (`card-001`, `card-002`, ...)
    - `front`: Japanese word only
    - `back`: reading, meaning, part of speech, JLPT level, occurrence count
    - `youtube_link`: valid deep link with timestamp
    - `secondary_links`: additional occurrence links (if applicable)

**Validation**:
- Parse the JSON — no syntax errors
- `meta.total_cards` matches `cards.length`
- `meta.jlpt_breakdown.N5 + N4 + N3` equals `meta.total_cards`
- Every `youtube_link` opens the YouTube video at a valid timestamp
- Card IDs are sequential and unique

### 5. Verify UI

**Action**: Open the flashcard viewer UI and load the generated flashcard JSON (or use sample data at `ui/sample-data/sample-deck.json`).

**Expected Outcome**:
- All flashcards render in a browsable deck
- Card flip/expand reveals back content (reading, meaning, part of speech, JLPT level)
- Clicking a timestamp link opens the YouTube video at the correct position
- JLPT filter: selecting N5 shows only N5 cards; selecting All restores full deck
- JLPT sort: sorting ascending orders N5 → N4 → N3
- Review counter shows progress (e.g., "3 of 25 reviewed")

**Validation**: Manually walk through:
1. Browse 5 cards and flip each — all back content present
2. Click a timestamp link — video opens at correct time (±1 second)
3. Filter to N5 — count matches `meta.jlpt_breakdown.N5`
4. Sort ascending — first card is N5, last is N3
5. Clear filter — all cards restored

## Edge Case Validation

| Edge Case | How to Test | Expected Behavior |
|-----------|------------|-------------------|
| Invalid URL | Submit `not-a-url` or `https://google.com` | Clear error: "not a valid YouTube link" |
| Video with no captions | Find a YouTube video known to have zero captions | Clear error: "no captions available" |
| Video with non-Japanese captions only | YouTube video with only English captions | Clear error: "Japanese subtitles not available" |
| Very short transcript (<10 segments) | YouTube Short with Japanese captions | Vocabulary still extracted; low-coverage warning shown |
| Long transcript (2,000+ segments) | 1+ hour Japanese lecture/podcast | Processing completes without crash; performance within NFR limits |
| Auto-generated captions | Video with only auto-generated Japanese CC | Extracted with `caption_type: auto_generated`; vocabulary may be less accurate |
| Duplicate words | Video where same word appears 10+ times | One card with occurrence_count = 10, multiple timestamps |
| No N5–N3 vocabulary | Video with only advanced Japanese (e.g., technical/academic) | Empty result with message: "No JLPT N5–N3 vocabulary found" |
| Deleted/private video | Submit URL of a recently deleted YouTube video | Clear error: "video could not be accessed" |

## Performance Validation

- **SC-001**: Time the full pipeline (URL submit → flashcards ready). For a 15-minute video, should complete in under 2 minutes.
- **SC-005**: With 100 flashcards loaded, test filter toggle and sort — UI updates in under 1 second.
- **NFR-005**: Process a video with 2,000 transcript segments — no crash or hang.
