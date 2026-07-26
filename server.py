#!/usr/bin/env python3
"""
Local server: YouTube URL → batch pipeline → flashcards.
Usage: python3 server.py   (http://localhost:8080)
"""
import http.server, json, os, re, subprocess, tempfile, urllib.parse, urllib.request
from pathlib import Path
from datetime import datetime, timezone

PORT = 8080
ROOT = Path(__file__).parent
OUTPUT_DIR = ROOT / "output"
OUTPUT_DIR.mkdir(exist_ok=True)


def has_japanese(text):
    for c in text:
        cp = ord(c)
        if 0x3040 <= cp < 0x30A0 or 0x30A0 <= cp < 0x3100 or 0x4E00 <= cp < 0x9FFF:
            return True
    return False


def fetch_transcript_direct(video_id):
    """Fetch Japanese transcript directly from YouTube's timedtext API (bypasses yt-dlp rate limits)."""
    # Get video page to extract caption track info
    req = urllib.request.Request(
        f"https://www.youtube.com/watch?v={video_id}",
        headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode("utf-8", errors="replace")
    except Exception:
        return None

    # Find caption track URLs — look for timedtext URLs with Japanese
    # Pattern: "baseUrl":"https://www.youtube.com/api/timedtext?..."
    matches = re.findall(r'"baseUrl"\s*:\s*"([^"]*timedtext[^"]*)"', html)
    ja_url = None
    for url in matches:
        url_clean = url.replace("\\u0026", "&")
        if "lang=ja" in url_clean or "lang%3Dja" in url_clean:
            ja_url = url_clean
            break

    if not ja_url:
        # Try any Japanese variant
        for url in matches:
            url_clean = url.replace("\\u0026", "&")
            if "ja" in url_clean.lower():
                ja_url = url_clean
                break

    if not ja_url:
        return None

    # Fetch the transcript XML
    ja_url = ja_url.replace("\\u0026", "&")
    req2 = urllib.request.Request(ja_url, headers={
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"})
    try:
        with urllib.request.urlopen(req2, timeout=15) as resp:
            xml = resp.read().decode("utf-8", errors="replace")
    except Exception:
        return None

    # Parse XML transcript
    segments = []
    for m in re.finditer(r'<text start="([\d.]+)" dur="([\d.]+)"[^>]*>(.*?)</text>', xml):
        start = float(m.group(1))
        dur = float(m.group(2))
        text = re.sub(r'<[^>]+>', '', m.group(3)).strip()
        text = text.replace("&amp;", "&").replace("&#39;", "'").replace("&quot;", '"')
        if text:
            segments.append({
                "text": text,
                "start_time": round(start, 3),
                "end_time": round(start + dur, 3),
                "segment_index": len(segments),
                "source": "auto_generated"
            })
    return segments if segments else None


# ── SRT parsing ───────────────────────────────────────────
SRT_RE = re.compile(
    r'(\d+)\s*\n(\d+):(\d+):(\d+)[.,](\d+)\s*-->\s*'
    r'(\d+):(\d+):(\d+)[.,](\d+)\s*\n([\s\S]+?)(?=\n\n|\n?\Z)')


def parse_srt(path):
    with open(path) as f:
        content = f.read()
    segs = []
    for m in SRT_RE.finditer(content):
        s = int(m[2])*3600 + int(m[3])*60 + int(m[4]) + int(m[5])/1000
        e = int(m[6])*3600 + int(m[7])*60 + int(m[8]) + int(m[9])/1000
        text = m[10].strip().replace('\n', ' ')
        if text:
            segs.append({"text": text, "start_time": round(s, 3),
                         "end_time": round(e, 3), "segment_index": len(segs),
                         "source": "auto_generated"})
    return segs


# ── Transcript compression ────────────────────────────────
def compress_transcript(bundle):
    text_map = {}
    for seg in bundle["segments"]:
        key = seg["text"].strip()
        if not key:
            continue
        if key not in text_map:
            text_map[key] = {"text": key, "count": 0, "timestamps": [],
                             "first_index": seg["segment_index"]}
        text_map[key]["count"] += 1
        text_map[key]["timestamps"].append(seg["start_time"])
    return sorted(
        [{"text": v["text"], "occurrence_count": v["count"],
          "timestamps": v["timestamps"], "first_segment_index": v["first_index"]}
         for v in text_map.values()],
        key=lambda x: x["first_segment_index"])


# ── Vocabulary extraction ─────────────────────────────────
STOPWORDS = set(list(
    "は が を に へ で と も か の や よ ね わ から まで より だけ しか "
    "ばかり ほど くらい など でも さえ いる ある する できる なる いう "
    "この その あの どの これ それ あれ どれ ここ そこ あそこ どこ "
    "わたし ぼく おれ あなた きみ こう そう ああ どう "
    "ため よう こと もの とき ところ ほう だ です ます ました でした "
    "って とか だよ だね かな けど でも て た ない ます れる られる "
    "し い う お から まで より ほど ぐらい くらい "
    # Single kanji that appear everywhere but aren't useful as flashcards
    "日 人 大 小 中 一 二 三 四 五 六 七 八 九 十 年 月 時 分 秒 "
    "円 本 水 火 木 金 土 山 川 花 鳥 風 雨 雪 空 海 田 "
    "上 下 左 右 前 後 内 外 高 安 新 古 明 暗 長 短 "
    "私 何 誰 方 思 言 行 見 聞 食 飲 書 読 泳 走 歩 "
    "的 用 件 体 回 番 組 階 度 所 部 社 校 家 会 市 村 省 "
    "男 女 子 親 子 先 生 今 父 母 兄 弟 姉 妹 "
    "朝 昼 夜 午 後 前 時 間 週 土 日 月 火 水 木 金".split()))


def extract_vocabulary(compressed_segments):
    """Extract Japanese compound words (2+ chars) from transcript."""
    word_data = {}
    for seg in compressed_segments:
        text = seg["text"]
        if not has_japanese(text):
            continue
        # Extract kanji compounds (2+ kanji) and mixed kanji-kana words
        tokens = re.findall(r'[一-鿿぀-ゟ゠-ヿ]{2,}', text)
        for tok in tokens:
            if tok in STOPWORDS or len(tok) < 2:
                continue
            # Skip if all same character repeated
            if len(set(tok)) == 1:
                continue
            if tok not in word_data:
                word_data[tok] = {"count": 0, "timestamps": [], "first_ctx": text}
            word_data[tok]["count"] += seg["occurrence_count"]
            word_data[tok]["timestamps"].extend(seg["timestamps"])
    return sorted(word_data.items(), key=lambda x: x[1]["count"], reverse=True)


# ── Flashcard deck ────────────────────────────────────────
def build_deck(video_id, video_title, vocabulary, youtube_url):
    cards, jlpt = [], {}
    for i, (word, info) in enumerate(vocabulary):
        ts = int(info["timestamps"][0]) if info["timestamps"] else 0
        jlpt["N/A"] = jlpt.get("N/A", 0) + 1
        cards.append({
            "id": f"card-{i+1:03d}", "front": word,
            "back": {"reading": "", "meaning": info["first_ctx"][:50],
                     "part_of_speech": "unknown", "jlpt_level": "N/A",
                     "occurrence_count": info["count"]},
            "jlpt_level": "N/A",
            "youtube_link": f"https://www.youtube.com/watch?v={video_id}&t={ts}s",
            "secondary_links": [f"https://www.youtube.com/watch?v={video_id}&t={int(t)}s"
                                for t in info["timestamps"][1:8]],
            "context_snippet": info["first_ctx"][:200]})
    return {"meta": {"video_id": video_id, "video_title": video_title,
                     "youtube_url": youtube_url,
                     "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                     "total_cards": len(cards), "jlpt_breakdown": jlpt},
            "cards": cards}


# ── Pipeline ──────────────────────────────────────────────
def run_pipeline(youtube_url):
    # extract video_id
    m = re.search(r'(?:watch\?v=|youtu\.be/|embed/|shorts/)([A-Za-z0-9_-]{11})', youtube_url)
    if not m:
        return None, "Invalid YouTube URL"
    video_id = m.group(1)

    # check cache
    out = OUTPUT_DIR / f"flashcards-{video_id}.json"
    if out.exists():
        with open(out) as f:
            return json.load(f), None

    # Try direct YouTube API first (no rate limit issues), then fall back to yt-dlp
    segments = fetch_transcript_direct(video_id)
    if not segments:
        # Fallback: yt-dlp with retry
        import time
        with tempfile.TemporaryDirectory() as tmp:
            for attempt in range(2):
                result = subprocess.run(
                    ["yt-dlp", "--write-subs", "--write-auto-subs",
                     "--sub-format", "srt", "--skip-download",
                     "--sub-langs", "ja",
                     "-o", f"{tmp}/%(id)s.%(ext)s", youtube_url],
                    capture_output=True, text=True, timeout=60)
                srt = list(Path(tmp).glob("*.srt"))
                if srt:
                    segments = parse_srt(str(srt[0]))
                    break
                if "429" in result.stderr:
                    time.sleep(5 * (attempt + 1))
                    continue
                break
    if not segments:
        return None, "No Japanese captions found for this video"

    sample = " ".join(s["text"] for s in segments[:20])
    if not has_japanese(sample):
        return None, "Japanese subtitles not available"

    title = subprocess.run(["yt-dlp", "--get-title", "--no-warnings",
                            youtube_url], capture_output=True, text=True, timeout=30)
    video_title = title.stdout.strip() or "YouTube Video"

    # compress + extract vocabulary + build deck
    compressed = compress_transcript({"segments": segments})
    vocabulary = extract_vocabulary(compressed)
    if not vocabulary:
        return None, "No vocabulary found"

    deck = build_deck(video_id, video_title, vocabulary, youtube_url)
    with open(out, "w") as f:
        json.dump(deck, f, ensure_ascii=False, indent=2)
    return deck, None


# ── HTTP server ───────────────────────────────────────────
class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT / "ui"), **kw)

    def do_GET(self):
        if self.path.startswith("/api/generate"):
            params = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            url = params.get("url", [None])[0]
            if not url:
                return self.send_json(400, {"error": "Missing url"})
            try:
                deck, err = run_pipeline(url)
                self.send_json(400 if err else 200,
                               {"error": err} if err else deck)
            except Exception as e:
                self.send_json(500, {"error": str(e)})
            return
        super().do_GET()

    def send_json(self, code, data):
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", len(body))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    print(f"Flashcard Generator — http://localhost:{PORT}")
    http.server.HTTPServer(("localhost", PORT), Handler).serve_forever()
