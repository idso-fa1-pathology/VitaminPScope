/*
	Desc: Raster class
	Author:	Sebastian Schmittner (stp.schmittner@gmail.com)
	Date: 2014.10.31 
	Last Author: Sebastian Schmittner (stp.schmittner@gmail.com)
	Last Date: 2014.10.31
	Version: 0.0.1
*/

function Raster(container, cols, rows) {
	this.rows = rows;
	this.cols = cols;
	this.container = container;
	this.elementWidth = 0.0;
	this.elementHeight = 0.0;
	this.table = this.createTable(this.cols, this.rows);
	this.centerDeadZone = 0.3; // e.g. 50% -> 25% left = 50% center = 25% right
	this.rowwidth = 0.0;
	this.rowheight = 0.0;
};

Raster.prototype = {
	DIRECTION: {
		UPPERLEFT:  0,
		UP:         1,
		UPPERRIGHT: 2,
		LEFT:       3,
		CENTER:     4,
		RIGHT:      5,
		LOWERLEFT:  6,
		DOWN:       7,
		LOWERRIGHT: 8
	},
		
	SIZECHANGE: {
		INC:  +1,
		DEC:  -1
	},
	
	createTable: function( cols, rows ) {
		var localTable = new Array(cols);
		
		for(var x = 0; x < cols; ++x) {
			
			localTable[x] = new Array(rows);
			
			for(var y = 0; y < rows; ++y) {
				var item = new Object();
				
				item.width = 0;
				item.height = 0;
				item.x = x;
				item.y = y;
				item.item = null;
				
				localTable[x][y] = item;
			}
		}
		
		return localTable;
	},
	
	doTableResize: function( cols, rows ) {
		var newTable = this.createTable(cols, rows);
		var items = this.getItems();
		
		var index = 0;
		
		for(var x = 0; x < cols; ++x) {
			for(var y = 0; y < rows; ++y) {
				if(index < items.length) {
					newTable[x][y].item = items[index];
					++index;
				}
			}
		}

		this.table = newTable;	
		this.cols = cols;
		this.rows = rows;
		
		this.recomputeSize();
	},
	
	changeRows: function( row, change ) {
		if(row < 0 || row > this.rows) {
			return;
		}
		
		var newTable = this.createTable( this.cols, this.rows + change );
		
		for(var x = 0; x < this.cols; ++x) {
			for(var y = 0; y < this.rows; ++y) {
				
				if( this.table[x][y].item !== null ) {
					if(y >= row) {
						newTable[x][y + change].item = this.table[x][y].item;
					}
					else {
						newTable[x][y].item = this.table[x][y].item;
					}
				}
			}
		}
		
		this.table = newTable;
		this.rows = this.rows + change;
		this.cols = this.cols;
	},
	
	changeCols: function( col, change ) {
		if(col < 0 || col > this.cols) {
			return;
		}
		
		var newTable = this.createTable( this.cols + change, this.rows );
		
		for(var x = 0; x < this.cols; ++x) {
			for(var y = 0; y < this.rows; ++y) {
				
				if( this.table[x][y].item !== null ) {
					if(x >= col) {
						newTable[x + change][y].item = this.table[x][y].item;
					}
					else {
						newTable[x][y].item = this.table[x][y].item;
					}
				}
			}
		}
		
		this.table = newTable;
		this.rows = this.rows;
		this.cols = this.cols + change;
	},
	
	isCoordinateValid: function( row, col ) {
		return row >= 0 && 
			   row < this.rows && 
			   col >= 0 && 
			   col < this.cols;
	},
	
	cleanGrid: function() {
		
		for( var i = this.cols - 1; i >= 0; --i ) {
			this.removeCol(i);
		}

		for( var i = this.rows - 1; i >= 0; --i ) {
			this.removeRow(i);
		}
		
		if( this.rows <= 0 || this.cols <= 0 ) {
			this.doTableResize(1,1);
		}
	},
	
	removeRow: function( row ) {
		if( this.isEmpty(-1, row) && this.isCoordinateValid(row, 0) ) {
			this.changeRows( row, this.SIZECHANGE.DEC );
		}
	},
	
	removeCol: function( col ) {
		if( this.isEmpty(col, -1) && this.isCoordinateValid(0, col) ) {
			this.changeCols( col, this.SIZECHANGE.DEC );
		}
	},
	
	isEmpty: function( col, row ) {

		var isempty = true;
	
		if( col == -1 ) {
			for( var i = 0; i < this.cols; ++i ) {
				isempty = isempty && this.table[i][row].item === null;
			}
		}
		else if( row == -1 ) {
			for( var i = 0; i < this.rows; ++i ) {
				isempty = isempty && this.table[col][i].item === null;
			} 
		}
		else {
			isempty = this.table[col][row].item === null;
		}
		
		return isempty;
	},
	
	getItems: function() {
		var items = [];
		
		for(var x = 0; x < this.cols; ++x) {
			for(var y = 0; y < this.rows; ++y) {
				items.push(this.table[x][y].item);
			}
		}
		
		return items;
	},
	
	setItem: function(x, y, item) {
		this.table[x][y].item = item;
	},
	
	testCell: function(x, y) {
		if(x >= 0 && x < this.cols && y >= 0 && y < this.rows) {
			return this.table[x][y].item === null;
		}
		else {
			return false;
		}
	},
	
	addAt: function(x, y, item, quadrant) {
		if(this.table[x][y].item === null) {
			this.table[x][y].item = item;
		} 
		else {
			
			var left = x;
			var top = y;
			var right = x + 1;
			var bottom = y + 1;
			
			switch (quadrant) {
				case this.DIRECTION.UPPERLEFT:
					if(this.testCell(x-1, y-1)) {
						x = x - 1;
						y = y - 1;
					}
					else {
						this.changeCols(left, this.SIZECHANGE.INC);
						this.changeRows(top, this.SIZECHANGE.INC);
					}
					break;
				case this.DIRECTION.UP:
					if(this.testCell(x, y-1)) {
						y = y - 1;
					}
					else {
						this.changeRows(top, this.SIZECHANGE.INC);
					}
					break;
				case this.DIRECTION.UPPERRIGHT:
					if(this.testCell(x+1, y-1)) {
						x = x + 1;
						y = y - 1;
					}
					else {
						this.changeCols(right, this.SIZECHANGE.INC);
						this.changeRows(top, this.SIZECHANGE.INC);
						x = x + 1;
					}
					break;
				case this.DIRECTION.LEFT:
					if(this.testCell(x-1, y)) {
						x = x - 1;
					}
					else {
						this.changeCols(left, this.SIZECHANGE.INC);
					}
					break;
				case this.DIRECTION.RIGHT:
					if(this.testCell(x+1, y)) {
						x = x + 1;
					}
					else {
						this.changeCols(right, this.SIZECHANGE.INC);
						x = x + 1;
					}
					break;
				case this.DIRECTION.LOWERLEFT:
					if(this.testCell(x-1, y+1)) {
						x = x - 1;
						y = y + 1;
					}
					else {
						this.changeCols(left, this.SIZECHANGE.INC);
						this.changeRows(bottom, this.SIZECHANGE.INC);
						y = y + 1;
					}
					break;
				case this.DIRECTION.DOWN:
					if(this.testCell(x, y+1)) {
						y = y + 1;
					}
					else {
						this.changeRows(bottom, this.SIZECHANGE.INC);
						y = y + 1;
					}
					break; 
				case this.DIRECTION.LOWERRIGHT:
					if(this.testCell(x+1, y+1)) {
						x = x + 1;
						y = y + 1;
					}
					else {
						this.changeCols(right, this.SIZECHANGE.INC);
						this.changeRows(bottom, this.SIZECHANGE.INC);
						x = x + 1;
						y = y + 1;
					}
					break;
				case this.DIRECTION.CENTER:
					break;
				default:
					break;
			}
			
			this.table[x][y].item = item;
		}
	},
	
	dropAt: function(xpos, ypos, item) {
		
		var offset = jQuery(this.container).offset();
		
		xpos = xpos - offset.left + jQuery(this.container).scrollLeft();
		ypos = ypos - offset.top + jQuery(this.container).scrollTop();
		
		if( jQuery('.sampleCell').outerHeight() !== null && jQuery('.sampleCell').outerHeight() !== undefined ) {
			this.elementHeight = jQuery('.sampleCell').outerHeight();
			this.elementWidth = jQuery('.sampleCell').outerWidth();
		}
		
		var xcell = Math.floor(xpos / this.elementWidth);
		var ycell = Math.floor(ypos / this.elementHeight);
		
		if(xcell < 0 || xcell >= this.cols || ycell < 0 || ycell >= this.rows) {
			return;
		}
		
		var inCellX = xpos - xcell * this.elementWidth;
		var inCellY = ypos - ycell * this.elementHeight;
		
		var quadrant = this.detectQuadrant(inCellX, inCellY);
		
		this.addAt(xcell, ycell, item, quadrant);
		
		this.createGrid();
	},
	
	detectQuadrant: function(inCellX, inCellY) {
		var deadZoneH = this.elementWidth * this.centerDeadZone;
		var deadZoneV = this.elementHeight * this.centerDeadZone;
		
		var left = (this.elementWidth - deadZoneH) / 2.0;
		var top = (this.elementHeight - deadZoneV) / 2.0;
		
		var quadrant = 0;
		
		if(inCellX <= left) {
			quadrant = 0;
		}
		else if(inCellX > left && inCellX < left + deadZoneH) {
			quadrant = 1;
		}
		else {
			quadrant = 2;
		}
		
		if(inCellY <= top) {
			quadrant = quadrant + 0;
		}
		else if(inCellY > top && inCellY < top + deadZoneV) {
			quadrant = quadrant + 3;
		}
		else {
			quadrant = quadrant + 6;
		}
		
		return quadrant;
	},
	
	isSingular: function() {
		return this.cols == 1.0 && this.rows == 1.0;
	},
	
	createGrid: function() {
		
		this.recomputeSize();
		
		var gridHtml = "";
		
		for(var y = 0; y < this.rows; ++y) {
			gridHtml = gridHtml + '<div class="rasterrow">';
			for(var x = 0; x < this.cols; ++x) {
				var content = this.table[x][y].item;
				
				if(content === null) {
					content = '';
				}

				gridHtml = gridHtml + '<div class="rastercell sampleCell" data-x="' + x + '" data-y="' + y + '">' + content + '</div>';
			}
			gridHtml = gridHtml + '</div>';
		}
		
		jQuery(this.container).html(gridHtml);
		
		this.applySize(this.elementWidth, this.elementHeight);
		
		jQuery('.sampleCell').not(":empty").append('<div class="icon trash" style="width:32px; height:32px;"></div>');
		jQuery('.sampleCell').not(":empty").append('<div class="icon alpha" style="width:32px; height:32px;"></div>');
		
		jQuery('.alpha-item').siblings('.icon.alpha').addClass('active');

		var grid = this;
		
		jQuery('.icon.trash').click(function() {
			var item = jQuery(this).closest('.sampleCell');
			
			if(item.length != 0) {
				var e = jQuery(item[0]);
				var x = e.data('x');
				var y = e.data('y');
				grid.table[x][y].item = null;
				grid.cleanGrid();
				grid.createGrid();
			}
		});
		
		jQuery('.icon.alpha').click(function() {
			var item = jQuery(this).closest('.sampleCell');
			
			if(item.length != 0) {
				// remove all alpha marks
				for(var x = 0; x < grid.cols; ++x) {
					for(var y = 0; y < grid.rows; ++y) {
						if(grid.table[x][y].item !== null) {
							grid.table[x][y].item = jQuery(grid.table[x][y].item).removeClass('alpha-item')[0].outerHTML;
						}
					}
				}
				
				var e = jQuery(item[0]);
				var x = e.data('x');
				var y = e.data('y');
				
				grid.table[x][y].item = jQuery(grid.table[x][y].item).addClass('alpha-item')[0].outerHTML;
				grid.createGrid();
			}
		});
		
		jQuery(this.container).css('overflow-x', 'scroll');
		jQuery(this.container).css('overflow-y', 'scroll');
	},
	
	scrollbarWidth: function() {
		var parent, child, width;

		if(width===undefined) {
			parent = $('<div style="width:50px;height:50px;overflow:auto"><div/></div>').appendTo('body');
			child=parent.children();
			width=child.innerWidth()-child.height(99).innerWidth();
			parent.remove();
		}

		return width; 
	},
	
	recomputeSize: function() {
		var imgSizes = this.getMaxImageSize();
		
		var minCellWidth = Math.max(imgSizes.width + 100, 256);
		var minCellHeight = Math.max(imgSizes.height + 100, 256);
		
		var height = jQuery(this.container).height() - this.scrollbarWidth();
		var width = jQuery(this.container).width() - this.scrollbarWidth();
		
		var heightPerCell = height / this.rows;
		var widthPerCell = width / this.cols;
		
		heightPerCell = Math.max(heightPerCell, minCellHeight);
		widthPerCell = Math.max(widthPerCell, minCellWidth);
		
		this.elementHeight = heightPerCell;
		this.elementWidth = widthPerCell;
	
		this.rowwidth = this.cols * this.elementWidth;
		this.rowheight = this.elementHeight;

		var row = jQuery('.rasterrow');
		row.outerHeight(this.rowheight).outerWidth(this.rowwidth);

		heightPerCell = row.height() / this.rows;
		widthPerCell = row.width() / this.cols;
		
		for(var x = 0; x < this.cols; ++x) {
			for(var y = 0; y < this.rows; ++y) {
				this.table[x][y].width = Math.floor(widthPerCell);
				this.table[x][y].height = Math.floor(heightPerCell);
			}
		}
	},
	
	getMaxImageSize: function() {
		
		var maxImgHeight = 1;
		var maxImgWidth = 1;
		var aimedSide = 256; // pixels
		
		jQuery('.sampleCell img').each( function() {
			maxImgHeight = Math.max(jQuery(this).height(), maxImgHeight);
			maxImgWidth = Math.max(jQuery(this).width(), maxImgWidth);
		});
		
		var maxFactor = Math.max(maxImgWidth, maxImgHeight);
		maxImgHeight = maxImgHeight / maxFactor * aimedSide;
		maxImgWidth = maxImgWidth / maxFactor * aimedSide;
		
		return { 
					width: maxImgWidth,
					height: maxImgHeight 
				};
	},
	
	applySize: function(cellWidth, cellHeight) {
		
		jQuery('.rasterrow').height(this.rowheight).width(this.rowwidth);//.css('display','block');
		jQuery('.rastercell').outerHeight(cellHeight).outerWidth(cellWidth);//.css('display','inline-block');
		
		jQuery('.sampleCell').find('img').each(function(e, i) {
			jQuery(this).width("256px").height("auto");
		});
		
		jQuery('.analysis').css('position','relative').css('left', '0px').css('top', '0px');
		jQuery('.sampleCell').outerWidth(cellWidth).outerHeight(cellHeight).css('position','relative');
		jQuery('.sampleCell').children('div').width('auto').height('auto');
		jQuery('.sampleCell img').css('margin', 'none');
		
		var shouldHeight = Math.min(cellHeight, cellHeight - (jQuery('.sampleCell').outerHeight() - cellHeight));
		var shouldWidth = Math.min(cellWidth, cellWidth - (jQuery('.sampleCell').outerWidth() - cellWidth));
		
		jQuery('.sampleCell').outerHeight(shouldHeight).outerWidth(shouldWidth);
		jQuery('.sampleCell').children('.analysis').height("100%").width("100%");

		jQuery('.sampleCell').each(function(i, element) {
			var image = jQuery(this).find('img.itemImage');
			var marginLeft = (jQuery(this).innerWidth() - image.outerWidth()) / 2;
			var marginTop = (jQuery(this).innerHeight() - image.outerHeight()) / 2;
			
			jQuery(image).css('margin-left', marginLeft)
						   .css('margin-top', marginTop);
		});
		
		jQuery('.icon.alpha').height("32px").width("32px");
		jQuery('.icon.trash').height("32px").width("32px");
		
		jQuery('.sampleCell').css('float','left');
	},
	
	refresh: function() {
		this.recomputeSize();
		this.applySize(this.elementWidth, this.elementHeight);
	}
};