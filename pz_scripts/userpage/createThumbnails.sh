#!/bin/bash
# Author: Sebastian Schmittner
# Date: 2015.01.24 16:16:51 (+01:00)
# LastAuthor: Enhanced for Tiered Storage
# LastDate: 2025.06.27
# Version: 0.1.0 - TIERED STORAGE SUPPORT

SETUPFILE=$1
SETUPPATH=$(dirname "$SETUPFILE")
DEFAULTSIDELENGHT=256 # pixels
EXECUTIONDIR=$PWD
BORDER=4 # pixels

# Function to resolve DZI path using tiered storage
resolve_dzi_path() {
    local DZI_PATH="$1"
    
    # If it's an absolute path, check if it exists
    if [[ -f "$DZI_PATH" ]]; then
        echo "$DZI_PATH"
        return 0
    fi
    
    # Extract project name from path
    if [[ $DZI_PATH == *"/polyzoomer_hot/"* ]]; then
        PROJECT_NAME=$(echo "$DZI_PATH" | sed 's|.*/polyzoomer_hot/\([^/]*\)/.*|\1|')
    elif [[ $DZI_PATH == *"/polyzoomer/"* ]]; then
        PROJECT_NAME=$(echo "$DZI_PATH" | sed 's|.*/polyzoomer/\([^/]*\)/.*|\1|')
    else
        echo "$DZI_PATH"  # Return original if can't parse
        return 1
    fi
    
    # Get the relative part after project name
    RELATIVE_PATH=$(echo "$DZI_PATH" | sed "s|.*/polyzoomer[^/]*/[^/]*/||")
    
    # Try hot storage first
    HOT_PATH="/var/www/polyzoomer_hot/$PROJECT_NAME/$RELATIVE_PATH"
    if [[ -f "$HOT_PATH" ]]; then
        echo "$HOT_PATH"
        return 0
    fi
    
    # Try cold storage
    COLD_PATH="/var/www/polyzoomer/$PROJECT_NAME/$RELATIVE_PATH"
    if [[ -f "$COLD_PATH" ]]; then
        echo "$COLD_PATH"
        return 0
    fi
    
    # Return original path as fallback
    echo "$DZI_PATH"
    return 1
}

echo "Start generating thumbnails with tiered storage support..."
COLS=`sed '1q;d' $1`
ROWS=`sed '2q;d' $1`
EMAIL=`sed '3q;d' $1`
ITEMS=`expr $COLS \* $ROWS`
IMAGELIST=""

for Y in `seq 1 $ROWS`;
do
for X in `seq 1 $COLS`;
do
ITEMSPERROW=2
X1=`expr $X - 1`
Y1=`expr $Y - 1`
XI=`expr $ROWS \* $X1 \* $ITEMSPERROW`
YI=`expr 4 + $Y1 \* $ITEMSPERROW`
INDEXDZI=`expr $XI + $YI`
DZI=`sed "${INDEXDZI}q;d" ${SETUPFILE}`

if [[ -z $DZI ]]
then
# generate a filling thumbnail for empty squares
cd "$SETUPPATH"
convert -size ${DEFAULTSIDELENGHT}x${DEFAULTSIDELENGHT} xc:black "THUMBNAIL_${X}_${Y}.png"
cd "$EXECUTIONDIR"
else
echo "Processing DZI: $DZI"

# ENHANCED: Resolve DZI path using tiered storage
RESOLVED_DZI=$(resolve_dzi_path "$DZI")
echo "Resolved to: $RESOLVED_DZI"

# Handle different path formats
if [[ $RESOLVED_DZI == *"/var/www/polyzoomer_hot/"* ]] || [[ $RESOLVED_DZI == *"/var/www/polyzoomer/"* ]]; then
    # Direct polyzoomer path (hot or cold)
    PATHTODZI="${RESOLVED_DZI/.dzi/}"
    PATHTODZIFILES="${PATHTODZI}_files/"
elif [[ $RESOLVED_DZI == *"/customers/"* ]]; then
    # Customer path - extract relative part
    PATHTODZI="${RESOLVED_DZI##*/customers/}"
    PATHTODZI="${PATHTODZI/.dzi/}"
    PATHTODZIFILES="/var/www/customers/${PATHTODZI}_files/"
else
    # Fallback
    PATHTODZI="${RESOLVED_DZI/.dzi/}"
    PATHTODZIFILES="${PATHTODZI}_files/"
fi

echo "Looking for tiles in: $PATHTODZIFILES"

# - find all directories - which contain JPEGs - exact 2 of them - and print -
PATHTOOVERVIEW=""
IMAGECOUNTER=2
LOOPCOUNTER=0
export IMAGECOUNTER

if [[ -d "$PATHTODZIFILES" ]]; then
    DIRECTORYCOUNT=$(find "${PATHTODZIFILES}" -type d | wc | awk '{ print $1 };')
    DIRECTORYCOUNT=`expr $DIRECTORYCOUNT - 1`
    while [[ -z $PATHTOOVERVIEW && $LOOPCOUNTER -lt $DIRECTORYCOUNT ]]; do
    PATHTOOVERVIEW=`find "${PATHTODZIFILES}" -type d -exec sh -c 'set -- "$0"/*.jpeg; [ $# -eq ${IMAGECOUNTER} ]' {} \; -print | head -1`
    LOOPCOUNTER=`expr $LOOPCOUNTER + 1`
    IMAGECOUNTER=`expr $IMAGECOUNTER + 1`
    export IMAGECOUNTER
    done
else
    echo "Tiles directory not found: $PATHTODZIFILES"
    LOOPCOUNTER=999  # Force fallback
fi

if [[ -z $PATHTOOVERVIEW ]]
then
echo "No suitable overview found, creating black thumbnail"
cd "$SETUPPATH"
convert -size ${DEFAULTSIDELENGHT}x${DEFAULTSIDELENGHT} xc:black "THUMBNAIL_${X}_${Y}.png"
cd "$EXECUTIONDIR"
else
OVERVIEWIMAGE="${PATHTOOVERVIEW}/0_0.jpeg"
echo "Using overview: $OVERVIEWIMAGE"
cd "$SETUPPATH"
if [[ -f "$OVERVIEWIMAGE" ]]; then
    convert "${OVERVIEWIMAGE}" -resize ${DEFAULTSIDELENGHT}x${DEFAULTSIDELENGHT} -background black -gravity center -extent ${DEFAULTSIDELENGHT}x${DEFAULTSIDELENGHT} "THUMBNAIL_${X}_${Y}.png"
    echo "Created THUMBNAIL_${X}_${Y}.png"
else
    echo "Overview image not found, creating black thumbnail"
    convert -size ${DEFAULTSIDELENGHT}x${DEFAULTSIDELENGHT} xc:black "THUMBNAIL_${X}_${Y}.png"
fi
cd "$EXECUTIONDIR"
fi
fi
IMAGELIST="${IMAGELIST} THUMBNAIL_${X}_${Y}.png"
done
done

cd "$SETUPPATH"
echo "Creating final montage..."
montage ${IMAGELIST} -tile ${COLS}x${ROWS} -geometry ${DEFAULTSIDELENGHT}x${DEFAULTSIDELENGHT}+${BORDER}+${BORDER} -background black -gravity center "THUMBNAIL_OVERVIEW.png"

if [[ -f "THUMBNAIL_OVERVIEW.png" ]]; then
    echo "SUCCESS: Created THUMBNAIL_OVERVIEW.png"
    chown www-data:www-data THUMBNAIL_OVERVIEW.png
    chmod 644 THUMBNAIL_OVERVIEW.png
else
    echo "ERROR: Failed to create THUMBNAIL_OVERVIEW.png"
fi

cd "$EXECUTIONDIR"