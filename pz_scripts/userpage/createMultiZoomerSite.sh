#!/bin/bash

# Author: Sebastian Schmittner (stp.schmittner@gmail.com)
# Date: 2014.11.24 23:40:07 (+01:00)
# LastAuthor: Sebastian Schmittner (stp.schmittner@gmail.com)
# LastDate: 2016.03.13 21:58:00 (+01:00)
# Version: 0.1.1

# Requirements:  Directories must be labeled according to the following scheme
#		 PATIENTIDPATIENTNUMBER_CHANNELNAME_ARBITRARYSTRING
#	         e.g. P02_Cycline_arbitrarytext
#
# Change log
# 0.1 Initial version
# 0.2 Visualization works (except sync)
# 0.3 Check hashtable and livesync for presence of *processed* 
# 0.6 Move files instead of copying (DO_FILES switch)
# 0.7 -maxdepth 2 added to ZOOMFILES - speed increase * 100
# 0.8 Adaption of paths to fit to the polyzoomer server
# 0.9 Add the copying of the dependencies from /templates/*
# 1.0 Remove tiling
# 1.1 Remove deepzoom    

DO_FILES=1 
DO_WEBSITE=1
PATH_TO_INSTALL_PACKAGE="/var/www/pz_scripts/userpage/"
WEBDIRECTORY="page"
EXCLUDEFILES='-and ! -name *blocks* -and ! -name *template* -and ! -name . -and ! -wholename *${WEBDIRECTORY}* -and ! -name css -and ! -name static -and ! -name images -and ! -name blocks'
LINKSUFFIX="processed" # e.g. P02_HEprocessed  will be sync'ed with P02_HE

##################################################

# create polyzoomer directory structure
if [ $DO_FILES -eq "1" ]; then
  if [ ! -d "$WEBDIRECTORY" ]; then  #don't overwrite already existing website
    echo "Start creating filestructure for website ..."
    mkdir "$WEBDIRECTORY"
    cp -r "$PATH_TO_INSTALL_PACKAGE"/templates/* "$WEBDIRECTORY"
  fi
else
  echo "[ERROR]: Website directory already exists!"
fi

# create website
VIEWERCOUNTER=0
if [ $DO_WEBSITE -eq "1" ]; then
	echo "Start generating website ..."
	cd "$WEBDIRECTORY"

	COLS=`sed '1q;d' ../setup.cfg`
	ROWS=`sed '2q;d' ../setup.cfg`
	EMAIL=`sed '3q;d' ../setup.cfg`
	ITEMS=`expr $COLS \* $ROWS`

	echo "Processing ${f}"
	echo "" > _tmpviewer #create tmp viewer html file
	echo "" > _tmpbody2  #create tmp hashtable html file

	mkdir "./INDEX"
	PATHTOINDEX="./INDEX/index.html"
	echo "./INDEX/index.html" >> "./indexes"

	cat ./blocks/header.block > ${PATHTOINDEX} #create index file
	
	ALPHAVIEWER="contentDiv0"
	
	for Y in `seq 1 $ROWS`;
	do
		echo "<tr>" >> _tmpviewer
		
		for X in `seq 1 $COLS`;
		do
			CONTENTID="contentDiv${VIEWERCOUNTER}"
			
			ITEMSPERROW=2
			X1=`expr $X - 1`
			Y1=`expr $Y - 1`
			XI=`expr $ROWS \* $X1 \* $ITEMSPERROW`
			YI=`expr 4 + $Y1 \* $ITEMSPERROW`
			
			INDEXDZI=`expr $XI + $YI`
			INDEXALPHA=`expr $INDEXDZI + 1`
			
			DZI=`sed "${INDEXDZI}q;d" ../setup.cfg`
			ALPHA=`sed "${INDEXALPHA}q;d" ../setup.cfg`
	
			if [[ -z $DZI ]]
			then
				echo "<td></td>" >> _tmpviewer
				continue
			fi
				
			if [[ $ALPHA == *1* ]]
			then
				ALPHAVIEWER=$CONTENTID
			fi
			
			echo "LiveSync(${CONTENTID});" >> "${PATHTOINDEX}"   # corresponding PROCESSED file found	      
			#echo "addPrintHandler(${CONTENTID});" >> "${PATHTOINDEX}" 

			VIEWERNAME=`basename "${DZI}"`
			NDPIKEY=".ndpideepzoom.dzi"
			KEYUNKNOWN="UNKNOWNPAT0001_UNKNOWNCHANNEL0001_"
			VIEWERNAME="${VIEWERNAME/$NDPIKEY}"
			VIEWERNAME="${VIEWERNAME/$KEYUNKNOWN}"
			
			# read: get the _ positions, get the numbers infront of the : and get the second in the list
			#SECONDUNDERSCORE=`echo $VIEWERNAME | grep -b -o '_' | cut -d: -f1 | sed '2!d;q'`

			#if [[ $VIEWERNAME == *"UNKNOWN"* ]]
			#then
				# get the file name part
				#VIEWERNAME=${VIEWERNAME:$SECONDUNDERSCORE + 1}
			#else
				# get the detected patient and channel id
				#VIEWERNAME=${VIEWERNAME:0:$SECONDUNDERSCORE}
			#fi
			
			cat ./blocks/viewer.block >> "_tmpviewer"
			##
			#not stored in header but pre-created to concat to body afterwards
			##
			PATHTODZI="/${WEBDIRECTORY}/${PAT_ID}/${CHANNEL_ID}"
			#replace tags
			
			#sed -i "s/_CONTENTID_/${CONTENTID}/g" "_tmpviewer"     
			#sed -i "s/_REL_PATH_TO_DZI_/${DZI}|g" "_tmpviewer"
			#sed -i "s/_VIEWERNAME_/${VIEWERNAME}/g" "_tmpviewer"
			#sed -i "s/_VIEWER_VARNAME_/${CONTENTID}/g" "_tmpviewer"  #important for hash table later    
			
			sed "s/_CONTENTID_/${CONTENTID}/g" _tmpviewer > tmp; cat tmp > _tmpviewer  
			echo this is the path to dzi ${DZI}
			sed "s+_REL_PATH_TO_DZI_+${DZI}+g" "_tmpviewer" > tmp; cat tmp > "_tmpviewer" 
			sed "s/_VIEWERNAME_/${VIEWERNAME}/g" _tmpviewer > tmp; cat tmp > _tmpviewer 
			sed "s/_VIEWER_VARNAME_/${CONTENTID}/g" "_tmpviewer" > tmp; cat tmp > "_tmpviewer"   
			
			let VIEWERCOUNTER=VIEWERCOUNTER+1      
			
			if [[ $ALPHA != *1* ]]
			then
				echo "ViewerHash['_VIEWERID_'] = _VIEWERVARNAME_;" >> "_tmpbody2"
				#sed -i "s/_VIEWERID_/${CONTENTID}/g" "_tmpbody2" 
				sed "s/_VIEWERID_/${CONTENTID}/g" "_tmpbody2" > tmp; cat tmp > "_tmpbody2"     
			fi

			#replace tags
			#sed -i "s/_VIEWERVARNAME_/${PAT_ID}${CHANNEL_ID}${LINKSUFFIX}/g" "_tmpbody2"
		done

		echo "</tr>" >> _tmpviewer
	
	done
	
	#sed -i "s/_VIEWERVARNAME_/${ALPHAVIEWER}/g" "_tmpbody2"
	sed "s/_VIEWERVARNAME_/${ALPHAVIEWER}/g" "_tmpbody2" > tmp; cat tmp > "_tmpbody2" 
  
	cat ./blocks/body1.block >> "${PATHTOINDEX}"

	#add viewer scripts
	cat ./_tmpviewer >> "${PATHTOINDEX}"
		
	#echo "</tr>" >> "${PATHTOINDEX}"
	echo "</table>" >> "${PATHTOINDEX}"
	echo "<script type="text/javascript">" >> "${PATHTOINDEX}"
	echo "var ViewerHash = new Object();"  >> "${PATHTOINDEX}"
	cat ./_tmpbody2 >> "${PATHTOINDEX}" 
	echo "</script>" >> "${PATHTOINDEX}"
	echo "</body>" >> "${PATHTOINDEX}"
fi

 # FILES=`find . -maxdepth 1 -type d ${EXCLUDEFILES}`  
#  for f in $FILES
  #do