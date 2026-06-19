# Japanese YouTube → JLPT Flashcard Generator

A Claude Code–powered system that turns Japanese YouTube videos into structured JLPT-graded flashcard decks. It removes the manual work of extracting vocabulary from native content and converts passive watching into active study.

No login. No backend. No setup friction.

---

## 🎯 Who this is for

Japanese learners who use YouTube for immersion but struggle to turn content into study material.

They typically:
- Pause videos constantly to look up unknown words
- Manually write vocabulary lists
- Search meanings and readings one by one
- Try (and fail) to estimate JLPT levels manually

The result: it takes longer to extract vocabulary than to watch the video.

---

## 🧠 What this system does

This project automatically converts YouTube Japanese content into structured flashcard decks with:

- Vocabulary extraction
- Readings (furigana support via pipeline processing)
- Meanings
- JLPT level estimation
- Timestamp links back to the original video

Everything is exported as `FlashcardDeck JSON`.

---

## ⚙️ Two pipelines

### 1. Batch pipeline (primary workflow)

Designed for processing multiple videos at once from a search query.

Example:
> “download top 3 N4 listening videos”

Flow:
- YouTube search + download via `yt-dlp`
- `.ja.srt` subtitle extraction
- Python processing pipeline:
  - `parse_srt.py`
  - `compress_transcript.py`
  - `extract_candidates.py`
  - `generate_flashcards.py`
- Output: structured flashcard decks

Best for:
- Bulk study sessions
- JLPT practice sets
- Building multiple decks quickly

---

### 2. Single-URL pipeline (alternative workflow)

Designed for converting a specific video into a deck.

Flow:
- Paste YouTube URL
- MCP tools:
  - `youtube-transcript`
  - `youtube` (fallback)
- Agent: `vocabulary-extractor`
  - CJK tokenization
  - Stopword filtering
  - Structured JSON output
- Skill: `flashcard-generator`
  - URL validation
  - MCP orchestration
  - Deck generation

Best for:
- Targeted study from a specific video
- Teacher-recommended content
- Deep dive learning

---

## 🖥️ UI system

### Flashcard viewer
- Warm dark theme
- 3D flip animations
- Keyboard navigation
- JLPT-based color coding
- Filtering and sorting
- Progress tracking

### Landing page
Built using **Magic MCP (21st.dev)**:
- Hero section
- Pipeline visualization
- Feature grid
- Interactive demo card

---

## 🏗️ Architecture overview

### Batch pipeline
- Skill: `subtitle-downloader`
- Tools: `yt-dlp`, subtitle processing
- Python modules:
  - SRT parsing
  - Transcript compression
  - Vocabulary extraction
  - Flashcard generation

---

### Single-URL pipeline
- MCP config (`.mcp.json`)
  - `youtube-transcript`
  - `youtube`
  - fallback chain system
- Agent: `vocabulary-extractor`
- Skill: `flashcard-generator`

---

### UI layer
- Magic MCP (21st.dev) for landing page
- Custom frontend for flashcards
- No authentication or backend required

---

## 🚀 Why it matters

This system turns passive immersion into structured learning without manual effort.

Instead of:
- Watching → pausing → looking up words → forgetting context

You get:
- Watching → automatic extraction → JLPT-graded flashcards → review

It keeps:
- Readings
- Meanings
- JLPT levels
- Exact timestamps in the video

All connected back to native content.

---

## ✅ Done checklist

- [x] Repo public
- [x] MCP + skill + agent architecture implemented
- [x] `report.md` included in team repo
- [x] `.mcp.json` configured (youtube-transcript, youtube, magic)
- [x] Batch pipeline with subtitle downloader + 4 Python scripts
- [x] Single-URL pipeline with flashcard generator + vocabulary extractor
- [x] 4 FlashcardDeck outputs in `/output`
- [x] Landing page built with Magic MCP
- [x] Flashcard UI with dark theme + JLPT filtering + animations

---
