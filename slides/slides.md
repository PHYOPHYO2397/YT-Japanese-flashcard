---
marp: true
paginate: true
transition: fade
# PechaKucha: 6 slides, 20s auto-advance. Do not change the count.
auto-advance: 20
---

<!-- slide 1 -->
# Who's my person?

Japanese learners who watch YouTube for immersion — but struggle to pull vocabulary out of native content without pausing every 5 seconds to look up words.

<!-- 20s -->

---

<!-- slide 2 -->
# Their problem

They watch Japanese YouTube videos for listening practice, but turning what they hear into study material means:
- Manually writing down every unknown word
- Looking up readings and meanings one by one
- Figuring out JLPT level by hand
- Missing the exact moment a word was spoken

It takes longer to extract the vocab than to watch the video.

---

<!-- slide 3 -->
# What I built

A Claude Code system with two pipelines — both producing JLPT-graded flashcard decks. No auth, no database, no setup.

**Batch (primary):** Type "download top 3 N4 listening videos" → yt-dlp downloads `.srt` → Python pipeline → FlashcardDeck JSON

**Single-URL (alternative):** Paste a YouTube link → MCP transcript → AI vocabulary extraction → FlashcardDeck JSON

**Shared UI:** Warm dark-themed flashcard viewer with flip animation, keyboard nav, JLPT color coding. Plus a landing page built with Magic MCP.

---

<!-- slide 4 -->
# How I built it

**Batch pipeline (primary workflow):**
- **Skill** (`subtitle-downloader`): yt-dlp search → `.ja.srt` download with manual→auto fallback
- **Python**: `parse_srt.py` → `compress_transcript.py` → `extract_candidates.py` → `generate_flashcards.py`

**Single-URL pipeline (alternative):**
- **MCP** (`.mcp.json`): `youtube-transcript` + `youtube` — two-tool fallback for Japanese subtitles
- **Agent** (`vocabulary-extractor`): CJK tokenization, stopword filtering, structured JSON
- **Skill** (`flashcard-generator`): URL validation → MCP → subagent → JSON output

**UI (Magic MCP + hand-coded):**
- **Magic MCP** (21st.dev): Landing page hero, pipeline visualization, demo card, feature grid
- **Hand-coded**: 3D flip cards with tilt, filter/sort, pagination, progress counter

---

<!-- slide 5 -->
# Why it matters

Turns passive watching into active study — without spending an hour manually mining vocabulary from a 15-minute video.

Two ways to use it, depending on what you need:
- **Batch:** "Download top 3 N4 videos" → multiple decks at once from search results
- **Single:** Paste a specific URL → one deck from a video you already know

Either way: readings, meanings, JLPT levels, and timestamp links back to every word occurrence. No login. No backend. Just Claude Code.

---

<!-- slide 6 -->
# Done checklist

- [x] repo public
- [x] MCP + skill + agent used
- [x] report.md in team repo
- [x] `.mcp.json` — 3 servers: youtube-transcript, youtube, magic (21st.dev)
- [x] Batch pipeline: subtitle-downloader skill + 4 Python scripts
- [x] Single-URL pipeline: flashcard-generator skill + vocabulary-extractor agent
- [x] 4 FlashcardDeck outputs in `output/`
- [x] Landing page with hero, pipeline viz, and interactive demo (Magic MCP)
- [x] Flashcard viewer with warm dark theme, keyboard nav, JLPT filter/sort
