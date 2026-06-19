# Research: YouTube Japanese Flashcard Generator

**Date**: 2026-06-18

## 1. YouTube MCP Transcript Extraction

**Decision**: Use `mcp__youtube__download_youtube_url` as the sole transcript extraction mechanism.

**Rationale**:
- Already available in this Claude Code session
- Handles both manual and auto-generated captions
- No API keys, no external service registration
- Satisfies constraint C-001

**Alternatives rejected**: `youtube-transcript` npm package (requires Node runtime outside sandbox), YouTube Data API v3 (requires API key + OAuth, violates C-004), manual paste (degrades UX)

## 2. Vocabulary Identification

**Decision**: Delegated entirely to a Claude subagent (`vocabulary-extractor`) with structured JSON output schema.

**Rationale**:
- Claude models have strong Japanese morphological awareness, kana reading, and JLPT classification
- Schema-constrained output ensures structured, parseable results
- Avoids external NLP dependencies (MeCab, Kuromoji, Sudachi)
- Satisfies constraint C-002

**Alternatives rejected**: External morphological analyzer (platform dependency), pre-built JLPT DB lookup (can't handle conjugation, violates C-005 spirit)

## 3. Flashcard Generation

**Decision**: Use a Claude skill (`flashcard-generator`) that transforms VocabularyList → FlashcardDeck JSON.

**Rationale**:
- Skills are the native transformation primitive in Claude Code
- Transformation is deterministic: map + assign IDs + construct YouTube links + serialize
- Satisfies constraint C-003
- Separate skill enables independent testing and future enhancement (Anki export, different card formats)

**Alternatives rejected**: Merge into single subagent (violates single-responsibility), generate in UI layer (UI should consume data, not transform it)

## 4. UI Technology

**Decision**: Static HTML/CSS/JavaScript — single page, no framework, no build step.

**Rationale**:
- No authentication, no backend needed (C-004, C-005)
- Single-user desktop browser target
- Consumes pre-generated JSON file — no dynamic server
- Can open directly in browser (`file://` or simple HTTP server)

**Alternatives rejected**: React/Vue SPA (over-engineered for single-page card viewer), CLI-only (spec requires interactive UI)

## Resolved Unknowns

All Technical Context unknowns resolved from spec and constraints:

| Unknown | Resolution |
|---------|------------|
| Language/Version | Markdown/CLI for skills/subagents; HTML/CSS/JS for UI |
| Primary Dependencies | YouTube MCP, Claude subagent system, Claude skills system |
| Storage | None — session-based, temp files for inter-layer handoff |
| Testing | Manual E2E validation per quickstart.md |
| Target Platform | Desktop browser |
| Project Type | Claude Code pipeline + static web UI |
| Performance Goals | Transcript <30s, Vocab+Flashcards <60s, UI <500ms |
| Constraints | No auth, no DB, YouTube MCP, vocab subagent, flashcard skill |

## Best Practices

- **Subagent prompt**: Include explicit JSON schema with `additionalProperties: false` and `required` fields
- **Skill idempotency**: Identical vocabulary input → identical flashcard output
- **Error messages**: Plain language for non-technical users (NFR-004), never raw stack traces
- **Timestamp format**: `https://www.youtube.com/watch?v={video_id}&t={seconds}s`
- **UI accessibility**: CJK-capable font, readable Japanese text sizing
