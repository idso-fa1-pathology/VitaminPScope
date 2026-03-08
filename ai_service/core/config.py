from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent.parent

CHECKPOINT_DIR = BASE_DIR / "checkpoints"
OUTPUT_DIR = BASE_DIR / "outputs"
LOG_DIR = BASE_DIR / "logs"

DEFAULT_DEVICE = os.getenv("VITAMINP_DEVICE", "cpu")
DEFAULT_MODEL_NAME = os.getenv("VITAMINP_MODEL_NAME", "flex")

CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
LOG_DIR.mkdir(parents=True, exist_ok=True)