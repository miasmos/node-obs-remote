var net = require('websocket').client;
var crypto = require('crypto-js');
var events = require('events');

function OBSRemote(opts) {
	var self = this;

	self.opts = opts;
	self.streaming = false;
	self.previewing = false;
	self.currentMessageCounter = 0;
	self.totalSecondsStreaming = 0;
	self.authSalt = "";
	self.authChallenge = "";
	self.requestCallbacks = {};
	self.events = new events.EventEmitter();

	self.Connect();
}

OBSRemote.prototype.Connect = function() {
	var self = this;

	self.client = new net();

	self.client.on('connectFailed', function(error) {
		console.log('Connect '+error);
		setTimeout(function(){self.Connect()},4000);
	});

	self.client.on('connect', function(connection){
		console.log('Connected to '+"ws://"+self.opts.host+":4444");
		self.connection = connection;
		self.supressWebsocketReconnect = false;
		self.CheckForAuth();

		connection.on('message', function(data) {
			var response = JSON.parse(data.utf8Data);
			if(!response) {return;}
			if(response["update-type"]) {
				console.log("Got "+response["update-type"]);

				/* this is an update */
				switch(response["update-type"]) {
					case "StreamStatus":
						self.onStreamStatus(response);
						break;
					case "StreamStarting":
						self.onStartStreaming(response);
						break;
					case "StreamStopping":
						self.onStopStreaming(response);
						break;
					case "SwitchScenes":
						self.onSceneSwitched(response);
						break;
					case "ScenesChanged":
						self.onScenesChanged(response);
						break;
					case "SourceOrderChanged":
						self.onSourceOrderChanged(response);
						break;
					case "SourceChanged":
						self.onSourceChanged(response);
						break;
					case "RepopulateSources":
						self.onRepopulateSources(response);
						break;
					case "VolumeChanged":
						self.onVolumeChanged(response);
				}
			} else {
				/* else this is a response */
				var id = response["message-id"];
				
				if(response["status"] == "error") {
					console.log("Response Error: " + response["error"]);
				}
				
				var callback = self.requestCallbacks[id];
				if(callback) {
					callback(response);
					self.requestCallbacks[id] = null;
				}
			}
		});

		connection.on('close', function() {
			console.log('Server closed connection');
			self.websocketConnected = false;
			if (!self.supressWebsocketReconnect) {setTimeout(function(){self.Connect();},4000);}

			self.events.emit('close');
		});

		connection.on('error', function(error) {
			self.events.emit('error', error);
			console.log("Connection " + error.toString());
		});
	});

	self.client.connect("ws://"+self.opts.host+":4444", 'obsapi');
}


OBSRemote.prototype.Send = function(msg, callback) {
	if (typeof msg == 'string') {
		msg = {"request-type": msg};
	}

	if(this.connection.connected) {
		var id = this.currentMessageCounter;

		if(!callback) {
			this.requestCallbacks[id] = function(){};
		} else {
			this.requestCallbacks[id] = callback;
		}
		msg["message-id"] = id.toString();
		console.log("Sent "+msg["request-type"]);
		this.connection.sendUTF(JSON.stringify(msg));
		this.currentMessageCounter++;
	}
}

/* Requests/Sends */
OBSRemote.prototype.CheckForAuth = function() {
	var self = this;
	this.Send("GetAuthRequired", function(res) {
		if (res.authRequired) {
			self.authSalt = res.salt;
			self.authChallenge = res.challenge;
			self.Authenticate();
		} else {
			setTimeout(self.events.emit('connect'),1000);
			self.requestStreamStatus();
			self.requestScenes();
			self.requestVolumes();
		}
	});
}

OBSRemote.prototype.Authenticate = function() {
	var authHash = crypto.SHA256(this.opts.pass.toString("utf8") + this.authSalt.toString("utf8")).toString(crypto.enc.Base64);
	var authResp = crypto.SHA256(authHash.toString("utf8") + this.authChallenge.toString("utf8")).toString(crypto.enc.Base64);
	
	var req = {
		'request-type': 'Authenticate',
		'auth': authResp
	};
	
	var self = this;
	this.Send(req, function(res){
		if(res["status"] == "ok") {
			console.log('Auth Success');
			setTimeout(self.events.emit('connect'),1000);
			self.requestStreamStatus();
			self.requestScenes();
			self.requestVolumes();
		} else {
			console.log('Auth Failed');
		}
	});
}

OBSRemote.prototype.requestStreamStatus = function() {
	this.Send("GetStreamingStatus", function(res){
		if(res["status"] === "ok") {
			var newStreaming = res["streaming"];
			if(newStreaming != this.streaming && typeof this.streaming !== 'undefined') {
				if(newStreaming) {
					this.onStartStreaming(res);
				} else {
					this.onStopStreaming(res);
				}
			}
			this.streaming = newStreaming;
		}
	});
}

OBSRemote.prototype.requestScenes = function() {
	var self = this;
	this.Send("GetSceneList", function(res){
		if(res["status"] === "ok") {
			self.assignScenes(res);
		}
	});
}

OBSRemote.prototype.requestVolumes = function() {
	var self = this;
	this.Send("GetVolumes", function(res){
		if(res["status"] === "ok") {
			self.assignVolumes(res);
		}
	});
}

OBSRemote.prototype.sendMute = function(type) {
	var req = {
		'request-type': 'ToggleMute',
		'channel': type
	};
	this.Send(req);
}

OBSRemote.prototype.sendVolume = function(volume, type, fin) {
	var req = {
		'request-type': 'SetVolume',
		'volume': volume,
		'channel': type,
		'final': fin
	};
	this.Send(req);
}

OBSRemote.prototype.sendPreviewStream = function() {
	var req = {
		'request-type': 'StartStopStreaming',
		'preview-only': true
	}
	this.Send(req);
}

OBSRemote.prototype.sendSetScene = function(name) {
	var req = {
		'request-type': 'SetCurrentScene',
		'scene-name': name
	}
	this.Send(req);
}

OBSRemote.prototype.sendSourceVisibility = function(name, bit) {
	var req = {
		'request-type': 'SetSourceRender',
		'source': name,
		'render': bit
	}
	this.Send(req);
}

OBSRemote.prototype.sendSourceOrder = function(sources) {
	var req = {
		'request-type': 'SetSourceOrder',
		'scene-names': sources
	}
	this.Send(req);
}
/* End Requests/Sends */

/* Events */
OBSRemote.prototype.onStreamStatus = function(res) {
	if (res["status"] === "ok") {
		assignStreamStatus(res);
	}
	this.events.emit('status', res);
}

OBSRemote.prototype.onStartStreaming = function(res) {
	if (res["status"] === "ok") {
		assignStream(res);
	}
	this.events.emit('start', res);
}

OBSRemote.prototype.onStopStreaming = function(res) {
	if (res["status"] === "ok") {
		assignStream(res);
	}
	this.events.emit('stop', res);
}

OBSRemote.prototype.onSceneSwitched = function(res) {
	if (res["status"] === "ok") {
		assignScenes(res);
	}
	this.events.emit('sceneswitch', res);
}

OBSRemote.prototype.onScenesChanged = function(res) {
	if (res["status"] === "ok") {
		assignScenes(res);
	}
	this.events.emit('scenechange', res);
}

OBSRemote.prototype.onSourceOrderChanged = function(res) {
	if (res["status"] === "ok") {
		var temp = [];
		var index = 0;
		for (var i = 0; i < this.sources.length; i++) {
			if (this.sources[i]['name'] == res['sources'][index]) {
				temp.push(this.sources[i]);
				index++;
				i = 0;
			}
		}
		this.sources = temp;
	}
	this.events.emit('sourceorder', res);
}

OBSRemote.prototype.onSourceChanged = function(res) {
	if (res["status"] === "ok") {
		for (var i = 0; i < this.sources.length; i++) {
			if (this.sources[i]['name'] == res['source-name']) {
				this.sources[i] = res['source'];
				break;
			}
		}
	}
	this.events.emit('sourcechange', res);
}

OBSRemote.prototype.onRepopulateSources = function(res) {
	if (res["status"] === "ok") {
		this.sources = res['sources'];
	}
	this.events.emit('sourcerepopulate', res);
}

OBSRemote.prototype.onVolumeChanged = function(res) {
	if(res["status"] === "ok") {
		assignVolumes(res);
	}
	this.events.emit('volumechange', res);
}
/* End Events */

/* Public Methods */
OBSRemote.prototype.MuteMic = function() {
	if (!this.micMuted || this.micMuted == 'undefined') {
		this.sendMute('microphone');
	}
}

OBSRemote.prototype.UnMuteMic = function() {
	if (this.micMuted || this.micMuted == 'undefined') {
		this.sendMute('microphone');
	}
}

OBSRemote.prototype.ToggleMicMute = function() {
	this.sendMute('microphone');
}

OBSRemote.prototype.MuteDesktop = function() {
	if (!this.desktopMuted || this.desktopMuted == 'undefined') {
		this.sendMute('desktop');
	}
}

OBSRemote.prototype.UnMuteDesktop = function() {
	if (this.desktopMuted || this.desktopMuted == 'undefined') {
		this.sendMute('desktop');
	}
}

OBSRemote.prototype.ToggleDesktopMute = function() {
	this.sendMute('desktop');
}

OBSRemote.prototype.SetMicVolume = function(num) {
	this.sendVolume(num,'microphone',false);
}

OBSRemote.prototype.SetDesktopVolume = function(num) {
	this.sendVolume(num,'desktop',false);
}

OBSRemote.prototype.StartStream = function() {
	if (!this.streaming && !this.previewing) {
		this.Send("StartStopStreaming");
	}
}

OBSRemote.prototype.StopStream = function() {
	if (this.streaming || this.previewing) {
		this.Send("StartStopStreaming");
	}
}

OBSRemote.prototype.ToggleStream = function() {
	this.Send("StartStopStreaming");
}

OBSRemote.prototype.StartPreview = function() {
	if (!this.streaming && !this.previewing) {
		this.sendPreviewStream();
	}
}

OBSRemote.prototype.StopPreview = function() {
	if (this.streaming || this.previewing) {
		this.sendPreviewStream();
	}
}

OBSRemote.prototype.TogglePreview = function() {
	this.sendPreviewStream();
}

OBSRemote.prototype.SetSceneByName = function(name) {
	if (this.currentScene != name) {
		this.sendSetScene(name);
	}
}

OBSRemote.prototype.SetScene = function(num) {
	if (num < this.scenes.length && num > -1) {
		var name = this.scenes[num]['name'];
		if (this.currentScene == name) {return;}
		this.sendSetScene(name);
	}
}

OBSRemote.prototype.SetSourceVisibleByName = function(name) {
	var num = this.findSourceIndex(name);
	if (num > -1) {this.SetSourceVisible(num);}
}

OBSRemote.prototype.SetSourceInvisibleByName = function(name) {
	var num = this.findSourceIndex(name);
	if (num > -1) {this.SetSourceInvisible(num);}
}

OBSRemote.prototype.SetSourceVisible = function(num) {
	if (this.sources[num]['render'] == false) {
		var name = this.sources[num]['name'];
		this.sendSourceVisibility(name, true);
	}
}

OBSRemote.prototype.SetSourceInvisible = function(num) {
	if (this.sources[num]['render'] == true) {
		var name = this.sources[num]['name'];
		this.sendSourceVisibility(name, false);
	}
}

OBSRemote.prototype.ShiftSourceOrder = function(oldIndex, newIndex) {
	if (oldIndex == newIndex) {return;}

	var sources = [];
	for (var i = 0; i < this.sources.length; i++) {
		sources.push(this.sources[i]['name']);
	}

	var source = sources[oldIndex];
	sources[oldIndex].splice(oldIndex, 1);
	sources.splice(newIndex, 0, source);
	this.sendSourceOrder(sources);
}

OBSRemote.prototype.SetSourceOrder = function(newIndices) {
	if (newIndices.length != this.sources.length) {return;}

	var similar = true;
	for (var i = 0; i < this.sources.length; i++) {
		if (newIndices[i] != i) {
			similar = false;
			break;
		}
	}

	if (!similar) {
		var sources = [];
		for (var i = 0; i < this.sources.length; i++) {
			sources.push(this.sources[newIndices[i]]['name']);
		}
		this.sendSourceOrder(sources);
	}
}

OBSRemote.prototype.SetSourceOrderByName = function(newIndices) {
	if (newIndices.length != this.sources.length) {return;}

	var similar = true;
	for (var i = 0; i < this.sources.length; i++) {
		if (newIndices[i]['name'] != this.sources[i]['name']) {
			similar = false;
			break;
		}
	}

	if (!similar) {this.sendSourceOrder(sources);}
}
/* End Public Methods */

/* Utils */
OBSRemote.prototype.assignVolumes = function(res) {
	this.micVolume = res["mic-volume"];
	this.desktopVolume = res["desktop-volume"];
	this.micMuted = res["mic-muted"];
	this.desktopMuted = res["desktop-muted"];
	this.micVolume = res["mic-volume"];
	this.desktopVolume = res["destop-volume"];
}

OBSRemote.prototype.assignStream = function(res) {
	var previewOnly = res["preview-only"];
	this.previewing = previewOnly;
	this.streaming = !previewOnly;
}

OBSRemote.prototype.assignStreamStatus = function(res) {
	this.bytesPerSec = res["bytes-per-sec"];
	this.fps = res["fps"];
	this.droppedFrames = res["num-dropped-frames"];
	this.totalFrames = res["num-total-frames"];
	this.streamTime = res["total-stream-time"];
}

OBSRemote.prototype.assignScenes = function(res) {
	this.currentScene = res["current-scene"];
	this.scenes = res["scenes"];

	for (var i = 0; i < this.scenes.length; i++) {
		if (this.scenes[i]['name'] == this.currentScene) {
			this.sources = this.scenes[i]['sources'];
		}
	}
}

OBSRemote.prototype.findSourceIndex = function(name) {
	for (var i = 0; i < this.sources.length; i++) {
		if (this.sources[i]['name'] == name) {
			return i;
		}
	}
	return -1;
}
/* End Utils */

module.exports = OBSRemote;
