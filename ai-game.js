/* SteamVault — AI Game Generator
   Uses Puter.js puter.ai.chat() to generate top-down HTML games.
   No CORS issues since Puter handles the API calls. */

// Build the prompt for game generation
function buildGamePrompt(gameName) {
  return 'You are an expert game developer. Create a COMPLETE, SELF-CONTAINED HTML file (with inline CSS and JavaScript) for a top-down 2D game inspired by "' + gameName + '".\n\n' +
    'REQUIREMENTS:\n' +
    '- Research and include accurate lore, characters, abilities and visual style from "' + gameName + '"\n' +
    '- Use HTML5 Canvas for rendering\n' +
    '- Top-down perspective (bird\'s eye view)\n' +
    '- The player character must be recognizable from the original game\n' +
    '- Include at least 3 enemy types faithful to the original game\n' +
    '- Include the main character\'s signature abilities/weapons\n' +
    '- Color palette and visual style must match the original game\'s aesthetic\n' +
    '- Controls: WASD or Arrow keys to move, Space to attack/shoot, E for special ability\n' +
    '- HUD showing: health bar, score, ability cooldown\n' +
    '- Include a title screen with the game name and "Press ENTER to start"\n' +
    '- Include game over screen with score\n' +
    '- Procedural enemy spawning with increasing difficulty\n' +
    '- Collision detection and combat mechanics\n' +
    '- Sound effects using Web Audio API (synthesized, no external files)\n' +
    '- Particle effects for attacks and explosions\n' +
    '- The canvas should fill the entire viewport (100vw x 100vh)\n' +
    '- Background should represent an iconic location from the game\n' +
    '- Include mini-map in corner\n\n' +
    'CRITICAL: Output ONLY the complete HTML file. No explanations, no markdown, no code fences. Start with <!DOCTYPE html> and end with </html>.';
}

// Main function to generate and play a game
async function playGame(libraryIndex) {
  var game = state.library[libraryIndex];
  if (!game) return;

  showPage('play');
  document.getElementById('play-game-name').textContent = game.name;
  document.getElementById('play-loading').style.display = 'flex';
  document.getElementById('play-loading-title').textContent = 'Generating ' + game.name + '...';
  document.getElementById('play-loading-sub').textContent = 'Analyzing game lore, characters and mechanics via AI';
  document.getElementById('play-loading-model').textContent = '';
  document.getElementById('play-iframe').srcdoc = '';

  var prompt = buildGamePrompt(game.name);
  var html = null;

  // Try Puter.js AI chat (no CORS issues)
  var models = [
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' }
  ];

  for (var m = 0; m < models.length; m++) {
    var model = models[m];
    document.getElementById('play-loading-model').textContent = 'Model: ' + model.name + (m > 0 ? ' (fallback ' + m + ')' : '');
    document.getElementById('play-loading-sub').textContent = 'Connecting to ' + model.name + '...';

    try {
      html = await callPuterAI(prompt, model.id);
      if (html && html.indexOf('<') >= 0 && html.length > 500) break;
      html = null;
    } catch (e) {
      console.warn('Model ' + model.name + ' failed:', e);
      html = null;
    }
  }

  document.getElementById('play-loading').style.display = 'none';

  if (html) {
    html = cleanGeneratedHTML(html);
    document.getElementById('play-iframe').srcdoc = html;
  } else {
    document.getElementById('play-iframe').srcdoc = buildFallbackGame(game.name);
  }
}

// Call Puter.js AI chat
async function callPuterAI(prompt, modelId) {
  if (typeof puter === 'undefined' || !puter.ai || !puter.ai.chat) {
    throw new Error('Puter.js not loaded');
  }

  document.getElementById('play-loading-sub').textContent = 'Generating game code...';

  var response = await puter.ai.chat(prompt, { model: modelId });

  // Extract text from response
  var text = '';
  if (typeof response === 'string') {
    text = response;
  } else if (response && response.message && response.message.content) {
    // Standard response format
    if (Array.isArray(response.message.content)) {
      for (var i = 0; i < response.message.content.length; i++) {
        var part = response.message.content[i];
        if (part.type === 'text') text += part.text;
      }
    } else {
      text = response.message.content;
    }
  } else if (response && response.text) {
    text = response.text;
  }

  document.getElementById('play-loading-sub').textContent = 'Received ' + Math.round(text.length / 1024) + 'KB of code';
  return text;
}

// Clean up generated HTML
function cleanGeneratedHTML(html) {
  html = html.replace(/```html\s*/gi, '').replace(/```\s*/g, '');
  var start = html.indexOf('<!DOCTYPE');
  if (start < 0) start = html.indexOf('<!doctype');
  if (start < 0) start = html.indexOf('<html');
  if (start >= 0) html = html.substring(start);
  var end = html.lastIndexOf('</html>');
  if (end >= 0) html = html.substring(0, end + 7);
  return html;
}

// Fallback game if all AI models fail
function buildFallbackGame(name) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + name + '</title><style>' +
    '*{margin:0;padding:0}body{background:#111;overflow:hidden}canvas{display:block}</style></head><body><canvas id="c"></canvas><script>' +
    'var c=document.getElementById("c"),x=c.getContext("2d");c.width=innerWidth;c.height=innerHeight;' +
    'var px=c.width/2,py=c.height/2,score=0,hp=100,enemies=[],bullets=[],keys={},started=false,dead=false;' +
    'var title="' + name.replace(/"/g, '\\"') + '";' +
    'function rand(a,b){return Math.random()*(b-a)+a}' +
    'function spawnEnemy(){var a=Math.random()*Math.PI*2,d=500;enemies.push({x:px+Math.cos(a)*d,y:py+Math.sin(a)*d,hp:3,sz:12,spd:rand(1,2.5),col:"hsl("+rand(0,360)+",70%,50%)"})}' +
    'addEventListener("keydown",function(e){keys[e.key]=true;if(e.key==="Enter"&&(!started||dead)){started=true;dead=false;hp=100;score=0;enemies=[];bullets=[]}});' +
    'addEventListener("keyup",function(e){keys[e.key]=false});' +
    'addEventListener("click",function(e){if(!started||dead)return;var a=Math.atan2(e.clientY-py,e.clientX-px);bullets.push({x:px,y:py,dx:Math.cos(a)*8,dy:Math.sin(a)*8,life:60})});' +
    'var tick=0;function loop(){requestAnimationFrame(loop);x.fillStyle="#111";x.fillRect(0,0,c.width,c.height);' +
    'if(!started){x.fillStyle="#67c1f5";x.font="bold 28px Inter,sans-serif";x.textAlign="center";x.fillText(title,c.width/2,c.height/2-30);x.font="14px Inter";x.fillStyle="#8f98a0";x.fillText("Press ENTER to start",c.width/2,c.height/2+10);x.fillText("WASD move / Click shoot",c.width/2,c.height/2+35);return}' +
    'if(dead){x.fillStyle="#e74c3c";x.font="bold 24px Inter";x.textAlign="center";x.fillText("GAME OVER",c.width/2,c.height/2-20);x.fillStyle="#c7d5e0";x.font="16px Inter";x.fillText("Score: "+score,c.width/2,c.height/2+15);x.fillText("Press ENTER to restart",c.width/2,c.height/2+45);return}' +
    'var spd=3.5;if(keys.w||keys.ArrowUp)py-=spd;if(keys.s||keys.ArrowDown)py+=spd;if(keys.a||keys.ArrowLeft)px-=spd;if(keys.d||keys.ArrowRight)px+=spd;' +
    'px=Math.max(10,Math.min(c.width-10,px));py=Math.max(10,Math.min(c.height-10,py));' +
    'tick++;if(tick%60===0)spawnEnemy();' +
    'x.fillStyle="#a4d007";x.beginPath();x.arc(px,py,10,0,Math.PI*2);x.fill();' +
    'for(var i=bullets.length-1;i>=0;i--){var b=bullets[i];b.x+=b.dx;b.y+=b.dy;b.life--;x.fillStyle="#67c1f5";x.beginPath();x.arc(b.x,b.y,3,0,Math.PI*2);x.fill();if(b.life<=0)bullets.splice(i,1)}' +
    'for(var i=enemies.length-1;i>=0;i--){var e=enemies[i];var a=Math.atan2(py-e.y,px-e.x);e.x+=Math.cos(a)*e.spd;e.y+=Math.sin(a)*e.spd;x.fillStyle=e.col;x.beginPath();x.arc(e.x,e.y,e.sz,0,Math.PI*2);x.fill();' +
    'var dx=px-e.x,dy=py-e.y;if(Math.sqrt(dx*dx+dy*dy)<e.sz+10){hp-=1;if(hp<=0){dead=true}}' +
    'for(var j=bullets.length-1;j>=0;j--){var b=bullets[j];var bx=b.x-e.x,by=b.y-e.y;if(Math.sqrt(bx*bx+by*by)<e.sz+3){e.hp--;bullets.splice(j,1);if(e.hp<=0){enemies.splice(i,1);score+=10;break}}}}' +
    'x.fillStyle="#2a475e";x.fillRect(10,10,204,16);x.fillStyle=hp>30?"#a4d007":"#e74c3c";x.fillRect(12,12,hp*2,12);' +
    'x.fillStyle="#c7d5e0";x.font="12px Inter";x.textAlign="left";x.fillText("HP: "+hp,14,22);' +
    'x.textAlign="right";x.fillText("Score: "+score,c.width-14,22);}loop();' +
    '<\/script></body></html>';
}

function togglePlayFullscreen() {
  var iframe = document.getElementById('play-iframe');
  if (iframe.requestFullscreen) iframe.requestFullscreen();
  else if (iframe.webkitRequestFullscreen) iframe.webkitRequestFullscreen();
}
