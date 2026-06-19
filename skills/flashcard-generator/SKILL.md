# Flashcard Generator Skill

This skill orchestrates the full pipeline: YouTube URL → Japanese transcript → vocabulary → flashcards → UI-ready JSON.

---

## URL Input & Validation

### Input

The skill accepts a single YouTube URL from the user.

### Validation Rules

1. **URL format**: The input must match one of these patterns:
   - `https://www.youtube.com/watch?v={video_id}` (standard watch URL)
   - `https://youtu.be/{video_id}` (short link)
   - `https://m.youtube.com/watch?v={video_id}` (mobile URL)
   - URL may include additional query parameters (e.g., `&list=...`, `&t=...`, `&si=...`)

2. **Video ID extraction**: The 11-character video ID is extracted from:
   - `v` query parameter for `youtube.com/watch` URLs
   - The path segment after `youtu.be/` for short links

3. **Rejection**: If the URL does not match any YouTube pattern, output the error:

   > The URL you entered is not a valid YouTube link. Please paste a full YouTube video URL.

4. **Trim whitespace**: Leading/trailing whitespace is stripped from the input before validation.

---

## Transcript Extraction

### MCP Invocation

After URL validation passes, attempt transcript extraction using a two-MCP fallback strategy.

### Primary: youtube-transcript MCP

Call the primary MCP first — it supports explicit language selection:

```
Tool: mcp__youtube-transcript__get_transcript
Parameters:
  url: <validated URL string>
  lang: "ja"            # Request Japanese captions
  include_timestamps: true
  strip_ads: true
```

### Fallback: youtube MCP

If the primary MCP fails (any error), fall back to the legacy YouTube MCP:

```
Tool: mcp__youtube__download_youtube_url
Parameter: url = <validated URL string>
```

### Extraction Strategy

1. Try `youtube-transcript` with `lang: "ja"` first — this explicitly requests Japanese captions
2. If it fails (error, timeout, no transcript), fall back to `youtube` MCP
3. If both fail, apply error handling (see Error Handling section)
4. The output from either MCP is normalized into the same TranscriptBundle format

### Parsing MCP Output

The MCP tool returns subtitle text with timestamps. Parse the output into a structured `TranscriptBundle`:

1. **Extract video metadata**:
   - `video.url`: The original URL as submitted
   - `video.video_id`: The 11-character ID extracted during validation
   - `video.title`: Extract from the MCP output if a title is present; otherwise use `"YouTube Video"`
   - `video.has_captions`: `true` (we reached this point, so captions exist)
   - `video.caption_type`: `"manual"` if the output indicates human-uploaded captions, `"auto_generated"` if machine-generated

2. **Parse segments**: The MCP output typically contains subtitle entries with start/duration timestamps and text. Convert each entry to a segment object:
   - `text`: The Japanese subtitle text (keep original characters — kanji, hiragana, katakana)
   - `start_time`: Start timestamp in seconds (as a number, e.g. `12.5`)
   - `end_time`: End timestamp in seconds (start + duration)
   - `segment_index`: Zero-based index in order of appearance
   - `source`: Same as `caption_type` above

3. **Timestamp format handling**: The MCP may return timestamps in various formats:
   - `HH:MM:SS.mmm` → convert to total seconds
   - Raw seconds (number) → use directly
   - `MM:SS` → convert to seconds

4. **Segment ordering**: Segments MUST be ordered by `start_time` ascending. Verify `start_time` is monotonically non-decreasing; if not, sort the segments.

### TranscriptBundle Output

Produce a JSON object matching this schema:

```json
{
  "video": {
    "url": "<original URL>",
    "video_id": "<11-char ID>",
    "title": "<video title>",
    "has_captions": true,
    "caption_type": "manual | auto_generated"
  },
  "segments": [
    {
      "text": "<Japanese subtitle text>",
      "start_time": <seconds>,
      "end_time": <seconds>,
      "segment_index": <0-based index>,
      "source": "manual | auto_generated"
    }
  ]
}
```

### Validation Check

After parsing, if `segments` is empty or contains 0 entries, this is an error condition — the MCP returned data but no parseable segments. Treat as a transcript extraction failure (see Error Handling section).

---

## Error Handling

Each error condition below MUST output the exact user-facing message specified. The skill must detect the condition and respond with the message — do not pass raw errors to the user.

### 1. No Captions Available

**Detection**: The MCP tool returns a response indicating no subtitles/captions exist for this video (e.g., empty result, "no transcript available", or a caption-not-found indicator).

**User message**:

> This video does not have any captions (subtitles) available. Try a different video.

### 2. No Japanese Captions

**Detection**: The MCP tool returns captions, but they are not in Japanese. Check: if the parsed text contains no hiragana, katakana, or kanji characters (CJK Unicode ranges: U+3040–U+309F, U+30A0–U+30FF, U+4E00–U+9FFF), the captions are not Japanese. Also applies if the MCP indicates the only available caption language is non-Japanese.

**User message**:

> This video has captions, but Japanese subtitles are not available. Try a video with Japanese captions.

### 3. Video Unavailable

**Detection**: The MCP tool returns an error indicating the video is private, deleted, blocked, or otherwise inaccessible (e.g., HTTP 403/404, "video not found", "this video is private").

**User message**:

> This video could not be accessed. It may be private, deleted, or blocked in your region.

### 4. MCP Timeout or Failure

**Detection**: The MCP tool call throws an exception, times out, or returns an unrecognized error that doesn't match the specific conditions above.

**User message**:

> Something went wrong while downloading the transcript. Please try again. If the problem persists, the video may be too long or temporarily unavailable.

### 5. Empty Parse Result

**Detection**: The MCP returned data, but after parsing, the segments array has 0 entries.

**User message** (same as general failure, since something went wrong in extraction):

> Something went wrong while downloading the transcript. Please try again. If the problem persists, the video may be too long or temporarily unavailable.

### General Rule

All errors stop the pipeline. After outputting an error message, do not proceed to vocabulary extraction or flashcard generation. The user must submit a new URL to retry.

---

## Vocabulary Extraction

After transcript extraction succeeds and a valid TranscriptBundle is produced, invoke the vocabulary-extractor subagent.

### Subagent Invocation

Launch the subagent with the TranscriptBundle and the structured output schema:

```
Agent type: vocabulary-extractor
Input: TranscriptBundle JSON (from previous step)
Schema: VocabularyList (per contracts/vocabulary-contract.md)
```

The subagent definition is at `subagents/vocabulary-extractor/SUBAGENT.md`. It:
- Detects the transcript language automatically
- Tokenizes and normalizes text (language-agnostic)
- Filters stopwords and punctuation
- Deduplicates words across segments
- Preserves timestamps from each occurrence
- Sorts output by occurrence_count descending

### Schema Validation

The subagent output must be validated against the VocabularyList schema:

```json
{
  "video_id": "string",
  "video_title": "string",
  "detected_language": "string",
  "vocabulary": [
    {
      "word": "string",
      "occurrence_count": "integer >= 1",
      "timestamps": ["number (start_time from each occurrence)"],
      "context": "string (first occurrence segment text)"
    }
  ]
}
```

Validation checks:
1. `video_id` matches the input TranscriptBundle
2. Each `occurrence_count` equals `timestamps.length`
3. All `timestamps` values exist in the input segments
4. Vocabulary is sorted by `occurrence_count` descending

### Retry Logic

If the subagent produces output that fails schema validation:
1. **First failure**: Retry once — re-invoke the subagent with the same TranscriptBundle and a reminder to match the schema exactly
2. **Second failure**: Surface error to user and stop the pipeline:

> Something went wrong while identifying vocabulary. Please try again with a different video.

### Empty Vocabulary Handling

If the subagent returns a valid response but the `vocabulary` array is empty (zero items found):

1. **User message**: Output the following and stop the pipeline:

   > No JLPT N5–N3 vocabulary was found in this transcript.

2. **Low coverage warning**: If the input TranscriptBundle has fewer than 10 segments, include a `low_coverage_warning: true` flag in the output alongside the message. This warns that the transcript was too short for meaningful vocabulary extraction.

3. **Pipeline stop**: After outputting the empty-vocabulary message, do not proceed to flashcard generation. The user must try a different video.

---

## Flashcard Generation

After vocabulary extraction succeeds with a non-empty vocabulary list, transform each vocabulary item into a flashcard.

### Input

The VocabularyList from the subagent (see Vocabulary Extraction section):
- `video_id`, `video_title`
- `vocabulary[]`: each with `word`, `occurrence_count`, `timestamps`, `context`

### Mapping Rules

For each item in `vocabulary[]`, produce a flashcard:

1. **ID**: Sequential, zero-padded: `card-001`, `card-002`, ..., `card-NNN`
   - IDs match the 1-based index in the sorted vocabulary array

2. **Front**: The `word` field as-is (preserve original script — kanji, kana, Latin, Hangul, etc.)

3. **Back**: An object with all available fields:
   - `reading`: `word` from source if available; otherwise empty string `""`
   - `meaning`: `context` snippet from first occurrence if available; otherwise empty string `""`
   - `part_of_speech`: If source provides it, include it; otherwise `"unknown"`
   - `jlpt_level`: If source provides it, include it; otherwise `"N/A"` (not applicable for non-Japanese)
   - `occurrence_count`: From source (integer)

4. **YouTube link**: Primary timestamp link:
   ```
   https://www.youtube.com/watch?v={video_id}&t={floor(timestamps[0])}s
   ```
   Where `timestamps[0]` is the first (earliest) occurrence timestamp, floored to integer seconds.

5. **Secondary links**: For each additional timestamp beyond the first:
   ```
   https://www.youtube.com/watch?v={video_id}&t={floor(ts)}s
   ```
   Include only when `occurrence_count > 1`. Otherwise empty array `[]`.

6. **JLPT level** (card-level field): Copied from source `jlpt_level` if present; otherwise `"N/A"`.

7. **Context snippet**: The `context` field from source (first occurrence segment text). Truncated to 200 chars if longer.

8. **Card sort order**: Cards follow the vocabulary array ordering (most frequent first — already sorted by the subagent).

### Output: FlashcardDeck JSON

Produce a complete FlashcardDeck JSON object matching this schema:

```json
{
  "meta": {
    "video_id": "<string>",
    "video_title": "<string>",
    "youtube_url": "https://www.youtube.com/watch?v=<video_id>",
    "generated_at": "<ISO 8601 timestamp>",
    "total_cards": "<integer>",
    "jlpt_breakdown": {
      "N5": 0,
      "N4": 0,
      "N3": 0,
      "N/A": "<count if non-JLPT>"
    }
  },
  "cards": [
    {
      "id": "card-001",
      "front": "<word>",
      "back": {
        "reading": "<string | empty>",
        "meaning": "<string | empty>",
        "part_of_speech": "<string>",
        "jlpt_level": "<string>",
        "occurrence_count": "<integer>"
      },
      "jlpt_level": "<string>",
      "youtube_link": "https://www.youtube.com/watch?v=<id>&t=<seconds>s",
      "secondary_links": ["<url>", "..."],
      "context_snippet": "<string, max 200 chars>"
    }
  ]
}
```

### Language-Agnostic Fields

When the vocabulary source does not provide JLPT levels, readings, or parts of speech (as is the case for non-Japanese transcripts):

| Field | Fallback Value | Notes |
|-------|---------------|-------|
| `back.reading` | `""` | Empty if source language has no phonetic reading field |
| `back.meaning` | First `context` snippet | Serves as usage context when no translation available |
| `back.part_of_speech` | `"unknown"` | Can be enriched later by language-specific subagents |
| `back.jlpt_level` | `"N/A"` | Non-Japanese content has no JLPT classification |
| `card.jlpt_level` | `"N/A"` | Same as above |
| `meta.jlpt_breakdown` | `{ "N/A": total_cards }` | All cards fall into N/A for non-JLPT content |

When a future Japanese-specific vocabulary subagent provides JLPT levels, readings, and parts of speech, these fields will be populated from the source and the breakdown will show proper N5/N4/N3 counts.

### Metadata Generation

After mapping all cards, generate the `meta` object:

1. **`meta.video_id`**: From the TranscriptBundle video metadata
2. **`meta.video_title`**: From the TranscriptBundle video metadata
3. **`meta.youtube_url`**: Constructed as `https://www.youtube.com/watch?v=<video_id>`
4. **`meta.generated_at`**: Current timestamp in ISO 8601 format (e.g., `2026-06-18T12:00:00Z`)
5. **`meta.total_cards`**: The number of cards in the deck (`cards.length`)
6. **`meta.jlpt_breakdown`**: Count of cards per JLPT level:
   - Count occurrences of each unique `jlpt_level` value across all cards
   - For Japanese content: `{ "N5": N, "N4": N, "N3": N }`
   - For non-Japanese content: `{ "N/A": total_cards }`
   - Only include levels that have at least 1 card
   - The sum of all breakdown values MUST equal `meta.total_cards`

### Output File

Write the complete FlashcardDeck JSON to a file: `output/flashcards-{video_id}.json`

```
output/flashcards-jNQXAC9IVRw.json
```

The file is written relative to the project root. This is the final artifact — the UI layer loads this file to render the flashcard viewer.
