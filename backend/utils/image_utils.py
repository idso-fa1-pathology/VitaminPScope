from io import BytesIO
from PIL import Image


def normalize_hex_color(color: str) -> str:
    color = color.strip().lstrip("#")
    if len(color) != 6:
        return "ffffff"
    return color.lower()


def hex_to_rgb(color: str):
    color = normalize_hex_color(color)
    return tuple(int(color[i:i + 2], 16) for i in (0, 2, 4))


def tint_grayscale_tile(tile_binary: bytes, color: str = "ffffff") -> bytes:
    """
    Takes a grayscale or single-band tile and returns an RGB JPEG tinted
    with the requested color.
    """
    rgb = hex_to_rgb(color)

    img = Image.open(BytesIO(tile_binary))

    # Convert to 8-bit grayscale first
    if img.mode not in ("L", "I;16", "I"):
        img = img.convert("L")
    else:
        img = img.convert("L")

    tinted = Image.new("RGB", img.size)
    gray_pixels = img.load()
    tinted_pixels = tinted.load()

    for y in range(img.height):
        for x in range(img.width):
            v = gray_pixels[x, y]
            tinted_pixels[x, y] = (
                int(v * rgb[0] / 255),
                int(v * rgb[1] / 255),
                int(v * rgb[2] / 255),
            )

    output = BytesIO()
    tinted.save(output, format="JPEG", quality=90)
    return output.getvalue()