#!/bin/bash
#
###
# Read DigitalSlideStuidoExtractor FinalScan.ini files and put labels on the corresponding tile
# 
# $1 FinalScan.ini
# $2 Target image file for labels
# 
###
# 
# Version 1.0
#
echo "Processing ... reading offsets from " $1 ". Labels will be put on " $2
YPOS=-1
XPOS=-1
cp $2 ${2}_labeled.jpg

while read line           
do          
	if [[ $line == tDescription* ]]
		then
		IMGSIZE=`echo $line | grep -o "[0-9]*x[0-9]*" | head -1`
		IMGSIZEWIDTH=`echo $IMGSIZE | grep -o "[0-9]*" | head -1`  
		IMGSIZEHEIGHT=`echo $IMGSIZE | grep -o "[0-9]*" | tail -1`
		centerOX=`expr $IMGSIZEWIDTH / 2` 
		centerOY=`expr $IMGSIZEHEIGHT / 2`
		echo "Size=" $IMGSIZE "Center=" $centerOX "/" $centerOY				
	fi



	if [[ $line == x\=* ]]
		then
		#We found a coordinate position
		XPOS=`echo "$line" | tr -dc '[0-9]'` 		
		#echo "XPOS: " $XPOS
	fi        
	if [[ $line == y\=* ]]
		then
		#We found the corresponding Y coordinate position
		YPOS=`echo "$line" | tr -dc '[0-9]'` 		
		#echo "YPOS: " $YPOS
		#echo "--------------"
	fi           
	if [[ $XPOS -ge 0 &&  $YPOS -ge 0 ]]
		then
		echo "XPOS: " $XPOS",YPOS: " $YPOS
		#plot text on image
		#DEBUG
		cBlockXP=`expr $XPOS / 4` #/4 /4 latter due to D 
		cBlockYP=`expr $YPOS / 4`
		echo "cBlock" ${cBlockXP} "/"  ${cBlockYP}
		echo "center" ${centerOX} "/"  ${centerOX}
		posBlockX=$((centerOX-cBlockXP))
		posBlockY=$((centerOY-cBlockYP))
		echo "posBlock" ${posBlockX} "/"  ${posBlockY}
		posBlockX=${posBlockX/-/}
		posBlockY=${posBlockY/-/}
		#Scale
		posBlockX=`expr $posBlockX / 4` #/4 Dx
		posBlockY=`expr $posBlockY / 4` #/4 Dx
		convert ${2}_labeled.jpg -pointsize 80 -gravity NorthWest -annotate +${posBlockX}+${posBlockY} 'test'  ${2}_labeled.jpg
		XPOS=-1
		YPOS=-1
	fi
done <${1}
