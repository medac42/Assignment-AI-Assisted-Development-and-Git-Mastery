/* SteamVault — AI Game Generator (Multi-step OpenRouter + Cohere fallback) */

async function playGame(idx) {
  var game = state.library[idx];
  if (!game) return;
  showPage('play');
  document.getElementById('play-game-name').textContent = game.name;
  document.getElementById('play-loading').style.display = 'flex';
  document.getElementById('play-loading-title').textContent = 'Generating ' + game.name + '...';
  document.getElementById('play-loading-sub').textContent = 'Fetching game info...';
  document.getElementById('play-loading-model').textContent = '';
  document.getElementById('play-iframe').srcdoc = '';

  // Step 0: Fetch real game info from Steam
  var gameInfo = null;
  if (game.steamAppID) {
    try {
      var infoRes = await fetch('/api/steam-info?appid=' + game.steamAppID);
      if (infoRes.ok) gameInfo = await infoRes.json();
    } catch (e) { console.warn('Steam info fetch failed:', e); }
  }

  // Show game logo in loading screen
  var logoEl = document.getElementById('play-loading-logo');
  if (game.steamAppID) {
    logoEl.src = 'https://cdn.cloudflare.steamstatic.com/steam/apps/' + game.steamAppID + '/header.jpg';
    logoEl.style.display = 'block';
    logoEl.onerror = function() { logoEl.style.display = 'none'; };
  } else if (game.image) {
    logoEl.src = game.image;
    logoEl.style.display = 'block';
    logoEl.onerror = function() { logoEl.style.display = 'none'; };
  } else {
    logoEl.style.display = 'none';
  }

  var html = null;
  var prompt = buildFullPrompt(game.name, gameInfo);
  var system = 'You make fun 2D HTML5 canvas games. Output ONLY the HTML code. No markdown, no explanation.';

  // 1. Try Groq first (ultra-fast, 5-10s)
  updateLoading('Groq (fast)', 'Generating...');
  try {
    html = await callGroqWithTimeout(system, prompt, 'llama-3.3-70b-versatile', 30000);
    if (html && html.length > 500 && html.indexOf('<') >= 0) {
      console.log('Groq success! (' + html.length + ' chars)');
    } else {
      console.warn('Groq: response too short');
      html = null;
    }
  } catch (e) {
    console.warn('Groq failed:', e.message);
    html = null;
  }

  // 2. Fallback: OpenRouter free models
  if (!html) {
    var models = [
      { id: 'inclusionai/ring-2.6-1t:free', name: 'Ring 1T' },
      { id: 'poolside/laguna-m.1:free', name: 'Laguna M.1' },
      { id: 'openai/gpt-oss-120b:free', name: 'GPT-OSS 120B' },
      { id: 'poolside/laguna-xs.2:free', name: 'Laguna XS.2' },
      { id: 'minimax/minimax-m2.5:free', name: 'MiniMax M2.5' }
    ];

    for (var m = 0; m < models.length; m++) {
      updateLoading(models[m].name, 'Generating...');
      try {
        html = await callAIWithTimeout(system, prompt, models[m].id, 90000);
        if (html && html.length > 500 && html.indexOf('<') >= 0) {
          console.log(models[m].name + ' success! (' + html.length + ' chars)');
          break;
        }
        console.warn(models[m].name + ': response too short or invalid');
        html = null;
      } catch (e) {
        console.warn(models[m].name + ':', e.message);
        html = null;
      }
    }
  }

  document.getElementById('play-loading').style.display = 'none';
  var valid = html && html.length > 500 && html.indexOf('<') >= 0;
  document.getElementById('play-iframe').srcdoc = valid ? cleanHTML(html) : themedFallbackGame(game.name);
}




// Build context from Steam data
function buildGameContext(name, info) {
  if (!info) return '"' + name + '"';
  var ctx = '"' + name + '"';
  if (info.short_description) ctx += ' — ' + info.short_description;
  if (info.genres) ctx += ' (' + info.genres + ')';
  return ctx;
}

function buildFullPrompt(name, gameInfo) {
  var ctx = buildGameContext(name, gameInfo);
  return 'Make a simple, fun 2D canvas mini-game that plays like a mini version of ' + ctx + '. ' +
    'Use real elements from the actual game (characters, items, tools, places, mechanics). ' +
    'Keep it simple but playable. Title screen with "' + name + '" and press ENTER. ' +
    'Score, game over, restart. Canvas fills viewport. ' +
    'Start with <!DOCTYPE html>. Single HTML file.';
}

function updateLoading(model, sub) {
  document.getElementById('play-loading-model').textContent = model;
  document.getElementById('play-loading-sub').textContent = sub;
}

// Single-shot AI call with timeout
async function callAIWithTimeout(system, prompt, model, timeoutMs) {
  var controller = new AbortController();
  var timer = setTimeout(function() { controller.abort(); }, timeoutMs);

  try {
    var res = await fetch('/api/openrouter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt }
        ],
        max_tokens: 16000,
        temperature: 0.7
      })
    });
    clearTimeout(timer);
    if (!res.ok) {
      var errText = await res.text();
      throw new Error(res.status + ': ' + errText.substring(0, 200));
    }
    var json = await res.json();
    if (json.choices && json.choices[0] && json.choices[0].message) {
      return json.choices[0].message.content;
    }
    if (json.error) throw new Error(json.error.message);
    return '';
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new Error('Timeout (' + (timeoutMs/1000) + 's)');
    throw e;
  }
}


// Groq call (ultra-fast LPU inference)
async function callGroqWithTimeout(system, prompt, model, timeoutMs) {
  var controller = new AbortController();
  var timer = setTimeout(function() { controller.abort(); }, timeoutMs);
  try {
    var res = await fetch('/api/groq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt }
        ],
        max_tokens: 8000,
        temperature: 0.7
      })
    });
    clearTimeout(timer);
    if (!res.ok) {
      var errText = await res.text();
      throw new Error(res.status + ': ' + errText.substring(0, 200));
    }
    var json = await res.json();
    if (json.choices && json.choices[0] && json.choices[0].message) {
      return json.choices[0].message.content;
    }
    if (json.error) throw new Error(json.error.message);
    return '';
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new Error('Timeout (' + (timeoutMs/1000) + 's)');
    throw e;
  }
}

function cleanHTML(h) {
  h = h.replace(/```html\s*/gi, '').replace(/```\s*/g, '');
  var s = h.indexOf('<!DOCTYPE'); if (s < 0) s = h.indexOf('<!doctype'); if (s < 0) s = h.indexOf('<html');
  if (s >= 0) h = h.substring(s);
  var e = h.lastIndexOf('</html>'); if (e >= 0) h = h.substring(0, e + 7);
  return h;
}

// Themed fallback
function themedFallbackGame(name) {
  var hash = 0;
  for (var i = 0; i < name.length; i++) hash = ((hash << 5) - hash) + name.charCodeAt(i);
  var hue = Math.abs(hash) % 360, bg = 'hsl(' + hue + ',20%,8%)', pc = 'hsl(' + hue + ',70%,55%)', ac = 'hsl(' + ((hue+120)%360) + ',70%,55%)', bc = 'hsl(' + ((hue+60)%360) + ',80%,60%)';

  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + name + '</title>' +
    '<style>*{margin:0;padding:0}body{overflow:hidden;background:' + bg + '}canvas{display:block}</style></head>' +
    '<body><canvas id="c"></canvas><script>' +
    'var c=document.getElementById("c"),g=c.getContext("2d");c.width=innerWidth;c.height=innerHeight;' +
    'addEventListener("resize",function(){c.width=innerWidth;c.height=innerHeight});' +
    'var W=c.width,H=c.height,px=W/2,py=H/2,pa=0,score=0,hp=100,maxHp=100,wave=1,kills=0,' +
    'enemies=[],bullets=[],particles=[],pickups=[],keys={},started=false,dead=false,cooldown=0,special=30,maxSpecial=30,' +
    'mx=W/2,my=H/2,camX=0,camY=0,tick=0;' +
    'var TITLE="' + name.replace(/"/g,'\\"') + '",PCOL="' + pc + '",ACOL="' + ac + '",BCOL="' + bc + '";' +
    'addEventListener("keydown",function(e){keys[e.key.toLowerCase()]=true;' +
    'if(e.key==="Enter"&&(!started||dead)){started=true;dead=false;hp=maxHp;score=0;wave=1;kills=0;enemies=[];bullets=[];particles=[];pickups=[];special=maxSpecial;px=W/2;py=H/2}' +
    'if(e.key===" "&&started&&!dead&&special>=maxSpecial){special=0;for(var i=0;i<16;i++){var a=Math.PI*2*i/16;bullets.push({x:px,y:py,dx:Math.cos(a)*10,dy:Math.sin(a)*10,life:30,sp:true})}addP(px,py,ACOL,20)}e.preventDefault()});' +
    'addEventListener("keyup",function(e){keys[e.key.toLowerCase()]=false});' +
    'addEventListener("mousemove",function(e){mx=e.clientX;my=e.clientY});' +
    'addEventListener("click",function(e){if(!started||dead||cooldown>0)return;cooldown=8;var a=Math.atan2(my-H/2,mx-W/2);bullets.push({x:px,y:py,dx:Math.cos(a)*12,dy:Math.sin(a)*12,life:50,sp:false});addP(px,py,BCOL,3)});' +
    'function addP(x,y,col,n){for(var i=0;i<n;i++){var a=Math.random()*Math.PI*2,s=Math.random()*4+1;particles.push({x:x,y:y,dx:Math.cos(a)*s,dy:Math.sin(a)*s,life:20+Math.random()*20,col:col,sz:Math.random()*3+1})}}' +
    'function spawnE(){var a=Math.random()*Math.PI*2,d=600,ex=px+Math.cos(a)*d,ey=py+Math.sin(a)*d,t=Math.random();' +
    'if(t<.6)enemies.push({x:ex,y:ey,hp:3+wave,mhp:3+wave,sz:10+wave,spd:1.5+wave*.15,col:"hsl("+((Math.random()*60+' + hue + ')%360)+",60%,45%)",type:0,dmg:1});' +
    'else if(t<.85)enemies.push({x:ex,y:ey,hp:6+wave*2,mhp:6+wave*2,sz:16+wave,spd:.8,col:"hsl(' + ((hue+180)%360) + ',50%,35%)",type:1,dmg:2});' +
    'else enemies.push({x:ex,y:ey,hp:2+wave,mhp:2+wave,sz:8,spd:2.5+wave*.2,col:"hsl(' + ((hue+90)%360) + ',70%,55%)",type:2,dmg:1})}' +
    'function spawnPk(x,y){if(Math.random()<.3)pickups.push({x:x,y:y,type:Math.random()<.5?0:1,life:300})}' +
    'var stars=[];for(var i=0;i<100;i++)stars.push({x:Math.random()*3e3-1500,y:Math.random()*3e3-1500,s:Math.random()*1.5+.5});' +
    'function loop(){requestAnimationFrame(loop);W=c.width;H=c.height;g.fillStyle="' + bg + '";g.fillRect(0,0,W,H);' +
    'if(!started){g.textAlign="center";g.fillStyle=PCOL;g.font="bold 32px monospace";g.fillText(TITLE,W/2,H/2-50);g.fillStyle="#c7d5e0";g.font="16px monospace";g.fillText("Press ENTER to start",W/2,H/2);g.fillText("WASD / Click / Space",W/2,H/2+30);return}' +
    'if(dead){g.textAlign="center";g.fillStyle="#e74c3c";g.font="bold 28px monospace";g.fillText("GAME OVER",W/2,H/2-30);g.fillStyle="#c7d5e0";g.font="18px monospace";g.fillText("Score:"+score+" Wave:"+wave,W/2,H/2+10);g.fillText("ENTER restart",W/2,H/2+45);return}' +
    'tick++;if(cooldown>0)cooldown--;if(special<maxSpecial)special+=.05;' +
    'var spd=4;if(keys.w||keys.arrowup)py-=spd;if(keys.s||keys.arrowdown)py+=spd;if(keys.a||keys.arrowleft)px-=spd;if(keys.d||keys.arrowright)px+=spd;' +
    'pa=Math.atan2(my-H/2,mx-W/2);camX+=(px-W/2-camX)*.1;camY+=(py-H/2-camY)*.1;' +
    'if(tick%Math.max(15,60-wave*3)===0)spawnE();if(kills>=5+wave*3){wave++;kills=0;maxHp+=5;hp=Math.min(hp+20,maxHp);addP(px,py,"#fff",15)}' +
    'g.fillStyle="rgba(255,255,255,.3)";for(var i=0;i<stars.length;i++){var sx=((stars[i].x-camX)%W+W)%W,sy=((stars[i].y-camY)%H+H)%H;g.fillRect(sx,sy,stars[i].s,stars[i].s)}' +
    'for(var i=pickups.length-1;i>=0;i--){var p=pickups[i];p.life--;var sx=p.x-camX,sy=p.y-camY;g.fillStyle=p.type===0?"#a4d007":"#67c1f5";g.beginPath();g.arc(sx,sy,6+Math.sin(tick*.1)*2,0,Math.PI*2);g.fill();var dx=px-p.x,dy=py-p.y;if(Math.sqrt(dx*dx+dy*dy)<20){if(p.type===0)hp=Math.min(hp+15,maxHp);else special=maxSpecial;pickups.splice(i,1);addP(p.x,p.y,"#fff",8);continue}if(p.life<=0)pickups.splice(i,1)}' +
    'for(var i=bullets.length-1;i>=0;i--){var b=bullets[i];b.x+=b.dx;b.y+=b.dy;b.life--;g.fillStyle=b.sp?ACOL:BCOL;g.beginPath();g.arc(b.x-camX,b.y-camY,b.sp?4:3,0,Math.PI*2);g.fill();if(b.life<=0)bullets.splice(i,1)}' +
    'for(var i=enemies.length-1;i>=0;i--){var e=enemies[i],a=Math.atan2(py-e.y,px-e.x);e.x+=Math.cos(a)*e.spd;e.y+=Math.sin(a)*e.spd;var sx=e.x-camX,sy=e.y-camY;' +
    'var hp2=e.hp/e.mhp;g.fillStyle="rgba(0,0,0,.5)";g.fillRect(sx-e.sz,sy-e.sz-6,e.sz*2,3);g.fillStyle=hp2>.5?"#a4d007":"#e74c3c";g.fillRect(sx-e.sz,sy-e.sz-6,e.sz*2*hp2,3);' +
    'g.fillStyle=e.col;g.beginPath();if(e.type===1)g.fillRect(sx-e.sz,sy-e.sz,e.sz*2,e.sz*2);else if(e.type===2){g.moveTo(sx,sy-e.sz);g.lineTo(sx+e.sz,sy+e.sz);g.lineTo(sx-e.sz,sy+e.sz);g.closePath();g.fill()}else{g.arc(sx,sy,e.sz,0,Math.PI*2);g.fill()}' +
    'var dx=px-e.x,dy=py-e.y;if(Math.sqrt(dx*dx+dy*dy)<e.sz+10){hp-=e.dmg;addP(px,py,"#e74c3c",5);if(hp<=0)dead=true}' +
    'for(var j=bullets.length-1;j>=0;j--){var b=bullets[j];if(Math.sqrt((b.x-e.x)**2+(b.y-e.y)**2)<e.sz+4){e.hp-=b.sp?2:1;bullets.splice(j,1);addP(e.x,e.y,e.col,4);if(e.hp<=0){enemies.splice(i,1);score+=e.type===1?25:e.type===2?15:10;kills++;spawnPk(e.x,e.y);addP(e.x,e.y,e.col,12);break}}}}' +
    'for(var i=particles.length-1;i>=0;i--){var p=particles[i];p.x+=p.dx;p.y+=p.dy;p.dx*=.95;p.dy*=.95;p.life--;g.globalAlpha=p.life/30;g.fillStyle=p.col;g.beginPath();g.arc(p.x-camX,p.y-camY,p.sz,0,Math.PI*2);g.fill();g.globalAlpha=1;if(p.life<=0)particles.splice(i,1)}' +
    'var ppx=px-camX,ppy=py-camY;g.save();g.translate(ppx,ppy);g.rotate(pa);g.fillStyle=PCOL;g.beginPath();g.moveTo(12,0);g.lineTo(-8,-7);g.lineTo(-8,7);g.closePath();g.fill();g.fillStyle="rgba(255,255,255,.3)";g.beginPath();g.arc(0,0,14,0,Math.PI*2);g.fill();g.restore();' +
    'g.fillStyle="rgba(0,0,0,.6)";g.fillRect(8,8,210,50);g.fillStyle="#2a475e";g.fillRect(12,12,200,10);g.fillStyle=hp>30?PCOL:"#e74c3c";g.fillRect(12,12,Math.max(0,hp/maxHp*200),10);' +
    'g.fillStyle="#1b2838";g.fillRect(12,26,200,8);g.fillStyle=ACOL;g.fillRect(12,26,Math.min(special/maxSpecial,1)*200,8);' +
    'g.fillStyle="#c7d5e0";g.font="10px monospace";g.textAlign="left";g.fillText("HP:"+Math.ceil(hp)+"/"+maxHp,14,48);g.fillText("Wave:"+wave,90,48);g.textAlign="right";g.fillText("Score:"+score,214,48);' +
    'var mmx=W-70,mmy=10;g.fillStyle="rgba(0,0,0,.5)";g.fillRect(mmx,mmy,60,60);g.fillStyle=PCOL;g.fillRect(mmx+29,mmy+29,3,3);' +
    'for(var i=0;i<enemies.length;i++){var ex=(enemies[i].x-px)/20+30,ey=(enemies[i].y-py)/20+30;if(ex>0&&ex<60&&ey>0&&ey<60){g.fillStyle=enemies[i].col;g.fillRect(mmx+ex,mmy+ey,2,2)}}' +
    '}loop();<\\/script></body></html>';
}

function togglePlayFullscreen() {
  var el = document.getElementById('play-iframe');
  if (el.requestFullscreen) el.requestFullscreen();
  else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
}
