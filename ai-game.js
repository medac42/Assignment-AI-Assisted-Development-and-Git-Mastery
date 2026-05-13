/* SteamVault — AI Game Generator via Puter.js
   Uses puter.ai.chat() with fast models. Falls back to themed procedural game. */

function buildGamePrompt(name) {
  return 'Create a COMPLETE self-contained HTML file for a top-down 2D canvas game based on "' + name + '". ' +
    'Include accurate characters, enemies, weapons from the real game. Use its color palette. ' +
    'Canvas fills viewport. WASD move, click shoot, Space special. HUD with HP and score. ' +
    'Title screen, game over screen, increasing difficulty. Particle effects. ' +
    'Output ONLY raw HTML starting with <!DOCTYPE html>. No markdown. No explanation.';
}

async function playGame(idx) {
  var game = state.library[idx];
  if (!game) return;
  showPage('play');
  document.getElementById('play-game-name').textContent = game.name;
  document.getElementById('play-loading').style.display = 'flex';
  document.getElementById('play-loading-title').textContent = 'Generating ' + game.name + '...';
  document.getElementById('play-loading-sub').textContent = 'Connecting to AI...';
  document.getElementById('play-loading-model').textContent = '';
  document.getElementById('play-iframe').srcdoc = '';

  var html = null;
  var models = ['gpt-4o-mini', 'claude-3-5-haiku-20241022', 'gpt-4o', 'gemini-2.0-flash'];

  for (var m = 0; m < models.length; m++) {
    document.getElementById('play-loading-model').textContent = 'Model: ' + models[m] + (m > 0 ? ' (fallback)' : '');
    try {
      html = await callPuterChat(buildGamePrompt(game.name), models[m]);
      if (html && html.length > 300 && html.indexOf('<') >= 0) break;
      html = null;
    } catch (e) {
      console.warn(models[m] + ' failed:', e);
      html = null;
    }
  }

  document.getElementById('play-loading').style.display = 'none';
  if (html) {
    html = cleanHTML(html);
    document.getElementById('play-iframe').srcdoc = html;
  } else {
    document.getElementById('play-iframe').srcdoc = themedFallbackGame(game.name);
  }
}

async function callPuterChat(prompt, model) {
  if (typeof puter === 'undefined' || !puter.ai) throw new Error('Puter not loaded');
  document.getElementById('play-loading-sub').textContent = 'Generating with ' + model + '...';
  var res = await puter.ai.chat(prompt, { model: model });
  var text = '';
  if (typeof res === 'string') text = res;
  else if (res && res.message && res.message.content) {
    if (Array.isArray(res.message.content)) {
      for (var i = 0; i < res.message.content.length; i++) {
        if (res.message.content[i].type === 'text') text += res.message.content[i].text;
      }
    } else text = res.message.content;
  }
  return text;
}

function cleanHTML(h) {
  h = h.replace(/```html\s*/gi, '').replace(/```\s*/g, '');
  var s = h.indexOf('<!DOCTYPE'); if (s < 0) s = h.indexOf('<!doctype'); if (s < 0) s = h.indexOf('<html');
  if (s >= 0) h = h.substring(s);
  var e = h.lastIndexOf('</html>'); if (e >= 0) h = h.substring(0, e + 7);
  return h;
}

// Themed fallback game — uses game name to customize visuals
function themedFallbackGame(name) {
  // Hash name to get consistent colors per game
  var hash = 0;
  for (var i = 0; i < name.length; i++) hash = ((hash << 5) - hash) + name.charCodeAt(i);
  var hue = Math.abs(hash) % 360;
  var bg = 'hsl(' + hue + ',20%,8%)';
  var playerCol = 'hsl(' + hue + ',70%,55%)';
  var accentCol = 'hsl(' + ((hue + 120) % 360) + ',70%,55%)';
  var bulletCol = 'hsl(' + ((hue + 60) % 360) + ',80%,60%)';

  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + name + '</title>' +
    '<style>*{margin:0;padding:0}body{overflow:hidden;background:' + bg + '}canvas{display:block}</style></head>' +
    '<body><canvas id="c"></canvas><script>' +
    'var c=document.getElementById("c"),g=c.getContext("2d");' +
    'c.width=innerWidth;c.height=innerHeight;' +
    'addEventListener("resize",function(){c.width=innerWidth;c.height=innerHeight});' +
    'var W=c.width,H=c.height,px=W/2,py=H/2,pa=0,score=0,hp=100,maxHp=100,wave=1,kills=0,' +
    'enemies=[],bullets=[],particles=[],pickups=[],keys={},started=false,dead=false,cooldown=0,special=30,maxSpecial=30,' +
    'mx=W/2,my=H/2,camX=0,camY=0,tick=0;' +
    'var TITLE="' + name.replace(/"/g,'\\"') + '";' +
    'var PCOL="' + playerCol + '",ACOL="' + accentCol + '",BCOL="' + bulletCol + '";' +
    // Input
    'addEventListener("keydown",function(e){keys[e.key.toLowerCase()]=true;' +
    'if(e.key==="Enter"&&(!started||dead)){started=true;dead=false;hp=maxHp;score=0;wave=1;kills=0;enemies=[];bullets=[];particles=[];pickups=[];special=maxSpecial;px=W/2;py=H/2}' +
    'if(e.key===" "&&started&&!dead&&special>=maxSpecial){special=0;for(var i=0;i<16;i++){var a=Math.PI*2*i/16;bullets.push({x:px,y:py,dx:Math.cos(a)*10,dy:Math.sin(a)*10,life:30,sp:true});}addParticles(px,py,ACOL,20)}' +
    'e.preventDefault()});' +
    'addEventListener("keyup",function(e){keys[e.key.toLowerCase()]=false});' +
    'addEventListener("mousemove",function(e){mx=e.clientX;my=e.clientY});' +
    'addEventListener("click",function(e){if(!started||dead)return;if(cooldown>0)return;cooldown=8;' +
    'var a=Math.atan2(my-H/2,mx-W/2);bullets.push({x:px,y:py,dx:Math.cos(a)*12,dy:Math.sin(a)*12,life:50,sp:false});' +
    'addParticles(px,py,BCOL,3)});' +
    // Particles
    'function addParticles(x,y,col,n){for(var i=0;i<n;i++){var a=Math.random()*Math.PI*2,s=Math.random()*4+1;' +
    'particles.push({x:x,y:y,dx:Math.cos(a)*s,dy:Math.sin(a)*s,life:20+Math.random()*20,col:col,sz:Math.random()*3+1})}}' +
    // Spawn
    'function spawnEnemy(){var t=Math.random();var a=Math.random()*Math.PI*2,d=600;' +
    'var ex=px+Math.cos(a)*d,ey=py+Math.sin(a)*d;' +
    'if(t<0.6){enemies.push({x:ex,y:ey,hp:3+wave,mhp:3+wave,sz:10+wave,spd:1.5+wave*0.15,col:"hsl("+((Math.random()*60+' + hue + ')%360)+",60%,45%)",type:"chase",dmg:1})}' +
    'else if(t<0.85){enemies.push({x:ex,y:ey,hp:6+wave*2,mhp:6+wave*2,sz:16+wave,spd:0.8,col:"hsl(' + ((hue+180)%360) + ',50%,35%)",type:"tank",dmg:2})}' +
    'else{enemies.push({x:ex,y:ey,hp:2+wave,mhp:2+wave,sz:8,spd:2.5+wave*0.2,col:"hsl(' + ((hue+90)%360) + ',70%,55%)",type:"fast",dmg:1})}}' +
    // Pickup spawn
    'function spawnPickup(x,y){if(Math.random()<0.3){pickups.push({x:x,y:y,type:Math.random()<0.5?"hp":"special",life:300})}}' +
    // Draw stars background
    'var stars=[];for(var i=0;i<100;i++)stars.push({x:Math.random()*3000-1500,y:Math.random()*3000-1500,s:Math.random()*1.5+0.5});' +
    // Main loop
    'function loop(){requestAnimationFrame(loop);W=c.width;H=c.height;g.fillStyle="' + bg + '";g.fillRect(0,0,W,H);' +
    // Title
    'if(!started){g.save();g.textAlign="center";g.fillStyle=PCOL;g.font="bold 32px monospace";g.fillText(TITLE,W/2,H/2-50);' +
    'g.fillStyle="#c7d5e0";g.font="16px monospace";g.fillText("Press ENTER to start",W/2,H/2);' +
    'g.fillText("WASD move / Click shoot / Space special",W/2,H/2+30);' +
    'g.font="12px monospace";g.fillStyle="#556772";g.fillText("AI-generated tribute game",W/2,H/2+60);g.restore();return}' +
    // Game over
    'if(dead){g.save();g.textAlign="center";g.fillStyle="#e74c3c";g.font="bold 28px monospace";g.fillText("GAME OVER",W/2,H/2-30);' +
    'g.fillStyle="#c7d5e0";g.font="18px monospace";g.fillText("Score: "+score+" | Wave: "+wave,W/2,H/2+10);' +
    'g.font="14px monospace";g.fillStyle="#8f98a0";g.fillText("Press ENTER to restart",W/2,H/2+45);g.restore();return}' +
    // Update
    'tick++;if(cooldown>0)cooldown--;if(special<maxSpecial)special+=0.05;' +
    'var spd=4;if(keys.w||keys.arrowup)py-=spd;if(keys.s||keys.arrowdown)py+=spd;' +
    'if(keys.a||keys.arrowleft)px-=spd;if(keys.d||keys.arrowright)px+=spd;' +
    'pa=Math.atan2(my-H/2,mx-W/2);' +
    'camX+=(px-W/2-camX)*0.1;camY+=(py-H/2-camY)*0.1;' +
    'var spawnRate=Math.max(15,60-wave*3);if(tick%spawnRate===0)spawnEnemy();' +
    'if(kills>=5+wave*3){wave++;kills=0;maxHp+=5;hp=Math.min(hp+20,maxHp);addParticles(px,py,"#fff",15)}' +
    // Draw stars
    'g.fillStyle="rgba(255,255,255,0.3)";for(var i=0;i<stars.length;i++){var sx=stars[i].x-camX,sy=stars[i].y-camY;' +
    'sx=((sx%W)+W)%W;sy=((sy%H)+H)%H;g.fillRect(sx,sy,stars[i].s,stars[i].s)}' +
    // Draw grid
    'g.strokeStyle="rgba(255,255,255,0.03)";g.lineWidth=1;var gs=80;' +
    'for(var gx=-camX%gs;gx<W;gx+=gs){g.beginPath();g.moveTo(gx,0);g.lineTo(gx,H);g.stroke()}' +
    'for(var gy=-camY%gs;gy<H;gy+=gs){g.beginPath();g.moveTo(0,gy);g.lineTo(W,gy);g.stroke()}' +
    // Pickups
    'for(var i=pickups.length-1;i>=0;i--){var p=pickups[i];p.life--;var sx=p.x-camX,sy=p.y-camY;' +
    'g.fillStyle=p.type==="hp"?"#a4d007":"#67c1f5";g.beginPath();g.arc(sx,sy,6+Math.sin(tick*0.1)*2,0,Math.PI*2);g.fill();' +
    'var dx=px-p.x,dy=py-p.y;if(Math.sqrt(dx*dx+dy*dy)<20){if(p.type==="hp")hp=Math.min(hp+15,maxHp);else special=maxSpecial;pickups.splice(i,1);addParticles(p.x,p.y,"#fff",8);continue}' +
    'if(p.life<=0)pickups.splice(i,1)}' +
    // Bullets
    'for(var i=bullets.length-1;i>=0;i--){var b=bullets[i];b.x+=b.dx;b.y+=b.dy;b.life--;' +
    'var sx=b.x-camX,sy=b.y-camY;g.fillStyle=b.sp?ACOL:BCOL;g.beginPath();g.arc(sx,sy,b.sp?4:3,0,Math.PI*2);g.fill();' +
    'if(b.life<=0)bullets.splice(i,1)}' +
    // Enemies
    'for(var i=enemies.length-1;i>=0;i--){var e=enemies[i];var a=Math.atan2(py-e.y,px-e.x);' +
    'e.x+=Math.cos(a)*e.spd;e.y+=Math.sin(a)*e.spd;' +
    'var sx=e.x-camX,sy=e.y-camY;' +
    // HP bar
    'var hpPct=e.hp/e.mhp;g.fillStyle="rgba(0,0,0,0.5)";g.fillRect(sx-e.sz,sy-e.sz-6,e.sz*2,3);' +
    'g.fillStyle=hpPct>0.5?"#a4d007":"#e74c3c";g.fillRect(sx-e.sz,sy-e.sz-6,e.sz*2*hpPct,3);' +
    // Body
    'g.fillStyle=e.col;g.beginPath();' +
    'if(e.type==="tank"){g.fillRect(sx-e.sz,sy-e.sz,e.sz*2,e.sz*2)}' +
    'else if(e.type==="fast"){g.moveTo(sx,sy-e.sz);g.lineTo(sx+e.sz,sy+e.sz);g.lineTo(sx-e.sz,sy+e.sz);g.closePath();g.fill()}' +
    'else{g.arc(sx,sy,e.sz,0,Math.PI*2);g.fill()}' +
    // Player collision
    'var dx=px-e.x,dy=py-e.y,dist=Math.sqrt(dx*dx+dy*dy);' +
    'if(dist<e.sz+10){hp-=e.dmg;addParticles(px,py,"#e74c3c",5);if(hp<=0){dead=true}}' +
    // Bullet collision
    'for(var j=bullets.length-1;j>=0;j--){var b=bullets[j];var bx=b.x-e.x,by=b.y-e.y;' +
    'if(Math.sqrt(bx*bx+by*by)<e.sz+4){e.hp-=(b.sp?2:1);bullets.splice(j,1);addParticles(e.x,e.y,e.col,4);' +
    'if(e.hp<=0){enemies.splice(i,1);score+=e.type==="tank"?25:e.type==="fast"?15:10;kills++;spawnPickup(e.x,e.y);addParticles(e.x,e.y,e.col,12);break}}}}' +
    // Particles
    'for(var i=particles.length-1;i>=0;i--){var p=particles[i];p.x+=p.dx;p.y+=p.dy;p.dx*=0.95;p.dy*=0.95;p.life--;' +
    'var sx=p.x-camX,sy=p.y-camY;g.globalAlpha=p.life/30;g.fillStyle=p.col;g.beginPath();g.arc(sx,sy,p.sz,0,Math.PI*2);g.fill();g.globalAlpha=1;' +
    'if(p.life<=0)particles.splice(i,1)}' +
    // Player
    'var ppx=px-camX,ppy=py-camY;' +
    'g.save();g.translate(ppx,ppy);g.rotate(pa);g.fillStyle=PCOL;g.beginPath();g.moveTo(12,0);g.lineTo(-8,-7);g.lineTo(-8,7);g.closePath();g.fill();' +
    'g.fillStyle="rgba(255,255,255,0.3)";g.beginPath();g.arc(0,0,14,0,Math.PI*2);g.fill();g.restore();' +
    // HUD
    'g.fillStyle="rgba(0,0,0,0.6)";g.fillRect(8,8,210,50);g.strokeStyle="rgba(255,255,255,0.1)";g.strokeRect(8,8,210,50);' +
    'g.fillStyle="#2a475e";g.fillRect(12,12,200,10);g.fillStyle=hp>30?PCOL:"#e74c3c";g.fillRect(12,12,Math.max(0,hp/maxHp*200),10);' +
    'g.fillStyle="#1b2838";g.fillRect(12,26,200,8);g.fillStyle=ACOL;g.fillRect(12,26,Math.min(special/maxSpecial,1)*200,8);' +
    'g.fillStyle="#c7d5e0";g.font="10px monospace";g.textAlign="left";g.fillText("HP: "+Math.ceil(hp)+"/"+maxHp,14,48);' +
    'g.fillText("Wave: "+wave,90,48);g.textAlign="right";g.fillText("Score: "+score,214,48);' +
    // Minimap
    'var mmx=W-70,mmy=10,mms=60;g.fillStyle="rgba(0,0,0,0.5)";g.fillRect(mmx,mmy,mms,mms);g.strokeStyle="rgba(255,255,255,0.1)";g.strokeRect(mmx,mmy,mms,mms);' +
    'g.fillStyle=PCOL;g.fillRect(mmx+mms/2-1,mmy+mms/2-1,3,3);' +
    'for(var i=0;i<enemies.length;i++){var e=enemies[i];var ex=(e.x-px)/20+mms/2,ey=(e.y-py)/20+mms/2;' +
    'if(ex>0&&ex<mms&&ey>0&&ey<mms){g.fillStyle=e.col;g.fillRect(mmx+ex,mmy+ey,2,2)}}' +
    '}loop();' +
    '<\/script></body></html>';
}

function togglePlayFullscreen() {
  var el = document.getElementById('play-iframe');
  if (el.requestFullscreen) el.requestFullscreen();
  else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
}
