# Implementation Plan: YouTube Japanese Flashcard Generator

**Branch**: `001-youtube-flashcard-generator` | **Date**: 2026-06-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-youtube-flashcard-generator/spec.md`

## Summary

A Claude Code pipeline: user pastes a YouTube URL → YouTube MCP extracts Japanese transcript → vocabulary-extractor subagent identifies JLPT N5–N3 words → flashcard-generator skill produces UI-ready JSON → static HTML page renders interactive flashcards. Session-based, no auth, no database.

## Technical Context

**Language/Version**: Markdown/CLI (Claude Code skills, subagents); HTML/CSS/JavaScript (UI)

**Primary Dependencies**: YouTube MCP (transcript), Claude subagent system (vocabulary), Claude skills system (flashcards)

**Storage**: N/A — session-based, temp files for inter-layer handoff only

**Testing**: Manual end-to-end validation per quickstart.md

**Target Platform**: Desktop browser

**Project Type**: Claude Code multi-layer pipeline + static web UI

**Performance Goals**: Transcript <30s (<30min video); Vocab + flashcards <60s (≤500 segments); UI interactions <500ms

**Constraints**: No auth (C-004), no DB (C-005), YouTube MCP only (C-001), vocab subagent required (C-002), flashcard skill required (C-003), JSON output (C-006)

**Scale/Scope**: Single user, one URL per session, desktop browser, Japanese→English, JLPT N5–N3 only

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Status**: ✅ PASS — Constitution template is not yet populated. No violations. All architectural decisions align with constraints.

*Post-Phase 1 re-check:* ✅ PASS — no violations introduced.

## Project Structure

### Documentation (this feature)

```text
specs/001-youtube-flashcard-generator/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── transcript-contract.md
│   ├── vocabulary-contract.md
│   └── flashcard-contract.md
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
subagents/
└── vocabulary-extractor/
    └── SUBAGENT.md          # System prompt + output schema (structured JSON)

skills/
└── flashcard-generator/
    └── SKILL.md             # Transformation rules: VocabularyList → FlashcardDeck JSON

ui/
├── index.html               # Single-page flashcard viewer (loads JSON, renders deck)
├── app.js                   # All UI logic: card render, flip, filter, sort, YouTube links
├── flashcards.css           # Card deck styling, flip animation, filter bar
└── sample-data/
    └── sample-deck.json     # Sample FlashcardDeck for UI development & testing
```

**Changes from previous version:**
- Removed `mcp/` directory — MCP usage is fully documented in `contracts/transcript-contract.md`
- Removed per-directory README files — each contract file already documents layer I/O
- Collapsed 4 JS files into 1 (`app.js`) — single static page doesn't warrant file splitting
- Removed `card-renderer.js`, `filter-sort.js`, `youtube-linker.js` — all logic lives in `app.js`

## Architecture: 4-Layer Pipeline

```
USER INPUT: YouTube URL
        │
        ▼
┌──────────────────────────────────────────────────┐
│ LAYER 1 — MCP                                    │
│ Tool: mcp__youtube__download_youtube_url          │
│                                                   │
│ IN:  YouTube URL string                           │
│ OUT: TranscriptBundle (segments + timestamps)     │
│ ERR: Invalid URL, No captions, No Japanese CC     │
│ PERF: <30s for <30min video                       │
└───────────────────┬──────────────────────────────┘
                    │ TranscriptBundle
                    ▼
┌──────────────────────────────────────────────────┐
│ LAYER 2 — SUBAGENT                               │
│ Agent: vocabulary-extractor                       │
│                                                   │
│ IN:  TranscriptBundle                             │
│ OUT: VocabularyList (N5–N3 only, deduplicated)    │
│ DOES:                                             │
│  • Identify unique Japanese words                 │
│  • Provide reading (kana), meaning (EN), POS      │
│  • Classify JLPT level (N5/N4/N3); reject others  │
│  • Deduplicate: consolidate occurrences/timestamps│
│  • Filter proper nouns, particles, non-vocab      │
│ ERR: No N5–N3 vocab found, Schema invalid         │
└───────────────────┬──────────────────────────────┘
                    │ VocabularyList
                    ▼
┌──────────────────────────────────────────────────┐
│ LAYER 3 — SKILL                                  │
│ Skill: flashcard-generator                        │
│                                                   │
│ IN:  VocabularyList + video metadata              │
│ OUT: FlashcardDeck JSON (UI-ready)                │
│ DOES:                                             │
│  • Map VocabularyItem → Flashcard (sequential ID) │
│  • Front: Japanese word                           │
│  • Back: reading, meaning, POS, JLPT level        │
│  • Embed YouTube deep-link with timestamp         │
│  • Primary link = first occurrence                │
│  • Secondary links = additional occurrences       │
│  • Generate JLPT breakdown stats                  │
└───────────────────┬──────────────────────────────┘
                    │ FlashcardDeck (JSON)
                    ▼
┌──────────────────────────────────────────────────┐
│ LAYER 4 — UI (static HTML page)                   │
│ File: ui/index.html + app.js + flashcards.css     │
│                                                   │
│ IN:  FlashcardDeck JSON (loaded from file)        │
│ FEATURES:                                         │
│  • Card deck with prev/next navigation            │
│  • Click to flip — reveal back (answer)           │
│  • JLPT filter: N5 / N4 / N3 / All                │
│  • JLPT sort: N5→N3 ascending / descending        │
│  • Timestamp click → open YouTube at that moment  │
│  • Progress counter: "X of Y reviewed"            │
│ PERF: <500ms for all UI interactions              │
└──────────────────────────────────────────────────┘
```

## Data Flow

| Step | From | To | Data | Format |
|------|------|----|------|--------|
| 1 | User | MCP | YouTube URL | String |
| 2 | MCP | Subagent | Transcript + timestamps | TranscriptBundle |
| 3 | Subagent | Skill | Deduplicated N5–N3 vocabulary | VocabularyList |
| 4 | Skill | UI | Flashcards with YouTube links | FlashcardDeck JSON |
| 5 | UI | User | Interactive card study view | Browser DOM |

## Layer Boundaries (Contracts)

Each arrow in the pipeline is governed by a contract:

| Boundary | Contract File | Producer | Consumer |
|----------|--------------|----------|----------|
| MCP → Subagent | `contracts/transcript-contract.md` | YouTube MCP | vocabulary-extractor subagent |
| Subagent → Skill | `contracts/vocabulary-contract.md` | vocabulary-extractor subagent | flashcard-generator skill |
| Skill → UI | `contracts/flashcard-contract.md` | flashcard-generator skill | static HTML UI |

## Complexity Tracking

> No constitution violations. This section intentionally left empty.
