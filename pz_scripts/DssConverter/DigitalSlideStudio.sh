#!/bin/bash
#
###
# Converts Aperion svs files to JPG/PNG/... files
# Requirements:
# FinalScan_template file 
# *nix grep 
# 
# 
# 
# 
###
# 
# Version 2.0
#
# SET PATH
#
# Change log
# 1.0 Initial version
# 1.1 Support for Dx tiles
# 1.2 added daTile.sh (tile whole image)
# 1.3 Add LSF support for cluster Cyberman
# 1.4 Now the target dir for the tiles is not the current dir but instead the dir where the source is located
# 1.5 Add ${WORKINGDIR} to all created files, JPEG quality 80% default
# 1.6 Fixed Preview issue (even if image is very small, -crop has to be used)
# 1.7b Added slide label - always the last-1 series
# 1.8 Added SlideThumb
# 1.9 Fixed SLIDETHUMBTHRESH typo
# 2.0 Fixed SS.jpg (wrong layer)

function floor() {
    float_in=$1
    floor_val=${float_in/.*}
}

function ceiling() {
    float_in=$1
    ceil_val=${float_in/.*}
    ceil_val=$((ceil_val+1))
}


BFTOOLS=/var/www/pz_scripts/bmtools

#Size of tiles
TILESIZE=2000 #assume width=height of tiles
#Added as suffix to the tiles
TILECOUNTER=0
EXPORTFILEFORMAT="jpg"
#SCALEDXTILE=0.30
FINALSCANTEMPLATE="FinalScan_template"
OVERVIEWIMGSIZE=3 #level in SVS

t1=`dirname "${1}"`
t2=`basename "${1}"` 
t3="${t2##*.}" #extension
WORKINGDIR=`echo "${t1}""/""${t2%%.${t3}}"` 
#Counters for tiles
iXTILES=0
iYTILES=0


#Get width and height
tIMGWIDTH=`${BFTOOLS}/showinf -nopix "${1}" | grep "Width = "`
IMGWIDTH=`grep -m 1 -o "[0-9]*" <<< "$tIMGWIDTH"`  #stop after the first match
tIMGHEIGHT=`${BFTOOLS}/showinf -nopix "${1}" | grep "Height = "` # - " -
IMGHEIGHT=`grep -m 1 -o "[0-9]*" <<< "$tIMGHEIGHT"`

#Get width and height
tIMGWIDTHORIG=`${BFTOOLS}/showinf -nopix "${1}" | grep "Width = "`
IMGWIDTHORIG=`grep -m 1 -o "[0-9]*" <<< "$tIMGWIDTHORIG"`  #stop after the first match
tIMGHEIGHTORIG=`${BFTOOLS}/showinf -nopix "${1}" | grep "Height = "` # - " -
IMGHEIGHTORIG=`grep -m 1 -o "[0-9]*" <<< "$tIMGHEIGHTORIG"`

#Get total amount of series
tTOTALAMOUNTOFSERIES=`${BFTOOLS}/showinf -nopix "${1}"  | grep "Series #" | tail -1`
TOTALAMOUNTOFSERIES=`grep -m 1 -o "[0-9]*" <<< "$tTOTALAMOUNTOFSERIES"`

#initialize log file
echo "" > "${WORKINGDIR}/${1%.svs}.log"

#create target directory
mkdir "${WORKINGDIR}"

#Prepare the FinalScan.ini
cat $FINALSCANTEMPLATE > "${WORKINGDIR}/FinalScan.ini"

if [ ${IMGWIDTH} -eq 0 ] || [ ${IMGHEIGHT} -eq 0 ]
 then
  echo "IMAGEWIDTH or IMAGEHEIGHT are <= 0!"
  exit
else
  echo "Image Width = $IMGWIDTH, image Height = $IMGHEIGHT"
  for (( h = 0 ; h < ${IMGHEIGHT} ; h= h + ${TILESIZE} ))
  do
    iYTILES=$((iYTILES +1))
    iXTILES=0
  for (( w = 0 ; w < ${IMGWIDTH} ; w= w + ${TILESIZE} ))
    do
      iXTILES=$((iXTILES +1))
      echo "Getting tile No. $TILECOUNTER (${w},${h}) storing tiles in ${WORKINGDIR}"
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
    
     ${BFTOOLS}/bfconvert -overwrite -series 0 -crop ${w},${h},$TILESIZEX,$TILESIZEY "$1" "${WORKINGDIR}/Da${TILECOUNTER}.${EXPORTFILEFORMAT}"  
      echo "[Da"${TILECOUNTER}"]" >> "${WORKINGDIR}/FinalScan.ini"
      fIMGWIDTH=`bc -l <<< "$IMGWIDTHORIG"`
      fIMGHEIGHT=`bc -l <<< "$IMGHEIGHTORIG"`
      #echo "((($fIMGWIDTH / 2)-($w + ($TILESIZE / 2))))*4"
      wAperio=`bc -l <<< "((($fIMGWIDTH / 2)-($w + ($TILESIZE / 2))))*4"` 
      hAperio=`bc -l <<< "((($fIMGHEIGHT / 2)-($h + ($TILESIZE / 2))))*4"`
      wAperio=${wAperio/\.*} #remove floating point 
      hAperio=${hAperio/\.*} #remove floating point 
      #echo "x="${wAperio} " y="${hAperio}  
      echo "x="${wAperio} >> "${WORKINGDIR}/FinalScan.ini"
      echo "y="${hAperio} >> "${WORKINGDIR}/FinalScan.ini"
      echo "z=0" >> "${WORKINGDIR}/FinalScan.ini"
      TILECOUNTER=$((TILECOUNTER +1))
    done
  done
fi


sed -i "s/%TILESIZE%/${TILESIZE}/g" "${WORKINGDIR}/FinalScan.ini"
sed -i "s/%XSIZE%/${IMGWIDTH}/g" "${WORKINGDIR}/FinalScan.ini"
sed -i "s/%YSIZE%/${IMGHEIGHT}/g" "${WORKINGDIR}/FinalScan.ini"

#Create overview image (total amount of series - 1)
PREVIEWWIDTH=`${BFTOOLS}/showinf -nopix "${1}" | grep -m 2 "Width = " | tail -1 | grep -o "[0-9]*" -`
PREVIEWHEIGHT=`${BFTOOLS}/showinf -nopix "${1}" | grep -m 2 "Height = " | tail -1 | grep -o "[0-9]*" -`
PREVIEWSERIE=1
echo "Generating Preview x="$PREVIEWWIDTH" y="$PREVIEWHEIGHT

       ${BFTOOLS}/bfconvert -overwrite -series "${PREVIEWSERIE}" -crop 0,0,"${PREVIEWWIDTH},${PREVIEWHEIGHT}" "$1" "${WORKINGDIR}/Ss1.${EXPORTFILEFORMAT}" 
echo "montage -limit area 8192 -limit memory 8192 \\" > "${WORKINGDIR}/_daTile.sh" 

for (( i = 0 ; i < ${TILECOUNTER} ; i= i + 1 ))
do
	echo "Da"${i}".jpg \\" >> "${WORKINGDIR}/_daTile.sh" 
done

echo "-mode Concatenate -tile " ${iXTILES}"x"${iYTILES} "Da_tiled.${EXPORTFILEFORMAT}" >> "${WORKINGDIR}/_daTile.sh"
chmod +x "${WORKINGDIR}/*.sh"



#Create Slidemacro - always the last-1 layer
LABELWIDTH=`${BFTOOLS}/showinf -nopix "${1}" | grep "Width = " | tail -2 | head -n 1 | grep -o "[0-9]*" -`
LABELHEIGHT=`${BFTOOLS}/showinf -nopix "${1}" | grep  "Height = " | tail -2 | head -n 1 | grep -o "[0-9]*" -`
GETLABELSERIES=`${BFTOOLS}/showinf -nopix "${1}" | grep "Series" | tail -2 | head -n 1 | grep -o "[0-9]*" -`
echo "Extracting Label"
        ${BFTOOLS}/bfconvert -overwrite -series ${GETLABELSERIES} -crop 0,0,"${LABELWIDTH},${LABELHEIGHT}" "$1" "${WORKINGDIR}/SlideMacro.${EXPORTFILEFORMAT}" 



#Create SlideThumb (depending on the ratio of w/h. If > 1.3 then w=1024 else h=768
SLIDETHUMBTHRESH=1.3
SOURCEFORTHUMB=3 #series number
if [ `echo "(${PREVIEWWIDTH} / ${PREVIEWHEIGHT} > ${SLIDETHUMBTHRESH})" |bc -l` ]
then # w=1024
  RESIZEFACTORHEIGHT=`echo "${PREVIEWHEIGHT}/1024" |bc -l`  #changed
  THUMBWIDTH=1024
  THUMBHEIGHT=`echo "${PREVIEWHEIGHT}/${RESIZEFACTORHEIGHT}" |bc -l`
  floor $THUMBHEIGHT
  THUMBWIDTH=${floor_val}
else # h=768
  RESIZEFACTORWIDTH=`echo "${PREVIEWHEIGHT}/768" |bc -l` #changed
  THUMBHEIGHT=768
  THUMBWIDTH=`echo "${IMGHEIGHTORIG}/${RESIZEFACTORHEIGHT}" |bc -l`
  floor $THUMBWIDTH
  THUMBWIDTH=${floor_val}
fi
echo "Creating SlideThumb"
	convert "${WORKINGDIR}/Ss1.${EXPORTFILEFORMAT}" -resize ${THUMBWIDTH}x${THUMBHEIGHT} "${WORKINGDIR}/SlideThumb.${EXPORTFILEFORMAT}"


# CLUSTER scripts
#LSF support
echo "" > "${WORKINGDIR}/clustTile.sh" #init
echo "#BSUB -J \"testjob\"" >> "${WORKINGDIR}/clustTile.sh"
echo "#BSUB -o z.output.%J" >> "${WORKINGDIR}/clustTile.sh"
echo "#BSUB -e z.errors.%J" >> "${WORKINGDIR}/clustTile.sh"
echo "#BSUB -n 1" >> "${WORKINGDIR}/clustTile.sh"
echo "#BSUB -P default" >> "${WORKINGDIR}/clustTile.sh"
echo "#BSUB -B" >> "${WORKINGDIR}/clustTile.sh"
echo "startRowByRowTile.sh" >> "${WORKINGDIR}/clustTile.sh"
echo "startFinalTile.sh" >> "${WORKINGDIR}/clustTile.sh"




