# Contract: Flashcard Interface

**Layer boundary**: Skill Layer → UI Layer

**Direction**: The flashcard-generator skill produces a FlashcardDeck JSON consumed by the static browser UI.

## Input

A valid VocabularyList (see [vocabulary-contract.md](./vocabulary-contract.md)):
- `vocabulary` array of VocabularyItem objects
- `video_id` and `video_title` for link generation

## Output: FlashcardDeck

### Schema

```json
{
  "meta": {
    "video_id": "string",
    "video_title": "string",
    "youtube_url": "string (full YouTube watch URL)",
    "generated_at": "string (ISO 8601 timestamp)",
    "total_cards": "integer",
    "jlpt_breakdown": {
      "N5": "integer (count)",
      "N4": "integer (count)",
      "N3": "integer (count)"
    }
  },
  "cards": [
    {
      "id": "string (card-001, card-002, ...)",
      "front": "string (Japanese word)",
      "back": {
        "reading": "string (hiragana/katakana reading)",
        "meaning": "string (English meaning)",
        "part_of_speech": "string",
        "jlpt_level": "N5 | N4 | N3",
        "occurrence_count": "integer"
      },
      "jlpt_level": "N5 | N4 | N3",
      "youtube_link": "string (https://www.youtube.com/watch?v={video_id}&t={seconds}s)",
      "secondary_links": ["string", "..."],
      "context_snippet": "string (optional, first context excerpt)"
    }
  ]
}
```

### Link Format

YouTube timestamp deep links follow this format:
```
https://www.youtube.com/watch?v={video_id}&t={seconds}s
```
Where `{seconds}` is the integer floor of `primary_timestamp`.

### Contract Rules

1. **Card IDs**: Sequential, zero-padded: `card-001`, `card-002`, ..., `card-NNN`. Matches array index for easy lookup.
2. **Front content**: Only the Japanese word (written form). No furigana, no reading, no meaning.
3. **Back content**: All four fields populated (reading, meaning, part_of_speech, jlpt_level).
4. **Sort order**: Cards follow the VocabularyList ordering (most frequent first).
5. **Link accuracy**: `youtube_link` must resolve to the exact timestamp of the word's first occurrence (±1 second tolerance).
6. **Secondary links**: Included only when `occurrence_count > 1`. Otherwise empty array.
7. **Statistics**: `meta.jlpt_breakdown` sums must equal `meta.total_cards`.

## UI Consumption Contract

The static web UI loads this JSON and MUST be able to:
- Render all cards without additional transformation
- Filter by `jlpt_level` field
- Sort by `jlpt_level` field (N5 < N4 < N3)
- Open `youtube_link` in a new tab or embedded player
- Display `meta.jlpt_breakdown` as a summary

## Contract Test

**Given** a valid VocabularyList with 10 vocabulary items (4 N5, 3 N4, 3 N3),
**When** the flashcard-generator skill processes it,
**Then** the output FlashcardDeck has:
- `meta.total_cards` = 10
- `meta.jlpt_breakdown` = `{ "N5": 4, "N4": 3, "N3": 3 }`
- 10 card objects with sequential IDs
- Each card has a valid YouTube deep link with correct timestamp
- Each card back has all 4 fields populated
- The JSON parses without errors and can be loaded by the UI
