#!/bin/bash
#VERSION 0.6
# andreas.heindl@icr.ac.uk
#
# Change log
# 0.6 If svs doesn't exist read dimensions from FinalScan.ini
#     Max memory and dis 
# 0.7 (20140708) Reduction of memory to use
MAXMEM=2048 #in MB

function floor() {
    float_in=$1
    floor_val=${float_in/.*}
}

function ceiling() {
    float_in=$1
    ceil_val=${float_in/.*}
    ceil_val=$((ceil_val+1))
}
echo "ROW by ROW tile: " ${1}
#Is the argument the _daTile.sh or the FinalScan.ini?
if [[ ${1} =~ "FinalScan" ]] #contains
then
  echo "Parsing FinalScan..."
  DIMENSION=`egrep -oE "[0-9]{1,}x[0-9]{1,}" ${1} | head -1`
  tmpW=`echo $DIMENSION | grep -o [0-9]\* | head -1`
  tmpH=`echo $DIMENSION | grep -o [0-9]\* | tail -1`
  tmpW=`echo "scale=2; ${tmpW}/2000" | bc -q` 
  tmpH=`echo "scale=2; ${tmpH}/2000" | bc -q` 
  ceiling $tmpW
  p1=$ceil_val 
  ceiling $tmpH
  p2=$ceil_val 
  LASTLINE=`echo "${p1}x${p2}"`  
  echo $LASTLINE
else
  echo "Reading _daTile.sh..."
  LASTLINE=`tail -1 ${1}` 
fi

TILELAYPUT=`echo $LASTLINE | grep -o [0-9]\*x[0-9]\*`
ROWS=`echo $TILELAYPUT | grep -o [0-9]\* | head -1`
COLS=`echo $TILELAYPUT | grep -o [0-9]\* | tail -1`
MAXTILES=`bc <<< "$ROWS * $COLS"` 
ROWCOUNTER=0

echo "Found" ${ROWS}" rows," ${COLS} " columns, resulting in $MAXTILES"

#HEADER
HEADER="montage -limit area ${MAXMEM} -limit memory ${MAXMEM} \\"
#WRITE HEADER
OUTPUTFILE="_daRowByRowTile0"
FOOTER="-mode Concatenate -tile ${ROWS}x1 ${OUTPUTFILE}.png"

#init first file
echo $HEADER > _daRowByRowTile0.sh 
echo "time bash _daRowByRowTile0.sh" > startRowByRowTile.sh

echo $HEADER > startFinalTile.sh
echo "_daRowByRowTile0.png \\" >> startFinalTile.sh
FOOTERFINAL="-mode Concatenate -tile 1x${COLS} Da_tiled.png"


echo "Output file = "${OUTPUTFILE}  
for (( i = 0 ; i <= $MAXTILES+1 ; i= i + 1 ))
do
    echo "Da"${i}".jpg \\" >> ${OUTPUTFILE}.sh
    ROWCOUNTER=$((ROWCOUNTER + 1))
    #if    
    #echo $ROWCOUNTER "/" $ROWS
    if [[ $ROWCOUNTER -ge  $ROWS ]]
    then
		ROWCOUNTER=0
    		#close old one
    		#create new one
        	echo "Closing output file = ${OUTPUTFILE}.sh"
		echo "$FOOTER" >> "$OUTPUTFILE.sh"

    		OUTPUTFILE="_daRowByRowTile${i}"
        	echo "New output file = ${OUTPUTFILE}.sh"
		echo $HEADER > "${OUTPUTFILE}.sh"
    		FOOTER="-mode Concatenate -tile ${ROWS}x1 ${OUTPUTFILE}.png"
		echo "time bash ${OUTPUTFILE}.sh" >> startRowByRowTile.sh
		echo "${OUTPUTFILE}.png \\" >> startFinalTile.sh
    fi
done

echo $FOOTERFINAL >> startFinalTile.sh
#now start tiling by row
time bash startRowByRowTile.sh
time bash startFinalTile.sh


