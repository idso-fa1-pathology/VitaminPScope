#!/bin/bash
# Author: Sebastian Schmittner
# Date: 2014.07.08
# LastAuthor: Sebastian Schmittner
# LastDate: 2016.04.13 11:09
# Version: 0.2.0

# log the file size
FILE_SIZE=$(ls "$1" -l | awk ' {print $5}')
echo "$FILE_SIZE" >> polyzoom.pid
# log the filename
echo "$1" >> polyzoom.pid
# log start time
date >> polyzoom.pid

t1=`dirname "${1}"`
t2=`basename "${1}"`
t3="${t2##*.}" #extension
WORKINGDIR=`echo "${t1}""/""${t2%%.${t3}}"`
chmod 777 ./createPolyzoomerSite.sh
mkdir "${WORKINGDIR}"

# cp "$1" "${WORKINGDIR}"
#time /usr/local/bin/vips dzsave "${1}" "${WORKINGDIR}/${1}deepzoom" &> deepzoom.log
time /usr/local/bin/vips dzsave "${1}" "${WORKINGDIR}/" &> deepzoom.log

FILENAME="${t2%%.${t3}}"
DZIIN="${WORKINGDIR}/${FILENAME}.dzi"
FILESIN="${WORKINGDIR}/${FILENAME}_files"
DZIOUT="${WORKINGDIR}/${t2}deepzoom.dzi"
FILESOUT="${WORKINGDIR}/${t2}deepzoom_files"

mv "${DZIIN}" "${DZIOUT}"
mv "${FILESIN}" "${FILESOUT}"

# ========== EXTRACT METADATA FOR SCALE BAR ==========
echo "Extracting metadata for scale bar..." >> deepzoom.log
echo "DEBUG: Working directory: $(pwd)" >> deepzoom.log
echo "DEBUG: Input file: ${1}" >> deepzoom.log
echo "DEBUG: Full path test: $(readlink -f "${1}" 2>&1)" >> deepzoom.log
echo "DEBUG: File exists: $(test -f "${1}" && echo "YES" || echo "NO")" >> deepzoom.log

# Extract all header information from the image
/usr/local/bin/vips header --all "${1}" > "${WORKINGDIR}/vips_metadata.txt" 2>&1

# Initialize metadata variables
MPP_X=""
MPP_Y=""
MAGNIFICATION=""
SCAN_DATE=""
SCAN_TIME=""
SCANNER_ID=""
VENDOR=""

# Method 1: Check for xres/yres in vips header (common in TIFF/SVS)
XRES=$(grep -i "xres:" "${WORKINGDIR}/vips_metadata.txt" | awk '{print $2}')
YRES=$(grep -i "yres:" "${WORKINGDIR}/vips_metadata.txt" | awk '{print $2}')

echo "DEBUG: VIPS XRES='$XRES', YRES='$YRES'" >> deepzoom.log

# If xres/yres exist and are in pixels/mm, convert to microns per pixel
if [ -n "$XRES" ] && [ "$XRES" != "0" ]; then
    MPP_X=$(echo "scale=6; 1000 / $XRES" | bc)
    echo "DEBUG: Calculated MPP_X from VIPS: $MPP_X" >> deepzoom.log
fi
if [ -n "$YRES" ] && [ "$YRES" != "0" ]; then
    MPP_Y=$(echo "scale=6; 1000 / $YRES" | bc)
    echo "DEBUG: Calculated MPP_Y from VIPS: $MPP_Y" >> deepzoom.log
fi

# Method 2: Try OpenSlide for SVS/NDPI files
echo "DEBUG: Checking for openslide-show-properties command..." >> deepzoom.log
OPENSLIDE_CMD="/usr/local/bin/openslide-show-properties"
echo "DEBUG: Using OpenSlide at: $OPENSLIDE_CMD" >> deepzoom.log
echo "DEBUG: OpenSlide exists: $(test -f "$OPENSLIDE_CMD" && echo "YES" || echo "NO")" >> deepzoom.log

if [ -f "$OPENSLIDE_CMD" ]; then
    echo "DEBUG: OpenSlide found, attempting extraction..." >> deepzoom.log
    echo "DEBUG: Running: $OPENSLIDE_CMD \"${1}\"" >> deepzoom.log
    
    # Capture full output for debugging
    OPENSLIDE_OUTPUT=$($OPENSLIDE_CMD "${1}" 2>&1)
    OPENSLIDE_EXIT_CODE=$?
    echo "DEBUG: OpenSlide exit code: $OPENSLIDE_EXIT_CODE" >> deepzoom.log
    
    # Only process if OpenSlide successfully opened the file
    if [ $OPENSLIDE_EXIT_CODE -eq 0 ]; then
        echo "DEBUG: OpenSlide output (first 15 lines):" >> deepzoom.log
        echo "$OPENSLIDE_OUTPUT" | head -15 >> deepzoom.log
        
        # Extract MPP
        OPENSLIDE_MPP_X=$(echo "$OPENSLIDE_OUTPUT" | grep "openslide.mpp-x" | cut -d: -f2 | tr -d " '\"")
        OPENSLIDE_MPP_Y=$(echo "$OPENSLIDE_OUTPUT" | grep "openslide.mpp-y" | cut -d: -f2 | tr -d " '\"")
        
        # Extract additional metadata
        MAGNIFICATION=$(echo "$OPENSLIDE_OUTPUT" | grep -E "aperio.AppMag|hamamatsu.SourceLens" | head -1 | cut -d: -f2 | tr -d " '\"")
        SCAN_DATE=$(echo "$OPENSLIDE_OUTPUT" | grep "aperio.Date" | cut -d: -f2 | tr -d " '\"")
        SCAN_TIME=$(echo "$OPENSLIDE_OUTPUT" | grep "aperio.Time" | cut -d: -f2 | tr -d " '\"" | tr -d '\n\r' | tr -d '\t')
        SCANNER_ID=$(echo "$OPENSLIDE_OUTPUT" | grep -E "aperio.ScanScope ID|hamamatsu.SerialNumber" | head -1 | cut -d: -f2 | tr -d " '\"")
        VENDOR=$(echo "$OPENSLIDE_OUTPUT" | grep "openslide.vendor" | cut -d: -f2 | tr -d " '\"")
        
        echo "DEBUG: Extracted OPENSLIDE_MPP_X='$OPENSLIDE_MPP_X'" >> deepzoom.log
        echo "DEBUG: Extracted OPENSLIDE_MPP_Y='$OPENSLIDE_MPP_Y'" >> deepzoom.log
        echo "DEBUG: Magnification='$MAGNIFICATION', Date='$SCAN_DATE', Time='$SCAN_TIME'" >> deepzoom.log
        echo "DEBUG: Scanner='$SCANNER_ID', Vendor='$VENDOR'" >> deepzoom.log
        
        if [ -n "$OPENSLIDE_MPP_X" ]; then
            MPP_X=$OPENSLIDE_MPP_X
            echo "DEBUG: Set MPP_X to $MPP_X from OpenSlide" >> deepzoom.log
        fi
        if [ -n "$OPENSLIDE_MPP_Y" ]; then
            MPP_Y=$OPENSLIDE_MPP_Y
            echo "DEBUG: Set MPP_Y to $MPP_Y from OpenSlide" >> deepzoom.log
        fi
    else
        echo "DEBUG: OpenSlide could not open file (exit code: $OPENSLIDE_EXIT_CODE)" >> deepzoom.log
        echo "DEBUG: This is normal for non-whole-slide formats like JPG, PNG, TIFF" >> deepzoom.log
    fi
else
    echo "DEBUG: OpenSlide command NOT found at $OPENSLIDE_CMD" >> deepzoom.log
fi

# Extract image dimensions from DZI file
IMAGE_WIDTH=""
IMAGE_HEIGHT=""
TILE_SIZE=""
OVERLAP=""

if [ -f "${DZIOUT}" ]; then
    IMAGE_WIDTH=$(grep -oP 'Width="\K[0-9]+' "${DZIOUT}")
    IMAGE_HEIGHT=$(grep -oP 'Height="\K[0-9]+' "${DZIOUT}")
    TILE_SIZE=$(grep -oP 'TileSize="\K[0-9]+' "${DZIOUT}")
    OVERLAP=$(grep -oP 'Overlap="\K[0-9]+' "${DZIOUT}")
    echo "DEBUG: Image dimensions: ${IMAGE_WIDTH}x${IMAGE_HEIGHT}" >> deepzoom.log
    echo "DEBUG: Tile size: ${TILE_SIZE}, Overlap: ${OVERLAP}" >> deepzoom.log
fi

# Calculate physical dimensions if we have MPP and pixel dimensions
PHYSICAL_WIDTH_MM=""
PHYSICAL_HEIGHT_MM=""
if [ -n "$MPP_X" ] && [ -n "$IMAGE_WIDTH" ] && [ -n "$MPP_Y" ] && [ -n "$IMAGE_HEIGHT" ]; then
    # Convert to millimeters: (pixels × microns/pixel) / 1000
    PHYSICAL_WIDTH_MM=$(echo "scale=3; $IMAGE_WIDTH * $MPP_X / 1000" | bc)
    PHYSICAL_HEIGHT_MM=$(echo "scale=3; $IMAGE_HEIGHT * $MPP_Y / 1000" | bc)
    echo "DEBUG: Physical dimensions: ${PHYSICAL_WIDTH_MM}mm x ${PHYSICAL_HEIGHT_MM}mm" >> deepzoom.log
fi

echo "DEBUG: Final MPP_X='$MPP_X', MPP_Y='$MPP_Y'" >> deepzoom.log

# Create metadata JSON file
METADATA_JSON="${WORKINGDIR}/${t2}deepzoom_metadata.json"
echo "{" > "$METADATA_JSON"
echo "  \"filename\": \"${t2}\"," >> "$METADATA_JSON"
echo "  \"format\": \"${t3}\"," >> "$METADATA_JSON"

# Add file size
if [ -n "$FILE_SIZE" ]; then
    echo "  \"fileSizeBytes\": $FILE_SIZE," >> "$METADATA_JSON"
    FILE_SIZE_MB=$(echo "scale=2; $FILE_SIZE / 1048576" | bc 2>/dev/null)
    # Only add fileSizeMB if bc produced a valid result
    if [ -n "$FILE_SIZE_MB" ] && [ "$FILE_SIZE_MB" != "" ]; then
        echo "  \"fileSizeMB\": $FILE_SIZE_MB," >> "$METADATA_JSON"
    fi
fi

# Add image dimensions
if [ -n "$IMAGE_WIDTH" ] && [ -n "$IMAGE_HEIGHT" ]; then
    echo "  \"imageWidth\": $IMAGE_WIDTH," >> "$METADATA_JSON"
    echo "  \"imageHeight\": $IMAGE_HEIGHT," >> "$METADATA_JSON"
fi

# Add DZI tile info
if [ -n "$TILE_SIZE" ]; then
    echo "  \"tileSize\": $TILE_SIZE," >> "$METADATA_JSON"
fi
if [ -n "$OVERLAP" ]; then
    echo "  \"overlap\": $OVERLAP," >> "$METADATA_JSON"
fi

# Add scale information
if [ -n "$MPP_X" ] && [ -n "$MPP_Y" ]; then
    echo "  \"mppX\": $MPP_X," >> "$METADATA_JSON"
    echo "  \"mppY\": $MPP_Y," >> "$METADATA_JSON"
    echo "  \"hasScale\": true," >> "$METADATA_JSON"
    
    # Add physical dimensions if calculated
    if [ -n "$PHYSICAL_WIDTH_MM" ] && [ -n "$PHYSICAL_HEIGHT_MM" ]; then
        echo "  \"physicalWidthMM\": $PHYSICAL_WIDTH_MM," >> "$METADATA_JSON"
        echo "  \"physicalHeightMM\": $PHYSICAL_HEIGHT_MM," >> "$METADATA_JSON"
    fi
    
    echo "Scale information extracted: MPP_X=$MPP_X, MPP_Y=$MPP_Y" >> deepzoom.log
else
    echo "  \"hasScale\": false," >> "$METADATA_JSON"
    echo "Warning: Could not extract scale information" >> deepzoom.log
fi

# Add scanner/acquisition metadata if available
if [ -n "$MAGNIFICATION" ]; then
    echo "  \"magnification\": \"$MAGNIFICATION\"," >> "$METADATA_JSON"
fi
if [ -n "$SCAN_DATE" ]; then
    echo "  \"scanDate\": \"$SCAN_DATE\"," >> "$METADATA_JSON"
fi
if [ -n "$SCAN_TIME" ]; then
    echo "  \"scanTime\": \"$SCAN_TIME\"," >> "$METADATA_JSON"
fi
if [ -n "$SCANNER_ID" ]; then
    echo "  \"scannerId\": \"$SCANNER_ID\"," >> "$METADATA_JSON"
fi
if [ -n "$VENDOR" ]; then
    echo "  \"vendor\": \"$VENDOR\"," >> "$METADATA_JSON"
fi

# Add processing timestamp
echo "  \"processingDate\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"" >> "$METADATA_JSON"

echo "}" >> "$METADATA_JSON"

echo "Metadata saved to: $METADATA_JSON" >> deepzoom.log
# ========== END METADATA EXTRACTION ==========

# create the polyzoomer site
date > createSiteTiming.log
time bash +x ./createPolyzoomerSite.sh &> creation.log
date >> createSiteTiming.log

# perform OME XML extraction
/var/www/pz_scripts/bmtools/showinf -nopix -omexml -novalid "${1}" > "${1}.xml"

# Try to extract PhysicalSize from OME-XML if scale wasn't found earlier
if [ -z "$MPP_X" ] && [ -f "${1}.xml" ]; then
    PHYSICAL_X=$(grep -i "PhysicalSizeX=" "${1}.xml" | head -1 | sed 's/.*PhysicalSizeX="\([^"]*\)".*/\1/')
    PHYSICAL_Y=$(grep -i "PhysicalSizeY=" "${1}.xml" | head -1 | sed 's/.*PhysicalSizeY="\([^"]*\)".*/\1/')
    
    if [ -n "$PHYSICAL_X" ] && [ -n "$PHYSICAL_Y" ]; then
        # Update the metadata JSON with PhysicalSize values
        sed -i 's/"hasScale": false/"hasScale": true/' "$METADATA_JSON"
        sed -i '/"hasScale": true/a\  "mppX": '$PHYSICAL_X',\n  "mppY": '$PHYSICAL_Y',' "$METADATA_JSON"
        echo "Scale extracted from OME-XML: PhysicalSizeX=$PHYSICAL_X, PhysicalSizeY=$PHYSICAL_Y" >> deepzoom.log
    fi
fi

# log end time
date >> polyzoom.pid
# mark as finished
mv polyzoom.pid polyzoom.pid.done