# ch-5 YT-Japanese-flashcard — Report

## Project

- **GitHub username:** @PHYOPHYO2397
- **Repo URL:** https://github.com/PHYOPHYO2397/YT-Japanese-flashcard
- **Live / download URL:** https://yt-japanese-flashcard.vercel.app/

## AI Tools Used

- **Claude Code** — primary development agent; built the entire app through iterative plan-implement cycles
- **Magic MCP (21st.dev)** — landing page hero section, pipeline visualization component, feature grid, and interactive demo card

### Skill (required)

- **path:** `skills/flashcard-generator/SKILL.md`
- **what:** Main pipeline orchestrator — accepts a YouTube URL, validates it, extracts Japanese transcript via MCP with youtube-transcript → youtube fallback, invokes the vocabulary-extractor subagent, transforms vocabulary into FlashcardDeck JSON, and writes the output file. Handles all error paths (no captions, no Japanese, video unavailable, MCP failure, empty result).

- **path:** `.claude/skills/mermaid/SKILL.md`
- **what:** Generates Mermaid diagram code from natural-language requirements. Used to visualize the 4-layer pipeline architecture and workflow as a flowchart in the project documentation.

- **path:** `skills/subtitle-downloader/SKILL.md`
- **what:** Standalone batch subtitle downloader — uses yt-dlp CLI to search YouTube and download `.ja.srt` files with manual-first-then-auto caption fallback. Used for the batch pipeline workflow ("download top 3 N4 listening videos").

### Subagent (required)

- **path:** `.claude/agents/vocabulary-extractor.md`
- **what:** Language-agnostic vocabulary extraction engine. Receives a TranscriptBundle JSON, detects the transcript language, tokenizes CJK or space-separated text, filters stopwords (including Japanese particles は, が, を, に, etc.), deduplicates words across segments, counts occurrences, and returns a VocabularyList JSON sorted by frequency. Supports structured output via schema validation.

## Trigger / Command

### Skill: flashcard-generator
- **Trigger:** Invoked when the user provides a YouTube URL and wants to generate flashcards from a video
- **Command:** `/flashcard-generator` or invoked directly during the pipeline workflow when a YouTube URL is submitted

### Skill: subtitle-downloader
- **Trigger:** Invoked when the user wants to batch-download Japanese subtitles from YouTube — either by search query or direct URL
- **Command:** `/subtitle-downloader` or contextually when batch subtitle download is requested

### Skill: mermaid
- **Trigger:** Invoked when a visual diagram of the pipeline architecture or workflow is needed
- **Command:** `/mermaid` or contextually when diagram generation is requested

### Subagent: vocabulary-extractor
- **Trigger:** `vocabulary-extractor` subagent runs when given a TranscriptBundle JSON and needs to produce a VocabularyList with tokenization, stopword filtering, deduplication, and structured JSON output
- **Command:** Spawned by the main agent during the flashcard pipeline (after transcript extraction, before flashcard generation)

## Tech-Stack Slides

- **Slides path:** slides/slides.md
- **Pitch deck:** slides/slides.md (PechaKucha 6-slide format, 20s auto-advance)

## Architecture

```
YouTube URL
  → L1: YouTube MCP (transcript extraction)
        Primary: youtube-transcript MCP (lang: "ja")
        Fallback: youtube MCP
  → L2: vocabulary-extractor subagent (CJK tokenization, stopword filtering, dedup)
  → L3: flashcard-generator skill (card mapping, JSON output)
  → L4: static HTML UI (interactive study with flip animation)
```

### Two Pipelines

**Batch (primary):** Search query → yt-dlp downloads `.srt` → Python scripts (`parse_srt.py` → `compress_transcript.py` → `extract_candidates.py` → `generate_flashcards.py`) → FlashcardDeck JSON

**Single-URL (alternative):** Paste YouTube link → MCP transcript → vocabulary-extractor subagent → flashcard-generator skill → FlashcardDeck JSON

### Key Files

| File | Role |
|------|------|
| `skills/flashcard-generator/SKILL.md` | Pipeline orchestrator — URL validation, MCP invocation, error handling, subagent invocation, flashcard transformation, JSON output |
| `skills/subtitle-downloader/SKILL.md` | Batch subtitle downloader — yt-dlp search + download with manual→auto fallback |
| `.claude/agents/vocabulary-extractor.md` | Vocabulary extraction subagent — language-agnostic tokenization, stopword filtering, structured output |
| `.claude/skills/mermaid/SKILL.md` | Diagram generation skill — pipeline visualization |
| `.claude/skills/ui-ux-pro-max/SKILL.md` | UI/UX design intelligence — 67 styles, 96 palettes, 57 font pairings |
| `ui/index.html` | Single-page flashcard viewer shell — loads JSON, renders card deck |
| `ui/app.js` | All UI logic — card rendering, flip animation, keyboard navigation, JLPT filter/sort, progress tracking |
| `ui/flashcards.css` | Dark-themed card deck styling — 3D flip animation, CJK fonts, JLPT color coding (green/orange/red for N5/N4/N3) |

### Data Flow

```
TranscriptBundle → VocabularyList → FlashcardDeck → UI Rendering
    (segments)      (words, counts)   (cards, links)   (interactive viewer)
```

### Output Artifacts

- 4 FlashcardDeck JSON files in `output/` directory
- Landing page with hero, pipeline visualization, and interactive demo (Magic MCP)
- Flashcard viewer with warm dark theme, keyboard nav, JLPT filter/sort

## Methodology

- **Contracts-first design**: Layer boundaries defined by contract schemas before implementation. Every handoff (MCP → subagent → skill → UI) validated against its contract.
- **Plan-implement cycles**: Spec → research → plan → tasks → implement → verify. Each phase gated by artifact review.
- **Specs directory**: Full specification living in `specs/001-youtube-flashcard-generator/` with spec.md, plan.md, data-model.md, contracts, and workflow diagrams.
- **No external dependencies**: No package.json, no npm install, no build step. Everything runs inside Claude Code or a browser.
- **Session-based, stateless**: No auth, no database. Each pipeline run is ephemeral. Only persistent artifact is the output JSON file.
