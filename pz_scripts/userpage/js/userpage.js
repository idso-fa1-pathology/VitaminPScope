/*
 *   Author: Sebastian Schmittner
 *   Date: 2014.10.14 10:24:00
 *   LastAuthor: Sebastian Schmittner
 *   LastDate: 2016.02.14 14:45:00 (+02:00)
 *   Version: 0.03.18
 *   Version Key: VERSIONKEY
 */

//# sourceURL=./js/userpage.js

var DATESORT = {
    ASCENDING: 0,
    DESCENDING: 1
};

var CACHETIMEOUT = 10000;
var CACHETIMER = 0;

var items = {
    dictionary: {},
    tags: [],
    caches: {
        single: 0,
        multi: 0
    }
};

var fileManager = null;
var filterDialog = null;

function generateSingleZoomEntry(project, index) {
    var element =
            '<td class="sampleSource">' +
            '<div class="analysis">' +
            '<img class="itemImage" title="' + baseName(project.dzi[0]) +
            '" src="' + project.image +
            '" indexPath="' + project.index +
            '" data-pathname="' + project.name +
            '" data-index="' + index +
            '" data-dzi="' + project.dzi +
            '" data-name="' + baseName(project.dzi[0]) +
            '" data-type="singleZoom"' +
            '"></img>' +
            '</div>' +
            '</td>';

    return element;
}

function generateMultiZoomEntry(project, index) {
    var element =
            '<td class="sampleSource">' +
            '<div class="multizoom">' +
            '<img class="itemImage" title="' + (project.dziName || project.name) +
            '" src="' + project.thumbnail +
            '" indexPath="' + project.index +
            '" data-pathname="' + project.name +
            '" data-index="' + index +
            '" data-setup="' + project.setupFile +
            '" data-name="' + project.name +
            '" data-type="multiZoom"' +
            '"></img>' +
            '</div>' +
            '</td>';

    return element;
}

function isMultiZoom(project) {
    return project.setupFile !== undefined;
}

var fileOptions = FileManager.File.getDefaultConfig();
fileOptions.createElement = function (item, dirIndex) {
    var name = item.name;
    var currentProject = items.dictionary[name];
    if (currentProject === null || currentProject === undefined) {
        console.log("Project is not yet loaded or available. ", JSON.stringify(item));
        //fileManager.deleteItems(fileManager.fullItemsPath([name]), ''); //This is line useful for removing deleted zooms floating in the fs file.
        return '';
    }

    if (!isMultiZoom(currentProject)) {
        return generateSingleZoomEntry(currentProject, dirIndex);
    }
    else {
        return generateMultiZoomEntry(currentProject, dirIndex);
    }

    console.log('Failed to create FILE entry. [' + JSON.stringify(item) + ']');

    return '';
};

fileOptions.makeDraggable = function () {
    var droppableOptions = {
        appendTo: 'body',
        scroll: false,
        revert: 'invalid',
        cursor: 'move',
        helper: 'clone',
        start: function (event, ui) {
            var container = jQuery(ui.helper[0]);
            var item = container.find('.itemImage');
            item.height(item.height());
            item.width(item.width());
        }
    };

    jQuery('.multizoom').draggable(droppableOptions);
    jQuery('.analysis').draggable(droppableOptions);
};

fileOptions.addToolTips = function () {
    jQuery('#sampleTable .itemImage').tooltip({
        content: function () {
            var element = jQuery(this);
            var index = element.data('index');
            var project = items.dictionary[index];
            var tags = project.tags;
            var tt = createToolTip(tags);
            return tt;
        },
        open: function (event, ui) {
            jQuery("div.ui-helper-hidden-accessible").remove();
        }
    });
};

function generateDirectoryEntry(directory, index) {
    var element =
            '<td class="sampleSource">' +
                '<div class="directory">' +
                        '<img class="itemImage" title="' + directory.name +
                            '" src="' + './images/imagefiles-folder_icon_yellow.png' +
                            '" data-index="' + index +
                            '" data-type="directory"' +
                            '">' + 
                                '<span class="directoryName" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: inline-block; vertical-align: middle; line-height: normal">' +
                                    directory.name +
                                '</span>' +
                            '</img>' +
                '</div>' +
            '</td>';

    return element;
}

var directoryOptions = FileManager.Directory.getDefaultConfig();
directoryOptions.createElement = function (item, dirIndex) {
    return generateDirectoryEntry(item, dirIndex);
};

directoryOptions.makeDraggable = function () {
    var droppableOptions = {
        appendTo: 'body',
        scroll: false,
        revert: 'invalid',
        cursor: 'move',
        helper: 'clone',
        start: function (event, ui) {
            var container = jQuery(ui.helper[0]);
            var item = container.find('.itemImage');
            item.height(item.height());
            item.width(item.width());
        }
    };

    jQuery('.directory').draggable(droppableOptions);
};

function makeDirectoriesAcceptDrops() {
    jQuery('.directory').droppable({
        tolerance: 'pointer',
        accept: 'div, .itemImage',
        drop: function (event, ui) {
            var targetPath = jQuery(this).find('.itemImage').data('index');
            doDropItemsIntoDirectory(targetPath, event, ui);
        }
    });
}

var itemsToBeModified = [];
var absolutePathsOfItems = [];

function doDropItemsIntoDirectory(targetPath, event, ui) {

    var itemsToBeModified = getAllItemsToBeModified(event, ui);

    fileManager.moveItems(itemsToBeModified, fileManager.fullItemPath(targetPath));
}

function getAllItemsToBeModified(event, ui) {
    var currentItem = null,
            selectedItems = getSelectedItems(),
            itemsToBeModified = jQuery(selectedItems)
            .find('.itemImage')
            .map(function(){
              return jQuery(this).data('index');
            }).get();

    if (event !== undefined && 
        ui !== undefined &&
        event.type !== 'menuselect') {
        currentItem = jQuery(ui.helper[0])
                .find('.itemImage')
                .data('index');
        itemsToBeModified.push(currentItem);
    }

    absolutePathsOfItems = fileManager.fullItemsPath(itemsToBeModified);
    
    return itemsToBeModified;
}

directoryOptions.addToolTips = function () {

};

function generateParentEntry(path, index) {
    var element =
            '<td class="sampleSource">' +
                '<div class="parent">' +
                    '<img class="itemImage" title="' + path.path +
                        '" src="' + './images/parent.png' +
                        '" data-index="' + index +
                        '" data-type="parent"' +
                        '"></img>' +
                '</div>' +
            '</td>';

    return element;
}

var parentOptions = FileManager.Parent.getDefaultConfig();
parentOptions.createElement = function (item, dirIndex) {
    return generateParentEntry(item, dirIndex);
};

var directoryType = new FileManager.Directory(directoryOptions);
var fileType = new FileManager.File(fileOptions);
var parentType = new FileManager.Parent(parentOptions);

var onFileManagerRedraw = function () {
    doApplyImageMagnification( g_currentMagnification );
    fileOptions.makeDraggable();
    //fileOptions.addToolTips();
    directoryOptions.makeDraggable();
    makeDirectoriesAcceptDrops();
};

function titleFromIndex(index) {
    var title = "";

    if (index === 0) {
        title = "Patientname";
    }
    else if (index === 1) {
        title = "Channelname";
    }
    else {
        title = "Template Selection Tag";
    }

    return title;
}

function createTagSpan(name) {
    var tags = name.split('_');
    var tagSpan = '<span class="tag tagIdx0" title="Patientname" data-key="tagIdx0" >' + tags[0] + '</span>';

    for (var tag = 1; tag < tags.length; ++tag) {
        tagSpan = tagSpan +
                '_<span class="tag tagIdx' + tag + '" title="' + titleFromIndex(tag) + '" data-key="tagIdx' + tag + '" >' + tags[tag] + '</span>';
    }

    return tagSpan;
}

function toggleSpan(item) {
    var item = jQuery(item);
    var key = item.data('key');
    var collection = jQuery('.' + key);

    if (item.hasClass('spanActive')) {
        collection.toggleClass('spanActive');
        collection.toggleClass('spanMatch');
    }
    else if (collection.hasClass('spanMatch')) {
        collection.toggleClass('spanMatch');
    }
    else {
        collection.toggleClass('spanActive');
    }
}

jQuery(document).on('click', 'span.tag', function () {
    toggleSpan(this);
});

jQuery('.button.deleteZooms').droppable({
    tolerance: "touch",
    accept: "div",
    drop: function (event, ui) {
        var items = getAllItemsToBeModified(event, ui);
        /*
        if (ui === undefined || event === undefined) {
            return;
        }

        var container = jQuery(ui.helper[0]);
        var path = container.find('itemImage').attr('indexPath');
        var index = [];

        index.push(path);

        deleteZooms(index);
        */
        deleteZooms(items);
    }
});

jQuery('.raster').droppable({
    tolerance: 'pointer',
    accept: "div.analysis, div.multizoom",
    drop: function (event, ui) {
        doDropFileIntoRaster(event, ui);
    }
});

function doDropFileIntoRaster(event, ui) {
    if (event === undefined || ui === undefined) {
        console.log('Event or UI are undefined!');
        return;
    }

    var container = jQuery(ui.helper[0]);
    var item = container.find('.itemImage');
    var itemType = item.data('type');

    if (itemType === 'singleZoom') {
        raster.dropAt(event.pageX, event.pageY, ui.helper[0].outerHTML);
    }
/* In theory perfectly fine, but multizooms do not contain the setupContent field currently and thus this doesn't work right now 
    else if (itemType === 'multiZoom') {
        var index = jQuery(item).data('index');
        if (index === '#') {
            return;
        }

        var project = items.dictionary[index];
        if (project === 'undefined') {
            return;
        }

        var setupContent = project.setupContent;

        var setup = interpretSetupContent(setupContent, pathName(project.setupFile));

        raster = new Raster('.raster', setup.x, setup.y);

        for (var y = 0; y < setup.y; ++y) {
            for (var x = 0; x < setup.x; ++x) {

                var index = y + x * setup.y;
                var item = setup.items[index];

                if (item !== null) {
                    var tagSpan = createTagSpan(baseName(item.dzi));
                    var sampleEntry = createInternalSampleEntry(item.index, item.thumbnail, baseName(item.dzi), item.dzi, '#', baseName(item.dzi), tagSpan);
                    raster.setItem(x, y, sampleEntry);
                }
            }
        }

        raster.createGrid();
        raster.refresh();
    }
*/
    else {
        console.log('Tried to drop improper type!');
    }
}
;

// general stuff
var g_email = '';
var raster = new Raster('.raster', 1, 1);
raster.doTableResize(1, 1);

var removedItems = [];

// Sample List Refresh
ServerRefresh();
adjustHeader();
resizeActions();

function interpretSetupContent(setupContent, path) {
    var items = setupContent.split("\n");
    var setup = new Object();

    setup.x = parseInt(items[0], 0);
    setup.y = parseInt(items[1], 0);
    setup.email = items[2];
    setup.items = [];

    var base = 3;
    var itemsPerRow = 2;

    for (var x = 0; x < setup.x; ++x) {
        for (var y = 0; y < setup.y; ++y) {
            var item = new Object();
            var index = base + (y + setup.y * x) * itemsPerRow;
            item.dzi = items[index];

            if (!item.dzi.trim()) {
                item = null;
            }
            else {
                item.alpha = (parseInt(items[index + 1], 0) === 1);
                item.thumbnail = path + '/' + (x + 1) + '_' + (y + 1) + '.png';
                item.index = dziToIndexPath(item.dzi) + '/index.html';
            }

            setup.items.push(item);
        }
    }

    return setup;
}

jQuery(window).resize(function () {
    resizeActions();
});

// !!!! Deletes the selected zooms forever
jQuery('div.button.deleteZooms').click(function () {
    deleteZooms(getAllItemsToBeModified());
});

function deleteZooms(zoomIndexes) {
    var elementCount = zoomIndexes.length;

    if (elementCount === 0) {
        window.alert("Error: No items selected. Please select the items you would like to delete.");
        return;
    }

    var zooms = [];
    var folderCount = 0;
    
    for (var i=0; i<zoomIndexes.length; i++) {
        if (fileManager.shownFileSystem[zoomIndexes[i]].type === 'FILE') {
            zooms.push(zoomIndexes[i]);
        } else if (fileManager.shownFileSystem[zoomIndexes[i]].type === 'DIR') {
            zooms = zooms.concat(collectZoomFiles(fileManager.shownFileSystem[zoomIndexes[i]]));
            folderCount++;
        }
    }

    var zoomCount = zooms.length;

    var deleteString = "";

    if (zoomCount === 0) {
        if (folderCount === 0) {
            window.alert("Error: Cannot find selected items.");
            return;
        } else {
            deleteString = folderCount + ' folder' + (folderCount > 1 ? 's' : '');
        }
    } else {
        if (folderCount === 0) {
            deleteString = zoomCount + ' zoom' + (zoomCount > 1 ? 's' : '');
        } else {
            deleteString = folderCount + ' folder' + (folderCount > 1 ? 's' : '') + 
                           ' and ' + zoomCount + ' zoom' + (zoomCount > 1 ? 's' : '');
        }
    }

    var message = 'Warning: You are going to delete ' + deleteString + '!\nAre you sure you want to continue?';

    var result = showWarning(message);

    if (result === true) {
        // Just one more confirmation for safety
        var secondMessage = 'Are you absolutely sure you want to delete these items?';
        var secondResult = showWarning(secondMessage);
        
        if (secondResult === true) {
            // Call our new simplified deletion endpoint
            var paths = getIndexFiles(zooms);
            var fsPaths = fileManager.fullItemsPath(items);
            
            var request = serverRequest("directRemoveZooms.php", "files=" + JSON.stringify(paths),
                function () {
                    switch (request.readyState) {
                        case 4:
                            if (request.status === 200) {
                                var result = JSON.parse(request.responseText);
                                
                                window.alert(result["message"]);
                                
                                if (result["value"] != null && result["value"] == zooms.length) {
                                    fileManager.deleteItems(fsPaths, '');
                                }

                                ServerRefresh();
                                ServerRefreshMulti();
                            }
                            request = null;
                    }
                }, null);
        }
    } else {
        window.alert("Deletion aborted.");
    }
}

function getSpecificItems(selectors) {
    var selectedItems = [],
        i = 0,
        currentSelector = '';
    
    for(i = 0; i < selectors.length; ++i){
        currentSelector = selectors[i];
        selectedItems.push(items.dictionary[currentSelector]);
    }
    
    return selectedItems;
}

function getSpecificItemsProperty(specificItems, property){
    var properties = [];
    
    properties = specificItems.map(function(input){
        return input[property];
    });
    
    return properties;
}

function getPropertyForSelection(selectors, property){
    var selectedItems = getSpecificItems(selectors);
    return getSpecificItemsProperty(selectedItems, property);
}

function getIndexFiles(selectors) {
    return getPropertyForSelection(selectors, 'index');
}

function getDziFiles(selectors) {
    var files = getPropertyForSelection(selectors, 'dzi');
    var dziFiles = [];

    for (var i = 0; i < files.length; ++i) {
        dziFiles.push(files[i][0]);
    }

    return dziFiles;
}

function requestRemoveZooms(userCode, items, zooms) {
    var paths = getIndexFiles(zooms);
    var fsPaths = fileManager.fullItemsPath(items);
    
    var request = serverRequest("removeZooms.php", "usercode=" + JSON.stringify(userCode) + "&files=" + JSON.stringify(paths),
            function () {
                switch (request.readyState) {
                    case 4:
                        if (request.status !== 200) {
                        }
                        else
                        {
                            var result = JSON.parse(request.responseText);

                            window.alert(result["message"]);
                            
                            if (result["value"] != null && result["value"] == zooms.length) {
                                fileManager.deleteItems(fsPaths, '');
                            }

                            ServerRefresh();
                            ServerRefreshMulti();
                        }
                        request = null;
                }
            }, null);
}

function collectZoomFiles(fileSystem) {
    zoomFiles = [];

    for (var key in fileSystem) {
        if (fileSystem[key]) {
            if (fileSystem[key].type === 'FILE') {
                if (items.dictionary[key]) {
                    zoomFiles.push(key);
                }
            } else if (fileSystem[key].type === 'DIR') {
                zoomFiles = zoomFiles.concat(collectZoomFiles(fileSystem[key]));
            }
        }
    }

    return zoomFiles;
}

function showWarning(message) {
    var result = confirm(message);
    return result === true;
}

jQuery('#createZoom').click(function () {
    doMultiZoom();
});

jQuery('.button.sort').click(function () {
    fileFilter.sortOrder = Math.abs(fileFilter.sortOrder - 1);
    fileManager.refresh(true);
});

var filterTimeout = 0;
var wasDialogShown = false;
jQuery('.button.filter').mousedown(function () {
    filterTimeout = setTimeout(doDisplayFilterDialog, 1000);
}).bind('mouseup mouseleave', function () {

    if (filterTimeout !== 0) {
        clearTimeout(filterTimeout);

        /*		if(wasDialogShown) {
         wasDialogShown = false;
         return;
         }*/

        applyFilter(false);
        filterTimeout = 0;
    }
});

function getSelectedItems() {
    return jQuery('.selected');
}

function getSelectedItemsData(key) {
    var selection = getSelectedItems();
    return selection.map(function () {
        return jQuery(this).find('.itemImage').data(key);
    });
}

function doDisplayFilterDialog() {
    filterDialog = displayFilterDialog(filterDialog, items.tags);
}

function displayFilterDialog(dialog, tags) {

    var minWidth = 320,
            minHeight = 320,
            partOfViewportWidth = 0.4,
            partOfViewportHeight = 0.8,
            maxHeight = 'auto',
            maxWidthMultiplier = 0.85,
            dateFormatStyle = "dd/mm/yy";

    tags = tags.sort();

    if (dialog === null) {
        dialog = createFilterDialog();
        var anchor = document.getElementById('sortingmenu').appendChild(dialog);

        jQuery('#' + dialog.id + ' #dateFrom').datepicker({dateFormat: dateFormatStyle});
        jQuery('#' + dialog.id + ' #dateTo').datepicker({dateFormat: dateFormatStyle});

        dialog.tags = tags;

        setFilterTagsForSelection(dialog, tags);

        jQuery('#' + dialog.id + ' #tagselector :checkbox').prop("checked", false);
        jQuery('#' + dialog.id + ' #tagActive').bind('change', function () {
            var $isChecked = this.checked;
            if ($isChecked) {
                jQuery('#' + dialog.id + ' #tagBlocker').hide();
            }
            else {
                var tagSelector = jQuery('#' + dialog.id + ' #tagselector');
                jQuery('#' + dialog.id + ' #tagBlocker').width(tagSelector.width()).height(tagSelector.height()).show();
                jQuery('#' + dialog.id + ' #tagBlocker').position({
                    of: tagSelector,
                    my: 'center',
                    at: 'center'
                });
            }
        });
    }
    else {
        if (dialog.tags.length !== tags.length) {
            setFilterTagsForSelection(dialog, tags);
        }
    }

    var viewportWidth = jQuery(window).width();
    var viewportHeight = jQuery(window).height();

    var maxDialogWidth = Math.max(minWidth, viewportWidth * partOfViewportWidth);
    var maxDialogHeight = Math.max(minHeight, viewportHeight * partOfViewportHeight);

    jQuery('#' + dialog.id + ' #tagselector').height(maxHeight).width(maxDialogWidth * maxWidthMultiplier);

    var tagSelector = jQuery('#' + dialog.id + ' #tagselector');
    jQuery('#' + dialog.id + ' #tagBlocker').width(tagSelector.width()).height(tagSelector.height());

    jQuery('#' + dialog.id).dialog({
        dialogClass: 'noclose',
        minWidth: minWidth,
        minHeight: minHeight,
        maxWidth: maxDialogWidth,
        maxHeight: maxDialogHeight,
        width: maxDialogWidth,
        height: maxDialogHeight,
        autoOpen: true,
        modal: true,
        open: function (event, ui) {
            $(".ui-dialog-titlebar-close", ui.dialog || ui).hide();
            wasDialogShown = true;

            var isSize = $('.filterTable').outerHeight();
            var shallSize = jQuery('#' + dialog.id).outerHeight();
            var difference = shallSize - isSize;
            var listSize = jQuery('#' + dialog.id + ' #tagselector').height();
            jQuery('#' + dialog.id + ' #tagselector').height(listSize + difference);

            var tagSelector = jQuery('#' + dialog.id + ' #tagselector');
            jQuery('#' + dialog.id + ' #tagBlocker').width(tagSelector.width()).height(tagSelector.height()).show();
            jQuery('#' + dialog.id + ' #tagBlocker').position({
                of: tagSelector,
                my: 'center',
                at: 'center'
            });
        },
        buttons: {
            'Ok': function () {
                jQuery(this).hide();
                jQuery(this).dialog('close');

                applyFilter(true);
                fileManager.refresh(true);
            },
            'Cancel': function () {
                jQuery(this).hide();
                jQuery(this).dialog('close');
            }
        }
    });

    return dialog;
}

function setFilterTagsForSelection(dialog, tags) {

    jQuery('#' + dialog.id + ' #tagselector p').remove();

    for (var i = 0; i < tags.length; ++i) {
        jQuery('#' + dialog.id + ' #tagselector').append('<p><label><input type="checkbox" name="selectedTags[]" class="selectedTag" value="' + i + '" />' + tags[i] + '</label></p>');
    }
}

function createFilterDialog() {

    var _div = document.createElement('div');
    _div.setAttribute('id', 'filterDialog-' + Math.floor(Math.random() * 10000));
    _div.setAttribute('title', 'Filter Dialog');
    _div.style.display = 'none';

    _div.innerHTML =
            '<table class="filterTable">' +
            '<tr>' +
            '<td style="border-bottom: 1px solid #00AAFF;">' +
            'Date Filter:<br>' +
            '<input type="checkbox" id="dateFromActive" value="dateFromActive"> From<br>' +
            '<input type="text" id="dateFrom"><br>' +
            '<input type="checkbox" id="dateToActive" value="dateToActive"> To<br>' +
            '<input type="text" id="dateTo"><br>' +
            '</td>' +
            '</tr>' +
            '<tr>' +
            '<td style="border-bottom: 1px solid #00AAFF;">' +
            'Text Filter:<br>' +
            '<input type="text" id="textPattern"><br>' +
            '</td>' +
            '</tr>'+
            '<tr>' +
            '<td>' +
            'Tag Filter:<br>' +
            '<div id="tagBlocker" class="tagBlocker"></div>' +
            '<input type="checkbox" id="tagActive" value="tagActive"> Available Tags<br>' +
            '<div id="tagselector" class="selectionList">' +
            '</div>' +
            '</td>' +
            '</tr>' +
            '</table>';

    return _div;
}

function resizeActions() {
    adjustHeader();
    var buttons = jQuery('.button');
    var height = jQuery(buttons[0]).height();
    buttons.width(height);
    raster.refresh();
}

// functions
function adjustHeader() {
    jQuery('.headerbubble').position({
        my: "center",
        at: "center",
        of: "#header"
    });
}

function clearList(listname) {
    jQuery('#' + listname + ' tbody').html('');
}

function ServerRefresh() {
    var request = serverRequest("getCustomerProjects.php", "",
            function () {
                switch (request.readyState) {
                    case 4:
                        if (request.status !== 200) {
                        }
                        else
                        {
                            var projects = JSON.parse(request.responseText);

                            projects = removeEmptyProjects(projects);

                            projects = createDates(projects);
                            projects = fillSampleData(projects);

                            for (var i = 0; i < projects.length; ++i) {
                                var currentProject = projects[i];
                                items.dictionary[currentProject.name] = currentProject;
                            }

                            if (items.caches.single === 0) {
                                requestCacheVersion();
                                ServerRefreshMulti();
                            }
                        }
                        request = null;
                }
            }, null);
}

jQuery('div.refresh').click(function () {

    if (jQuery('div.refresh').hasClass('active')) {
        jQuery('div.refresh').removeClass('active');
    }

    items.caches.single = 0;
    items.caches.multi = 0;
    ServerRefresh();
});

function requestCacheVersion() {
    var request = serverRequest("getCustomerProjects.php", "version=1",
            function () {
                switch (request.readyState) {
                    case 4:
                        if (request.status !== 200) {
                        }
                        else
                        {
                            var keys = JSON.parse(request.responseText);

                            if (items.caches.single === 0) {

                                items.caches.single = keys['md5'];
                            }
                            else {

                                if (items.caches.single !== keys['md5']) {
                                    jQuery('div.refresh').addClass('active');
                                }
                            }

                            if (CACHETIMER !== 0) {

                                clearTimeout(CACHETIMER);
                                CACHETIMER = 0;
                                CACHETIMER = setTimeout(requestCacheVersion, CACHETIMEOUT);
                            }
                            else {
                                CACHETIMER = setTimeout(requestCacheVersion, CACHETIMEOUT);
                            }
                        }

                        request = null;
                }
            }, null);
}

function requestMultiCacheVersion() {
    var request = serverRequest("getCustomerProjectsMulti.php", "version=1",
            function () {
                switch (request.readyState) {
                    case 4:
                        if (request.status !== 200) {
                        }
                        else
                        {
                            var keys = JSON.parse(request.responseText);

                            if (items.caches.multi === 0) {

                                items.caches.multi = keys['md5'];
                            }
                            else {

                                if (items.caches.multi !== keys['md5']) {
                                    jQuery('div.refresh').addClass('active');
                                }
                            }

                            if (CACHETIMER !== 0) {

                                clearTimeout(CACHETIMER);
                                CACHETIMER = 0;
                                CACHETIMER = setTimeout(requestMultiCacheVersion, CACHETIMEOUT);
                            }
                            else {
                                CACHETIMER = setTimeout(requestMultiCacheVersion, CACHETIMEOUT);
                            }
                        }

                        request = null;
                }
            }, null);
}

function ServerRefreshMulti() {
    var request = serverRequest("getCustomerProjectsMulti.php", "",
            function () {
                switch (request.readyState) {
                    case 4:
                        if (request.status !== 200) {
                        }
                        else
                        {
                            var projects = JSON.parse(request.responseText);

                            projects = projects.filter(function (e) {
                                return e !== null
                            });
                            projects = createDates(projects);

                            for (var i = 0; i < projects.length; ++i) {
                                var currentProject = projects[i];
                                items.dictionary[currentProject.name] = currentProject;
                            }

                            if (items.caches.multi === 0) {
                                requestMultiCacheVersion();
                                items.tags = getTags(items.dictionary);

                                if (fileManager) {
                                    fileManager.loadFileSystem();
                                } else {
                                    fileManager = new FileManager.FileManager('sampleTable', [fileType, directoryType, parentType], 1, onFileManagerRedraw, function(x){ return cleanItems(x);});
                                    fileManager.setFilter(function(x){ return doFilter(x); });
                                }
                            }
                        }
                        request = null;
                }
            }, null);
}

function createDates(projects) {

    for (var i = 0; i < projects.length; ++i) {
        var dateString = projects[i].fileDate.date;
        projects[i].fileDate = parseDate(dateString);
    }

    return projects;
}

function parseDate(dateString) {
    var newString = dateString.replace(/ /g, '-');
    newString = newString.replace(/:/g, '-');

    // I really dont get why 01 is Feb... whereas 01 should be Jan (of course 0 indexing, but its the month index??)
    var items = newString.split('-');
    var date = new Date(items[0], items[1] - 1, items[2], items[3], items[4], items[5]);

    date = Date.parse(date);

    return date;
}

// desc: Javascript Date expects MM/DD/YYYY but we are working with DD/MM/YYYY
function convertDate(dateString) {
    var parts = dateString.split('/');
    var dt = new Date(parseInt(parts[2], 10),
            parseInt(parts[1], 10) - 1,
            parseInt(parts[0], 10));
    return dt;
}

function removeEmptyProjects(projects) {

    removedItems = [];

    for (var i = projects.length - 1; i >= 0; --i) {
        if (projects[i].dzi.length === 0) {
            var removedItem = projects.splice(i, 1);
            removedItems.push(removedItem);
        }
    }

    console.log('There were items which could not be resolved: ' + JSON.stringify(removedItems));

    return projects;
}

function fillSampleData(projects) {

    for (var i = 0; i < projects.length; ++i) {
        var dziName = baseName(projects[i].dzi[0]);
        projects[i].dziName = dziName;

        var pathTags = projects[i].name.split('_');
        var tags = dziName.split('_');

        projects[i].tags = pathTags.concat(tags);

    }

    return projects;
}

function sortByDateAscending(a, b) {
    var dateA = Number.MIN_VALUE;
    var dateB = Number.MIN_VALUE;
    
    if (items.dictionary[a]) {
        dateA = items.dictionary[a].fileDate;
    }
    
    if (items.dictionary[b]) {
        dateB = items.dictionary[b].fileDate;
    }
    
    return dateA - dateB;
}

function sortByDateDecending(a, b) {
    var dateA = Number.MAX_VALUE;
    var dateB = Number.MAX_VALUE;
    
    if (items.dictionary[a]) {
        dateA = items.dictionary[a].fileDate;
    }
    
    if (items.dictionary[b]) {
        dateB = items.dictionary[b].fileDate;
    }
    
    return dateB - dateA;
}

function getOlderThan(names, dateEnd) {

    var filteredProjects = [];

    for (var i = 0; i < names.length; ++i) {
        if ((fileManager.shownFileSystem[names[i]] && fileManager.shownFileSystem[names[i]].type === 'DIR') || items.dictionary[names[i]].fileDate <= dateEnd) {
            filteredProjects.push(names[i]);
        }
    }

    return filteredProjects;
}

function getNewerThan(names, dateStart) {

    var filteredProjects = [];

    for (var i = 0; i < names.length; ++i) {
        if ((fileManager.shownFileSystem[names[i]] && fileManager.shownFileSystem[names[i]].type === 'DIR') || items.dictionary[names[i]].fileDate >= dateStart) {
            filteredProjects.push(names[i]);
        }
    }

    return filteredProjects;
}

function getTags(names) {

    var tags = [];

    if (names.length > 0) {

        tags = [];

        for (var i = 0; i < names.length; ++i) {
            tags = _.union(tags, items.dictionary[names[i]].tags);
        }
    }

    return tags;
}

function filterByText(names, text) {
    var filteredProjects = [];

    for (var i = 0; i < names.length; ++i) {
        if (names[i].indexOf(text) > -1 || (items.dictionary[names[i]] && (items.dictionary[names[i]].name.indexOf(text) > -1 || items.dictionary[names[i]].dziName && items.dictionary[names[i]].dziName.indexOf(text) > -1))) {
            filteredProjects.push(names[i]);
        }
    }

    return filteredProjects;
}

function filterByTags(names, tags) {
    var filteredProjects = [];

    for (var i = 0; i < names.length; ++i) {
        if ((fileManager.shownFileSystem[names[i]] && fileManager.shownFileSystem[names[i]].type === 'DIR') || _.intersection(items.dictionary[names[i]].tags, tags).length > 0) {
            filteredProjects.push(names[i]);
        }
    }

    return filteredProjects;
}

var fileFilter = getEmptyFilter();

function getEmptyFilter() {
    return {
        fromDate: null,
        toDate: null,
        textPattern: null,
        tags: null,
        sortOrder: DATESORT.DESCENDING
    };
}

function doFilter(fileSystem){

    var names = Object.keys(fileSystem);
    var filteredItems = [];
    
    for (i=0; i<names.length; i++) {
        if (typeof fileSystem[names[i]] === "object") {
            filteredItems.push(names[i]);
        }
    }
    
    if(fileFilter.fromDate) {
        filteredItems = getNewerThan(filteredItems, fileFilter.fromDate);
    }
    
    if(fileFilter.toDate) {
        filteredItems = getOlderThan(filteredItems, fileFilter.toDate);
    }
    
    if(fileFilter.textPattern) {
        filteredItems = filterByText(filteredItems, fileFilter.textPattern);
    }
    
    if(fileFilter.tags) {
        filteredItems = filterByTags(filteredItems, fileFilter.tags);
    }

    return sortByDate(filteredItems, fileFilter.sortOrder);
}

function cleanItems(fileSystem){
    var itemsOk = {};
    for(var key in fileSystem) {
        if(items.dictionary[key]){
           itemsOk[key] = fileSystem[key]; 
        }
        else {
            
        }
    }
    
    return itemsOk;
}

function applyFilter(forceFilter) {

    if (filterDialog === null) {
        return;
    }

    var filterId = filterDialog.id;

    fileFilter = getEmptyFilter();
            
    if (!jQuery('.button.filter').hasClass('filterOn') || forceFilter) {
        if (jQuery('#' + filterId + ' #dateFromActive').is(':checked')) {
            var fromDate = convertDate(jQuery('#' + filterId + ' #dateFrom').val());
            fileFilter.fromDate = Date.parse(fromDate);
        }
           

        if (jQuery('#' + filterId + ' #dateToActive').is(':checked')) {
            var toDate = convertDate(jQuery('#' + filterId + ' #dateTo').val());
            fileFilter.toDate = Date.parse(toDate);
        }

        if (jQuery('#' + filterId + ' #textPattern').val() !== "") {
            fileFilter.textPattern = jQuery('#' + filterId + ' #textPattern').val();
        }

        /*if (jQuery('#' + filterId + ' #tagActive').is(':checked')) {
            var selectedTagsIndexes = getSelections('#' + filterId + ' .selectedTag');

            var realTags = getTags(projects);
            realTags = realTags.sort();

            var selectedTagArray = [];
            for (var i = 0; i < selectedTagsIndexes.length; ++i) {
                selectedTagArray.push(realTags[selectedTagsIndexes[i]]);
            }

            fileFilter.tags = selectedTagArray;
        }*/

        jQuery('.button.filter').addClass('filterOn');
    }
    else {
        jQuery('.button.filter').removeClass('filterOn');
    }
}

function getSelections(id) {
    var inputs = jQuery(id);
    var names = [].map.call(inputs, function (input) {
        if (input.checked) {
            return input.value;
        } else {
            return "";
        }
        ;
    });

    names = names.filter(function (n) {
        return n !== ""
    });

    return names;
}

function sortByDate(items, sortDirection) {

    if (sortDirection === DATESORT.DESCENDING) {
        items.sort(sortByDateDecending);
    }
    else {
        items.sort(sortByDateAscending);
    }
    
    return items;
}

function createToolTip(tags) {
    var tooltip = '';

    for (var i = 0; i < tags.length; ++i) {
        tooltip = tooltip + tags[i] + '<br>';
    }

    return tooltip;
}

function createInternalSampleEntry(indexPath, imagePath, projectName, dzi, i, name, tagSpan) {
    var element =
            '<div class="analysis">' +
            '<div id="' + name + '" class="templatetagger">' +
            tagSpan +
            '</div>' +
            '<img class="itemImage" title="' + projectName +
            '" src="' + imagePath +
            '" indexPath="' + indexPath +
            '" data-index="' + i +
            '" data-dzi="' + dzi +
            '" data-name="' + name +
            '"></img>' +
            '</div>';

    return element;
}

function doMultiZoom() {
    var layout = generateLayout(raster);

    if (layout === null) {
        return;
    }

    var message = "Multizoom request submitted.";
    window.alert(message);

    layout.email = g_email;
    var request = serverRequest("createMultiZoom.php", "layout=" + JSON.stringify(layout) + "&fspath=" + JSON.stringify(fileManager.currentDirectory),
            function () {
                switch (request.readyState) {
                    case 4:
                        if (request.status !== 200) {
                        }
                        else
                        {
                            var result = JSON.parse(request.responseText);

                            ServerRefresh();
                            ServerRefreshMulti();
                            fileManager.loadFileSystem();

                            window.open(result, '_blank');

                        }
                        request = null;
                }
            }, null);
}

function generateLayout(raster) {
    var layout = new Object();

    layout.rows = raster.rows;
    layout.cols = raster.cols;
    layout.table = new Array(layout.cols);

    var itemCount = layout.rows * layout.cols;
    var invalidCounter = 0;

    for (var x = 0; x < layout.cols; ++x) {
        layout.table[x] = new Array(layout.rows);

        for (var y = 0; y < layout.rows; ++y) {
            layout.table[x][y] = new Object();
            if (raster.table[x][y].item !== null) {
                layout.table[x][y].dzi = jQuery(raster.table[x][y].item).find('img').data('dzi');
                layout.table[x][y].alpha = jQuery(raster.table[x][y].item).hasClass('alpha-item');
            }
            else {
                layout.table[x][y].dzi = '';
                layout.table[x][y].alpha = false;
                ++invalidCounter;
            }
        }
    }

    if (invalidCounter === itemCount) {
        layout = null;
    }

    return layout;
}

// from: http://stackoverflow.com/questions/3820381/need-a-basename-function-in-javascript
function baseName(str)
{
    var base = new String(str).substring(str.lastIndexOf('/') + 1);
    if (base.lastIndexOf(".") !== -1)
        base = base.substring(0, base.lastIndexOf("."));
    return base;
}

function pathName(str) {
    var path = new String(str).substring(0, str.lastIndexOf('/'));
    return path;
}

function dziToIndexPath(url) {
    var channelPath = new String(url).substring(0, url.lastIndexOf('/') - 1);
    var indexPath = new String(channelPath).substring(0, channelPath.lastIndexOf('/'));
    return indexPath;
}

var splitterConfig = {
    splitterItems: [
        {
            name: 'leftpane',
            startWidth: 270,
            minWidth: 270
        },
        {
            name: 'rightpane',
            startWidth: 0,
            minWidth: 270
        }
    ],
    splitterCss: 'splitterCss',
    splitterHoverCss: 'splitterHoverCss'
};

function addSplitter(config) {
    //config = config | {};

    var item1name = '#' + config.splitterItems[0].name;
    var item1 = jQuery(item1name);
    $('<div id="splitter" class="splitter"></div>')
            .insertAfter(item1name)
            .addClass(config.splitterCss)
            .mouseenter(function () {
                jQuery('.splitter').addClass(splitterConfig.splitterHoverCss);
            })
            .mouseleave(function () {
                jQuery('.splitter').removeClass(splitterConfig.splitterHoverCss);
            });
}

addSplitter(splitterConfig);


var fileOpItems = [];
var lastFileOp = null;

function clearClipboard() {
    fileOpItems = [];
    lastFileOp = null;
}

function pasteItems( event, ui ){
    if( fileOpItems.length > 0 ) {
        if( lastFileOp === "copy" ) {
            fileManager.copyItems(absolutePathsOfItems, fileManager.currentDirectory, '');
        }

        if( lastFileOp === "cut" ) {
            fileManager.moveItems(absolutePathsOfItems, fileManager.currentDirectory, '');                    
        }
    }

    clearClipboard();
}

function copyItems( event, ui ){
    fileOpItems = getAllItemsToBeModified(event, ui);
    lastFileOp = "copy";   
}

function cutItems( event, ui ){
    fileOpItems = getAllItemsToBeModified(event, ui);
    lastFileOp = "cut";
}

var contextMenu = [
    { title: "Paste", cmd: "paste", action: function(event, ui) { pasteItems(event, ui); } },
    { title: "Copy", cmd: "copy", action: function(event, ui) { copyItems(event, ui); } },
    { title: "Cut", cmd: "cut", action: function(event, ui) { cutItems(event, ui); } },
    { title: "----" },
    { title: "Clear clipboard", cmd: "clear", action: function(event, ui) { clearClipboard(); } }
];

jQuery(document).contextmenu({
    delegate: ".sampleSource",
    menu: contextMenu,
    beforeOpen: function(event, ui){
        var isPaste = (fileOpItems.length > 0);
        
        jQuery(document).contextmenu('enableEntry', 'paste', isPaste);
        jQuery(document).contextmenu('enableEntry', 'copy', !isPaste);
        jQuery(document).contextmenu('enableEntry', 'cut', !isPaste);
        jQuery(document).contextmenu('enableEntry', 'clear', isPaste);
    }
});

var g_currentMagnification = 0.0;
var g_baseWidth = (jQuery('.samplelist table').width() * 0.9) || 256.0;
var g_currentWidth = 0.0;

$(function () {
    $(".verticalSlider").slider({
        orientation: "vertical",
        range: "min",
        min: 0,
        max: 6,
        value: 4,
        slide: function (event, ui) {
            g_currentMagnification = ui.value - 4;
            doApplyImageMagnification( g_currentMagnification );
            adjustColumnCount();
        }
    });
});

function doApplyImageMagnification( factor ){
    var percentage = Math.pow(2, factor) * g_baseWidth;
    jQuery('.samplelist table img').width(percentage + 'px');
    jQuery('.directoryName').width(percentage + 'px');
    g_currentWidth = jQuery('.samplelist table img').outerWidth();
}

//doApplyImage( g_currentMagnification );

jQuery('#createFolder').click(function () {
    var folderName = prompt('Please enter a folder name:', 'New Folder');

    var bannedFolderNames = ["null"];

    while ((folderName !== null) && (folderName.trim().length == 0 || bannedFolderNames.indexOf(folderName) != -1)) {
        folderName = prompt('Chosen folder name is not allowed: '+folderName+".\nPlease enter a different folder name:", 'New Folder');
    }

    if (folderName !== null) {
        fileManager.addDirectory(folderName);
    }
});

function addSplitterHover() {
    jQuery('.splitter').mouseenter(function(){
        jQuery(this).addClass('over');
    });
 
    jQuery('.splitter').mouseleave(function(){
        jQuery(this).removeClass('over');
    });
 
    jQuery('.splitter').draggable({ 
        helper: 'original',
        containment: '.pageContainer',
        cursor: 'grab',
        iframeFix: true,
        axis: 'x',
        start: function(event, ui) {
            jQuery(this).addClass('force');
            applySplitterDrag(event, ui);
        },
        drag: function(event, ui) {
            applySplitterDrag(event, ui);
        },
        stop: function(event, ui) {
            jQuery(this).removeClass('force');
            applySplitterDrag(event, ui);
            adjustColumnCount();
        }
    });
 }
 
 function applySplitterDrag(event, ui) {
    var $leftPane = jQuery('.leftpane');
    var minWidth = parseInt($leftPane.css('min-width'), 10);
    var offsetLeft = minWidth + ui.offset.left;
    var innerWidth = jQuery('.pageContainer').innerWidth();

    var left = Math.min(Math.max(offsetLeft / innerWidth, 0.0), 1.0);
    left = Math.floor(left * innerWidth) / innerWidth;

    var right = 1.0 - left;
    doResize(left, right);
    console.log( Math.floor(left * innerWidth));
}
 
 function scale(delta, value) {
	return delta * (1 - value / delta);
}

 function doResize(cell1, cell2) {

	var splitterWidth = 6;
        var $pageContainer = jQuery('.pageContainer');
        var width = $pageContainer.innerWidth();

	width = scale(width, splitterWidth);

	var c1 = Math.floor(width * cell1);
	
        //c1 = Math.floor(Math.min(Math.max(270.0, c1),width - 100.0));
        //c2 = width - c1;
        
	var $leftPane = jQuery('.leftpane');
	var $rightPane = jQuery('.rightpane');
	var $splitter = jQuery('.splitter');
        
	$leftPane
		.width(c1 + 'px');

	$splitter
                .css('left', (c1 - parseInt($splitter.css('margin-left'), 10)) + 'px');
     
        $rightPane
		.css('left', (c1 + splitterWidth) + 'px');
        
/*     console.log(' --- ')   ;
     console.log(c1 - parseInt($splitter.css('margin-left'), 10));
        console.log(c1 + splitterWidth);
        console.log(c1);
     console.log(' --- ')   ;*/
};

function realListWidth(){
    return jQuery('.leftpane').innerWidth() - jQuery('.sortingmenu').outerWidth() - tools.scrollbarWidth();
}

function getCellSize(){
    //return g_currentWidth + 5;
    
    //return $('#sampleTable td').outerWidth();
    var s1 = $('#sampleTable td').outerWidth();
    
    if(s1 - g_currentWidth > 25 && (s1 / g_currentWidth) - 1.0 > 0.5) {
    //if(s1 > realListWidth() * 0.75 &&
      //      ) {
        return g_currentWidth + (g_currentWidth % 2);
    }
    else {
        return s1 + (s1 % 2) + 2;
    }
}

function adjustColumnCount(){
    var tableWidth = realListWidth();
    var possibleColumnCount = Math.max(Math.floor(tableWidth / Math.ceil(getCellSize())), 1.0);
    fileManager.changeColumnCount(possibleColumnCount);
}

function onLoad(){
    addSplitterHover();
};

jQuery(document).on('click', '.analysis', function () {
    jQuery(this).toggleClass('selected');
});

jQuery(document).on('dblclick', '.analysis .itemImage', function () {
    var link = jQuery(this).attr('indexPath');
    window.open(link, '_blank');
});

jQuery(document).on('click', '.multizoom', function () {
    jQuery(this).toggleClass('selected');
});

jQuery(document).on('dblclick', '.multizoom .itemImage', function () {
    var link = jQuery(this).attr('indexPath');
    window.open(link, '_blank');
});

jQuery(document).on('click', '.directory', function () {
    jQuery(this).toggleClass('selected');
});

jQuery(document).on('dblclick', '.directory .itemImage', function() {
    if(fileManager !== undefined && 
       fileManager !== null) {
       
        var itemName = jQuery(this).data('index');
        var newPath = fileManager.fullItemPath( itemName );
        fileManager.updateDirectory( newPath );
    }
});

jQuery(document).on('dblclick', '.parent .itemImage', function() {
    if(fileManager !== undefined && 
       fileManager !== null) {
       
        var fullItemPath = jQuery(this).data('index');
        fileManager.updateDirectory( fullItemPath );
    }
});
