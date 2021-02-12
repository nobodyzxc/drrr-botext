const createMediaStreamFake = () => {
  return new MediaStream([createEmptyAudioTrack(), createEmptyVideoTrack({ width:640, height:480 })]);
}

const createEmptyAudioTrack = () => {
  const ctx = new AudioContext();
  const oscillator = ctx.createOscillator();
  const dst = oscillator.connect(ctx.createMediaStreamDestination());
  oscillator.start();
  const track = dst.stream.getAudioTracks()[0];
  return Object.assign(track, { enabled: false });
}

const createEmptyVideoTrack = ({ width, height }) => {
  const canvas = Object.assign(document.createElement('canvas'), { width, height });
  canvas.getContext('2d').fillRect(0, 0, width, height);

  const stream = canvas.captureStream();
  const track = stream.getVideoTracks()[0];

  return Object.assign(track, { enabled: false });
};

function askBeforeLeave(e) {
  var message = "Audio chat will end, do you wanna leave?",
    e = e || window.event;
  // For IE and Firefox
  if(window.call){
    if (e) {
      e.returnValue = message;
    }
    // For Safari
    return message;
  }
  return undefined;
}

function findGetParameter(parameterName, url) {
  var search = url ? (new URL(url)).search : location.search;
  var result = null,
    tmp = [];
  search
    .substr(1)
    .split("&")
    .forEach(function (item) {
      tmp = item.split("=");
      if (tmp[0] === parameterName) result = decodeURIComponent(tmp[1]);
    });
  return result;
}

function handleCall(call){
  call.on('stream', function(stream) {
    // Do something with this audio stream
    console.log("Here's a stream");
    playStream(remote, stream);
  });

  call.on('close', function() {
    // Do something with this audio stream
    window.onbeforeunload = null;
    stopStream();
    alert("call ended")
    window.call = null;
    $("#chat-setting-container").show();
    $("#chat-video-container").hide();
  });

  call.on('error', function(err) {
    window.onbeforeunload = null;
    stopStream();
    alert(`call error: ${err.type}`)
    window.call = null;
    // Do something with this audio stream
  });
}
function handleCallClose(call){
  call.peerConnection.onconnectionstatechange = function (event) {
    if (event.currentTarget.connectionState === 'disconnected') {
      call.close();
    }
  };
}

function clearPeer(){
  peer.close();
  peer.destroy();
  $('#id').text('Please set your peerID');
  peerID = null;
  peer = null;
}

function getConfig(){
  const audioSources =
    $('#audio-input')
    .find(':checkbox')
    .filter(':checked')
    .get().map(e => e.value);

  const videoSource = $('#video-input').val();
  return {
    audio: audioSources.length ? {deviceId: audioSources} : false,
    video: videoSource === "none" ? false : {deviceId: videoSource}
  };
}

function getStream(config, success, error){

  function getOtherStreams(cfg, initStream){
    if(cfg.video || cfg.audio){
      navigator.mediaDevices
        .getUserMedia(cfg)
        .then((stream) => {
          stream
            .getTracks()
            .forEach(track => initStream.addTrack(track));
          success(initStream);
        })
        .catch(e => {
          error(e);
        });
    }
    else success(initStream);
  }

  if(!config.video && !config.audio)
    success(new MediaStream([createEmptyAudioTrack()]));
  else if(config.video && config.video.deviceId == 'screen'){
    navigator.mediaDevices
      .getDisplayMedia({video: true, audio: true})
      .then(stream => {
        config.video = false;
        getOtherStreams(config, new MediaStream(stream))
      })
      .catch(e => {
        error(e);
      });
  }
  else getOtherStreams(config,new MediaStream());
}

/**
 * Create the Peer object for our end of the connection.
 *
 * Sets up callbacks that handle any events related to our
 * peer object.
 */
function initialize() {
  // Create own peer object with connection to shared PeerJS server
  if(!peerID) {
    alert("Please set your ID");
    return;
  }

  $('#id').text(peerID);

  peer = new Peer(peerID, {
    //debug: 3
  });

  peer.on('open', function(){
    if(findGetParameter('invite')){
      $('#remote-id').text(remote);
      join(`${remote}`);
    }
    else{
      if(findGetParameter('wait')){
        remote = `DRRR${remote}`
        $('#remote-id').text(remote);
        tryCall = true;
        $("#status").text("Try Calling...");
        window.call = peer.call(id, window.localStream);
        handleCall(window.call);
        handleCallClose(window.call);
      }
    }
  })

  // incoming call
  peer.on('call', function(call) {

    function answer_call(){
      $('#remote-id').text(call.peer);
      remote = call.peer;
      window.call = call;
      //window.onbeforeunload = askBeforeLeave;
      console.log("Here's a call");
      setTimeout(() => {
        handleCall(call);
        call.answer(window.localStream)
        handleCallClose(call);
      }, 2500);
    }

    function cancel_call(){
      call.answer();
      setTimeout(function(){
        call.close();
      }, 2500);
    }

    if(window.call){
      answer = confirm(`New call from ${call.peer}, break current and answer?`);
      if(answer){
        // break and answer
        window.call.close();
        var until_close = () => setTimeout(function(){
          if(window.call) until_close();
          else answer_call();
        }, 2500);
        until_close();
      } else cancel_call();
    }
    else{
      answer = true;
      if(call.peer != remote)
        answer = confirm(`Call from ${call.peer}, do you wanna answer?`);
      if(answer) answer_call();
      else cancel_call();
    }
  });

  peer.on('disconnected', function () {
    stopStream();
    console.log("Connection lost. Please reconnect");
    // Workaround for peer.reconnect deleting previous id
    //peer.id = lastPeerId;
    //peer._lastServerId = lastPeerId;
    //peer.reconnect();
  });
  peer.on('close', function() {
    stopStream();
    console.log("Connection destroyed. Please refresh");
  });

  peer.on('error', function (err) {
    stopStream();
    console.log(err);
    if(err.type === 'peer-unavailable'){
      //'peer-unavailable'
      window.call = null;
      if(tryCall){
        $("#status").text("Waiting answer...");
        ctrlRoom({
          'message': 'Click to answer my call',
          'url': `https://drrrchatbots.gitee.io${location.pathname}?invite=${peerID}`,
          'to': remote.replace('DRRR', ''),
        })
        tryCall = false;
      }
    }
    else if(err.type === 'unavailable-id'){
      alert("the id is taken");
      peerID = null;
      $('#id').text('Please set your ID');
    }
    else{
      console.log('peer error:' + err.type);
      alert('peer error:' + err.type);
    }
  });
};

function playStream(id, stream) {
  $("#status").text("Connected");
  $("#chat-setting-container").hide();
  $("#chat-video-container").show();

  var uelt = $(`#${id}`);
  if(uelt.length){
    localVideo = uelt.find(`#${id}-video`)[0];
  }
  else{
    full = $(`<input type="submit" id="${id}-full" value="full screen" />`)
    video = $(`<video id="${id}-video" autoplay controls playsinline/>`)
    localVideo = video[0];

    full.click(function(){
      if (localVideo.requestFullscreen)
        localVideo.requestFullscreen();
      else if (localVideo.webkitRequestFullscreen)
        localVideo.webkitRequestFullscreen();
      else if (localVideo.msRequestFullScreen)
        localVideo.msRequestFullScreen();
    });

    function wrap(elt){
      return $(`<div class="col-100"></div>`).append(elt);
    }
    $(`<div id="${id}" class="row"></div>`)
      .append(wrap(video))
      .append(wrap(full))
      .appendTo('#chat-video-container');
  }

  if(!localVideo.srcObject ||
    (stream.getTracks().length > localVideo.srcObject.getTracks().length)){
    if ("srcObject" in localVideo) {
      localVideo.srcObject = stream;
    } else {
      localVideo.src = window.URL.createObjectURL(stream);
    }
  }
}

function stopStream(){
  $('#status').text('No Connection');
  if(remote) $(`#${remote}`).remove();
}
/**
 * Create the connection between the two Peers.
 *
 * Sets up callbacks that handle any events related to the
 * connection and data received on it.
 */
function join(id) {
  // Close old connection
  // TODO
  function _join(){
    $("#status").text("Connecting...");
    try{
      if(!window.localStream){
        alert("please enable your audio stream");
        return;
      }

      while(!id){
        id = prompt("Input the peerID you want to call");
        if(!id) alert("Invalid ID");
      }

      // outgoing call
      window.call = peer.call(id, window.localStream);
      //window.onbeforeunload = askBeforeLeave;
      handlecall(window.call);
    }
    catch(err){
      alert(String(err));
    }
  }

  if(window.call){
    window.call.close();
    var until_close = () => setTimeout(function(){
      if(window.call) until_close();
      else _join();
    }, 2500);
    until_close();
  } else _join();
}

var peer = null; // Own peer object
var host = null;
var peerID = null;
var remote = null;
var lastPeerId = null;
var tryCall = false;
window.localStream = null;
window.call = null;

function makeid(length) {
  var result           = '';
  var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var charactersLength = characters.length;
  for ( var i = 0; i < length; i++ ) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

function randomPeerID(){
  return 'DRRR' + makeid(20);
}

function handleError(error) {
  console.log('navigator.MediaDevices.getUserMedia error: ', error.message, error.name);
}

function gotDevices(deviceInfos) {
  var videoSelect = $('#video-input');
  var audioInputChecks = $('#audio-input');
  //var audioOutputSelect = $('#audio-output');
  for (let i = 0; i !== deviceInfos.length; ++i) {
    const deviceInfo = deviceInfos[i];
    if (deviceInfo.kind === 'audioinput') {
      var label = deviceInfo.label || `microphone ${audioInputSelect.length + 1}`;
      audioInputChecks.append($(`<label><input type="checkbox" name="microphone" value="${deviceInfo.deviceId}">${label}</label><br>`));
    } else if (deviceInfo.kind === 'audiooutput') {
      //var label = deviceInfo.label || `speaker ${audioOutputSelect.length + 1}`;
      //audioOutputSelect.append($(`<option value="${deviceInfo.deviceId}">${label}</option>`));
    } else if (deviceInfo.kind === 'videoinput') {
      var label = deviceInfo.label || `camera ${videoSelect.length + 1}`;
      videoSelect.append($(`<option value="${deviceInfo.deviceId}">${label}</option>`));
    } else {
      console.log('Some other kind of source/device: ', deviceInfo);
    }
  }
  if(navigator.mediaDevices.getDisplayMedia)
    videoSelect.append($(`<option value="screen">Screen</option>`));
}

function setMediaSources(){
  navigator.mediaDevices.enumerateDevices().then(gotDevices).catch(handleError);
}

$(document).ready(function(){

  host = findGetParameter('host');
  if(host) peerID = `DRRR${host}`;
  else peerID = randomPeerID();

  $('#setID').click(function(){
    // TODO:clear window.call?
    input = prompt("Input your peerID");
    if(input){
      peerID = input;
      initialize();
    }
    else{
      peerID = null;
      $('#id').text('Please set your ID');
    }
  });

  $('#inviteRemote').click(function(){
    if(peerID){
      ctrlRoom({
        'message': 'Click to call me',
        'url': `https://drrrchatbots.gitee.io${location.pathname}?invite=${peerID}`,
      })
    }
    else alert("Please set your ID");
  })

  $('#setRemoteID').click(function(){
    // TODO:clear window.call?
    id = prompt("Input your peerID");
    if(id){
      remote = id;
      $('#remote-id').text(remote);
    }
    else{
      remote = null;
      $('#remote-id').text('Please set remote ID');
    }
  });

  $('#callRemote').click(function(){
    if(remote) join(remote);
    else alert("Please set remote ID");
  });

  $('#endCall').click(function(){
    if(window.call) window.call.close();
    else alert("There's no call now");
  })

  $('#complete').click(function(){
    getStream(getConfig(),
      function success(stream) {
        window.localStream = stream;
        $('#stream-ui').hide();
        $('#chat-ui').show();
        if(!peer) initialize();
      },
      function error(e) {
        //alert("No Mic, so you cannot call peer, please close the tab");
        alert("stream error: " + e);
        console.log(e);
      });
  });

  $('#setup').click(function(){
    //window.location.reload();
    $('#chat-ui').hide();
    $('#stream-ui').show();
    if(window.call) window.call.close();
    if (window.localStream) {
      window.localStream.getTracks().forEach(track => track.stop());
      window.localStream = null;
    }
  });

  $('#stream-setting-form').submit(()=>false);
  $('#chat-setting-form').submit(()=>false);

  remote = findGetParameter('invite') || findGetParameter('wait');

  setMediaSources();
});