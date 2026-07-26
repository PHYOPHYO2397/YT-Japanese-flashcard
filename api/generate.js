/**
 * Vercel Serverless Function — /api/generate?url=<youtube_url>
 *
 * Reimplements the Python server.py pipeline in Node.js:
 *  1. Fetch YouTube transcript via timedtext API
 *  2. Extract vocabulary (compound words)
 *  3. Build flashcard deck JSON
 */

const https = require('https');
const http = require('http');

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'ja,en;q=0.9',
};

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

function fetch(url, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers: HEADERS, timeout }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetch(res.headers.location, timeout).then(resolve, reject);
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function extractVideoId(url) {
  const m = url.match(
    /(?:watch\?v=|youtu\.be\/|embed\/|shorts\/|v\/)([A-Za-z0-9_-]{11})/
  );
  return m ? m[1] : null;
}

// ── Transcript fetcher ───────────────────────────────────────────────────────

async function fetchTranscript(videoId) {
  // 1. Get video page HTML
  let html;
  try {
    html = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
  } catch {
    return null;
  }

  // 2. Extract video title
  let title = 'YouTube Video';
  const titleMatch = html.match(/<title>(.*?)<\/title>/);
  if (titleMatch) {
    title = titleMatch[1]
      .replace(' - YouTube', '')
      .replace('&#39;', "'")
      .replace(/&amp;/g, '&')
      .trim();
  }

  // 3. Find caption track URLs
  const timedtextMatches = [...html.matchAll(/"baseUrl"\s*:\s*"([^"]*timedtext[^"]*)"/g)];
  let jaUrl = null;

  for (const match of timedtextMatches) {
    const cleaned = match[1].replace(/\\u0026/g, '&');
    if (cleaned.includes('lang=ja') || cleaned.includes('lang%3Dja')) {
      jaUrl = cleaned;
      break;
    }
  }

  if (!jaUrl) {
    for (const match of timedtextMatches) {
      const cleaned = match[1].replace(/\\u0026/g, '&');
      if (cleaned.toLowerCase().includes('ja')) {
        jaUrl = cleaned;
        break;
      }
    }
  }

  if (!jaUrl) return null;

  // 4. Fetch transcript XML
  let xml;
  try {
    xml = await fetch(jaUrl);
  } catch {
    return null;
  }

  // 5. Parse XML segments
  const segments = [];
  const regex = /<text start="([\d.]+)" dur="([\d.]+)"[^>]*>(.*?)<\/text>/g;
  let m;
  while ((m = regex.exec(xml)) !== null) {
    const start = parseFloat(m[1]);
    const dur = parseFloat(m[2]);
    let text = m[3]
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
    if (text) {
      segments.push({
        text,
        start_time: Math.round(start * 1000) / 1000,
        end_time: Math.round((start + dur) * 1000) / 1000,
        segment_index: segments.length,
        source: 'auto_generated',
      });
    }
  }

  if (!segments.length) return null;
  return { title, segments };
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
    const result = await fetchTranscript(videoId);
    if (!result) {
      return res.status(400).json({
        error: 'No Japanese captions found for this video. Try a video with Japanese subtitles.',
      });
    }

    const { title: videoTitle, segments } = result;

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
