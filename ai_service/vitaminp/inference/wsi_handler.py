#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""WSI/Image loading utilities for multiple pathology formats with streaming support."""

import openslide
import tifffile
from PIL import Image
import numpy as np
from pathlib import Path
from .channel_config import ChannelConfig


class MultiFormatImageLoader:
    """Universal loader for pathology image formats with streaming support
    
    Supports:
    - Whole slide formats: SVS, NDPI, MRXS, etc. (via OpenSlide)
    - OME-TIFF: Multi-page OME-TIFF files
    - Standard images: PNG, JPG, JPEG
    - Regular TIFF: Single/multi-page TIFF
    """
    
    OPENSLIDE_FORMATS = ['.svs', '.tif', '.tiff', '.ndpi', '.vms', '.vmu', '.scn', '.mrxs', '.bif']
    SIMPLE_FORMATS = ['.png', '.jpg', '.jpeg']
    OME_FORMATS = ['.ome.tif', '.ome.tiff']
    
    @staticmethod
    def get_wsi_reader(image_path):
        """Get a WSI reader object for streaming tile access (NEW)
        
        Args:
            image_path: Path to WSI file
            
        Returns:
            WSIReader object with .read_region() method
        """
        image_path = Path(image_path)
        
        if not image_path.exists():
            raise FileNotFoundError(f"Image not found: {image_path}")
        
        ext = image_path.suffix.lower()
        
        # Try OpenSlide first for WSI formats
        if ext in MultiFormatImageLoader.OPENSLIDE_FORMATS:
            try:
                return OpenSlideReader(image_path)
            except:
                return TiffReader(image_path)
        
        # OME-TIFF
        elif image_path.name.lower().endswith(('.ome.tif', '.ome.tiff')):
            return TiffReader(image_path)
        
        # Simple formats - load fully (small images)
        elif ext in MultiFormatImageLoader.SIMPLE_FORMATS:
            return SimpleImageReader(image_path)
        
        else:
            raise ValueError(f"Unsupported format: {ext}")
    
    @staticmethod
    def load_image(image_path):
        """Load image from any supported format (LEGACY - loads full image)
        
        Args:
            image_path: Path to image file
            
        Returns:
            numpy.ndarray: RGB image (H, W, 3), uint8
        """
        image_path = Path(image_path)
        
        if not image_path.exists():
            raise FileNotFoundError(f"Image not found: {image_path}")
        
        ext = image_path.suffix.lower()
        
        # Check if OME-TIFF (check before regular TIFF)
        if image_path.name.lower().endswith(('.ome.tif', '.ome.tiff')):
            return MultiFormatImageLoader._load_ome_tiff(image_path)
        
        # Try OpenSlide for whole slide formats
        elif ext in MultiFormatImageLoader.OPENSLIDE_FORMATS:
            return MultiFormatImageLoader._load_openslide(image_path)
        
        # Simple formats (PNG, JPG)
        elif ext in MultiFormatImageLoader.SIMPLE_FORMATS:
            return MultiFormatImageLoader._load_simple(image_path)
        
        else:
            raise ValueError(f"Unsupported format: {ext}")
    
    @staticmethod
    def _load_openslide(path):
        """Load using OpenSlide (for SVS, TIFF, etc.)"""
        try:
            slide = openslide.OpenSlide(str(path))
            # Get level 0 (highest resolution)
            level = 0
            dimensions = slide.level_dimensions[level]
            
            # Read the region
            image = slide.read_region((0, 0), level, dimensions)
            image = np.array(image.convert('RGB'))
            
            slide.close()
            return image
        except Exception as e:
            return MultiFormatImageLoader._load_tifffile(path)
    
    @staticmethod
    def _load_tifffile(path):
        """Load using tifffile (backup for TIFF)"""
        image = tifffile.imread(str(path))
        
        # Handle different TIFF formats
        if image.ndim == 2:  # Grayscale
            image = np.stack([image] * 3, axis=-1)
        elif image.ndim == 3 and image.shape[2] == 4:  # RGBA
            image = image[:, :, :3]
        elif image.ndim == 3 and image.shape[0] < 10:  # (C, H, W) format
            image = np.transpose(image, (1, 2, 0))
            if image.shape[2] > 3:
                image = image[:, :, :3]
        
        # Ensure uint8
        if image.dtype != np.uint8:
            if image.max() <= 1.0:
                image = (image * 255).astype(np.uint8)
            else:
                image = image.astype(np.uint8)
        
        return image
    
    @staticmethod
    def _load_ome_tiff(path):
        """Load OME-TIFF format"""
        with tifffile.TiffFile(str(path)) as tif:
            image = tif.asarray()
            
            # Handle multi-page OME-TIFF (take first page)
            if image.ndim == 4:  # (pages, H, W, C)
                image = image[0]
            elif image.ndim == 3 and image.shape[0] < 10:  # (C, H, W)
                image = np.transpose(image, (1, 2, 0))
            
            # Convert to RGB if needed
            if image.ndim == 2:
                image = np.stack([image] * 3, axis=-1)
            elif image.shape[2] == 4:
                image = image[:, :, :3]
            elif image.shape[2] > 3:
                image = image[:, :, :3]
            
            # Ensure uint8
            if image.dtype != np.uint8:
                if image.max() <= 1.0:
                    image = (image * 255).astype(np.uint8)
                else:
                    image = image.astype(np.uint8)
            
            return image
    
    @staticmethod
    def _load_simple(path):
        """Load simple formats (PNG, JPG)"""
        image = Image.open(str(path))
        image = np.array(image.convert('RGB'))
        return image
    
    @staticmethod
    def get_supported_formats():
        """Get list of all supported file extensions"""
        all_formats = (
            MultiFormatImageLoader.OPENSLIDE_FORMATS +
            MultiFormatImageLoader.SIMPLE_FORMATS +
            MultiFormatImageLoader.OME_FORMATS
        )
        return list(set(all_formats))

    @staticmethod
    def load_mif_image(image_path, channel_config=None):
        """Load MIF image with channel configuration.

        Returns:
            numpy array: MIF image with shape (2, H, W) after channel selection
                        or (C, H, W) before selection.
        """
        import cv2

        image_path = Path(image_path)

        if not image_path.exists():
            raise FileNotFoundError(f"Image not found: {image_path}")

        file_name_lower = image_path.name.lower()
        file_ext = image_path.suffix.lower()

        if file_ext in ['.png', '.jpg', '.jpeg']:
            mif_array = cv2.imread(str(image_path), cv2.IMREAD_UNCHANGED)

            if mif_array is None:
                raise ValueError(f"Failed to load image: {image_path}")

            if mif_array.ndim == 3 and mif_array.shape[2] == 3:
                mif_array = cv2.cvtColor(mif_array, cv2.COLOR_BGR2RGB)

            if mif_array.dtype == np.uint8:
                mif_array = mif_array.astype(np.float32) / 255.0
            elif mif_array.dtype == np.uint16:
                mif_array = mif_array.astype(np.float32) / 65535.0
            else:
                mif_array = mif_array.astype(np.float32)

            if mif_array.ndim == 2:
                mif_array = mif_array[np.newaxis, :, :]
            elif mif_array.ndim == 3:
                # PNG/JPG path is usually HWC -> CHW
                mif_array = np.transpose(mif_array, (2, 0, 1))

        elif file_ext in ['.tif', '.tiff'] or file_name_lower.endswith(('.ome.tif', '.ome.tiff')):
            axes = None
            with tifffile.TiffFile(str(image_path)) as tif:
                mif_array = tif.asarray()
                mif_array = np.asarray(mif_array)

                try:
                    if tif.series:
                        axes = getattr(tif.series[0], "axes", None)
                except Exception:
                    axes = None

            print(f"[load_mif_image] raw shape={mif_array.shape}, axes={axes}, dtype={mif_array.dtype}")

            if mif_array.dtype == np.uint8:
                mif_array = mif_array.astype(np.float32) / 255.0
            elif mif_array.dtype == np.uint16:
                mif_array = mif_array.astype(np.float32) / 65535.0
            else:
                mif_array = mif_array.astype(np.float32)

            # Normalize to CHW
            if mif_array.ndim == 2:
                mif_array = mif_array[np.newaxis, :, :]

            elif mif_array.ndim == 3:
                # Prefer explicit axes metadata when available
                if axes == "CYX":
                    pass
                elif axes in ("YXC",):
                    mif_array = np.transpose(mif_array, (2, 0, 1))
                elif axes in ("IYX", "SYX", "QYX"):
                    # plane-stack already channel-like in first axis
                    pass
                else:
                    # Fallback without fragile channel-count thresholds:
                    # - if first two dims are clearly spatial, treat as HWC
                    # - if last two dims are clearly spatial, treat as CHW
                    if mif_array.shape[0] > 4 and mif_array.shape[1] > 4:
                        mif_array = np.transpose(mif_array, (2, 0, 1))  # HWC -> CHW
                    elif mif_array.shape[1] > 4 and mif_array.shape[2] > 4:
                        pass  # CHW
                    else:
                        raise ValueError(
                            f"Ambiguous TIFF shape for MIF image: {mif_array.shape}, axes={axes}"
                        )
            else:
                raise ValueError(
                    f"Unsupported TIFF ndim for MIF image: ndim={mif_array.ndim}, shape={mif_array.shape}, axes={axes}"
                )
            
        print(f"[load_mif_image] normalized CHW shape={mif_array.shape}, dtype={mif_array.dtype}")

        if channel_config is not None:
            print(
                "[load_mif_image] channel config:",
                f"nuclear={channel_config.nuclear_channel},",
                f"membrane={channel_config.membrane_channel},",
                f"combination={channel_config.membrane_combination}"
            )
            mif_2ch = channel_config.select_channels(mif_array)
        else:
            if mif_array.ndim == 3 and mif_array.shape[0] >= 2:
                mif_2ch = mif_array[:2, :, :]
            else:
                raise ValueError(
                    f"Cannot auto-select channels from shape {mif_array.shape}. "
                    f"Please provide channel_config."
                )

        print(
            f"[load_mif_image] output shape={mif_2ch.shape}, dtype={mif_2ch.dtype}, "
            f"ch0_range=[{mif_2ch[0].min():.6f}, {mif_2ch[0].max():.6f}], "
            f"ch1_range=[{mif_2ch[1].min():.6f}, {mif_2ch[1].max():.6f}]"
        )

        return mif_2ch
# NEW: Reader classes for streaming tile access

class OpenSlideReader:
    """Stream tiles from OpenSlide-compatible WSI"""
    
    def __init__(self, path):
        self.slide = openslide.OpenSlide(str(path))
        self.dimensions = self.slide.level_dimensions[0]
        self.width, self.height = self.dimensions
        
        # MPP detection (already added)
        self.mpp = None
        self.magnification = None
        
        try:
            if openslide.PROPERTY_NAME_MPP_X in self.slide.properties:
                self.mpp = float(self.slide.properties[openslide.PROPERTY_NAME_MPP_X])
            elif 'aperio.MPP' in self.slide.properties:
                self.mpp = float(self.slide.properties['aperio.MPP'])
            
            if 'aperio.AppMag' in self.slide.properties:
                self.magnification = int(self.slide.properties['aperio.AppMag'])
            elif openslide.PROPERTY_NAME_OBJECTIVE_POWER in self.slide.properties:
                self.magnification = int(self.slide.properties[openslide.PROPERTY_NAME_OBJECTIVE_POWER])
        except:
            pass
    
    def read_region(self, location, size):
        """Read a region from the slide"""
        x, y = location
        w, h = size
        region = self.slide.read_region((x, y), 0, (w, h))
        return np.array(region.convert('RGB'))
    
    # ← ADD THESE METHODS
    def close(self):
        """Close the slide"""
        if hasattr(self, 'slide') and self.slide is not None:
            self.slide.close()
    
    def __enter__(self):
        return self
    
    def __exit__(self, *args):
        self.close()

class TiffReader:
    """Stream tiles from TIFF/OME-TIFF files"""
    
    def __init__(self, path):
        self.tif = tifffile.TiffFile(str(path))
        # Get first page/series
        if hasattr(self.tif, 'series'):
            self.page = self.tif.series[0]
            shape = self.page.shape
        else:
            self.page = self.tif.pages[0]
            shape = self.page.shape

        if len(shape) == 2:
            self.height, self.width = shape
        elif len(shape) == 3:
            axes = None
            try:
                if hasattr(self.tif, "series") and self.tif.series:
                    axes = getattr(self.tif.series[0], "axes", None)
            except Exception:
                axes = None

            if axes == "CYX" or axes in ("IYX", "SYX", "QYX"):
                self.height, self.width = shape[1], shape[2]
            elif axes == "YXC":
                self.height, self.width = shape[0], shape[1]
            else:
                # fallback
                if shape[0] > 4 and shape[1] > 4:
                    self.height, self.width = shape[0], shape[1]   # HWC
                elif shape[1] > 4 and shape[2] > 4:
                    self.height, self.width = shape[1], shape[2]   # CHW
                else:
                    raise ValueError(f"Unsupported TIFF shape in TiffReader: {shape}, axes={axes}")
        else:
            raise ValueError(f"Unsupported TIFF shape in TiffReader: {shape}")
        
        # ← ADD MPP DETECTION FOR OME-TIFF
        self.mpp = None
        self.magnification = None
        
        try:
            # Method 1: OME-XML metadata
            if hasattr(self.tif, 'ome_metadata') and self.tif.ome_metadata:
                # Parse OME-XML for PhysicalSizeX
                import xml.etree.ElementTree as ET
                root = ET.fromstring(self.tif.ome_metadata)
                ns = {'ome': 'http://www.openmicroscopy.org/Schemas/OME/2016-06'}
                pixels = root.find('.//ome:Pixels', ns)
                if pixels is not None:
                    # PhysicalSizeX/Y are in micrometers
                    physical_size_x = pixels.get('PhysicalSizeX')
                    if physical_size_x:
                        self.mpp = float(physical_size_x)
            
            # Method 2: TIFF resolution tags (fallback)
            if self.mpp is None and hasattr(self.page, 'tags'):
                if 'XResolution' in self.page.tags and 'ResolutionUnit' in self.page.tags:
                    x_res = self.page.tags['XResolution'].value
                    unit = self.page.tags['ResolutionUnit'].value
                    
                    # Convert to microns per pixel
                    if unit == 3:  # Centimeter
                        # x_res is pixels per cm, convert to μm/px
                        if isinstance(x_res, tuple):
                            x_res = x_res[0] / x_res[1]
                        self.mpp = 10000.0 / x_res  # cm to μm
                    elif unit == 2:  # Inch
                        if isinstance(x_res, tuple):
                            x_res = x_res[0] / x_res[1]
                        self.mpp = 25400.0 / x_res  # inch to μm
        except Exception as e:
            pass  # If metadata reading fails, mpp stays None
    
    def read_region(self, location, size):
        """Read a region from TIFF without forcing RGB truncation.

        Returns:
            - HWC for multichannel TIFFs
            - HWC for grayscale too (expanded to 1 channel if needed by caller logic)
        """
        x, y = location
        w, h = size

        full_image = self.tif.asarray()
        full_image = np.asarray(full_image)

        # Normalize full image to HWC for cropping
        if full_image.ndim == 2:
            region = full_image[y:y+h, x:x+w]

        elif full_image.ndim == 3:
            axes = None
            try:
                if hasattr(self.tif, "series") and self.tif.series:
                    axes = getattr(self.tif.series[0], "axes", None)
            except Exception:
                axes = None

            if axes == "YXC":
                pass
            elif axes == "CYX" or axes in ("IYX", "SYX", "QYX"):
                full_image = np.transpose(full_image, (1, 2, 0))
            else:
                # fallback
                if full_image.shape[0] > 4 and full_image.shape[1] > 4:
                    pass  # HWC
                elif full_image.shape[1] > 4 and full_image.shape[2] > 4:
                    full_image = np.transpose(full_image, (1, 2, 0))  # CHW -> HWC
                else:
                    raise ValueError(f"Ambiguous TIFF shape: {full_image.shape}, axes={axes}")
            region = full_image[y:y+h, x:x+w]

        else:
            raise ValueError(f"Unsupported TIFF ndim for read_region: {full_image.ndim}, shape={full_image.shape}")

        # Keep all channels. Do NOT truncate to RGB.
        if region.ndim == 2:
            region = region[:, :, np.newaxis]

        # Keep original dynamic range here; downstream normalizes.
        return region

    def close(self):
        self.tif.close()
    
    def __enter__(self):
        return self
    
    def __exit__(self, *args):
        self.close()


class SimpleImageReader:
    """Reader for simple image formats (loads once, streams tiles)"""
    
    def __init__(self, path):
        self.image = Image.open(str(path)).convert('RGB')
        self.width, self.height = self.image.size
        self._array = None
    
    def read_region(self, location, size):
        """Read a region from the image
        
        Args:
            location: (x, y) top-left corner
            size: (width, height) of region
            
        Returns:
            numpy array (H, W, 3), uint8, RGB
        """
        if self._array is None:
            self._array = np.array(self.image)
        
        x, y = location
        w, h = size
        return self._array[y:y+h, x:x+w]
    
    def close(self):
        if self.image:
            self.image.close()
    
    def __enter__(self):
        return self
    
    def __exit__(self, *args):
        self.close()