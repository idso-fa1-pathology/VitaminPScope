from io import BytesIO
from PIL import Image, ImageOps, ImageEnhance


def normalize_hex_color(color: str) -> str:
    color = color.strip().lstrip("#")
    if len(color) != 6:
        return "ffffff"
    return color.lower()


def hex_to_rgb(color: str):
    color = normalize_hex_color(color)
    return tuple(int(color[i:i + 2], 16) for i in (0, 2, 4))


def _gamma_correct_grayscale(img: Image.Image, gamma: float = 0.7) -> Image.Image:
    lut = [
        max(0, min(255, int(((i / 255.0) ** gamma) * 255.0)))
        for i in range(256)
    ]
    return img.point(lut)


def tint_grayscale_tile(tile_binary: bytes, color: str = "ffffff") -> bytes:
    """
    Convert a grayscale/single-band tile into a tinted RGBA PNG with
    transparency proportional to signal intensity.

    This makes multichannel overlays combine much better than black-background JPEGs.
    """
    rgb = hex_to_rgb(color)

    img = Image.open(BytesIO(tile_binary))

    # Convert to grayscale 8-bit
    img = img.convert("L")

    # Improve visibility for dim fluorescence channels
    img = ImageOps.autocontrast(img, cutoff=1)
    img = _gamma_correct_grayscale(img, gamma=0.7)
    img = ImageEnhance.Contrast(img).enhance(1.4)
    img = ImageEnhance.Brightness(img).enhance(1.15)

    rgba = Image.new("RGBA", img.size)
    gray_pixels = img.load()
    rgba_pixels = rgba.load()

    for y in range(img.height):
        for x in range(img.width):
            v = gray_pixels[x, y]
            rgba_pixels[x, y] = (
                int(v * rgb[0] / 255),
                int(v * rgb[1] / 255),
                int(v * rgb[2] / 255),
                v,
            )

    output = BytesIO()
    rgba.save(output, format="PNG")
    return output.getvalue()