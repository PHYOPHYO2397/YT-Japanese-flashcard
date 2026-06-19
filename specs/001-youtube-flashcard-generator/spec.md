# Feature Specification: YouTube Japanese Flashcard Generator

**Feature Branch**: `001-youtube-flashcard-generator`

**Created**: 2026-06-18

**Status**: Draft

**Input**: User description: "User pastes a YouTube URL → system extracts Japanese transcript → generates vocabulary → converts to flashcards → displays UI. Focus on JLPT N5–N3 vocabulary. No authentication or database required. Output must be UI-ready JSON with timestamp links back to YouTube video."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Submit YouTube URL and Retrieve Transcript (Priority: P1)

A Japanese language learner finds a YouTube video they want to study from. They paste the video URL into the application and the system extracts the Japanese transcript (subtitles/closed captions), making it available for vocabulary analysis. The learner can see the transcript text with timestamps.

**Why this priority**: This is the entry point for the entire feature. Without a transcript, no vocabulary extraction or flashcard generation is possible. Delivers immediate value as a transcript viewer.

**Independent Test**: Can be fully tested by submitting a valid YouTube URL containing Japanese captions and verifying the complete transcript with timestamps is returned. Delivers standalone value as a transcript viewer.

**Acceptance Scenarios**:

1. **Given** a user has a valid YouTube URL with Japanese captions, **When** they submit the URL, **Then** the system extracts and displays the full Japanese transcript with timestamp markers for each subtitle segment.
2. **Given** a user submits a YouTube URL that has no Japanese captions available, **When** the system attempts extraction, **Then** the system displays a clear error message indicating no Japanese transcript is available and suggests trying a different video.
3. **Given** a user submits an invalid or malformed YouTube URL, **When** the system validates the input, **Then** the system displays an error message explaining the URL format is not recognized.
4. **Given** a user submits a URL to a video with auto-generated Japanese captions, **When** the system extracts the transcript, **Then** the system retrieves the auto-generated captions and notes their source (auto-generated vs. manual).

---

### User Story 2 - Extract JLPT-Relevant Vocabulary from Transcript (Priority: P1)

After a transcript is loaded, the system analyzes the Japanese text and identifies vocabulary items relevant to JLPT levels N5 through N3. Each identified word includes its reading (kana), meaning (English), part of speech, and JLPT level classification.

**Why this priority**: Vocabulary extraction is the core value proposition. Users come to this feature specifically to discover and learn new words from real Japanese content.

**Independent Test**: Can be tested by providing a known Japanese transcript and verifying that vocabulary items are correctly identified with readings, meanings, parts of speech, and JLPT levels. Delivers standalone value as a vocabulary discovery tool.

**Acceptance Scenarios**:

1. **Given** a Japanese transcript is loaded, **When** the system processes it for vocabulary, **Then** the system returns a list of vocabulary items, each containing: the word in Japanese, its reading (kana), English meaning, part of speech, and JLPT level (N5, N4, or N3).
2. **Given** a transcript contains words outside JLPT N5–N3 range (e.g., N2, N1, or unlisted), **When** the system identifies vocabulary, **Then** those words are excluded from results, keeping focus on N5–N3 level vocabulary.
3. **Given** a transcript contains the same word multiple times, **When** the system processes vocabulary, **Then** each unique word appears only once with consolidated occurrence data (count and list of timestamps where it appears).
4. **Given** a transcript is very short (fewer than 10 subtitle segments), **When** the system processes vocabulary, **Then** it still returns whatever N5–N3 vocabulary it finds, with a note if fewer than 5 words are identified.

---

### User Story 3 - Generate Flashcards from Vocabulary (Priority: P2)

The extracted vocabulary is converted into structured flashcards ready for study. Each flashcard contains the Japanese word on the front and the reading, meaning, part of speech, JLPT level, and a link back to the exact timestamp in the YouTube video where the word appears on the back.

**Why this priority**: Flashcards are the deliverable that bridges vocabulary discovery to actual study. Without this, users must manually create their own study materials. It depends on User Stories 1 and 2 being complete.

**Independent Test**: Can be tested by providing a known vocabulary list and verifying the output is valid, complete flashcards with all required fields and correct timestamp links.

**Acceptance Scenarios**:

1. **Given** a list of extracted vocabulary items with timestamps, **When** the system generates flashcards, **Then** each flashcard includes: front (Japanese word), back (reading, meaning, part of speech, JLPT level), and a clickable timestamp link to the YouTube video at the word's first occurrence.
2. **Given** a vocabulary word appears at multiple timestamps, **When** the flashcard is generated, **Then** the primary timestamp links to the first occurrence and additional timestamps are listed as secondary references.
3. **Given** the flashcard generation completes, **When** the output is produced, **Then** it is formatted as structured data (UI-ready JSON) that any flashcard display interface can consume without additional transformation.

---

### User Story 4 - View and Interact with Generated Flashcards (Priority: P2)

The user views the generated flashcards in a study interface. They can browse through the deck, flip cards to reveal answers, and click timestamp links to jump to that word's context in the original YouTube video.

**Why this priority**: The UI makes the output usable for actual study. Without it, users only have raw JSON. This can be developed independently once the JSON output format is defined in User Story 3.

**Independent Test**: Can be tested by loading a known flashcard JSON output and verifying all cards render correctly, flip interactions work, and timestamp links open the correct YouTube video position.

**Acceptance Scenarios**:

1. **Given** a set of flashcards is generated, **When** the user views them, **Then** all flashcards are displayed in a browsable deck with the Japanese word visible on each card face.
2. **Given** a user is viewing a flashcard, **When** they click to reveal the answer, **Then** the card flips (or expands) to show the reading, meaning, part of speech, and JLPT level.
3. **Given** a flashcard has a timestamp link, **When** the user clicks the link, **Then** the YouTube video opens at the exact moment where that word appears in context.
4. **Given** a user has browsed through the deck, **When** they finish, **Then** they can see how many cards they reviewed out of the total.

---

### User Story 5 - Filter and Sort Flashcards by JLPT Level (Priority: P3)

The user can filter the generated flashcard deck to show only cards of a specific JLPT level (N5, N4, or N3), or sort the deck by JLPT level to prioritize beginner vocabulary first.

**Why this priority**: Filtering enhances the study experience but is not essential for the core workflow. Users can still study all cards without filtering.

**Independent Test**: Can be tested by loading a mixed-level flashcard deck and verifying filter controls show only the selected level, and sort reorders cards by JLPT level correctly.

**Acceptance Scenarios**:

1. **Given** a flashcard deck contains N5, N4, and N3 cards, **When** the user filters by N5, **Then** only N5-level flashcards are displayed.
2. **Given** a flashcard deck is displayed, **When** the user sorts by JLPT level ascending, **Then** cards are ordered N5 first, then N4, then N3.
3. **Given** the user has applied a filter, **When** they clear the filter, **Then** all flashcards are displayed again.

---

### Edge Cases

- What happens when a YouTube video has Japanese captions that mix hiragana, katakana, and kanji with English or other languages interspersed?
- How does the system handle videos where the transcript is region-locked or blocked due to content restrictions?
- What happens when a video's transcript contains primarily non-vocabulary content (e.g., song lyrics, poetry, heavy slang)?
- How does the system handle extremely long transcripts (e.g., 2+ hour videos or livestream recordings) — is there a practical limit?
- What happens when auto-generated captions contain significant errors or misrecognized words?
- How are proper nouns (names, places, brands) handled in vocabulary extraction?
- What if the YouTube video is deleted or made private between transcript extraction and when the user clicks a timestamp link?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST accept a YouTube video URL as input from the user.
- **FR-002**: System MUST validate the input URL format and reject malformed or non-YouTube URLs with a clear error message.
- **FR-003**: System MUST extract the Japanese transcript (subtitles/closed captions) from the provided YouTube video, including timestamp data for each subtitle segment.
- **FR-004**: System MUST support both manually-uploaded Japanese captions and auto-generated Japanese captions.
- **FR-005**: System MUST produce a clear error message when no Japanese transcript is available for the submitted video.
- **FR-006**: System MUST analyze the extracted transcript and identify unique vocabulary items.
- **FR-007**: System MUST classify each identified vocabulary item with its JLPT level and filter results to include only N5, N4, and N3 level words.
- **FR-008**: System MUST provide for each vocabulary item: the Japanese word (as written), reading (kana/romaji), English meaning, and part of speech.
- **FR-009**: System MUST deduplicate repeated vocabulary, consolidating occurrences into a count with all associated timestamps.
- **FR-010**: System MUST generate flashcards from the extracted vocabulary, with the Japanese word on the front and the reading, meaning, part of speech, and JLPT level on the back.
- **FR-011**: System MUST include on each flashcard a primary timestamp link to the word's first occurrence in the YouTube video, with secondary timestamps for additional occurrences.
- **FR-012**: System MUST output flashcards as structured data in a UI-ready format that any display interface can consume without transformation.
- **FR-013**: System MUST provide a user interface to browse, flip, and interact with the generated flashcards.
- **FR-014**: System MUST allow users to click timestamp links on flashcards to open the YouTube video at the exact moment of the word's occurrence.
- **FR-015**: System MUST allow users to filter the flashcard deck by JLPT level (N5, N4, N3).
- **FR-016**: System MUST allow users to sort the flashcard deck by JLPT level.
- **FR-017**: System MUST operate without requiring user authentication or persistent database storage.

### Key Entities

- **YouTube Video**: Represents the source content. Key attributes: URL, video ID, title, transcript availability status.
- **Transcript Segment**: A portion of the Japanese transcript. Key attributes: text content, start timestamp, end timestamp, source type (manual or auto-generated).
- **Vocabulary Item**: A unique Japanese word identified in the transcript. Key attributes: written form, reading, English meaning, part of speech, JLPT level, occurrence count, associated timestamps.
- **Flashcard**: A study card generated from a vocabulary item. Key attributes: front content (Japanese word), back content (reading, meaning, part of speech, JLPT level), primary timestamp link, secondary timestamp links, JLPT level.

### Non-Functional Requirements

- **NFR-001**: Transcript extraction MUST complete within 30 seconds for videos under 30 minutes in length.
- **NFR-002**: Vocabulary extraction and flashcard generation MUST complete within 60 seconds for transcripts containing up to 500 subtitle segments.
- **NFR-003**: The flashcard UI MUST respond to user interactions (flip, filter, sort) within 500 milliseconds.
- **NFR-004**: Error messages MUST be displayed in plain language understandable by a non-technical language learner.
- **NFR-005**: The system MUST gracefully handle transcripts of at least 2,000 subtitle segments without crashing or becoming unresponsive.

### Constraints

- **C-001**: YouTube transcript extraction MUST use the YouTube MCP integration.
- **C-002**: Vocabulary identification MUST be performed by a dedicated vocabulary-extractor subagent.
- **C-003**: Flashcard generation MUST use a dedicated flashcard generation skill.
- **C-004**: The system MUST NOT require user authentication or account creation.
- **C-005**: The system MUST NOT require persistent database storage; all processing is session-based.
- **C-006**: Flashcard output MUST be JSON-structured for UI consumption.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can submit a YouTube URL and receive a complete set of flashcards in under 2 minutes total (end-to-end) for a typical 15-minute video.
- **SC-002**: At least 90% of vocabulary items identified by the system are correctly classified for JLPT level (N5, N4, or N3) when verified against official JLPT vocabulary lists.
- **SC-003**: At least 95% of identified vocabulary items have accurate readings and English meanings.
- **SC-004**: All generated flashcards include functional timestamp links that, when clicked, open the YouTube video within 3 seconds of the word's actual occurrence.
- **SC-005**: A user can filter or sort a deck of 100 flashcards and see results updated within 1 second.
- **SC-006**: 80% of users can successfully generate a flashcard deck from a YouTube URL on their first attempt without needing help or documentation.
- **SC-007**: The system can process a video with up to 2,000 transcript segments without errors or timeouts.

## Assumptions

- YouTube videos used as input are publicly accessible and not region-blocked or age-restricted in a way that prevents transcript access.
- The target user is a Japanese language learner familiar with JLPT levels and basic Japanese writing systems (hiragana, katakana, kanji).
- Users have a stable internet connection capable of streaming YouTube video content.
- The YouTube MCP integration is available and functional for transcript extraction.
- Videos with manually-uploaded Japanese captions will yield higher quality vocabulary extraction than auto-generated captions, but both are acceptable inputs.
- A single session processes one YouTube URL at a time (no batch processing of multiple URLs).
- The system is designed for individual use; concurrent multi-user support is out of scope for the initial version.
- Proper nouns (names, places, brand names) that appear in transcripts and are not part of standard JLPT vocabulary will be filtered out during vocabulary extraction.
- Mobile-responsive design is out of scope for the initial version; the UI targets desktop browser use.
- The initial version supports Japanese-to-English vocabulary only; other language pairs are out of scope.
