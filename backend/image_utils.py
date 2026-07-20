import io

from PIL import Image, ImageOps


def normalize_to_jpeg_bytes(raw: bytes, max_long_side: int, quality: int = 85) -> bytes:
    img = Image.open(io.BytesIO(raw))
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
