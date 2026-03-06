//
// Author: Sebastian Schmittner
//         (function) http://benalman.com/projects/jquery-misc-plugins/#scrollbarwidth
// Date: 2014.12.07 10:06:32 (+01:00)
// LastAuthor: Sebastian Schmittner
// LastDate: 2014.12.07 10:06:32 (+01:00)
// Version: 0.0.1
//

var tools = {
	scrollbarWidth: function() {
		var parent, child, width;

		if(width===undefined) {
			parent = $('<div style="width:50px;height:50px;overflow:auto"><div/></div>').appendTo('body');
			child=parent.children();
			width=child.innerWidth()-child.height(99).innerWidth();
			parent.remove();
		}

		return width; 
	}
};
