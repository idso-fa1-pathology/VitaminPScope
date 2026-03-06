#!/bin/bash

# copy the pz sources
sudo cp /home/polyscope/productionPolyscope/* -R /var/www

# update the version key
VERSIONKEY=`git --git-dir /home/polyscope/productionPolyscope/.git describe --long --dirty --abbrev=10 --tags`
echo ${VERSIONKEY}
echo ${VERSIONKEY} > "/var/www/pz_version"

echo "Process *.html files"
find /var/www/ -maxdepth 1 -name "*.html" -type f -print0 | xargs -0 sed -i "s/VERSIONKEY/${VERSIONKEY}/g"
find /var/www/pz_scripts/ -name "*.html" -type f -print0 | xargs -0 sed -i "s/VERSIONKEY/${VERSIONKEY}/g"

echo "Process *.block files"
find /var/www/ -maxdepth 1 -name "*.block" -type f -print0 | xargs -0 sed -i "s/VERSIONKEY/${VERSIONKEY}/g"
find /var/www/pz_scripts/ -name "*.block" -type f -print0 | xargs -0 sed -i "s/VERSIONKEY/${VERSIONKEY}/g"

echo "Process *.js files"
find /var/www/ -maxdepth 1 -name "*.js" -type f -print0 | xargs -0 sed -i "s/VERSIONKEY/${VERSIONKEY}/g"
find /var/www/pz_scripts/ -name "*.js" -type f -print0 | xargs -0 sed -i "s/VERSIONKEY/${VERSIONKEY}/g"
