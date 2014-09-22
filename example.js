var OBSRemote = require('./main.js');
var opts = {pass: "foo", host: "localhost"};
var obs = new OBSRemote(opts);

obs.events.on('connect', function(){
	obs.MuteMic();
	// obs.UnMuteMic();
	// obs.ToggleMicMute();
	// obs.MuteDesktop();
	// obs.UnMuteDesktop();
	// obs.ToggleDesktopMute();
	// obs.SetMicVolume(0);
	// obs.SetDesktopVolume(0);
	obs.StartStream();
	// obs.StopStream();
	// obs.ToggleStream();
	// obs.StartPreview();
	// obs.StopPreview();
	// obs.TogglePreview();
	// obs.SetSceneByName('foo');
	// obs.SetScene(0);
	// obs.SetSourceVisibleByName('foo');
	// obs.SetSourceInvisibleByName('foo');
	// obs.SetSourceVisible(0);
	// obs.SetSourceInvisible(0);
	// obs.ShiftSourceOrder(0,1);
	// obs.SetSourceOrder([]);
	// obs.SetSourceOrderByName([]);
});