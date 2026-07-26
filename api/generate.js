/**
 * Vercel Serverless Function — /api/generate?url=<youtube_url>
 *
 * Pipeline:
 *  1. Fetch YouTube transcript via youtube-transcript-plus (handles PO tokens)
 *  2. Extract vocabulary (compound words)
 *  3. Build flashcard deck JSON
 */

const {
  fetchTranscript,
  YoutubeTranscriptNotAvailableLanguageError,
  YoutubeTranscriptTooManyRequestError,
  YoutubeTranscriptNotAvailableError,
  YoutubeTranscriptDisabledError,
} = require('youtube-transcript-plus');

const STOPWORDS = new Set(
  ('は が を に へ で と も か の や よ ね わ から まで より だけ しか '
    + 'ばかり ほど くらい など でも さえ いる ある する できる なる いう '
    + 'この その あの どの これ それ あれ どれ ここ そこ あそこ どこ '
    + 'わたし ぼく おれ あなた きみ こう そう ああ どう '
    + 'ため よう こと もの とき ところ ほう だ です ます ました でした '
    + 'って とか だよ だね かな けど でも て た ない ます れる られる '
    + 'し い う お から まで より ほど ぐらい くらい '
    + '日 人 大 小 中 一 二 三 四 五 六 七 八 九 十 年 月 時 分 秒 '
    + '円 本 水 火 木 金 土 山 川 花 鳥 風 雨 雪 空 海 田 '
    + '上 下 左 右 前 後 内 外 高 安 新 古 明 暗 長 短 '
    + '私 何 誰 方 思 言 行 見 聞 食 飲 書 読 泳 走 歩 '
    + '的 用 件 体 回 番 組 階 度 所 部 社 校 家 会 市 村 省 '
    + '男 女 子 親 子 先 生 今 父 母 兄 弟 姉 妹 '
    + '朝 昼 夜 午 後 前 時 間 週 土 日 月 火 水 木 金'
  ).split(/\s+/)
);

// ── Helpers ──────────────────────────────────────────────────────────────────

function hasJapanese(text) {
  for (let i = 0; i < text.length; i++) {
    const cp = text.charCodeAt(i);
    if (
      (cp >= 0x3040 && cp < 0x30a0) || // hiragana
      (cp >= 0x30a0 && cp < 0x3100) || // katakana
      (cp >= 0x4e00 && cp < 0x9fff)    // kanji
    ) {
      return true;
    }
  }
  return false;
}

function extractVideoId(url) {
  const m = url.match(
    /(?:watch\?v=|youtu\.be\/|embed\/|shorts\/|v\/)([A-Za-z0-9_-]{11})/
  );
  return m ? m[1] : null;
}

// ── Transcript fetcher ───────────────────────────────────────────────────────

/**
 * Custom fetch wrapper with browser-like headers for YouTube requests.
 * YouTube blocks requests from cloud IPs with bot-like headers.
 */
async function youtubeFetch(params) {
  const res = await fetch(params.url, {
    method: params.method || 'GET',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      ...(params.headers || {}),
    },
    body: params.body,
    signal: params.signal,
  });
  return res;
}

async function fetchVideoTranscript(videoId) {
  // Attempt 1: youtube-transcript-plus with retries and browser-like headers
  try {
    const transcript = await fetchTranscript(videoId, {
      lang: 'ja',
      retries: 2,
      retryDelay: 2000,
      videoFetch: youtubeFetch,
      playerFetch: youtubeFetch,
      transcriptFetch: youtubeFetch,
    });
    if (!transcript || !transcript.length) return null;

    const segments = transcript.map((item, i) => ({
      text: item.text,
      start_time: Math.round((item.offset / 1000) * 1000) / 1000,
      end_time: Math.round(((item.offset + item.duration) / 1000) * 1000) / 1000,
      segment_index: i,
      source: 'auto_generated',
    }));

    return { title: 'YouTube Video', segments };
  } catch (err) {
    // Japanese not available — check if any captions exist at all
    if (err instanceof YoutubeTranscriptNotAvailableLanguageError) {
      try {
        const anyTranscript = await fetchTranscript(videoId, {
          retries: 1,
          videoFetch: youtubeFetch,
          playerFetch: youtubeFetch,
          transcriptFetch: youtubeFetch,
        });
        if (anyTranscript && anyTranscript.length) {
          return { title: 'YouTube Video', segments: [], error: 'not_japanese' };
        }
      } catch { /* ignore */ }
      return null;
    }
    // TooManyRequests or other errors — retry once more after a delay
    if (err instanceof YoutubeTranscriptTooManyRequestError) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const transcript = await fetchTranscript(videoId, {
          lang: 'ja',
          videoFetch: youtubeFetch,
          playerFetch: youtubeFetch,
          transcriptFetch: youtubeFetch,
        });
        if (!transcript || !transcript.length) return null;
        const segments = transcript.map((item, i) => ({
          text: item.text,
          start_time: Math.round((item.offset / 1000) * 1000) / 1000,
          end_time: Math.round(((item.offset + item.duration) / 1000) * 1000) / 1000,
          segment_index: i,
          source: 'auto_generated',
        }));
        return { title: 'YouTube Video', segments };
      } catch { /* fall through to null */ }
    }
    return null;
  }
}

// ── Vocabulary extraction ────────────────────────────────────────────────────

function compressTranscript(segments) {
  const textMap = new Map();
  for (const seg of segments) {
    const key = seg.text.trim();
    if (!key) continue;
    if (!textMap.has(key)) {
      textMap.set(key, { text: key, count: 0, timestamps: [], first_index: seg.segment_index });
    }
    const entry = textMap.get(key);
    entry.count += 1;
    entry.timestamps.push(seg.start_time);
  }
  return [...textMap.values()]
    .sort((a, b) => a.first_index - b.first_index)
    .map((v) => ({
      text: v.text,
      occurrence_count: v.count,
      timestamps: v.timestamps,
      first_segment_index: v.first_index,
    }));
}

function extractVocabulary(compressed) {
  const wordData = new Map();
  for (const seg of compressed) {
    if (!hasJapanese(seg.text)) continue;
    const tokens = seg.text.match(/[一-鿿぀-ゟ゠-ヿ]{2,}/g) || [];
    for (const tok of tokens) {
      if (STOPWORDS.has(tok) || tok.length < 2) continue;
      if (new Set(tok).size === 1) continue; // all same char repeated
      if (!wordData.has(tok)) {
        wordData.set(tok, { count: 0, timestamps: [], first_ctx: seg.text });
      }
      const entry = wordData.get(tok);
      entry.count += seg.occurrence_count;
      entry.timestamps.push(...seg.timestamps);
    }
  }
  return [...wordData.entries()]
    .sort((a, b) => b[1].count - a[1].count);
}

// ── Deck builder ─────────────────────────────────────────────────────────────

function buildDeck(videoId, videoTitle, vocabulary, youtubeUrl) {
  const cards = [];
  const jlpt = {};

  for (let i = 0; i < vocabulary.length; i++) {
    const [word, info] = vocabulary[i];
    const ts = info.timestamps.length ? Math.floor(info.timestamps[0]) : 0;
    jlpt['N/A'] = (jlpt['N/A'] || 0) + 1;

    cards.push({
      id: `card-${String(i + 1).padStart(3, '0')}`,
      front: word,
      back: {
        reading: '',
        meaning: info.first_ctx.slice(0, 50),
        part_of_speech: 'unknown',
        jlpt_level: 'N/A',
        occurrence_count: info.count,
      },
      jlpt_level: 'N/A',
      youtube_link: `https://www.youtube.com/watch?v=${videoId}&t=${ts}s`,
      secondary_links: info.timestamps.slice(1, 8).map(
        (t) => `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(t)}s`
      ),
      context_snippet: info.first_ctx.slice(0, 200),
    });
  }

  return {
    meta: {
      video_id: videoId,
      video_title: videoTitle,
      youtube_url: youtubeUrl,
      generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      total_cards: cards.length,
      jlpt_breakdown: jlpt,
    },
    cards,
  };
}

// ── Vercel handler ───────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url } = req.query || {};
  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  const videoId = extractVideoId(url);
  if (!videoId) {
    return res.status(400).json({ error: 'Invalid YouTube URL' });
  }

  try {
    // 1. Fetch transcript
    let result;
    try {
      result = await fetchVideoTranscript(videoId);
    } catch (err) {
      // Map library errors to user-friendly messages
      if (err instanceof YoutubeTranscriptNotAvailableError) {
        return res.status(400).json({
          error: 'This video does not have any captions (subtitles) available. Try a different video.',
        });
      }
      if (err instanceof YoutubeTranscriptDisabledError) {
        return res.status(400).json({
          error: 'This video does not have any captions (subtitles) available. Try a different video.',
        });
      }
      if (err instanceof YoutubeTranscriptTooManyRequestError) {
        return res.status(429).json({
          error: 'Something went wrong while downloading the transcript. Please try again. If the problem persists, the video may be too long or temporarily unavailable.',
        });
      }
      // Unknown error
      return res.status(500).json({
        error: 'Something went wrong while downloading the transcript. Please try again.',
      });
    }

    if (!result) {
      return res.status(400).json({
        error: 'No Japanese captions found for this video. Try a video with Japanese subtitles.',
      });
    }

    const { title: videoTitle, segments, error: transcribeError } = result;

    // If captions exist but not in Japanese
    if (transcribeError === 'not_japanese') {
      return res.status(400).json({
        error: 'This video has captions, but Japanese subtitles are not available. Try a video with Japanese captions.',
      });
    }

    // 2. Validate Japanese content
    const sample = segments.slice(0, 20).map((s) => s.text).join(' ');
    if (!hasJapanese(sample)) {
      return res.status(400).json({ error: 'Japanese subtitles not available' });
    }

    // 3. Compress and extract vocabulary
    const compressed = compressTranscript(segments);
    const vocabulary = extractVocabulary(compressed);

    if (!vocabulary.length) {
      return res.status(400).json({ error: 'No vocabulary found in this video' });
    }

    // 4. Build deck
    const deck = buildDeck(videoId, videoTitle, vocabulary, url);

    return res.status(200).json(deck);
  } catch (err) {
    console.error('Pipeline error:', err);
    return res.status(500).json({
      error: 'Pipeline failed: ' + (err.message || 'Unknown error'),
    });
  }
};
