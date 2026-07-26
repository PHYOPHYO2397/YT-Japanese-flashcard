# How Japanese YouTube → JLPT Flashcard Generator is Built

Tech stack, AI tooling, and the workflow behind turning native video content into structured flashcards

by Your Name / Handle

---

## Tech Stack

The foundation — what powers the system end to end.

| Layer                 | Choice                          | Why                                                                                 |
| :-------------------- | :------------------------------ | :---------------------------------------------------------------------------------- |
| **Workflow Pipeline** | Python 3                        | Lightweight text handling, fast processing for parsing transcripts and tokenization |
| **Video Extraction**  | `yt-dlp`                        | Reliable YouTube subtitle (`.ja.srt`) and metadata fetching                         |
| **Agent Protocol**    | MCP (Model Context Protocol)    | Standardized integration connecting Claude Code directly to YouTube APIs            |
| **MCP Servers**       | `youtube-transcript`, `youtube` | Transcript extraction with fallbacks when primary streams fail                      |
| **UI Components**     | Magic MCP (`21st.dev`)          | Generates landing pages and interactive components directly                         |
| **Frontend**          | Pure Web Stack / No-Backend     | Zero authentication, instant loading, client-side flashcard viewer                  |

> **No Backend Required:** Zero login overhead. Everything runs as a fast local pipeline or client-side JSON export.

---

## Agents

Claude Code agents — specialized subroutines for focused tasks.

### `vocabulary-extractor`

- **Role:** Subtitle & Tokenization Specialist
- **Inputs:** Raw `.ja.srt` transcripts from YouTube
- **Pipeline:** CJK Tokenization $\rightarrow$ Stopword Filtering $\rightarrow$ JLPT Candidate Parsing
- **Output:** Cleaned Japanese vocabulary terms with exact video timestamp links
- Zero fluff — purges common filler words and extracts high-value study candidates.

---

## Skills

Reusable knowledge packs — inject domain expertise into any prompt.

### `subtitle-downloader`

- Wraps `yt-dlp` commands for batch downloading `.ja.srt` Japanese subtitle files.

### `flashcard-generator`

- Validates YouTube URLs and coordinates MCP tools.
- Enforces the `FlashcardDeck` JSON schema (meanings, readings, furigana, and timestamp links).

| JLPT Level  | Target Vocabulary Scope                                               |
| :---------: | :-------------------------------------------------------------------- |
| **N5 – N4** | High-frequency basic verbs, adjectives, daily life nouns              |
| **N3 – N1** | Nuanced grammar terms, complex kanji compounds, idiomatic expressions |

---

## Methodology

AI-assisted pair programming & automated ingestion pipelines.

### The Loop

1. **Fetch:** Pull `.ja.srt` subtitle tracks or video streams.
2. **Tokenize:** Break down raw Japanese strings into distinct words via CJK tokenization.
3. **Analyze:** Cross-reference terms against JLPT databases and attach video timestamps.
4. **Generate:** Output a self-contained `FlashcardDeck` JSON file.

### Decision Tree

---

## Pipelines & Workflows

### 1. Batch Pipeline (Primary Workflow)

Designed for processing multiple videos at once from a search query (e.g., _"download top 3 N4 listening videos"_).

- **Best for:** Bulk study sessions, JLPT practice sets, and building whole decks in seconds.

### 2. Single-URL Pipeline (Alternative Workflow)

Targeted study from a specific video link via MCP tools.

- **Best for:** Recommended videos, deep dive lessons, and specific creator content.

---

## UI System

Hand-crafted interface designed specifically for active recall:

- **Flashcard Viewer:** Warm dark theme, 3D flip animation, full keyboard navigation, and progress tracking.
- **JLPT Color Coding:** Instant visual reference for difficulty tiers (N5 through N1).
- **Landing Page:** Generated via Magic MCP (`21st.dev`) with pipeline visualizations and interactive demo cards.

---

## Trigger

How Claude Code handles execution requests.

| Trigger / Command       | Action                                                                     |
| :---------------------- | :------------------------------------------------------------------------- |
| **URL Input**           | Runs `flashcard-generator` skill $\rightarrow$ Orchestrates MCP tools      |
| **Batch Query**         | Triggers `subtitle-downloader` skill $\rightarrow$ Executes Python scripts |
| **Single Word Lookups** | Direct fallback reasoning without tool calls                               |
| **UI Updates**          | Magic MCP component generation                                             |

---

## Commands

Developer and execution scripts powering the system.

### Pipeline Operations

```bash
# Python Subtitle Pipeline
python parse_srt.py input.srt               # Parse raw subtitle file
python compress_transcript.py transcript.txt  # Clean up filler words
python extract_candidates.py compressed.txt  # CJK tokenization & candidate filtering
python generate_flashcards.py candidates.json # Final JSON deck export
```
