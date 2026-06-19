# Contract: Transcript Interface

**Layer boundary**: MCP Layer → Subagent Layer

**Direction**: The YouTube MCP produces transcript data consumed by the vocabulary-extractor subagent.

## Input (MCP Invocation)

```
Tool: mcp__youtube__download_youtube_url
Parameter: url (string) — full YouTube URL
```

## Output: TranscriptBundle

The MCP tool returns raw subtitle text. The system must parse this into the structured format below before passing to the subagent layer.

### Schema

```json
{
  "video": {
    "url": "string (YouTube URL as submitted)",
    "video_id": "string (extracted video ID)",
    "title": "string (video title)",
    "has_captions": "boolean",
    "caption_type": "manual | auto_generated"
  },
  "segments": [
    {
      "text": "string (Japanese subtitle text)",
      "start_time": "number (seconds, e.g. 12.5)",
      "end_time": "number (seconds, e.g. 15.2)",
      "segment_index": "integer (0-based)",
      "source": "manual | auto_generated"
    }
  ]
}
```

### Constraints

- `segments` array must contain at least 1 entry
- `segments[].start_time` must be monotonically non-decreasing
- Each `text` field must contain Japanese characters (hiragana, katakana, or kanji)
- `video_id` is extracted from the URL: 11-character alphanumeric string for youtube.com/watch?v=, or path segment for youtu.be/

## Error Outcomes

| Condition | Error Message |
|-----------|--------------|
| URL is not a YouTube URL | "The URL you entered is not a valid YouTube link. Please paste a full YouTube video URL." |
| Video has no captions at all | "This video does not have any captions (subtitles) available. Try a different video." |
| Video has captions but not Japanese | "This video has captions, but Japanese subtitles are not available. Try a video with Japanese captions." |
| Video is unavailable (private/deleted/blocked) | "This video could not be accessed. It may be private, deleted, or blocked in your region." |
| MCP tool fails or times out | "Something went wrong while downloading the transcript. Please try again. If the problem persists, the video may be too long or temporarily unavailable." |

## Contract Test

**Given** a valid YouTube URL with Japanese captions (e.g., a known Japanese learning video),
**When** the MCP layer processes it,
**Then** the output is a valid TranscriptBundle with at least 1 segment containing Japanese text and valid timestamps.
