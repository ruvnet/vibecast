"""Curated execution recipes. Provider schemas are verified again at live preflight."""
import math
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

CATALOG = {
    "image": {"name": "FLUX.1 Schnell", "endpoint": "fal-ai/flux-1/schnell", "kind": "image", "unit": "megapixels", "sample_price": 0.003, "description": "Concept frames, posters, storyboards and product imagery."},
    "video": {"name": "Wan 2.2", "endpoint": "fal-ai/wan/v2.2-a14b/text-to-video", "kind": "video", "unit": "seconds", "sample_price": 0.08, "description": "Turn a shot description into a moving scene."},
    "animate": {"name": "Wan 2.2 Image to Video", "endpoint": "fal-ai/wan/v2.2-a14b/image-to-video", "kind": "video", "unit": "seconds", "sample_price": 0.08, "description": "Animate a reference frame with camera direction."},
    "voice": {"name": "Kokoro", "endpoint": "fal-ai/kokoro/american-english", "kind": "audio", "unit": "1000 characters", "sample_price": 0.02, "description": "Narration from a script using a preset voice."},
    "cutout": {"name": "Pixelcut", "endpoint": "pixelcut/background-removal", "kind": "image", "unit": "images", "sample_price": 0.016, "description": "Isolate a product or subject from its background."},
}
PRESETS = [
    {"id": "first-contact", "name": "First contact", "category": "Cinema", "color": "ember", "camera": "Slow dolly in", "lens": "35mm anamorphic", "light": "Volumetric golden backlight", "prompt": "A lone explorer discovers a colossal circular structure half buried in the desert. Fine dust hangs in the air. Monumental scale, practical materials, restrained movement."},
    {"id": "midnight", "name": "Midnight signal", "category": "Cinema", "color": "violet", "camera": "Lateral tracking", "lens": "50mm", "light": "Neon reflections and soft rain", "prompt": "A courier pauses beneath a flickering sign in a rain soaked future city. Wet pavement reflects cyan light. Grounded physical detail, quiet tension."},
    {"id": "product", "name": "Object of desire", "category": "Product", "color": "jade", "camera": "Slow orbit", "lens": "85mm macro", "light": "Soft studio rim lighting", "prompt": "A premium glass perfume bottle on polished volcanic stone, suspended droplets, elegant negative space, tactile material detail and an editorial composition."},
    {"id": "wild", "name": "Into the wild", "category": "Nature", "color": "forest", "camera": "Rising aerial", "lens": "24mm wide", "light": "Blue hour mist", "prompt": "A vast ancient forest opens onto a still glacial lake. Low mist drifts between the trees. Natural color, tranquil scale, a sense of discovery."},
    {"id": "portrait", "name": "Human stories", "category": "Portrait", "color": "rose", "camera": "Locked close up", "lens": "85mm portrait", "light": "Window light and gentle fill", "prompt": "An artisan in a sunlit workshop, hands resting beside well worn tools, candid documentary portrait, natural skin texture, emotional honesty."},
    {"id": "launch", "name": "The launch", "category": "Campaign", "color": "cobalt", "camera": "Low angle push in", "lens": "35mm", "light": "High contrast editorial", "prompt": "A sculptural electric motorcycle in an empty concrete gallery, dramatic clean lines, premium automotive campaign, precise reflections and bold framing."},
    {"id": "miniature", "name": "Small wonders", "category": "Product", "color": "amber", "camera": "Macro slider", "lens": "100mm macro", "light": "Warm practical lights", "prompt": "A tiny handcrafted observatory on a moss covered stone, warm light through its windows, intricate miniature engineering, cinematic depth of field."},
    {"id": "fashion", "name": "After hours", "category": "Portrait", "color": "plum", "camera": "Gentle handheld", "lens": "50mm", "light": "Direct flash and city ambient", "prompt": "Editorial fashion portrait on a quiet rooftop at dusk, sculptural clothing, purposeful stance, natural fabric movement, sophisticated magazine photography."},
]
CAMERAS = ["Slow dolly in", "Slow orbit", "Lateral tracking", "Rising aerial", "Locked close up", "Low angle push in", "Gentle handheld", "Macro slider"]

class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, allow_inf_nan=False)

class Shot(Strict):
    id: str = Field(min_length=1, max_length=64, pattern=r"^[a-zA-Z0-9_-]+$")
    title: str = Field(default="Untitled shot", max_length=120)
    prompt: str = Field(default="", max_length=4000)
    camera: str = Field(default="Slow dolly in", max_length=80)
    lens: str = Field(default="35mm anamorphic", max_length=80)
    light: str = Field(default="Natural light", max_length=160)
    duration: int = Field(default=5, ge=1, le=10)
    narration: str = Field(default="", max_length=1500)
    asset_id: str | None = None
    audio_asset_id: str | None = None
    reference_id: str | None = None

class Project(Strict):
    name: str = Field(min_length=1, max_length=120)
    brief: str = Field(default="", max_length=5000)
    look: str = Field(default="Cinematic realism, consistent color and physical detail", max_length=1500)
    aspect: Literal["16:9", "9:16", "1:1"] = "16:9"
    shots: list[Shot] = Field(default_factory=list, max_length=24)
    revision: int = Field(default=0, ge=0)

class Generation(Strict):
    recipe: Literal["image", "video", "animate", "voice", "cutout"] = "image"
    prompt: str = Field(min_length=1, max_length=4000)
    aspect: Literal["16:9", "9:16", "1:1"] = "16:9"
    duration: Literal[3, 5, 8] = 5
    count: int = Field(default=1, ge=1, le=4)
    seed: int = Field(default=42, ge=0, le=2147483647)
    voice: Literal["af_heart", "af_bella", "am_adam", "am_michael"] = "af_heart"
    reference_id: str | None = None
    project_id: str | None = None
    shot_id: str | None = None
    idempotency_key: str = Field(min_length=16, max_length=100, pattern=r"^[a-zA-Z0-9_-]+$")

def build_input(g: Generation, reference: str | None = None):
    """Fixed dimensions and frame rate make the reservation auditable."""
    if g.recipe == "image":
        sizes = {"16:9": {"width": 1024, "height": 576}, "9:16": {"width": 576, "height": 1024}, "1:1": {"width": 1024, "height": 1024}}
        return {"prompt": g.prompt, "image_size": sizes[g.aspect], "num_images": g.count, "seed": g.seed, "num_inference_steps": 4, "enable_safety_checker": True, "output_format": "png"}, float(math.ceil(sizes[g.aspect]["width"]*sizes[g.aspect]["height"]/1000000)*g.count)
    if g.recipe in ("video", "animate"):
        frames = g.duration * 16 + 1
        data = {"prompt": g.prompt, "num_frames": frames, "frames_per_second": 16, "resolution": "480p", "seed": g.seed, "enable_safety_checker": True, "enable_output_safety_checker": True, "enable_prompt_expansion": False, "interpolator_model": "none", "num_interpolated_frames": 0}
        if g.recipe == "animate":
            if not reference: raise ValueError("An owned reference image is required")
            data["image_url"] = reference
            data["aspect_ratio"] = g.aspect
        else: data["aspect_ratio"] = g.aspect
        return data, float(g.duration + 1)
    if g.recipe == "voice":
        return {"prompt": g.prompt, "voice": g.voice, "speed": 1}, max(1.0, len(g.prompt) / 1000)
    if not reference: raise ValueError("An owned reference image is required")
    return {"image_url": reference, "output_format": "rgba", "sync_mode": False}, 1.0
