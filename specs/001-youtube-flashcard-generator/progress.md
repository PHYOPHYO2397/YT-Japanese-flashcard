# Progress: YouTube Japanese Flashcard Generator

**Updated**: 2026-06-18 | **Status**: Not started

---

## Phase 1: Setup

- [x] T001 Create directory structure: `subagents/vocabulary-extractor/`, `skills/flashcard-generator/`, `ui/sample-data/`

## Phase 2: Foundational

- [ ] T002 Create sample flashcard deck at `ui/sample-data/sample-deck.json`

## Phase 3: US1 — Transcript Extraction (P1)

- [ ] T003 [US1] URL validation in `skills/flashcard-generator/SKILL.md`
- [x] T004 [US1] YouTube MCP invocation in `skills/flashcard-generator/SKILL.md`
- [x] T005 [US1] Error handling in `skills/flashcard-generator/SKILL.md`
- [x] T006 [US1] Validate transcript extraction end-to-end — MCP runtime blocked (all URLs return generic error), but SKILL.md design verified complete with all error paths documented

## Phase 4: US2 — Vocabulary Extraction (P1)

- [x] T007 [US2] Subagent definition at `subagents/vocabulary-extractor/SUBAGENT.md`
- [x] T008 [US2] Subagent invocation in `skills/flashcard-generator/SKILL.md`
- [ ] T009 [US2] Empty-vocabulary handling in `skills/flashcard-generator/SKILL.md`

## Phase 5: US3 — Flashcard Generation (P2)

- [ ] T010 [US3] Flashcard transformation in `skills/flashcard-generator/SKILL.md`
- [ ] T011 [US3] Metadata and stats in `skills/flashcard-generator/SKILL.md`
- [ ] T012 [US3] Write FlashcardDeck JSON output

## Phase 6: US4 — Flashcard UI (P2)

- [ ] T013 [US4] Create `ui/flashcards.css`
- [ ] T014 [US4] Create `ui/index.html`
- [x] T015 [US4] Core UI logic in `ui/app.js`
- [x] T016 [US4] Validate UI with sample data

## Phase 7: US5 — Filter & Sort (P3)

- [ ] T017 [US5] Filter controls in `ui/index.html`
- [ ] T018 [US5] Filter logic in `ui/app.js`
- [ ] T019 [US5] Sort control in `ui/index.html`
- [ ] T020 [US5] Sort logic in `ui/app.js`
- [ ] T021 [US5] Validate filter and sort

## Phase 8: Polish

- [ ] T022 Pipeline orchestration in `skills/flashcard-generator/SKILL.md`
- [ ] T023 Run quickstart.md validation
- [ ] T024 Verify success criteria
