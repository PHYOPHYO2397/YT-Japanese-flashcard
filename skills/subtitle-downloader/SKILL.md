---
name: subtitle-downloader
description: >
  Download Japanese subtitles from YouTube videos. Use this skill whenever the user
  wants to download Japanese subtitles, Japanese captions, Japanese subs, or .srt
  files from YouTube — whether they provide a search query ("get Japanese subs for
  N4 listening practice"), a single YouTube URL, or mention extracting subtitles
  from YouTube. Uses yt-dlp with a manual-first-then-auto fallback strategy.
  Also use when the user talks about getting Japanese transcripts from YouTube
  videos in bulk or by search topic.
---

# Subtitle Downloader

Download Japanese subtitles (SRT) from YouTube videos using yt-dlp.
Supports both search queries (top 5 results by default) and direct URLs.

## Input modes

| Mode | What the user provides | Behavior |
|------|----------------------|----------|
| **Search** | A search query (e.g., "Japanese N3 listening", "みんなの日本語 会話") | Search YouTube, download subtitles for top 5 results |
| **Direct URL** | A full YouTube URL (`youtube.com/watch?v=...` or `youtu.be/...`) | Download subtitles for that single video |

User can override the top-N count by saying a specific number (e.g., "download top 10", "get 3 videos").

## Workflow

### Step 1: Determine mode and search (if needed)

**If the user gave a direct YouTube URL**, skip to Step 2 with that URL.

**If the user gave a search query**, run:

```bash
yt-dlp "ytsearch5:{query}" --print "%(id)s\t%(title)s\t%(uploader)s" --skip-download 2>/dev/null
```

Replace `5` with the user's requested count if they specified one. The output is tab-separated lines:

```
dQw4w9WgXcQ	Video Title Here	Channel Name
```

If no results are returned, tell the user: "No YouTube videos found for that search query. Try different keywords."

### Step 2: Download subtitles (for each video)

For each video URL (constructed as `https://www.youtube.com/watch?v={video_id}`), try manual captions first, then auto-generated as fallback.

**Attempt 1 — Manual captions:**

```bash
yt-dlp \
  --write-subs \
  --sub-format srt \
  --sub-langs "ja" \
  --skip-download \
  -o "subtitles/%(uploader)s/%(title)s.%(ext)s" \
  "https://www.youtube.com/watch?v={video_id}"
```

**Check the result.** yt-dlp prints what it downloaded. If a `.ja.srt` file was written, this video is done — move to the next one.

Common signals that manual captions weren't available:
- yt-dlp prints "no subtitles available" or "no video subtitles found"
- No `.ja.srt` file appears in `subtitles/{channel_name}/`
- The output says the subtitle language is not available

**Attempt 2 — Auto-generated captions (only if Attempt 1 failed):**

```bash
yt-dlp \
  --write-auto-subs \
  --sub-format srt \
  --sub-langs "ja" \
  --skip-download \
  -o "subtitles/%(uploader)s/%(title)s.%(ext)s" \
  "https://www.youtube.com/watch?v={video_id}"
```

If this also fails (no Japanese captions exist at all), report that video as skipped with the reason: no Japanese subtitles available.

### Step 3: Report results

Summarize what happened:

```
Downloaded:
  ✅ Channel Name / Video Title.ja.srt  (manual)
  ✅ Channel Name / Another Video.ja.srt  (auto-generated)

Skipped:
  ⏭️ Video Title — no Japanese subtitles available
```

Use `(manual)` or `(auto-generated)` labels so the user knows the caption quality.

The output template `subtitles/%(uploader)s/%(title)s.%(ext)s` produces:

```
subtitles/
├── 日本語の森/
│   ├── JLPT N3 文法 〜わけだ.ja.srt
│   └── ...
├── Miku Real Japanese/
│   └── ...
```

## Edge cases

- **Video has no Japanese captions at all** (manual or auto): Skip that video, mention it in the summary, continue with remaining videos.
- **Video is private/deleted/unavailable**: yt-dlp will error. Skip it, mention it, continue.
- **Channel name or title contains characters that are invalid in filenames** (`/`, `:`, etc.): yt-dlp sanitizes these automatically with its output template.
- **Network errors during download**: Retry once for that video. If it fails again, skip and continue.
- **yt-dlp not found**: Tell the user to install it: `brew install yt-dlp`.
- **Search returns 0 results**: Tell the user no videos matched and suggest different keywords.

## Notes

- The `--skip-download` flag means only subtitles are downloaded, not the video itself.
- The output directory `subtitles/` is created automatically by yt-dlp if it doesn't exist.
- Manual captions are preferred because they're human-uploaded and more accurate. Auto-generated captions may contain recognition errors.
