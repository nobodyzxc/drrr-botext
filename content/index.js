$(document).ready(function(){
  chrome.storage.sync.get('#login-mode', (config)=>{
    if(!config['#login-mode']){
      config['#login-mode'] = 'Bot';
      chrome.storage.sync.set({'#login-mode': 'Bot'});
    }
    $(this).val(config['#login-mode'])
    $('.home-name').append(`
      <select id="login-mode" name="conv_mode" class="home-name-input" style="width:100px" title="select login mode">
          <option value="Bot"     ${config['#login-mode'] == 'Bot' ? 'selected' : ''}  >bot</option>
          <option value="Tv"      ${config['#login-mode'] == 'Tv' ? 'selected' : ''}  >tv</option>
          <option value="Tablet"  ${config['#login-mode'] == 'Tablet' ? 'selected' : ''}  >tablet</option>
          <option value="Mobile"  ${config['#login-mode'] == 'Mobile' ? 'selected' : ''}  >phone</option>
          <option value="Desktop" ${config['#login-mode'] == 'Desktop' ? 'selected' : ''}  >desktop</option>
      </select>
    `)
  });

  $('.home-name').delegate('#login-mode', 'change', function(){
    chrome.storage.sync.set({'#login-mode': $(this).val()});
  });

  chrome.runtime.sendMessage({ clearNotes: true, pattern:'' });
  //'https://drrr.com/room/.*'
  chrome.storage.sync.get(
    ['profile', 'cookie'],
    (config)=>{
      if(config['profile'] && config['cookie']){
        chrome.runtime.sendMessage(
          { setCookies: true, cookies: config['cookie'] }
        )
      }
      else if(config['profile'] || config['cookie']){
        chrome.storage.sync.remove(['profile', 'cookie']);
      }
    }
  );
});

chrome.runtime.onMessage.addListener((req, sender, callback) => {
  if(req.cookieDone){
    ajaxProfile(function(p, err){
    if(p) location.reload()
    else{
      alert(`Bio Expired ${JSON.stringify(err)}`);
      chrome.storage.sync.remove(['profile', 'cookie']);
      chrome.runtime.sendMessage({expired_bio: true});
    }
  }, true, 'login');
  }
});
