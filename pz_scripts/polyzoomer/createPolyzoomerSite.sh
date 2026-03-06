#!/bin/bash

# Author: Andreas Heindl
# Date: -
# LastAuthor: Sebastian Schmittner
# LastDate: 2016.01.21 10:25:29 (+01:00)
# Version: 2.0.2 - Enhanced template placeholder processing

# Requirements:  Directories must be labeled according to the following scheme
#		 PATIENTIDPATIENTNUMBER_CHANNELNAME_ARBITRARYSTRING
#	         e.g. P02_Cycline_arbitrarytext

DO_FILES=1 
DO_WEBSITE=1
PATH_TO_INSTALL_PACKAGE="/var/www/pz_scripts/polyzoomer/"
WEBDIRECTORY="page"
EXCLUDEFILES='-and ! -name *blocks* -and ! -name *template* -and ! -name . -and ! -wholename *${WEBDIRECTORY}* -and ! -name css -and ! -name static -and ! -name images -and ! -name blocks -and ! -name js'
LINKSUFFIX="processed" # e.g. P02_HEprocessed  will be sync'ed with P02_HE

ANNOTATIONS_LINK=""

FORCEREPLACE=0
if [[ ! -z "${1// }" ]]; then
	if [[ "$1" == "FORCE" ]]; then
		FORCEREPLACE=1
		echo "[WARN]: Forced update!"
	fi
fi

##################################################

function checkIfProcessedFileAvailable {
  # $1 ... Patient ID and Channel name .. e.g. P02_CyclinA
  # returns 0 if not found else 1
  PROCESSED=`find ../ -maxdepth 1 -type d -name  "*${1}processed*"`    
  if [[ -z "$PROCESSED" ]] ; then # not found 
    echo 0	  
  else
    echo 1	  
  fi
}

function replaceTemplateVariable {
  # $1 = file path
  # $2 = placeholder pattern (with wildcards)
  # $3 = replacement value
  local filepath="$1"
  local pattern="$2"
  local replacement="$3"
  
  # Handle different placeholder formats
  sed "s/${pattern}/${replacement}/g" "$filepath" > tmp_replace && mv tmp_replace "$filepath"
}

# create polyzoomer directory structure
if [ $DO_FILES -eq "1" ]; then
  if [[ ! -d "$WEBDIRECTORY" || ${FORCEREPLACE} -eq 1 ]]; then  #don't overwrite already existing website
    echo "Start creating filestructure for website ..."
    mkdir "$WEBDIRECTORY"
    cp -r "$PATH_TO_INSTALL_PACKAGE"/templates/* "$WEBDIRECTORY"
    FILES=`find . -maxdepth 1 -type d ${EXCLUDEFILES}`
    echo $FILES
	for f in $FILES
    do  
      PAT_ID=`echo ${f} | egrep -i -o '[a-z]+[0-9]+' | head -1` # e.g. P10_CyclineA_sadasdasd  #added 
      # If PAT_ID is empty, extract it from the directory name directly
      if [[ -z "$PAT_ID" ]]; then
          PAT_ID=`echo ${f} | cut -d'_' -f1 | sed 's|^\./||'`
      fi
      echo "Processing Patient ID: $PAT_ID"
	  #Get all image of the current patient
      ZOOMFILES=`find . -maxdepth 2 -type f -wholename "*${PAT_ID}*dzi" ${EXCLUDEFILES}`
      echo "Found DZI files: $ZOOMFILES"
	  for i in $ZOOMFILES
      do
        PAT_ID=`echo ${i} | egrep -i -o '[a-z]+[0-9]+' | head -1` # e.g. P10_CyclineA_sadasdasd
        CHANNEL_ID=`echo ${i} | egrep -i -o '_[a-zA-Z]+[a-zA-Z0-9]*' | head -1`  #e.g. _CyclineA
        # If CHANNEL_ID is empty, try alternative extraction
        if [[ -z "$CHANNEL_ID" ]]; then
            CHANNEL_ID=`echo ${i} | cut -d'/' -f2 | cut -d'_' -f2`
            if [[ ! -z "$CHANNEL_ID" ]]; then
                CHANNEL_ID="_${CHANNEL_ID}"
            else
                CHANNEL_ID="_UNKNOWNCHANNEL0001"
            fi
        fi
        echo "Patient ID: $PAT_ID, Channel ID: $CHANNEL_ID"
		mkdir -p "${WEBDIRECTORY}/${PAT_ID}/${CHANNEL_ID}" #get first N characters and 
    echo "Copying ${i}..."   				   #create directory (will be grouped on a webpage)
    mv -n "${i}" "${WEBDIRECTORY}/${PAT_ID}/${CHANNEL_ID}/"
    #copy also directories
    mv -n "${i%.dzi}_files" "${WEBDIRECTORY}/${PAT_ID}/${CHANNEL_ID}/"

    # ========== COPY METADATA JSON FILE ==========
    # Move the metadata JSON file alongside the DZI
    METADATA_JSON="${i%.dzi}_metadata.json"
    if [ -f "$METADATA_JSON" ]; then
        echo "Copying metadata JSON: $METADATA_JSON"
        mv -n "$METADATA_JSON" "${WEBDIRECTORY}/${PAT_ID}/${CHANNEL_ID}/"
    else
        echo "Warning: Metadata JSON not found at $METADATA_JSON"
    fi
    # ========== END METADATA COPY ==========

    BAREFILE=$(basename "${i}")
    touch "./${WEBDIRECTORY}/${PAT_ID}/${CHANNEL_ID}/${BAREFILE%.dzi}_files/annotations.txt"
    chmod -R 777  "./${WEBDIRECTORY}/${PAT_ID}/${CHANNEL_ID}/${BAREFILE%.dzi}_files/annotations.txt"
		
    # Construct the path to annotations.txt
    ANNOTATIONS_PATH="./${WEBDIRECTORY}/${PAT_ID}/${CHANNEL_ID}/${BAREFILE%.dzi}_files/annotations.txt"
    ANNOTATIONS_LINK="./${CHANNEL_ID}/${BAREFILE%.dzi}_files/annotations.txt"

      done
    done
  fi
else
  echo "[ERROR]: Website directory already exists!"
fi

# create website
VIEWERCOUNTER=0
if [ $DO_WEBSITE -eq "1" ]; then
  echo "Start generating website ..."
  cd "$WEBDIRECTORY"
  FILES=`find . -maxdepth 1 -type d ${EXCLUDEFILES}`  
  for f in $FILES
  do
    echo "Processing directory: ${f}"
    echo "" > _tmpviewer #create tmp viewer html file
    echo "" > _tmpbody2  #create tmp hashtable html file
	
    CHANNELS=`find ${f} -maxdepth 1 -type d -and -name "_*" ${EXCLUDEFILES}`    
    PAT_ID=`echo ${f} | egrep -i -o '[a-z]+[0-9]+' | head -1` # e.g. P10
    # If PAT_ID is empty, extract it from the directory name directly
    if [[ -z "$PAT_ID" ]]; then
        PAT_ID=`echo ${f} | cut -d'_' -f1 | sed 's|^\./||'`
    fi
    PATHTOINDEX="./${PAT_ID}/index.html"

    echo "Creating index file: ${PATHTOINDEX}"
	  echo "./${PAT_ID}/index.html" >> "./indexes"
	
    cat ./blocks/header.block > ${PATHTOINDEX} #create index file
    
    # Process each channel to get the first one for slide info
    FIRST_CHANNEL=""
    FIRST_DZI=""
    SLIDE_INFO=""
    CHANNEL_NAME=""
    
    for c in $CHANNELS; do
      if [[ -z "$FIRST_CHANNEL" ]]; then
        FIRST_CHANNEL=$c
        #search for DZI files (could be png or jpg)
        TMPDZI=`find $c -name "*.dzi" -type f -print -quit` 
        if [[ ! -z "$TMPDZI" ]]; then
          FIRST_DZI=`basename "$TMPDZI"`
          # Use PAT_ID as slide info
          SLIDE_INFO="$PAT_ID"
          CHANNEL_ID=`echo ${c} | egrep -i -o '_[a-z]+[a-z0-9]*' | head -1`  #e.g. _CyclineA
          # If CHANNEL_ID is empty, extract it from the directory name directly  
          if [[ -z "$CHANNEL_ID" ]]; then
              CHANNEL_ID=`echo ${c} | cut -d'_' -f2`
              if [[ ! -z "$CHANNEL_ID" ]]; then
                CHANNEL_ID="_${CHANNEL_ID}"
              else
                CHANNEL_ID="_UNKNOWNCHANNEL0001"
              fi
          fi
          CHANNEL_NAME=${CHANNEL_ID#_}  # Remove leading underscore
          # Set annotations link for the first channel
          BAREFILE=$(basename "${TMPDZI}")
          ANNOTATIONS_LINK="./${CHANNEL_ID}/${BAREFILE%.dzi}_files/annotations.txt"
        fi
        break
      fi
    done
    
    # Debug output
    echo "DEBUG: PAT_ID is: ${PAT_ID}"
    echo "DEBUG: SLIDE_INFO is: ${SLIDE_INFO}"
    echo "DEBUG: CHANNEL_NAME is: ${CHANNEL_NAME}"
    echo "DEBUG: Processing file: ${PATHTOINDEX}"
    
    for c in $CHANNELS; do
      #search for DZI files (could be png or jpg)
	  TMPDZI=`find $c -name "*.dzi" -type f -print -quit` 
	  DZINAME=`basename "$TMPDZI"`   
		
	  echo "Found DZI: $TMPDZI"
	  echo "DZI basename: $DZINAME"
	  
	  CHANNEL_ID=`echo ${c} | egrep -i -o '_[a-z]+[a-z0-9]*' | head -1`  #e.g. _CyclineA
    # If CHANNEL_ID is empty, extract it from the directory name directly  
    if [[ -z "$CHANNEL_ID" ]]; then
        CHANNEL_ID=`echo ${c} | cut -d'_' -f2`
        if [[ ! -z "$CHANNEL_ID" ]]; then
            CHANNEL_ID="_${CHANNEL_ID}"
        else
            # Skip this iteration if we can't determine channel ID
            echo "Warning: Could not determine channel ID for ${c}, skipping..."
            continue
        fi
    fi
      
      #check if current image has a corresponding processed one
      HASPROCESSED=$(checkIfProcessedFileAvailable ${PAT_ID}${CHANNEL_ID})
      HASPROCESSED=`echo $HASPROCESSED | sed 's/[^0-9]//g'` #remove spaces      
      # if [ $HASPROCESSED -eq "1" ]; then
      #   echo "${PAT_ID}${CHANNEL_ID} has processed image ${PAT_ID}${CHANNEL_ID}processed"      	      
      #   echo "LiveSync(${PAT_ID}${CHANNEL_ID})" >> "${PATHTOINDEX}"   # corresponding PROCESSED file found	      
      # else
      #   echo "//LiveSync(${PAT_ID}${CHANNEL_ID})" >> "${PATHTOINDEX}"      	      
      # fi            
      
		# Process the viewer name more carefully
		VIEWERNAME=${DZINAME}
		NDPIKEY=".ndpideepzoom.dzi"
		KEYUNKNOWN="UNKNOWNPAT0001_UNKNOWNCHANNEL0001_"
		VIEWERNAME=${VIEWERNAME/$NDPIKEY}
		VIEWERNAME=${VIEWERNAME/$KEYUNKNOWN}
		
		# If VIEWERNAME is empty or just the extension, use a fallback
		if [[ -z "$VIEWERNAME" || "$VIEWERNAME" == ".dzi" ]]; then
		    VIEWERNAME="${PAT_ID}${CHANNEL_ID}"
		fi
		
		echo "Processed VIEWERNAME: $VIEWERNAME"
	
	  #write to tmp html file that is concated later to the body of the file
      cat ./blocks/viewer.block >> "_tmpviewer"
      
      PATHTODZI="/${WEBDIRECTORY}/${PAT_ID}/${CHANNEL_ID}"
      
      # Enhanced placeholder replacement - handle multiple formats
      VIEWER_VAR_NAME="${PAT_ID}${CHANNEL_ID}"
      
      echo "Replacing placeholders with:"
      echo "  CONTENTID: ${PAT_ID}${CHANNEL_ID}"
      echo "  VIEWERNAME: ${VIEWERNAME}"
      echo "  VIEWER_VARNAME: ${VIEWER_VAR_NAME}"
      echo "  DZI_PATH: ./${CHANNEL_ID}/${DZINAME}"
      
      # Replace all possible placeholder formats
      sed "s/_CONTENTID_/${PAT_ID}${CHANNEL_ID}/g" _tmpviewer > tmp; cat tmp > _tmpviewer 
      sed "s+_REL_PATH_TO_DZI_+./${CHANNEL_ID}/${DZINAME}+g" _tmpviewer > tmp; cat tmp > _tmpviewer
      
      # Handle multiple VIEWERNAME placeholder formats
      sed "s/_VIEWERNAME_/${VIEWERNAME}/g" _tmpviewer > tmp; cat tmp > _tmpviewer
      sed "s/\*VIEWERNAME\*/${VIEWERNAME}/g" _tmpviewer > tmp; cat tmp > _tmpviewer
      sed "s/{{VIEWERNAME}}/${VIEWERNAME}/g" _tmpviewer > tmp; cat tmp > _tmpviewer
      
      # Handle multiple VIEWER_VARNAME placeholder formats
      sed "s/_VIEWER_VARNAME_/${VIEWER_VAR_NAME}/g" _tmpviewer > tmp; cat tmp > _tmpviewer 
      sed "s/\*VIEWER\*VARNAME_/${VIEWER_VAR_NAME}/g" _tmpviewer > tmp; cat tmp > _tmpviewer
      sed "s/{{VIEWER_VARNAME}}/${VIEWER_VAR_NAME}/g" _tmpviewer > tmp; cat tmp > _tmpviewer
      
      # Remove any remaining unwanted content that might be causing issues
      # Remove standalone DZI filenames that might be added accidentally
      sed "s/^${DZINAME}$//g" _tmpviewer > tmp; cat tmp > _tmpviewer
      sed "s/^pathology\.jpgdeepzoom\.dzi$//g" _tmpviewer > tmp; cat tmp > _tmpviewer
      
      let VIEWERCOUNTER=VIEWERCOUNTER+1      
      
      # Hash tables for linking - only add if we have valid processed files
      if [ $HASPROCESSED -eq "1" ]; then      
      	      echo "ViewerHash['${PAT_ID}${CHANNEL_ID}'] = ${PAT_ID}${CHANNEL_ID}${LINKSUFFIX};" >> _tmpbody2
      	      echo "Added active ViewerHash entry for ${PAT_ID}${CHANNEL_ID}"
      else
      	      # Don't add anything to the HTML if no processed file exists
      	      echo "Skipping ViewerHash entry for ${PAT_ID}${CHANNEL_ID} (no processed file found)"
      fi

    done
    
    # Add body1 content
    cat ./blocks/body1.block >> "${PATHTOINDEX}"

    #add viewer scripts
    cat ./_tmpviewer >> "${PATHTOINDEX}"
    
    #add hash table only if it has content
    if [ -s _tmpbody2 ]; then
        cat ./_tmpbody2 >> "${PATHTOINDEX}" 
    fi
    echo "</script>" >> "${PATHTOINDEX}"

    # Set the JavaScript variable with the annotations link
    echo "<script type=\"text/javascript\">var annotationsPath = '${ANNOTATIONS_LINK}';</script>" >> "${PATHTOINDEX}"
    
    # Add JavaScript configuration object
    echo "<script type=\"text/javascript\">" >> "${PATHTOINDEX}"
    echo "// Configuration for Enhanced Annotation Manager and main.js" >> "${PATHTOINDEX}"
    echo "window.polyscopeConfig = {" >> "${PATHTOINDEX}"
    echo "  annotationsPath: '${ANNOTATIONS_LINK}'," >> "${PATHTOINDEX}"
    echo "  patientId: '${PAT_ID}'," >> "${PATHTOINDEX}"
    echo "  channelId: '${CHANNEL_ID}'," >> "${PATHTOINDEX}"
    echo "  contentId: '${PAT_ID}${CHANNEL_ID}'," >> "${PATHTOINDEX}"
    echo "  viewerVarName: '${PAT_ID}${CHANNEL_ID}'" >> "${PATHTOINDEX}"
    echo "};" >> "${PATHTOINDEX}"
    echo "</script>" >> "${PATHTOINDEX}"

    # Link the JavaScript file
    echo "<script type=\"text/javascript\" src=\"../js/enhancedAnnotationManager.js\"></script>" >> "${PATHTOINDEX}"
    echo "</body>" >> "${PATHTOINDEX}"
    echo "</html>" >> "${PATHTOINDEX}"
    
    # Final placeholder replacements at the end
    echo "DEBUG: Starting final placeholder replacements..."
    sed "s/_SLIDE_INFO_/${SLIDE_INFO}/g" "${PATHTOINDEX}" > tmp; cat tmp > "${PATHTOINDEX}"
    sed "s/_CHANNEL_NAME_/${CHANNEL_NAME}/g" "${PATHTOINDEX}" > tmp; cat tmp > "${PATHTOINDEX}"
    sed "s/_PATIENT_ID_/${PAT_ID}/g" "${PATHTOINDEX}" > tmp; cat tmp > "${PATHTOINDEX}"
    sed "s+_ANNOTATIONS_LINK_+${ANNOTATIONS_LINK}+g" "${PATHTOINDEX}" > tmp; cat tmp > "${PATHTOINDEX}"
    sed "s/_CHANNEL_ID_/${CHANNEL_ID}/g" "${PATHTOINDEX}" > tmp; cat tmp > "${PATHTOINDEX}"
    
    # Handle any remaining asterisk-based placeholders in the final file
    sed "s/\*VIEWERNAME\*/${VIEWERNAME}/g" "${PATHTOINDEX}" > tmp; cat tmp > "${PATHTOINDEX}"
    sed "s/\*VIEWER\*VARNAME\*/${PAT_ID}${CHANNEL_ID}/g" "${PATHTOINDEX}" > tmp; cat tmp > "${PATHTOINDEX}"
    sed "s/\*SLIDE_INFO\*/${SLIDE_INFO}/g" "${PATHTOINDEX}" > tmp; cat tmp > "${PATHTOINDEX}"
    sed "s/\*CHANNEL_NAME\*/${CHANNEL_NAME}/g" "${PATHTOINDEX}" > tmp; cat tmp > "${PATHTOINDEX}"
    sed "s/\*PATIENT_ID\*/${PAT_ID}/g" "${PATHTOINDEX}" > tmp; cat tmp > "${PATHTOINDEX}"
    
    echo "DEBUG: All placeholder replacements completed for ${PATHTOINDEX}"
    
    # Clean up temp files
    rm -f _tmpviewer _tmpbody2 tmp

  done
fi

echo "Script completed successfully!"
echo "Generated website structure in: ${WEBDIRECTORY}/"
echo "Total viewers processed: ${VIEWERCOUNTER}"