#!/bin/bash

# Author: Sebastian Schmittner
# Date: 2014.07.23
# LastAuthor: Sebastian Schmittner
# LastDate: 2014.07.24 15:06:00 (+02:00)
# Version: 0.0.1

EXCLUDEFILES='-and ! -name *blocks* -and ! -name *template* -and ! -name . -and ! -wholename *${WEBDIRECTORY}* -and ! -name css -and ! -name static -and ! -name images -and ! -name blocks'
PATH_TO_INSTALL_PACKAGE="/var/www/pz_scripts/polyzoomer/"

FILES=`find . -maxdepth 1 -type d ${EXCLUDEFILES}`
for f in $FILES
do
  echo "DEEPZOOM: Processing $f dir..."
  cp ${PATH_TO_INSTALL_PACKAGE}/createDeepZoomTiles.sh "$f"
  cd "$f"
  bash createDeepZoomTiles.sh "$1"
  cd ..
done
