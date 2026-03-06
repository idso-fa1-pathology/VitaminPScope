#!/bin/bash

# Author: Sebastian Schmittner
# Date: 2014.09.13 18:34:47 (+02:00)
# LastAuthor: Sebastian Schmittner
# LastDate: 2015.01.21 15:47:21 (+01:00)
# Version: 0.0.7

echo "Converting *.sh files"
find ./ -path ./polyzoomer -prune -o -type f -name "*.sh" -exec sudo dos2unix {} \;

echo "Converting *.php files"
find ./ -path ./polyzoomer -prune -o -type f -name "*.php" -exec sudo dos2unix {} \;

echo "Converting *.js files"
find ./ -path ./polyzoomer -prune -o -type f -name "*.js" -exec sudo dos2unix {} \;

echo "Done"

