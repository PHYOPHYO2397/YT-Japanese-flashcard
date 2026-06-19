#!/usr/bin/env python3
"""Parse .ja.srt files into TranscriptBundle JSON."""
import sys, json, re, glob

SRT_RE = re.compile(
    r'(\d+)\s*\n'
    r'(\d+):(\d+):(\d+)[.,](\d+)\s*-->\s*'
    r'(\d+):(\d+):(\d+)[.,](\d+)\s*\n'
    r'([\s\S]+?)(?=\n\n|\n?\Z)'
)

def parse_srt(path: str) -> list[dict]:
    with open(path) as f:
        content = f.read()
    segments = []
    for m in SRT_RE.finditer(content):
        sh, sm, ss, sms = int(m[2]), int(m[3]), int(m[4]), int(m[5])
        eh, em, es, ems = int(m[6]), int(m[7]), int(m[8]), int(m[9])
        start = sh * 3600 + sm * 60 + ss + sms / 1000.0
        end = eh * 3600 + em * 60 + es + ems / 1000.0
        text = m[10].strip().replace('\n', ' ')
        if not text:
            continue
        segments.append({
            "text": text,
            "start_time": round(start, 3),
            "end_time": round(end, 3),
            "segment_index": len(segments),
            "source": "auto_generated"
        })
    return segments

for srt_path in sorted(glob.glob("*.ja.srt")):
    # Extract video_id from filename pattern [video_id].ja.srt
    basename = srt_path.replace('.ja.srt', '')
    # Try to find [video_id] in the filename
    vid_match = re.search(r'\[([a-zA-Z0-9_-]{11})\]', basename)
    if not vid_match:
        print(f"SKIP: {srt_path} (no video_id found)", file=sys.stderr)
        continue
    video_id = vid_match.group(1)
    title = basename[:basename.rfind(' [')].strip()

    segments = parse_srt(srt_path)

    bundle = {
        "video": {
            "url": f"https://www.youtube.com/watch?v={video_id}",
            "video_id": video_id,
            "title": title,
            "has_captions": True,
            "caption_type": "auto_generated"
        },
        "segments": segments
    }

    out_path = f"/tmp/transcript-{video_id}.json"
    with open(out_path, 'w') as f:
        json.dump(bundle, f, ensure_ascii=False)
    print(f"{video_id} | {title} | {len(segments)} segments | {out_path}")
