from io import BytesIO
from PIL import Image, ImageOps, ImageEnhance


def normalize_hex_color(color: str) -> str:
    """
    Normalize a hex color string.

    Accepts:
    - '#ff00ff'
    - 'ff00ff'

    Returns lowercase 6-digit hex without '#'.
    """
    if not color:
        return "ffffff"

    color = color.strip().lstrip("#")

    if len(color) != 6:
        return "ffffff"

    return color.lower()


def hex_to_rgb(color: str):
    """
    Convert hex string to RGB tuple.
    """
    color = normalize_hex_color(color)

    return (
        int(color[0:2], 16),
        int(color[2:4], 16),
        int(color[4:6], 16),
    )


def _gamma_correct_grayscale(img: Image.Image, gamma: float = 0.7) -> Image.Image:
    """
    Apply gamma correction to an 8-bit grayscale image.
    This helps dim fluorescence channels become more visible.
    """
    # Pre-calculating the LUT mathematically is fast and avoids PIL overhead
    lut = [
        int(255.0 * ((i / 255.0) ** gamma))
        for i in range(256)
    ]

    return img.point(lut)


def tint_grayscale_tile(tile_binary: bytes, color: str = "ffffff") -> bytes:
    """
    Convert a grayscale tile into a tinted RGBA PNG.

    Optimized implementation:
    - uses Pillow alpha compositing for matrix-free speed
    - heavily optimized PNG compression for real-time tile serving
    """
    rgb = hex_to_rgb(color)

    img = Image.open(BytesIO(tile_binary)).convert("L")

    # Improve contrast for dim fluorescence channels
    img = ImageOps.autocontrast(img, cutoff=1)
    img = _gamma_correct_grayscale(img, gamma=0.7)
    img = ImageEnhance.Contrast(img).enhance(1.4)
    img = ImageEnhance.Brightness(img).enhance(1.15)

    # Create solid colored image with 0 alpha
    rgba = Image.new("RGBA", img.size, rgb + (0,))

    # Use the processed grayscale intensity as the alpha channel
    rgba.putalpha(img)

    output = BytesIO()
    
    # CRUCIAL TILE SERVER OPTIMIZATION: 
    # compress_level=1 encodes vastly faster than default (6) or optimize=True.
    # When serving tiles on the fly, speed beats byte-size.
    rgba.save(output, format="PNG", compress_level=1)

    return output.getvalue()