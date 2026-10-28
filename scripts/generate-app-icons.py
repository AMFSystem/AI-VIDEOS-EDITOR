import os
import shutil
import subprocess
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE_IMAGE = Path("/Users/hr/.gemini/antigravity/brain/863c955f-2707-4356-909f-fd6632de2cc2/.user_uploaded/media_1793176715666_3c891ab1.jpg")

DESKTOP_BUILD = ROOT / "desktop" / "build"
FRONTEND_ICONS = ROOT / "frontend" / "public" / "icons"
FRONTEND_PUBLIC = ROOT / "frontend" / "public"

DESKTOP_BUILD.mkdir(parents=True, exist_ok=True)
FRONTEND_ICONS.mkdir(parents=True, exist_ok=True)

print(f"Loading source image: {SOURCE_IMAGE}")
img = Image.open(SOURCE_IMAGE).convert("RGBA")

# 1. desktop/build/icon.png (1024x1024)
icon_1024 = img.resize((1024, 1024), Image.Resampling.LANCZOS)
icon_png_path = DESKTOP_BUILD / "icon.png"
icon_1024.save(icon_png_path, "PNG")
print(f"Saved: {icon_png_path}")

# 2. desktop/build/icon.ico (Windows multi-resolution icon)
icon_ico_path = DESKTOP_BUILD / "icon.ico"
icon_1024.save(
    icon_ico_path,
    format="ICO",
    sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
)
print(f"Saved: {icon_ico_path}")

# 3. desktop/build/icon.icns (macOS native iconset)
iconset_dir = DESKTOP_BUILD / "icon.iconset"
if iconset_dir.exists():
    shutil.rmtree(iconset_dir)
iconset_dir.mkdir(parents=True, exist_ok=True)

icns_specs = [
    ("icon_16x16.png", 16),
    ("icon_16x16@2x.png", 32),
    ("icon_32x32.png", 32),
    ("icon_32x32@2x.png", 64),
    ("icon_128x128.png", 128),
    ("icon_128x128@2x.png", 256),
    ("icon_256x256.png", 256),
    ("icon_256x256@2x.png", 512),
    ("icon_512x512.png", 512),
    ("icon_512x512@2x.png", 1024),
]

for filename, size in icns_specs:
    resized = img.resize((size, size), Image.Resampling.LANCZOS)
    resized.save(iconset_dir / filename, "PNG")

icon_icns_path = DESKTOP_BUILD / "icon.icns"
try:
    subprocess.run(["iconutil", "-c", "icns", str(iconset_dir), "-o", str(icon_icns_path)], check=True)
    print(f"Saved: {icon_icns_path}")
    shutil.rmtree(iconset_dir)
except Exception as e:
    print(f"iconutil failed: {e}")

# 4. Frontend Web Icons
img_512 = img.resize((512, 512), Image.Resampling.LANCZOS)
img_512.save(FRONTEND_ICONS / "timeline-studio-icon-512.png", "PNG")

img_192 = img.resize((192, 192), Image.Resampling.LANCZOS)
img_192.save(FRONTEND_ICONS / "timeline-studio-icon-192.png", "PNG")
img_192.save(FRONTEND_ICONS / "timeline-studio-apple-touch.png", "PNG")

img_32 = img.resize((32, 32), Image.Resampling.LANCZOS)
img_32.save(FRONTEND_PUBLIC / "favicon.png", "PNG")
img_32.save(FRONTEND_PUBLIC / "favicon.ico", format="ICO", sizes=[(32, 32)])

print("Successfully generated all desktop & frontend application icons!")

