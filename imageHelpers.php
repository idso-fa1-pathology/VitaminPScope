<?php

function estimateImageSize($filename) {
	$dimensions = getImageDimensions($filename);
	$bytes = estimateImageSizeInBytes($dimensions);
	return bytesToMB($bytes);
}

function getImageDimensions($filename) {

	$outputHeight = shell_exec('showinf -nopix "' . $filename . '" | grep "Height = " | head -1');
	$outputWidth = shell_exec('showinf -nopix "' . $filename . '" | grep "Width = " | head -1');

	$heightArray = array();
	$widthArray = array();
	
	preg_match("/[ ]*Height = ([0-9]*)/", $outputHeight, $heightArray);
	preg_match("/[ ]*Width = ([0-9]*)/", $outputWidth, $widthArray);
	
	return array(
		"width" => $width[1],
		"height" => $height[1],
		);
}

function estimateImageSizeInBytes($dimensions) {
	return $dimensions["width"] * $dimensions["height"] * 4;
}

function bytesToMB($bytes) {
	return $bytes * 1024.0 * 1024.0;
}

?>