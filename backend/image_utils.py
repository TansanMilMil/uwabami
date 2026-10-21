import io

from PIL import Image, ImageOps

# Pillow標準の上限(約1.8億画素で例外)では展開時に数百MBを消費するため、デコード前に弾く
MAX_IMAGE_PIXELS = 64_000_000


def normalize_to_jpeg_bytes(raw: bytes, max_long_side: int, quality: int = 85) -> bytes:
    img = Image.open(io.BytesIO(raw))
    if img.width * img.height > MAX_IMAGE_PIXELS:
        raise ValueError("image has too many pixels")
    img.load()
    img = ImageOps.exif_transpose(img)

    if img.mode == "RGBA":
        background = Image.new("RGB", img.size, (255, 255, 255))
        background.paste(img, mask=img.split()[3])
        img = background
    elif img.mode != "RGB":
        img = img.convert("RGB")

    if max(img.size) > max_long_side:
        img.thumbnail((max_long_side, max_long_side))

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=quality)
    return buf.getvalue()
