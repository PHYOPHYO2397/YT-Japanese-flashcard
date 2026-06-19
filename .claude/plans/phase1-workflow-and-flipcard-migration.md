# Plan: Phase 1 Workflow Update + Flip-Card Component Migration

## Summary
1. Migrate `ui/index.html` + `ui/flashcards.css` + `ui/app.js` to use the flip-card component's HTML/CSS naming conventions
2. Update the root landing page copy to reflect Phase 1 (CLI-based pipeline, not browser URL input)
3. Update `workflow.md` with Phase 1/Phase 2 distinction
4. Make `ui/flip-card-demo.html` reference shared `flashcards.css` instead of duplicating styles

---

## 1. Flip-Card Component Migration (ui/)

### Why
The user added a flip-card component with cleaner naming: `.flip-card-inner`, `.flip-card-face`, `.flip-card-front`, `.flip-card-back`. The current flashcard viewer uses `.card`, `.card-face`, `.card-front`, `.card-back`. Align them.

### What changes

**`ui/index.html` — HTML markup:**
- Change `<div class="card" id="card">` → `<div class="flip-card-inner" id="flipCardInner">`
- Change `.card-face.card-front` → `.flip-card-face.flip-card-front`
- Change `.card-face.card-back` → `.flip-card-face.flip-card-back`
- Update child element IDs to match naming: `cardFront` → `flipCardFront` (or keep IDs for minimal JS changes — prefer updating JS instead)
- Use `position: absolute; inset: 0` on faces (like flip-card-demo does) instead of current `min-height`

**`ui/flashcards.css` — CSS class rename:**
- `.card` → `.flip-card-inner`
- `.card-face` → `.flip-card-face`
- `.card-front` → `.flip-card-front`
- `.card-back` → `.flip-card-back`
- `.card-face` uses `position: absolute; inset: 0; height: 100%` not `min-height`
- Keep all existing design tokens, colors, borders, font sizes
- Keep variant classes: `.flip-vertical`, `.flip-hover`, `.flip-disabled`, `.flipped`
- Keep `.deck` wrapper (perspective container)
- Keep JLPT badge styles, youtube-link, nav, controls, breakdown, state styles

**`ui/app.js` — DOM refs and logic:**
- `$('card')` → `$('flipCardInner')`
- `$('cardFront')` → `$('cardFront')` (keep ID, just update CSS class on the element)
- Actually, keep all IDs the same to minimize churn — only the CSS class names change
- No JS logic changes needed beyond the card ID reference

**`ui/flip-card-demo.html` — Remove duplicate styles:**
- Replace inline card styles with `<link rel="stylesheet" href="flashcards.css">`
- Keep only demo-specific styles: grid layout, color themes (back-rose, etc.), legend
- Demo card structure already matches the new naming

## 2. Landing Page Copy Update (root index.html)

### Phase 1 Reality
The current workflow is CLI-based: the developer provides a YouTube URL inside Claude Code, the pipeline runs (MCP transcript → subagent vocabulary → skill flashcard generation), and a `FlashcardDeck.json` file is the output. The user opens `ui/index.html` to study.

Phase 2 (future) will add browser-based URL input.

### Copy changes

| Element | Before | After |
|---------|--------|-------|
| Hero badge | "Now supports JLPT N5 · N4 · N3" | "Claude-powered · JLPT N5–N3 · Instant decks" |
| Hero title | "YouTube videos become Japanese flashcards in minutes, not hours" | Keep — still accurate |
| Hero desc | "Paste any Japanese YouTube link. Our AI extracts..." | "Drop a YouTube link into Claude Code. The AI pipeline extracts vocabulary, classifies by JLPT level, and generates timestamp-linked flashcards — ready to study in your browser immediately." |
| Hero CTA primary | "Try It Now — It's Free" | "Open the Flashcard Viewer" |
| Pipeline step 1 | "Paste URL — Drop any YouTube link" | "Provide URL — Share a Japanese YouTube video with Claude" |
| Pipeline intro | "A fully automated pipeline takes any Japanese video..." | Keep |
| CTA section title | "Paste a YouTube link. Get your first deck in minutes." | "Open a deck. Start studying now." |
| CTA section desc | "No setup. No account. No waiting..." | "This sample deck was generated from a real JLPT N5 vocabulary video. Open it to see the full interactive study experience — flip cards, filter by level, and jump to timestamps." |
| CTA section URL input | Remove the input row entirely | Just the button to `ui/index.html` |

Remove `.cta-input-row`, `.cta-input`, `.cta-hint` from the CTA section. Keep the button.

## 3. Workflow Document Update

**`specs/001-youtube-flashcard-generator/workflow.md`:**
- Add a header note: "## Phase 1 vs Phase 2"
- Phase 1: Pipeline invoked inside Claude Code via `skills/flashcard-generator/SKILL.md`. Developer provides URL → MCP extracts transcript → subagent identifies vocabulary → skill generates FlashcardDeck JSON. User opens `ui/index.html` to study.
- Phase 2 (planned): Browser-based URL input. User pastes URL directly in the web UI. Pipeline runs automatically.

---

## Files modified
1. `ui/flashcards.css` — class rename to flip-card convention
2. `ui/index.html` — markup rename to flip-card convention
3. `ui/app.js` — card element ID update
4. `ui/flip-card-demo.html` — reference shared CSS
5. `index.html` (root) — landing page copy for Phase 1
6. `specs/001-youtube-flashcard-generator/workflow.md` — add Phase 1/2 note

## Files NOT modified
- `ui/sample-data/` — no changes
- `skills/` — no changes
- `subagents/` — no changes
- `specs/` contracts — no changes
