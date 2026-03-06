#!/bin/bash

# Author: Sebastian Schmittner
# Date: 2014.07.08
# LastAuthor: Sebastian Schmittner
# LastDate: 2014.07.23
# Version: 0.0.0

PATH_ROWBYROW_TILER="/var/www/pz_scripts/DssConverter/RowByRowTiler"

FILES=`find . -maxdepth 1 -type d -and ! -name "."`
for f in $FILES
do
  echo "TILING: Processing $f dir..."
  
  cp ${PATH_ROWBYROW_TILER}/RowByRowTile.sh "$f"
  cd "$f"
  #start tiling
  bash RowByRowTile.sh _daTile.sh
  cd ..
done