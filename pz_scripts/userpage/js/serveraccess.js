//
// Author: Sebastian Schmittner
// Date: 2014.07.23
// LastAuthor: Sebastian Schmittner
// LastDate: 2014.07.24 00:56:42 (+02:00)
// Version: 0.0.2
//

// 
// Server access functions
// 

function serverRequest(url, content, fnStateChange, context)
{
  var request = null;

  if (window.XMLHttpRequest)
  {
    request = new XMLHttpRequest();
    request.open('post', url, true);
    request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    request.send(content);
    request.onreadystatechange = fnStateChange;
    request.context = context;
  }

  return request;
}


