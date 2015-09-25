[![npm version](https://badge.fury.io/js/obsremote-node.svg)](http://badge.fury.io/js/obsremote-node)
  
OBSRemote-node
==============

A node implementation for OBSRemote. OBSRemote allows control of Open Broadcaster Software over a remote connection.
https://github.com/bilhamil/OBSRemote  
  
#Quickstart  

    var OBSRemote = require('./main.js');
    var opts = {pass: "admin", host: "127.0.0.1"};
    var obs = new OBSRemote(opts);
    
    obs.events.on('connect', function(){
	    obs.MuteMic();
    });
  
  
#Options  
host - obs-remote host name  
port - obs-remote port  
pass - obs-remote password  
debug - prevents sending commands to obs-remote  

#Licence  
The MIT License (MIT)

Copyright (c) 2015 Stephen Poole

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
