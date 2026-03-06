<?php
/*
* Author: Sebastian Schmittner
* Modified for security
* Date: 2014.10.14 10:24:00
* Version: 0.03.22
*/
session_start();
require_once '/var/www/auth/session_timeout.php';
// Check if user is logged in
if (!isset($_SESSION['loggedin']) || $_SESSION['loggedin'] !== true) {
    header('Location: /auth/login.php');
    exit;
}
$logged_in_user = $_SESSION['username'];
// Extract the requested username from the URL
$requested_url = $_SERVER['REQUEST_URI'];
preg_match('/\/customers\/([a-zA-Z0-9_]+)-mdanderson-org\//', $requested_url, $matches);
// Debugging
error_log("Requested URL: " . $requested_url);
error_log("Extracted username: " . ($matches[1] ?? 'No match found'));
error_log("Logged-in user: " . $logged_in_user);
if (!isset($matches[1])) {
    http_response_code(403);
    echo "Access Denied: Invalid URL.";
    exit;
}
$requested_user = $matches[1];
// Ensure that the logged-in user matches the requested user
if ($logged_in_user !== $requested_user) {
    http_response_code(403);
    echo "Access Denied: You do not have permission to access this page.";
    exit;
}
?>
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <link rel="stylesheet" href="./jquery-ui.css"/>
    <link rel="stylesheet" href="./css/main.css"/>
    <link rel="stylesheet" href="./css/style.css"/>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/1.11.3/jquery.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.11.4/jquery-ui.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jqueryui-touch-punch/0.2.3/jquery.ui.touch-punch.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/underscore.js/1.5.0/underscore-min.js"></script>
    <script src="./js/serveraccess.js"></script>
    <script src="./js/raster.js"></script>
    <script src="./js/fileManager.js"></script>
    <script src="./js/jquery.ui-contextmenu.js"></script>
    <script src="./js/scrollWidth.js"></script>
    <title>Polyscope - <?php echo htmlspecialchars($logged_in_user); ?></title>
    <style type="text/css">
        .ui-dialog-buttonpane { text-align: center; }
    </style>
</head>
<body>
    <div id='main' class='main'>
        <div id='header' class='header'>
            <div id="topMenu">
                <ul>
                    <li><a href="../../index.php">Polyscope</a></li>
                    <li><a href="../../docs/index.html" target="_blank" >Documentation/Help</a></li>
                </ul>
            </div>
        </div>
        <div id='pageContainer' class='pageContainer'>
            <!-- left pane !-->
            <div id='leftpane' class='leftpane'>
                <div id='sortingmenu' class='sortingmenu'>
                    <div id='deleteZooms' class='button deleteZooms' style='height:48px;width:48px;' title='Delete zooms'></div>
                    <div id='createFolder' class='button' style='height:48px;width:48px;' title='Create new folder'></div>
                    <div id='sort' class='button sort' style='height:48px;width:48px;' title='Sort samples'></div>
                    <div id='filter' class='button filter' style='height:48px;width:48px;' title='Filter samples'></div>
                    <div id='createZoom' class='button' style='height:48px;width:48px;' title='Create multizoom'></div>
                    <div id='imageSizeSlider' class='verticalSlider'></div>
                </div>
                <div id='samplelist' class='samplelist'>
                    <table id='sampleTable'><tbody></tbody></table>
                    <table id='multizooms' style='display:none;'><tbody></tbody></table>
                </div>
            </div>
            <!-- right pane !-->
            <div id='rightpane' class='rightpane'>
                <div id='centerPage' class='centerPage'>
                    <div id='raster' class='raster'></div>
                </div>
            </div>
        </div>
    </div>

    <script type="text/javascript">
        $(document).ready(function() {
            // Make user data available to JavaScript
            window.loggedInUser = "<?php echo htmlspecialchars($logged_in_user); ?>";
            
            // Load and execute userpage.js
            $.getScript('./js/userpage.js')
                .done(function() {
                    if (typeof onLoad === 'function') {
                        onLoad();
                    }
                })
                .fail(function() {
                    console.error("Failed to load userpage.js");
                });
        });
    </script>
</body>
</html>