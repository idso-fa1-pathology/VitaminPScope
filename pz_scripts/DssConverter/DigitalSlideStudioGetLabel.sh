#!/bin/bash
#
###
# Get slide label from file and store it as "Label.jpg"
# 
# 
# 
# 
###
# 
# Version 1.0
#


BFTOOLS=/var/www/pz_scripts/bmtools
LABELNAME="Label.jpg"


#Get width and height
tIMGWIDTHORIG=`${BFTOOLS}/showinf -nopix "${1}" | grep "Width = " | tail -2`
IMGWIDTHORIG=`grep -m 1 -o "[0-9]*" <<< "$tIMGWIDTHORIG"`  #stop after the first match
tIMGHEIGHTORIG=`${BFTOOLS}/showinf -nopix "${1}" | grep "Height = " | tail -2` # - " -
IMGHEIGHTORIG=`grep -m 1 -o "[0-9]*" <<< "$tIMGHEIGHTORIG"`

w=$IMGWIDTHORIG
h=$IMGHEIGHTORIG

#echo "${w},${h},$TILESIZEX,$TILESIZEY"

#series 5 label in case of NDPI file
${BFTOOLS}/bfconvert -overwrite -series 4 -crop 0,0,${w},${h} "$1" "${LABELNAME}" 
#> /dev/null 2>&1

