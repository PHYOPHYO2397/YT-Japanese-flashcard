# Contract: Vocabulary Interface

**Layer boundary**: Subagent Layer → Skill Layer

**Direction**: The vocabulary-extractor subagent produces a vocabulary list consumed by the flashcard-generator skill.

## Input

A valid TranscriptBundle (see [transcript-contract.md](./transcript-contract.md)):
- `video` metadata object
- `segments` array of transcript segments with text and timestamps

## Output: VocabularyList

### Schema (Subagent Structured Output)

```json
{
  "video_id": "string",
  "video_title": "string",
  "vocabulary": [
    {
      "word": "string (Japanese word as it appears)",
      "reading": "string (hiragana reading)",
      "meaning": "string (English gloss)",
      "part_of_speech": "noun | verb | adjective | adverb | particle | conjunction | expression | other",
      "jlpt_level": "N5 | N4 | N3",
      "occurrence_count": "integer >= 1",
      "primary_timestamp": "number (seconds, first occurrence)",
      "secondary_timestamps": ["number (seconds)", "..."],
      "context_snippets": ["string (surrounding transcript text)", "..."]
    }
  ]
}
```

### Contract Rules

1. **JLPT Filter**: Only N5, N4, and N3 vocabulary is included. N2, N1, and unclassified words are silently excluded.
2. **Deduplication**: Each unique word appears exactly once. Occurrences of the same word at different timestamps are consolidated into `secondary_timestamps`.
3. **Reading**: Must be in hiragana (or katakana for loanwords). No romaji.
4. **Meaning**: Concise English gloss (1–5 words preferred). Disambiguate homonyms by context.
5. **Proper Nouns**: Names, places, brands, and other proper nouns that are not JLPT vocabulary are excluded.
6. **Sort Order**: Results sorted by `occurrence_count` descending (most frequent words first).

### Subagent Prompt Requirements

The vocabulary-extractor subagent MUST:
- Receive the full transcript text from all segments
- Be instructed to act as a Japanese language teacher identifying study-relevant vocabulary
- Have its output validated against this schema (using `schema` option in agent invocation)
- Be constrained to include only JLPT N5–N3 vocabulary
- Exclude: proper nouns, numbers, single kana particles (は, が, を, に, へ, で, と, も, か, の, や, よ, ね, わ), punctuation-only entries, greetings treated as set expressions unless they carry distinct vocabulary value

## Error Outcomes

| Condition | Behavior |
|-----------|----------|
| No N5–N3 vocabulary found | Return empty vocabulary array with a note: "No JLPT N5–N3 vocabulary was found in this transcript." |
| Transcript is empty or very short (<10 segments) | Process normally but include a flag: `"low_coverage_warning": true` |
| Subagent fails to produce valid schema | Retry once; if still invalid, surface error to user |

## Contract Test

**Given** a sample TranscriptBundle with known Japanese text containing both N5 and N2 vocabulary,
**When** the vocabulary-extractor subagent processes it,
**Then** the output VocabularyList contains only N5/N4/N3 words, each with correct reading, meaning, part of speech, and consolidated timestamps. N2 words are absent.
