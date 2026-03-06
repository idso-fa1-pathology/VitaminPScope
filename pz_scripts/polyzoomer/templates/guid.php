<?php
/*
	Desc: Function to create a GUID.
	Reference: http://php.net/manual/de/function.com-create-guid.php
	Author:	Alix Axel
	Date: 2014.07.24 15:04:09 (+02:00)
	Last Author: Sebastian Schmittner
	Last Date: 2014.07.24 15:04:09 (+02:00)
	Version: 0.0.1
*/

function GUID()
{
    if (function_exists('com_create_guid') === true)
    {
        return trim(com_create_guid(), '{}');
    }

    return sprintf('%04X%04X-%04X-%04X-%04X-%04X%04X%04X', mt_rand(0, 65535), mt_rand(0, 65535), mt_rand(0, 65535), mt_rand(16384, 20479), mt_rand(32768, 49151), mt_rand(0, 65535), mt_rand(0, 65535), mt_rand(0, 65535));
}

?>
