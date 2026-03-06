#!/bin/bash
#
###
# Converts hamamatsu/svs files to JPG/PNG/... Dx (!) tiles (using the Level1 in the SVS)
# Requirements:
# FinalScan_template file 
# *nix grep 
# 
# 
# 
# 
###
# 
VERSION="1.4"
#
# SET PATH
#
# Change log
# 1.0 Initial version
# 1.1 Support for Dx tiles
# 1.2 Changed unit of x,y to "Aperio format" (Dx working!)
# 1.3 Fixed _dxTile.sh \\ problem
# 1.4 Fixed iXTILES counter (counted the total number of tiles)

BFTOOLS=/var/ww/pz_scripts/bmtools

#Size of tiles
TILESIZE=2000 #assume width=height of tiles
#Added as suffix to the tilesG
TILECOUNTER=10
EXPORTFILEFORMAT="jpg"
FINALSCANTEMPLATE="FinalScan_template"

#Counters for tiles
iXTILES=0
iYTILES=0


#Now for the Dx tiles
#Get width and height
tIMGWIDTH=`${BFTOOLS}/showinf -nopix "${1}" | grep -m 2 "Width = " | tail -1`
IMGWIDTH=`grep -m 1 -o "[0-9]*" <<< "$tIMGWIDTH"`  #stop after the second match
tIMGHEIGHT=`${BFTOOLS}/showinf -nopix "${1}" | grep -m 2 "Height = " | tail -1` # - " -
IMGHEIGHT=`grep -m 1 -o "[0-9]*" <<< "$tIMGHEIGHT"`

#Get width and height
tIMGWIDTHORIG=`${BFTOOLS}/showinf -nopix "${1}" | grep "Width = "`
IMGWIDTHORIG=`grep -m 1 -o "[0-9]*" <<< "$tIMGWIDTHORIG"`  #stop after the first match
tIMGHEIGHTORIG=`${BFTOOLS}/showinf -nopix "${1}" | grep "Height = "` # - " -
IMGHEIGHTORIG=`grep -m 1 -o "[0-9]*" <<< "$tIMGHEIGHTORIG"`

echo "DigitalSlideStudioDx Version " $VERSION
#rm Dx*

if [ ${IMGWIDTH} -eq 0 ] || [ ${IMGHEIGHT} -eq 0 ]
 then
  echo "IMAGEWIDTH or IMAGEHEIGHT are <= 0!"
  exit
else
  #echo "Image Width = $IMGWIDTH, image Height = $IMGHEIGHT"
  for (( h = 0 ; h < ${IMGHEIGHT} ; h= h + ${TILESIZE} ))
  do
    iYTILES=$((iYTILES +1))
    iXTILES=0
  for (( w = 0 ; w < ${IMGWIDTH} ; w= w + ${TILESIZE} ))
    do
      iXTILES=$((iXTILES +1))
      echo "iXTILES=${iXTILES}"
      echo "Getting tile No. $TILECOUNTER (${w},${h})"
      #Check if enough pixels are left to create a TILESIZE x TILESIZE tile

      #check for remaining WIDTH
      if [ `expr $w + ${TILESIZE}` -le $IMGWIDTH ]
  	then
	TILESIZEX=${TILESIZE} #no changes have to be made, tile can be cut out
      else #tile larger than remaining pixels
	TILESIZEX=`expr $IMGWIDTH - $w` #save remaining pixel in smaller tile
      fi

      #check for remaining HEIGHT
      if [ `expr $h + ${TILESIZE}` -le $IMGHEIGHT ]
  	then
	TILESIZEY=${TILESIZE} #no changes have to be made, tile can be cut out
      else #tile larger than remaining pixels
	TILESIZEY=`expr $IMGHEIGHT - $h` #save remaining pixel in smaller tile
      fi

       ${BFTOOLS}/bfconvert -overwrite -series 1 -crop ${w},${h},$TILESIZEX,$TILESIZEY "$1" "Dx${TILECOUNTER}.${EXPORTFILEFORMAT}" > /dev/null 2>&1
      echo "[Dx"${TILECOUNTER}"]">> FinalScan.ini
      fIMGWIDTH=`bc -l <<< "$IMGWIDTHORIG / 4"`
      fIMGHEIGHT=`bc -l <<< "$IMGHEIGHTORIG / 4"`
      echo "IMGWIDTH DX=" $fIMGWIDTH "IMGHEIGHT DX=" $fIMGHEIGHT
      wAperio=`bc -l <<< "((($fIMGWIDTH / 2)-($w + ($TILESIZE / 2))))*16"`  #16 dx
      hAperio=`bc -l <<< "((($fIMGHEIGHT / 2)-($h + ($TILESIZE / 2))))*16"` #16 dx
      wAperio=${wAperio/\.*} #remove floating point 
      hAperio=${hAperio/\.*} #remove floating point 
      #echo $IMGWIDTH " " $w " " $TILESIZE      
      echo "x="${wAperio} >> FinalScan.ini
      echo "y="${hAperio}iXTILES >> FinalScan.ini

      if [ `expr ${TILECOUNTER}` -eq 19 ] #copy the weird numbering of DSStudio
	then
	  TILECOUNTER=110
	else
	  TILECOUNTER=$((TILECOUNTER +1))
      fi
    done
  done
fi

echo "montage -limit area 8192 -limit memory 8192 Dx10.jpg Dx11.jpg Dx12.jpg Dx13.jpg Dx14.jpg Dx15.jpg Dx16.jpg Dx17.jpg Dx18.jpg Dx19.jpg \\" > _dxTile.sh 

for (( i = 110 ; i < ${TILECOUNTER} ; i= i + 1 ))
do
	echo "Dx"${i}".jpg \\" >> _dxTile.sh 
done

echo "-mode Concatenate -tile " ${iXTILES}"x"${iYTILES} "Dx_tiled.${EXPORTFILEFORMAT}" >> _dxTile.sh
chmod +x *.sh





