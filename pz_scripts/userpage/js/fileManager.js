/*
	Desc: File Manager class
	Author:	Sebastian Schmittner (stp.schmittner@gmail.com)
	Date: 2016.01.28
	Last Author: Sebastian Schmittner (stp.schmittner@gmail.com)
	Last Date: 2016.04.04
	Version: 0.0.4
*/

var DATESORT = {
	ASCENDING: 0,
	DESCENDING: 1
};

function isEmpty(str){
    return (!str || 0 === str.length);
}

function isNotEmpty(str) {
	return !isEmpty(str);
}

function isBlank(str){
    return (!str || /^s\s*$/.test(str));
}

window.FileManager = window.FileManager || {};

(function($) {

// FILEMANAGER
$.FileManager = function(container, types, columnCount, redrawCallback, cleanItemCallback) {
    this.fileSystem = [];
    this.shownFileSystem = [];
    this.container = container;
    this.tags = [];
    this.currentDirectory = '///';
    this.itemTypes = types;
    this.columnCount = columnCount;
    this.elements = [];
    this.redrawCallback = redrawCallback;
    this.filter = null;

    this.cutItems = [];

    this.loadFileSystem();
    this.cleanItems = cleanItemCallback;
};

$.FileManager.prototype = {
    DELIMITER: '///',

    issueRequest: function( command, onSuccess ) {
        var self = this;
        var request = serverRequest("accessUfs.php", "command=" + JSON.stringify(command),
            function() {
                switch (request.readyState) {
                    case 4:
                        if(request.status !== 200) {}
                        else {
                            onSuccess( request, self );
                        }
                    request = null;
                }
            }, null);
    },

    loadFileSystem: function() {
        var command = {
            task: 'getSystem'
        };

        this.issueRequest( command, function( request, self ){
            var result = JSON.parse(request.responseText);

            if(result !== null) {
                self.fileSystem = result.data;
                //self.fileSystem = self.cleanItems(self.fileSystem);
                self.updateDirectory( self.currentDirectory );
            }

        });
    },

    storeFileSystem: function() {
        var command = {
            task: 'setSystem',
            data: this.fileSystem
        };

        this.issueRequest( command, function( request, self ){
            var result = JSON.parse(request.responseText);
        });
    },

    changeColumnCount: function( columnCount ) {
        if( columnCount > 0 ) {
            this.columnCount = columnCount;
            this.refresh();
        }
    },

    updateDirectory: function( path ) {
        var selectors = this.pathToSelectors( path );

        var selectedFileSystem = this.recursiveGetItemBySelectors( this.fileSystem, selectors );

        if( selectedFileSystem === false ) {
            console.error('Selected element does not exist [' + JSON.stringify(this.fileSystem) + '] [' + JSON.stringify(selectors) + ']');
            return;
        }

        this.shownFileSystem = selectedFileSystem;
        this.elements = this.generateElements( selectedFileSystem );

        this.currentDirectory = path;
        if(this.currentDirectory !== this.DELIMITER) {
            var parentPath = this.reducePath(path);
            var parentElement = this.createParentElement(parentPath);
            this.elements.unshift(parentElement);
        }

        this.refresh();
    },

    pathToSelectors: function( path ) {
        return path.split(this.DELIMITER).filter(isNotEmpty);
    },

    selectorsToPath: function( selectors ) {
        var path = selectors.join(this.DELIMITER);    
        if(path.length === 0) {
            path = [this.DELIMITER];
        }
        return path;
    },

    searchItem: function( fileSystem, name ) {
        
    },
    
    recursiveGetItemBySelectors: function( fileSystem, selectors ) {
        if( selectors.length === 0 ) {
            return fileSystem;
        }

        var selector = selectors.shift();
        var child = fileSystem[selector];

        if( child !== undefined ) {
            return this.recursiveGetItemBySelectors( child, selectors );
        }

        return false;
    },

    doesItemExist: function( item ){
        return this.shownFileSystem[item] !== undefined;
    },

    doesItemExistAbsolute: function(path){
        var selectors = this.pathToSelectors(path);
        var possibleMatch = this.recursiveGetItemBySelectors(this.fileSystem, selectors);
        return (false !== possibleMatch);
    },
    
    fullItemPath: function( item, selectedRoot ){
        if( selectedRoot === undefined ) {
            selectedRoot = this.currentDirectory;
        }
        
        var root = this.pathToSelectors( selectedRoot );
        var itemPath = this.pathToSelectors( item );
        var selectors = root.concat( itemPath );
        return this.selectorsToPath( selectors );
    },

    fullItemsPath: function( items, root ){
        var i,
            fullPaths = [];

        if( root === undefined ) {
            root = this.currentDirectory;
        }
        
        for(i = 0; i < items.length; ++i){
                if(this.doesItemExist(items[i]) ||
                   this.doesItemExistAbsolute(items[i])){
                        fullPaths.push( this.fullItemPath( items[i], root ) );
                }
        }

        return fullPaths;
    },

    deleteItems: function( items, root ){
       var fullPaths_ = this.fullItemsPath( items, root ),
               command = {
                       task: 'delete',
                       fullPaths: fullPaths_
               };

            this.issueCommandAndHandleAnswer( command );
    },

    copyItems: function( items, targetPath, root ){
       var fullPaths_ = this.fullItemsPath( items, root ),
               command = {
                       task: 'copy',
                       fullPaths: fullPaths_,
                       target: targetPath
               };

            this.issueCommandAndHandleAnswer( command );
    },

    cutItems: function( items ){
       var fullPaths = this.fullItemsPath( items ); 
    },

    moveItems: function( items, targetPath, root ){
       var fullPaths_ = this.fullItemsPath( items, root ),
               command = {
                       task: 'move',
                       fullPaths: fullPaths_,
                       target: targetPath
               };

            this.issueCommandAndHandleAnswer( command );
    },

    addDirectory: function( directoryName ){
            if( !this.doesItemExist(directoryName ) ){
                    this.addDirectoryRequest( directoryName, this.currentDirectory );
            }
            else {}
    },

    addDirectoryRequest: function( name_, root_ ) {
            var command = {
                    task: 'addDirectory',
                    name: name_,
                    root: root_
            };

            this.issueCommandAndHandleAnswer( command );
    },

    issueCommandAndHandleAnswer: function( command ){
            this.issueRequest( command, function( request, self ){
                    var result = JSON.parse(request.responseText);

                    if(result !== null) {
                            if( result === false ){
                            }
                            else {
                                    self.loadFileSystem();
                            }
                    }
            });
    },

    generateElements: function( fileSystem ) {
        var elements = [],
            element = '',
            realName = '';

        var order = this.applyFilter(fileSystem);
        
        for(var indexName in order){
            element = '';
            realName = order[indexName];
            
            try {
                element = this.createElement(fileSystem[realName], realName);

                if (element && element.length > 0) {
                    elements.push(element);
                }
            }
            catch(error) {
                console.log("ERROR: Following item could not be accessed:", fileSystem[realName], " at index: ", realName, " with error: ", JSON.stringify(error));
            }
        }

        return elements;
    },

    applyFilter: function( fileSystem ) {
        
        var order = Object.keys(fileSystem);
        
        for (i=0; i<order.length; i++) {
            if (typeof fileSystem[order[i]] !== "object") {
                order.splice(i, 1);
                i--;
            }
        }
        
        try {
            if(this.filter) {
                order = this.filter( fileSystem );
            }
        }
        catch (e) {
            console.error('Filter could not be applied on FileSystem!');
        }
        
        return order;
    },
    
    clearList: function() {
        jQuery('#' + this.container + ' tbody').html('');
    },

    refresh: function( full ) {
        if(full) {
            this.updateDirectory(this.currentDirectory);
        }
        this.updateListing(this.elements, this.columnCount);
    },
    
    updateListing: function( elements, columnCount ) {
        var html = '',
                rowIndex = 0,
                colIndex = 0,
                elementIndex = 0;

        this.clearList();

        var rowCount = Math.ceil(elements.length / columnCount);

        for(rowIndex = 0; rowIndex < rowCount; ++rowIndex){
            html = html + '<tr>';

            for(colIndex = 0; colIndex < columnCount; ++colIndex){
                if(elementIndex < elements.length){
                    html = html + elements[elementIndex];
                    ++elementIndex;
                }
            }

            html = html + '</tr>';
        }

        jQuery('#' + this.container + ' > tbody:last').append(html);

        if(this.redrawCallback){
            this.redrawCallback();
        }
    },

    createElement: function(item, k) {
        var type = item.type;

        for(var i = 0; i < this.itemTypes.length; ++i) {
            if(type === this.itemTypes[i].type) {
                return this.itemTypes[i].createElement(item, k);
            }
        }

        console.error('Item TYPE does not exist! [' + JSON.stringify(item) + ']');
        return false;
    },
    
    createParentElement: function(k) {
        var item = new $.Parent({path: '[' + this.currentDirectory.replace('///', '/') + '/..]'});
        return this.createElement(item, k);
    },
    
    reducePath: function(path) {
        var selectors = this.pathToSelectors(path);
        
        if(selectors.length > 0) {
            selectors = selectors.slice(0, -1);
        }
        
        return this.selectorsToPath(selectors);
    },
    
    setFilter: function(filter) {
        this.filter = filter || null;
    },
    
    setCleanItems: function(cleanItems) {
        this.cleanItems = cleanItems || null;
    }
};

// DIRECTORY
$.Directory = function( options ) {
	var defaultOptions = {
		name: '',
		creationDate : '',
		type: 'DIR',
		children: [],
		createElement: null,
		makeDraggable: null,
		addTooltips: null
	};
	
	options = jQuery.extend(defaultOptions, options);
	
	this.name 			= options.name;
	this.creationDate 	= options.creationDate;
	this.children 		= options.children;
	this.type 			= options.type;
	
	$.Directory.prototype.createElement = 
			$.Directory.prototype.createElement ? 
			$.Directory.prototype.createElement : 
			options.createElement;
	
	$.Directory.prototype.makeDraggable =
			$.Directory.prototype.makeDraggable ? 
			$.Directory.prototype.makeDraggable : 
			options.makeDraggable;

	$.Directory.prototype.addTooltips =
			$.Directory.prototype.addTooltips ? 
			$.Directory.prototype.addTooltips : 
			options.addTooltips;
};

$.Directory.getDefaultConfig = function() {
    var defaultOptions = {
            name: '',
            creationDate: '',
            type: 'DIR',
            children: [],
            createElement: null,
            makeDraggable: null,
            addTooltips: null
    };

    return defaultOptions;
};

// FILE
$.File = function( options ) {
	var defaultOptions = {
		name: '',
		creationDate: '',
		type: 'FILE',
		createElement: null,
		makeDraggable: null,
		addTooltips: null
	};
	
	options = jQuery.extend(defaultOptions, options);

	this.name 			= options.name;
	this.creationDate 	= options.creationDate;
	this.type 			= options.type;

	$.File.prototype.createElement = 
			$.File.prototype.createElement ? 
			$.File.prototype.createElement : 
			options.createElement;
	
	$.File.prototype.makeDraggable =
			$.File.prototype.makeDraggable ? 
			$.File.prototype.makeDraggable : 
			options.makeDraggable;

	$.File.prototype.addTooltips =
			$.File.prototype.addTooltips ? 
			$.File.prototype.addTooltips : 
			options.addTooltips;
};

$.File.getDefaultConfig = function() {
    var defaultOptions = {
            name: '',
            creationDate: '',
            type: 'FILE',
            createElement: null,
            makeDraggable: null,
            addTooltips: null
    };

    return defaultOptions;
};

// SHARE
$.Share = function( options ) {
	var defaultOptions = {
		name: '',
		creationDate: '',
		owner: '',
		receiver: '',
		link: '',
		type: 'SHARE',
		createElement: null,
		makeDraggable: null,
		addTooltips: null
	};
	
	options = jQuery.extend(defaultOptions, options);

	this.name 			= options.name;
	this.creationDate 	= options.creationDate;
	this.type 			= options.type;
	this.owner			= options.owner;
	this.receiver 		= options.receiver;
	this.link			= options.link;
	
	$.Share.prototype.createElement = 
			$.Share.prototype.createElement ? 
			$.Share.prototype.createElement : 
			options.createElement;
	
	$.Share.prototype.makeDraggable =
			$.Share.prototype.makeDraggable ? 
			$.Share.prototype.makeDraggable : 
			options.makeDraggable;

	$.Share.prototype.addTooltips =
			$.Share.prototype.addTooltips ? 
			$.Share.prototype.addTooltips : 
			options.addTooltips;
};


$.Share.getDefaultConfig = function() {
    var defaultOptions = {
            name: '',
            creationDate: '',
            owner: '',
            receiver: '',
            link: '',
            type: 'SHARE',
            createElement: null,
            makeDraggable: null,
            addTooltips: null
    };

    return defaultOptions;
};

// PARENT
$.Parent = function( options ) {
	var defaultOptions = {
        path: '',
		type: 'PARENT',
		createElement: null,
		makeDraggable: null,
		addTooltips: null
	};
	
	options = jQuery.extend(defaultOptions, options);
	
	this.path 			= options.path;
	this.type 			= options.type;
	
	$.Parent.prototype.createElement = 
			$.Parent.prototype.createElement ? 
			$.Parent.prototype.createElement : 
			options.createElement;
	
	$.Parent.prototype.makeDraggable =
			$.Parent.prototype.makeDraggable ? 
			$.Parent.prototype.makeDraggable : 
			options.makeDraggable;

	$.Parent.prototype.addTooltips =
			$.Parent.prototype.addTooltips ? 
			$.Parent.prototype.addTooltips : 
			options.addTooltips;
};

$.Parent.getDefaultConfig = function() {
    var defaultOptions = {
        path: '',
		type: 'PARENT',
		createElement: null,
		makeDraggable: null,
		addTooltips: null
    };

    return defaultOptions;
};

})(FileManager);
