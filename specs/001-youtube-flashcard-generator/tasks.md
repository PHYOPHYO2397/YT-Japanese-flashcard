# Tasks: YouTube Japanese Flashcard Generator

**Input**: Design documents from `/specs/001-youtube-flashcard-generator/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), data-model.md, contracts/

**Tests**: Not requested — manual E2E validation per quickstart.md.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Source code at repository root per plan.md structure:
- `subagents/vocabulary-extractor/`
- `skills/flashcard-generator/`
- `ui/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create directory structure for all source code

- [ ] T001 Create directory structure: `subagents/vocabulary-extractor/`, `skills/flashcard-generator/`, `ui/sample-data/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Artifacts that MUST exist before any user story implementation can be validated

**⚠️ CRITICAL**: No user story work can be validated until sample data exists for UI development

- [ ] T002 Create sample flashcard deck at `ui/sample-data/sample-deck.json` per FlashcardDeck schema in `contracts/flashcard-contract.md`. Must contain at least 12 cards across all 3 JLPT levels (4 N5, 4 N4, 4 N3) with valid YouTube timestamp links, sequential card-IDs, and correct meta.jlpt_breakdown counts.

**Checkpoint**: Sample data ready — UI development and MCP validation can now proceed

---

## Phase 3: User Story 1 - Submit YouTube URL and Retrieve Transcript (Priority: P1) 🎯 MVP Start

**Goal**: User pastes a YouTube URL; system validates it, calls YouTube MCP, extracts Japanese transcript with timestamps, handles all error cases.

**Independent Test**: Submit a valid YouTube URL with Japanese captions → receive full TranscriptBundle with segments, timestamps, and metadata. Submit an invalid URL → receive clear plain-language error. Submit a video with no Japanese captions → receive clear error.

### Implementation for User Story 1

- [ ] T003 [US1] Define URL validation logic (YouTube URL patterns, error messages per `contracts/transcript-contract.md` error outcomes table) in `skills/flashcard-generator/SKILL.md` — add a "URL Input & Validation" section that accepts a YouTube URL, validates format, and rejects non-YouTube URLs with the prescribed error message.
- [ ] T004 [US1] Implement YouTube MCP invocation in `skills/flashcard-generator/SKILL.md` — add a "Transcript Extraction" section that calls `mcp__youtube__download_youtube_url` with the validated URL, parses raw subtitle output into TranscriptBundle format (video metadata + segments array with start/end times and text).
- [ ] T005 [US1] Implement error handling for transcript extraction in `skills/flashcard-generator/SKILL.md` — add handling for: no captions available, no Japanese captions, video unavailable (private/deleted), MCP timeout/failure. Each error must output the exact user-facing message from `contracts/transcript-contract.md`.
- [ ] T006 [US1] Validate end-to-end transcript extraction by invoking the skill with a known-good YouTube URL containing Japanese captions. Verify TranscriptBundle output matches the contract schema (valid timestamps, non-empty Japanese text, correct video metadata).

**Checkpoint**: User Story 1 complete — transcript extraction works independently, all error cases handled

---

## Phase 4: User Story 2 - Extract JLPT-Relevant Vocabulary from Transcript (Priority: P1)

**Goal**: System analyzes the Japanese transcript and identifies unique JLPT N5–N3 vocabulary items with readings, meanings, parts of speech, and consolidated timestamps.

**Independent Test**: Provide a known Japanese transcript → receive VocabularyList with only N5/N4/N3 words, each having reading (kana), meaning (English), part of speech, JLPT level, occurrence count, and timestamps. N2/N1 words absent. Duplicate words consolidated.

### Implementation for User Story 2

- [ ] T007 [US2] Write vocabulary-extractor subagent definition at `subagents/vocabulary-extractor/SUBAGENT.md` with: (a) system prompt instructing the subagent to act as a Japanese language teacher identifying JLPT N5–N3 vocabulary, (b) structured JSON output schema matching VocabularyList contract in `contracts/vocabulary-contract.md` including `additionalProperties: false` and all `required` fields, (c) rules for: JLPT level classification (N5/N4/N3 only — reject N2/N1/unclassified), deduplication (consolidate same word across segments into one entry with occurrence_count and timestamps), proper noun filtering (exclude names/places/brands), particle filtering (exclude single-kana particles: は, が, を, に, へ, で, と, も, か, の, や, よ, ね, わ), reading in hiragana (katakana for loanwords, no romaji), English meaning as concise gloss (1–5 words), sort output by occurrence_count descending.
- [ ] T008 [US2] Add subagent invocation to `skills/flashcard-generator/SKILL.md` — after transcript extraction succeeds, invoke the vocabulary-extractor subagent with the TranscriptBundle, passing the structured output schema for validation. Handle subagent failure (retry once on schema mismatch, surface error to user on second failure).
- [ ] T009 [US2] Add empty-vocabulary handling to `skills/flashcard-generator/SKILL.md` — if subagent returns zero vocabulary items, output the user message: "No JLPT N5–N3 vocabulary was found in this transcript." Include `low_coverage_warning: true` flag if transcript had fewer than 10 segments.

**Checkpoint**: User Stories 1 AND 2 complete — full pipeline from YouTube URL → N5–N3 vocabulary list works end-to-end

---

## Phase 5: User Story 3 - Generate Flashcards from Vocabulary (Priority: P2)

**Goal**: System transforms vocabulary list into structured FlashcardDeck JSON with Japanese word on front, full details on back, and clickable YouTube timestamp links.

**Independent Test**: Provide a known VocabularyList → receive valid FlashcardDeck JSON with sequential card IDs, correct front/back content, valid YouTube deep links, and accurate meta.jlpt_breakdown counts.

### Implementation for User Story 3

- [ ] T010 [US3] Implement flashcard transformation logic in `skills/flashcard-generator/SKILL.md` — add a "Flashcard Generation" section that: (a) maps each VocabularyItem to a Flashcard per `contracts/flashcard-contract.md` schema, (b) assigns sequential IDs (`card-001`, `card-002`, ...), (c) sets front = Japanese word only (no reading/meaning), (d) sets back = { reading, meaning, part_of_speech, jlpt_level, occurrence_count }, (e) constructs youtube_link as `https://www.youtube.com/watch?v={video_id}&t={floor(timestamp)}s`, (f) populates secondary_links for words with occurrence_count > 1.
- [ ] T011 [US3] Generate metadata and statistics in `skills/flashcard-generator/SKILL.md` — add output logic that produces: `meta.video_id`, `meta.video_title`, `meta.youtube_url`, `meta.generated_at` (ISO 8601), `meta.total_cards`, `meta.jlpt_breakdown` (N5/N4/N3 counts that sum to total_cards).
- [ ] T012 [US3] Write FlashcardDeck JSON to output file — the skill outputs the complete FlashcardDeck as a JSON file. Include sort order: cards follow VocabularyList ordering (most frequent first).

**Checkpoint**: User Story 3 complete — full pipeline YouTube URL → flashcard JSON works, output is valid per contract

---

## Phase 6: User Story 4 - View and Interact with Generated Flashcards (Priority: P2)

**Goal**: User opens a static HTML page that loads the FlashcardDeck JSON and displays an interactive flashcard study interface with card browsing, flip-to-reveal, and YouTube timestamp links.

**Independent Test**: Load sample-deck.json in the UI → all cards render, click to flip reveals answer, click timestamp opens YouTube at correct position, progress counter updates.

### Implementation for User Story 4

- [ ] T013 [P] [US4] Create `ui/flashcards.css` with styling for: card deck layout (centered, single-card focus with prev/next navigation), card face (Japanese word large and readable with CJK-appropriate font), card flip animation (smooth transition revealing back content), navigation buttons (previous/next arrows), progress counter, error/empty states. Desktop browser target (no mobile responsiveness required).
- [ ] T014 [P] [US4] Create `ui/index.html` — single-page HTML shell that: (a) loads `flashcards.css`, (b) loads `app.js` as a module or script, (c) provides a root container element for the flashcard app, (d) includes a file input or script tag to load the FlashcardDeck JSON. Page title: "Japanese Flashcard Viewer".
- [ ] T015 [US4] Implement core UI logic in `ui/app.js` — on JSON load, render the flashcard deck: (a) display current card with Japanese word (front) prominently, (b) prev/next navigation buttons to browse cards, (c) click/tap card to flip and reveal back content (reading, meaning, part of speech, JLPT level, occurrence count), (d) YouTube timestamp link on each card back — clicking opens `https://www.youtube.com/watch?v={video_id}&t={seconds}s` in a new tab, (e) progress counter showing "X of Y reviewed" where a card counts as reviewed when flipped at least once, (f) display meta.jlpt_breakdown summary above the deck.
- [ ] T016 [US4] Validate UI with sample data — load `ui/sample-data/sample-deck.json` into `ui/index.html`. Verify: all 12 cards render, flip works on each card, all YouTube links open correct timestamp, prev/next navigation works, progress counter increments on flip, JLPT breakdown displayed.

**Checkpoint**: User Story 4 complete — end-to-end feature works: URL → transcript → vocabulary → flashcards → interactive UI

---

## Phase 7: User Story 5 - Filter and Sort Flashcards by JLPT Level (Priority: P3)

**Goal**: User can filter the deck to show only N5, N4, or N3 cards, and sort cards by JLPT level (ascending/descending).

**Independent Test**: Load a mixed-level deck → filter by N5 shows only N5 cards (count matches breakdown), sort ascending orders N5→N4→N3, clear filter restores all cards.

### Implementation for User Story 5

- [ ] T017 [US5] Add JLPT filter controls to `ui/index.html` — filter bar with buttons: "All" (default active), "N5", "N4", "N3". Active button visually distinct.
- [ ] T018 [US5] Implement filter logic in `ui/app.js` — clicking a JLPT filter button: (a) updates active button state, (b) hides cards whose `jlpt_level` doesn't match, (c) updates progress counter for visible cards only, (d) "All" button clears filter and shows all cards.
- [ ] T019 [US5] Add JLPT sort control to `ui/index.html` — sort toggle button/dropdown with options: "Most Frequent" (default), "JLPT: N5→N3" (ascending), "JLPT: N3→N5" (descending).
- [ ] T020 [US5] Implement sort logic in `ui/app.js` — reorder cards array on sort change: N5→N3 ascending (N5 first), N3→N5 descending (N3 first), "Most Frequent" restores original order (occurrence_count descending per VocabularyList). Current card position preserved when possible after reorder.
- [ ] T021 [US5] Validate filter and sort — load sample-deck.json: (a) filter N5 → only 4 cards shown, (b) filter N3 → only 4 cards shown, (c) sort N5→N3 → first card is N5, last is N3, (d) sort N3→N5 → first card is N3, last is N5, (e) clear filter → all 12 cards restored, sort reverts to "Most Frequent."

**Checkpoint**: User Story 5 complete — full feature with filtering and sorting

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end validation and final quality checks

- [ ] T022 Add pipeline orchestration to `skills/flashcard-generator/SKILL.md` — a "Main Pipeline" section at the top that defines the full flow: (1) accept YouTube URL input, (2) validate URL (T003), (3) extract transcript via MCP (T004), (4) handle extraction errors (T005), (5) invoke vocabulary-extractor subagent (T008), (6) handle empty vocabulary (T009), (7) transform to flashcards (T010), (8) generate metadata (T011), (9) output FlashcardDeck JSON file (T012). This makes the skill the single entry point for the entire feature.
- [ ] T023 Run full quickstart.md validation — execute the 5 validation scenarios in `quickstart.md` end-to-end: (1) submit URL → transcript, (2) verify vocabulary output, (3) verify flashcard JSON, (4) verify UI with generated output, (5) run edge case tests (invalid URL, no captions, etc.).
- [ ] T024 Verify all success criteria from spec.md: SC-001 (E2E <2min for 15min video), SC-004 (all timestamp links functional, <3s offset), SC-005 (filter/sort <1s with 100 cards), SC-007 (2000-segment transcript without crash).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup (Phase 1) — BLOCKS UI development
- **US1 (Phase 3)**: Depends on Setup (Phase 1) — starts the core pipeline
- **US2 (Phase 4)**: Depends on US1 (Phase 3) — needs TranscriptBundle output
- **US3 (Phase 5)**: Depends on US2 (Phase 4) — needs VocabularyList output
- **US4 (Phase 6)**: Depends on Foundational (Phase 2) for sample data; integrates with US3 output format
- **US5 (Phase 7)**: Depends on US4 (Phase 6) — enhances existing UI
- **Polish (Phase 8)**: Depends on US1–US5 all complete

### User Story Dependencies

```
Phase 1: Setup
    ↓
Phase 2: Foundational (sample data)
    ↓
Phase 3: US1 (P1) — MCP transcript extraction
    ↓
Phase 4: US2 (P1) — Vocabulary extraction
    ↓
Phase 5: US3 (P2) — Flashcard generation
    ↓
Phase 6: US4 (P2) — Flashcard UI  ← also needs Phase 2
    ↓
Phase 7: US5 (P3) — Filter & sort
    ↓
Phase 8: Polish
```

- **US1 (P1)**: Starts after Setup. No dependencies on other stories.
- **US2 (P1)**: Depends on US1 (needs TranscriptBundle). Sequential — cannot parallelize with US1.
- **US3 (P2)**: Depends on US2 (needs VocabularyList). Sequential.
- **US4 (P2)**: Depends on Phase 2 (sample data) + US3 (FlashcardDeck schema). Can start sample-data-driven development in parallel with US2/US3 since the contract is known.
- **US5 (P3)**: Depends on US4 (needs existing UI to enhance).

### Within Each User Story

- Contract-defined tasks before validation
- Core implementation before integration
- Story validation before moving to next priority

### Parallel Opportunities

- **Phase 6 (US4)**: T013 (CSS) and T014 (HTML) can be built in parallel — different files, no dependencies
- **Phase 5 + Phase 6 overlap**: US4 UI development (T013, T014) can start as soon as Phase 2 sample data exists, running in parallel with US2/US3 pipeline work — the FlashcardDeck contract is the interface between them
- **Phase 7 (US5)**: Filter HTML (T017) and sort HTML (T019) can be added in parallel (different DOM elements)

---

## Parallel Example: Phase 6 (US4)

```bash
# Launch UI shell tasks in parallel (different files):
Task: "Create ui/flashcards.css in ui/flashcards.css"
Task: "Create ui/index.html — single-page HTML shell"
# Then sequential:
Task: "Implement core UI logic in ui/app.js"  # depends on HTML shell existing
Task: "Validate UI with sample data"          # depends on all three files
```

---

## Implementation Strategy

### MVP First (US1 + US2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 (transcript extraction)
4. Complete Phase 4: User Story 2 (vocabulary extraction)
5. **STOP and VALIDATE**: Test pipeline YouTube URL → vocabulary list
6. This is the minimal viable data pipeline

### Full MVP (US1–US4)

1. Complete Setup + Foundational
2. Complete US1 → US2 → US3 (data pipeline)
3. Complete US4 (UI) — can overlap with US2/US3 via sample data
4. **STOP and VALIDATE**: Full YouTube URL → interactive flashcards works
5. This is the complete feature MVP

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 → Test independently → Transcript extraction works
3. Add US2 → Test independently → Vocabulary extraction works (data pipeline MVP!)
4. Add US3 → Test independently → Flashcard JSON generation works
5. Add US4 → Test independently → End-to-end with UI (feature MVP!)
6. Add US5 → Test independently → Filter & sort (enhanced feature)
7. Phase 8: Polish → Production-ready

### Single Developer Strategy

Follow the dependency chain sequentially: T001 → T002 → T003–T006 (US1) → T007–T009 (US2) → T010–T012 (US3) → T013–T016 (US4) → T017–T021 (US5) → T022–T024 (Polish). UI shell (T013, T014) can be built while waiting for US3 completion since sample data is available.

---

## Notes

- [P] tasks = different files, no dependencies — can run concurrently
- [Story] label maps task to specific user story for traceability
- The file `skills/flashcard-generator/SKILL.md` is built incrementally across US1 (T003–T005), US2 (T008–T009), US3 (T010–T012), and Polish (T022) — each phase adds a new section
- Similarly, `ui/app.js` is built in US4 (T015) and extended in US5 (T018, T020)
- Validate at each checkpoint before proceeding to the next phase
- The YouTube MCP tool `mcp__youtube__download_youtube_url` is already available in the Claude Code session — no installation needed
- No package.json, no npm install, no build step — the project has zero external dependencies
