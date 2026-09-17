"""Local media inspection, illustrative demo fixtures, and bounded video exports."""
import hashlib
import io
import json
import math
import os
from pathlib import Path
import shutil
import struct
import subprocess
import tempfile
import wave
from PIL import Image, ImageDraw, ImageFont

MAX_IMAGE_PIXELS = 16000000
Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS

def inspect_media(path: Path):
    if path.suffix in (".png", ".jpg", ".jpeg", ".webp"):
        try:
            with Image.open(path) as im:
                if im.width * im.height > MAX_IMAGE_PIXELS: raise ValueError("Image too large")
                im.load()
                width, height = im.size
                # Strip EXIF and active metadata; always store a decoded PNG.
                decoded = im.convert("RGBA" if "A" in im.getbands() else "RGB")
                dest = path.with_suffix(".png")
                decoded.save(dest, "PNG")
            if dest != path: path.unlink()
            return dest, {"kind": "image", "width": width, "height": height, "duration": 0, "mime": "image/png"}
        except (OSError, Image.DecompressionBombError) as e:
            raise ValueError("Invalid or oversized image") from e
    if path.suffix not in (".mp4", ".webm", ".wav", ".mp3", ".m4a"):
        raise ValueError("Only PNG, JPEG, WebP, MP4, WebM, WAV, MP3 and M4A are supported")
    if not shutil.which("ffprobe"): raise ValueError("ffprobe is required for audio and video")
    r = subprocess.run(["ffprobe", "-v", "error", "-protocol_whitelist", "file,pipe", "-f", {".mp4":"mov",".m4a":"mov",".webm":"matroska",".wav":"wav",".mp3":"mp3"}[path.suffix], "-show_format", "-show_streams", "-of", "json", str(path)], capture_output=True, timeout=10, check=True)
    data = json.loads(r.stdout)
    duration = float(data["format"].get("duration", 0))
    if not math.isfinite(duration) or not 0 < duration <= 300: raise ValueError("Media duration must be between 0 and 300 seconds")
    streams = data.get("streams", [])
    video = next((s for s in streams if s.get("codec_type") == "video" and not s.get("disposition", {}).get("attached_pic")), None)
    if video and video.get("width", 0) * video.get("height", 0) > MAX_IMAGE_PIXELS: raise ValueError("Video dimensions too large")
    return path, {"kind": "video" if video else "audio", "width": video.get("width", 0) if video else 0, "height": video.get("height", 0) if video else 0, "duration": duration, "mime": {".mp4": "video/mp4", ".webm": "video/webm", ".wav": "audio/wav", ".mp3": "audio/mpeg", ".m4a": "audio/mp4"}[path.suffix]}

def demo_frame(target: Path, seed: int = 42):
    """Procedural test illustration, not an AI-generated photograph."""
    w, h = 1280, 720
    im = Image.new("RGB", (w, h))
    pix = im.load()
    for y in range(h):
        for x in range(w):
            t = y / h
            glow = max(0, 1 - math.hypot((x - 820) / 570, (y - 290) / 390)) ** 3
            pix[x, y] = (int(13 + 46*t + 170*glow), int(19 + 14*t + 105*glow), int(29 + 7*t + 45*glow))
    d = ImageDraw.Draw(im)
    d.ellipse((655, 125, 985, 455), fill=(166, 106, 63), outline=(227, 173, 105), width=6)
    d.ellipse((687, 157, 953, 423), fill=(36, 35, 36), outline=(86, 70, 54), width=3)
    for i in range(5):
        y = 450 + i*48
        pts = [(0,h),(0,y)] + [(x, y + int(35*math.sin(x/210+i+seed/30))) for x in range(0,w+1,20)] + [(w,h)]
        d.polygon(pts, fill=(66-i*9, 46-i*6, 34-i*3))
    d.ellipse((456, 445, 470, 459), fill=(8,12,17)); d.polygon([(454,460),(473,460),(478,511),(449,511)], fill=(8,12,17))
    d.line((455,503,449,536), fill=(8,12,17), width=5); d.line((468,503,474,536), fill=(8,12,17), width=5)
    d.text((30, 30), "VIBECAST / SIMULATION FIXTURE / NOT AI OUTPUT", fill=(208,197,180))
    im.save(target, "PNG")

def demo_media(root: Path, kind: str, seed: int):
    frame = root / f"demo-{seed}.png"
    if not frame.exists(): demo_frame(frame, seed)
    if kind == "image": return frame
    if kind == "audio":
        target = root / "demo-audio.wav"
        if not target.exists():
            with wave.open(str(target), "wb") as wav:
                wav.setnchannels(1); wav.setsampwidth(2); wav.setframerate(22050)
                wav.writeframes(b"".join(struct.pack("<h", int(900*math.sin(2*math.pi*220*i/22050)*math.sin(math.pi*i/(22050*3)))) for i in range(22050*3)))
        return target
    target = root / f"demo-{seed}.mp4"
    if not target.exists():
        subprocess.run(["ffmpeg","-v","error","-y","-loop","1","-i",str(frame),"-t","3","-vf","scale=640:360","-r","24","-c:v","libx264","-threads","1","-pix_fmt","yuv420p","-movflags","+faststart",str(target)], check=True, timeout=30)
    return target

def export_film(project, assets, root: Path):
    """Flatten approved owned media to an H.264 review film; no shell or remote URLs."""
    if not shutil.which("ffmpeg"): raise ValueError("ffmpeg is required for video export")
    shots = project["shots"]
    if not shots or len(shots) > 24 or sum(s["duration"] for s in shots) > 180: raise ValueError("Export requires 1 to 24 shots and at most 180 seconds")
    width, height = {"16:9": (1280,720), "9:16": (720,1280), "1:1": (720,720)}[project["aspect"]]
    # Each segment has both video and audio with exactly the same codec layout.
    with tempfile.TemporaryDirectory(dir=root) as td:
        td = Path(td)
        clips = []
        for i, shot in enumerate(shots):
            asset = assets.get(shot.get("asset_id"))
            if not asset or asset["kind"] not in ("image", "video"): raise ValueError(f"Shot {i+1} needs a selected image or video")
            source = Path(asset["path"])
            audio = assets.get(shot.get("audio_asset_id"))
            dest = td/f"clip-{i}.mp4"
            args = ["ffmpeg","-v","error","-y","-protocol_whitelist","file,pipe"]
            args += ["-loop","1"] if asset["kind"] == "image" else ["-stream_loop","-1"]
            args += ["-i",str(source)]
            if audio:
                if audio["kind"] != "audio": raise ValueError("Narration must be audio")
                args += ["-protocol_whitelist","file,pipe","-i",audio["path"]]
            else: args += ["-f","lavfi","-i","anullsrc=r=48000:cl=stereo"]
            args += ["-map","0:v:0","-map","1:a:0","-vf",f"scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,setsar=1","-af","apad","-t",str(shot["duration"]),"-r","24","-c:v","libx264","-preset","ultrafast","-crf","22","-threads","1","-pix_fmt","yuv420p","-c:a","aac","-ar","48000","-ac","2",str(dest)]
            subprocess.run(args, capture_output=True, check=True, timeout=90)
            clips.append(dest)
        manifest = td/"concat.txt"
        manifest.write_text("".join(f"file '{p.name}'\n" for p in clips))
        result = root / f"export-{os.urandom(12).hex()}.mp4"
        subprocess.run(["ffmpeg","-v","error","-y","-f","concat","-safe","1","-i",str(manifest),"-c","copy","-movflags","+faststart",str(result)], capture_output=True, check=True, timeout=45)
        return result
