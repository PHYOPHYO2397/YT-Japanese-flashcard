# Data Model: YouTube Japanese Flashcard Generator

**Date**: 2026-06-18

## Entity Relationship Diagram

```
YouTubeVideo (1) ──→ (*) TranscriptSegment
YouTubeVideo (1) ──→ (*) VocabularyItem
VocabularyItem (1) ──→ (1) Flashcard
Flashcard (*) ──→ (1) FlashcardDeck
```

## Entities

### 1. YouTubeVideo

Represents the source YouTube video for the session.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string (URL) | Yes | Full YouTube video URL as submitted by user |
| `video_id` | string | Yes | Extracted YouTube video ID (e.g., `dQw4w9WgXcQ`) |
| `title` | string | Yes | Video title (from transcript metadata if available) |
| `has_captions` | boolean | Yes | Whether captions were available |
| `caption_type` | enum | Yes | `manual` or `auto_generated` |

**Validation**:
- `url` must match YouTube URL pattern (youtube.com/watch or youtu.be)
- `video_id` must be non-empty, extracted from URL

---

### 2. TranscriptSegment

A single subtitle/caption segment from the YouTube transcript.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | string | Yes | Japanese text content of this segment |
| `start_time` | number (seconds) | Yes | Start timestamp in seconds from video beginning |
| `end_time` | number (seconds) | Yes | End timestamp in seconds from video beginning |
| `segment_index` | integer | Yes | Zero-based position in the transcript sequence |
| `source` | enum | Yes | `manual` or `auto_generated` |

**Validation**:
- `start_time` must be < `end_time`
- `text` must be non-empty
- `segment_index` must be strictly increasing across the full transcript

**Aggregate**: TranscriptBundle = `{ video: YouTubeVideo, segments: TranscriptSegment[] }`

---

### 3. VocabularyItem

A unique Japanese word identified in the transcript, classified by JLPT level.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `word` | string | Yes | Japanese word as written in transcript (kanji/kana) |
| `reading` | string | Yes | Reading in hiragana (primary) or katakana |
| `meaning` | string | Yes | English meaning/gloss |
| `part_of_speech` | enum | Yes | One of: `noun`, `verb`, `adjective`, `adverb`, `particle`, `conjunction`, `expression`, `other` |
| `jlpt_level` | enum | Yes | `N5`, `N4`, or `N3` |
| `occurrence_count` | integer | Yes | Number of times this word appears in the transcript |
| `primary_timestamp` | number (seconds) | Yes | Start time of first occurrence in transcript |
| `secondary_timestamps` | number[] | No | Start times of subsequent occurrences (empty array if count=1) |
| `context_snippets` | string[] | No | Short transcript excerpts around each occurrence (for study context) |

**Validation**:
- `occurrence_count` must equal `1 + secondary_timestamps.length`
- `jlpt_level` must be one of `N5`, `N4`, `N3`
- `primary_timestamp` must correspond to a valid timestamp in the source transcript
- `word` must be non-empty and contain Japanese characters

**Aggregate**: VocabularyList = `VocabularyItem[]` (deduplicated, sorted by occurrence_count descending)

---

### 4. Flashcard

A single study card generated from one vocabulary item.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique card identifier (e.g., `card-001`) |
| `front` | string | Yes | Display content: Japanese word (written form) |
| `back` | object | Yes | Answer content (see FlashcardBack below) |
| `jlpt_level` | enum | Yes | `N5`, `N4`, `N3` (for filtering/sorting) |
| `youtube_link` | string (URL) | Yes | Deep link: `https://www.youtube.com/watch?v={video_id}&t={primary_timestamp}s` |
| `secondary_links` | string[] | No | Additional timestamp deep links |

**FlashcardBack**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reading` | string | Yes | Reading in kana |
| `meaning` | string | Yes | English meaning |
| `part_of_speech` | string | Yes | Part of speech |
| `jlpt_level` | string | Yes | JLPT level label |
| `occurrence_count` | integer | Yes | Times word appears in video |

**Validation**:
- `id` must be unique within the deck
- `youtube_link` must be a valid, clickable YouTube URL with timestamp parameter

**Aggregate**: FlashcardDeck = `{ video: YouTubeVideo, cards: Flashcard[], generated_at: ISO8601 string, total_cards: integer }`

---

## State Transitions

This is a stateless pipeline. There are no stateful entities that transition between states. Each session processes one URL through a linear flow:

```
[User Input URL] → [Transcript Extraction] → [Vocabulary Identification] → [Flashcard Generation] → [UI Display]
                        ↓                        ↓                             ↓
                   Error: No captions      Error: No vocab found         Error: Generation failure
```

All intermediate data is ephemeral (in-memory or temp files) and discarded after the session.
