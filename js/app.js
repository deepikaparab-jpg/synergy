/* ==========================================================================
   app.js  -  application logic of the Synergy
   Uses the storage layer from database.js (S, load, save, openDB, idb).
   Main parts: timer, tasks, calendar views, clock/alarms/stopwatch,
   chat + reminders, file storage + offline copies, strict mode, stickers,
   themes, statistics and tips.
   ========================================================================== */
(function(){
 var $=function(id){return document.getElementById(id)};
 var C=2*Math.PI*45, prog=$('prog');
 prog.style.strokeDasharray=C;
 var DEF={focus:25,short:5,long:15};
 var mode='focus',total=0,left=0,timer=null,endAt=0;

 function fmt(s){var m=Math.floor(s/60),x=s%60;return (m<10?'0':'')+m+':'+(x<10?'0':'')+x}
 function render(){
  $('clock').textContent=fmt(left);
  prog.style.strokeDashoffset=C*(1-(total?left/total:1));
  document.title=(timer?fmt(left)+' · ':'')+'Synergy';
 }
 function setMode(m){
  stop();mode=m;total=left=S.dur[m]*60;
  document.documentElement.setAttribute('data-mode',m);
  document.querySelectorAll('.tabs button').forEach(function(b){b.setAttribute('aria-pressed',b.dataset.m===m)});
  $('startBtn').textContent='Start';updateLabel();render();breakUI();
 }
 function updateLabel(){
  var t=S.tasks.filter(function(x){return x.id===S.active&&!x.done})[0];
  $('label').textContent=mode==='focus'?(t?t.text:'Pick a task or just start'):(mode==='short'?'Take a short break':'Take a long break');
 }
 function dots(){
  var n=S.done%4,h='';for(var i=0;i<4;i++)h+='<i class="'+(i<n?'on':'')+'"></i>';
  $('dots').innerHTML=h;
  $('count').textContent=S.done+' focus session'+(S.done===1?'':'s')+' today';
 }
 function tick(){
  left=Math.max(0,Math.round((endAt-Date.now())/1000));render();
  if(left<=0){finish(true)}
 }
 function start(){
  if(timer)return;if(mode==='focus')prefetch();endAt=Date.now()+left*1000;timer=setInterval(tick,250);
  $('startBtn').textContent='Pause';render();
 }
 function stop(){if(timer){clearInterval(timer);timer=null}$('startBtn').textContent='Start';document.title='Synergy'}
 function finish(auto){
  if(locked)lock(false);
  var wasFocus=mode==='focus',brkMode=mode;
  if(wasFocus&&auto){if(S.day!==new Date().toDateString()){S.day=new Date().toDateString();S.done=0}S.done++;var k=key(new Date()),h=S.hist[k]||{n:0,m:0};h.n++;h.m+=Math.round(total/60);S.hist[k]=h;save();cal()}
  stop();dots();
  var nextBreak=(S.done>0&&S.done%4===0)?'long':'short';
  if(!auto){setMode(wasFocus?nextBreak:'focus');return}
  if(wasFocus){
   setMode(nextBreak);
   ring({title:'Focus session complete',body:'Nice work. What would you like to do next?',tone:'chime',
    tip:'Not urgent? Take a break and rest your eyes: look at something about 6 metres (20 ft) away for 20 seconds and blink slowly. Urgent study? Keep going and rest later.',
    actions:[{l:'Take a break',p:1,fn:function(){setMode(nextBreak);start()}},{l:'Keep studying',fn:function(){setMode('focus');begin()}}]})
  }else{
   setMode('focus');
   ring({title:'Break is over',body:'Ready for the next focus session?',tone:'chime',
    actions:[{l:'Start focusing',p:1,fn:function(){setMode('focus');begin()}},{l:'5 more minutes',fn:function(){setMode(brkMode);total=left=300;render();start()}}]})
  }
 }
 function begin(){if(S.strict&&mode==='focus'){challenge();return}start()}
 $('startBtn').onclick=function(){if(timer){if(locked)return;stop();render();return}begin()};
 $('resetBtn').onclick=function(){if(!locked)setMode(mode)};
 $('skipBtn').onclick=function(){if(!locked)finish(false)};
 document.querySelectorAll('.tabs button').forEach(function(b){b.onclick=function(){if(!locked)setMode(b.dataset.m)}});
 document.addEventListener('keydown',function(e){
  if(e.code==='Space'&&!locked&&!/INPUT|BUTTON|TEXTAREA/.test(e.target.tagName)){e.preventDefault();$('startBtn').click()}
 });

 // theme
 var mq=window.matchMedia?window.matchMedia('(prefers-color-scheme: dark)'):null;
 var THM={
 default:{l:['#F3EADB','#EEDFCB','#FAF4E9','#33291F','#7A6A57','#E2D4BD','#FAF4E9','#7B5732','#91663B','#624528'],d:['#211B17','#2B2119','#2E2620','#EBE3DA','#B5A595','#473B31','#1E1E1E','#D3B69C','#DFCBB9','#C9A687']},
 pink:{l:['#F6DDE2','#FAE9DD','#FBEDEF','#3A2B30','#7A5E66','#E8C4CC','#FBEDEF','#7B3244','#983E55','#622836'],d:['#231A1E','#2E1F26','#2F2328','#F1E3E7','#BFA3AC','#4A3840','#1E1E1E','#F0A5B8','#F5BDCB','#E58FA6']},
 blue:{l:['#D6E6F5','#E4E6F7','#EDF3FA','#26303D','#4F6179','#BDD0E4','#EDF3FA','#375576','#456992','#2C435E'],d:['#161B26','#1D2433','#212838','#E0E4EC','#9EA9BD','#323C50','#1E1E1E','#97B2D8','#B5C8E3','#90ADD5']}},
 OLDT={sand:['default','light'],paper:['default','light'],sepia:['default','light'],butter:['default','light'],peach:['default','light'],cocoa:['default','dark'],rose:['pink','light'],pink:['pink','light'],blush:['pink','light'],lilac:['purple','light'],candy:['purple','light'],plum:['purple','dark'],slate:['purple','dark'],sage:['green','light'],forest:['green','dark'],sky:['blue','light'],mist:['blue','light'],midnight:['blue','dark'],night:['blue','dark']};
 (function(){var css='';Object.keys(THM).forEach(function(n){['l','d'].forEach(function(k){var v=THM[n][k],t=k==='d'?'dark':'light';css+=':root[data-theme="'+n+'"][data-tone="'+t+'"]{--bg:'+v[0]+';--bgimg:linear-gradient(135deg,'+v[0]+' 0%,'+v[1]+' 100%);--card:'+v[2]+';--ink:'+v[3]+';--mute:'+v[4]+';--line:'+v[5]+';--on:'+v[6]+';--a-focus:'+v[7]+';--a-short:'+v[8]+';--a-long:'+v[9]+';color-scheme:'+t+'}'})});var st=document.createElement('style');st.textContent=css;document.head.appendChild(st)})();
 function applyTheme(){
  var o=OLDT[S.theme];if(o){S.theme=o[0];if(!S.tone)S.tone=o[1]}
  if(!THM[S.theme])S.theme='default';
  if(S.tone!=='dark'&&S.tone!=='light')S.tone=(mq&&mq.matches)?'dark':'light';
  var r=document.documentElement,k=S.tone==='dark'?'d':'l';
  r.setAttribute('data-theme',S.theme);r.setAttribute('data-tone',S.tone);$('themeBtn').innerHTML=ic(S.tone==='dark'?'moon':'sun');
  var tc=document.querySelector('meta[name=theme-color]');if(tc)tc.content=getComputedStyle(r).getPropertyValue('--bg').trim();
  document.querySelectorAll('.sw button').forEach(function(x){var v=THM[x.dataset.t][k];x.style.background='linear-gradient(135deg,'+v[2]+' 50%,'+v[7]+' 50%)';x.setAttribute('aria-pressed',x.dataset.t===S.theme)});
  document.querySelectorAll('[data-tn]').forEach(function(x){x.setAttribute('aria-pressed',x.dataset.tn===S.tone)});
 }
 document.querySelectorAll('.sw button').forEach(function(x){x.onclick=function(){S.theme=x.dataset.t;applyTheme();save()}});
 document.querySelectorAll('[data-tn]').forEach(function(x){x.onclick=function(){S.tone=x.dataset.tn;applyTheme();save()}});

 // sound
 function soundUI(){$('soundBtn').innerHTML=ic(S.sound?'vol':'mute')+' Sound '+(S.sound?'on':'off');$('soundBtn').setAttribute('aria-pressed',S.sound);$('soundBtn').setAttribute('aria-label',S.sound?'Sound on':'Sound off')}
 $('soundBtn').onclick=function(){S.sound=!S.sound;soundUI();save()};

 // tasks
 function esc(s){return s.replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
 function tdate(t){return new Date(t.d+'T00:00:00').toLocaleDateString(undefined,{day:'numeric',month:'short'})+(t.t?' '+t.t:'')}
 function taskLi(t){var f=t.id===S.active&&!t.done;return '<li class="'+(t.done?'done ':'')+(f?'active':'')+'" data-id="'+t.id+'"><input type="checkbox" id="c'+t.id+'" '+(t.done?'checked':'')+' aria-label="Done"><span class="tx" data-a="edit" tabindex="0">'+esc(t.text)+(t.t?' <small class="tag">'+t.t+'</small>':'')+'</span><button class="ib'+(f?' on':'')+'" data-a="star" aria-label="'+(f?'Remove focus':'Set as focus task')+'" aria-pressed="'+f+'">'+ic(f?'starf':'star')+'</button><button class="ib" data-a="del" aria-label="Delete task">'+ic('trash')+'</button></li>'}
 function tasks(){var k=key(new Date()),L=S.tasks.filter(function(t){return !t.d||t.d===k}).sort(function(a,b){return (a.done-b.done)||((b.id===S.active?1:0)-(a.id===S.active?1:0))});
  $('tasks').innerHTML=L.length?L.map(taskLi).join(''):'<li class="empty">No tasks for today. Open the Calendar, pick a day and press +.</li>'}
 function newTask(v,d,tm){var t={id:Date.now(),text:v,done:false,imp:false,d:d||'',t:tm||''};S.tasks.push(t);
  if(t.d&&t.t){S.msgs.push({id:uid(),d:t.d,t:t.t,text:'To-do: '+v,atts:[],type:'rem',fired:false,ts:Date.now(),task:t.id});try{if(window.Notification&&Notification.permission==='default')Notification.requestPermission()}catch(e){}}
  save();return t}
 function taskClick(e){var li=e.target.closest('li[data-id]');if(!li)return;var id=+li.dataset.id,b=e.target.closest('[data-a]'),act=b&&b.dataset.a;
  if(act==='del'){S.tasks=S.tasks.filter(function(t){return t.id!==id});if(S.active===id)S.active=null;S.msgs=S.msgs.filter(function(m){return m.task!==id||m.fired})}
  else if(act==='edit'){var cur=S.tasks.filter(function(t){return t.id===id})[0];if(!cur)return;var inp=document.createElement('input');inp.type='text';inp.className='edit';inp.value=cur.text;inp.maxLength=80;b.replaceWith(inp);inp.focus();
   inp.onblur=function(){var v=inp.value.trim();if(v){cur.text=v;S.msgs.forEach(function(m){if(m.task===id&&!m.fired)m.text='To-do: '+v})}save();tasks();updateLabel();cal()};
   inp.onkeydown=function(ev){if(ev.key==='Enter')inp.blur();if(ev.key==='Escape'){inp.value=cur.text;inp.blur()}};return}
  else if(act==='star'){var tt=S.tasks.filter(function(t){return t.id===id})[0];if(tt&&!tt.done)S.active=S.active===id?null:id}
  else if(act==='pick'){S.active=id}
  else if(e.target.type==='checkbox'){var ck=e.target.checked;S.tasks.forEach(function(t){if(t.id===id)t.done=ck});if(ck&&S.active===id)S.active=null;if(ck)setTimeout(askClean,300)}
  else return;
  save();tasks();updateLabel();cal()}
 $('tasks').onclick=taskClick;
 // edit the timer length by tapping the time
 function editTimer(){
  if(locked)return;
  if(timer){toast('Pause the timer before changing its length.');return}
  modal('<h2>Timer length</h2><p class="hint">Minutes for each mode.</p><div class="set">'+[['Focus','focus',120],['Short break','short',60],['Long break','long',60]].map(function(x){return '<label>'+x[0]+'<input type="number" min="1" max="'+x[2]+'" id="e_'+x[1]+'" value="'+S.dur[x[1]]+'"></label>'}).join('')+'</div><div class="crow"><button class="ghost" data-close>Cancel</button><button class="main-btn sm" id="eSave">Save</button></div>');
  $('eSave').onclick=function(){['focus','short','long'].forEach(function(k){var el=$('e_'+k);S.dur[k]=Math.min(+el.max,Math.max(1,parseInt(el.value,10)||DEF[k]))});save();closeModal();setMode(mode);toast('Timer updated')};
 }
 $('clock').onclick=editTimer;
 $('clock').onkeydown=function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();editTimer()}};

 // calendar
 var view=new Date(),sel=key(new Date());view.setDate(1);
 function key(d){var m=d.getMonth()+1,x=d.getDate();return d.getFullYear()+'-'+(m<10?'0':'')+m+'-'+(x<10?'0':'')+x}
 function cal(){
  var y=view.getFullYear(),m=view.getMonth(),first=new Date(y,m,1).getDay(),n=new Date(y,m+1,0).getDate(),tk=key(new Date());
  $('calTitle').textContent=view.toLocaleDateString(undefined,{month:'long',year:'numeric'});
  var h=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(function(d){return '<div class="dow">'+d+'</div>'}).join('');
  for(var i=0;i<first;i++)h+='<div class="day blank"></div>';
  for(var d=1;d<=n;d++){
   var k=key(new Date(y,m,d)),e=S.hist[k],c=e?e.n:0,l=c?(c>=7?3:c>=4?2:1):0;
   h+='<button class="day'+(l?' l'+l:'')+(S.msgs.some(function(m){return m.d===k})?' has':'')+(k===tk?' today':'')+(k===sel?' sel':'')+'" data-k="'+k+'" aria-label="'+k+', '+c+' sessions">'+d+(c?'<small>⭐'+c+'</small>':'')+(S.stick[k]&&S.stick[k][0]?'<span class="stkc">'+stkMini(S.stick[k][0])+'</span>':'')+'</button>';
  }
  $('calGrid').innerHTML=h;calViews();
 }
 var calV='month',STK=['🌸','🍓','🐱','🐰','🌈','☁️','🎀','🧸','🍀','📚','☕','🌙'],MOODS=[{k:'great',x:'grin',t:0,l:'Great'},{k:'ok',x:'smile',t:1,l:'Okay'},{k:'tired',x:'sleepy',t:2,l:'Tired'},{k:'low',x:'frown',t:3,l:'Not motivated'},{k:'stressed',x:'worried',t:4,l:'Stressed'}];
 function setTitle(t,y,dw){$('calTitle').textContent=t;$('calYr').textContent=y?y+' ▾':'';$('calYr').hidden=!y;$('calDow').textContent=dw}
 function addDays(k,n){var d=new Date(k+'T00:00:00');d.setDate(d.getDate()+n);return key(d)}
 function openDay(k){sel=k;calV='day';cal()}
 function items(k){var r=S.tasks.filter(function(t){return t.d===k}).map(function(t){return {text:t.text,t:t.t,imp:t.id===S.active,done:t.done}});
  S.msgs.forEach(function(m){if(m.type==='rem'&&!m.task&&(m.sd||m.d)===k)r.push({text:m.text||'Reminder',t:m.st||m.t,rm:1})});return r}
 function calViews(){
  var tk=key(new Date()),cur=calV==='day'&&sel===tk?'today':calV,T=$('calTitle');
  $('calMain').hidden=calV!=='month';$('weekV').hidden=calV!=='week';$('schedV').hidden=calV!=='sched';$('detail').hidden=calV!=='day';$('yearV').hidden=calV!=='year';
  document.querySelectorAll('#calTabs button').forEach(function(b){b.setAttribute('aria-pressed',b.dataset.v===cur)});
  var D=new Date(sel+'T00:00:00'),Y=D.getFullYear();$('backM').hidden=calV!=='day';
  if(calV==='week'){var a=new Date(D);a.setDate(a.getDate()-a.getDay());var z=new Date(a);z.setDate(a.getDate()+6);
   setTitle(a.toLocaleDateString(undefined,{day:'numeric',month:'short'})+' – '+z.toLocaleDateString(undefined,{day:'numeric',month:'short'}),Y,'');weekRender()}
  else if(calV==='sched'){setTitle('Upcoming','','');schedRender()}
  else if(calV==='year'){setTitle('',Y,'');yearRender()}
  else if(calV==='day')setTitle(D.getDate()+' '+D.toLocaleDateString(undefined,{month:'long'}),Y,', '+D.toLocaleDateString(undefined,{weekday:'short'}));
  else setTitle(view.toLocaleDateString(undefined,{month:'long'}),view.getFullYear(),'');
  detail();statsRender()}
 function weekRender(){
  var d0=new Date(sel+'T00:00:00');d0.setDate(d0.getDate()-d0.getDay());var ks=[],i,tk=key(new Date()),H0=6,H1=22,PX=34;
  for(i=0;i<7;i++){var x=new Date(d0);x.setDate(d0.getDate()+i);ks.push(key(x))}
  var lab='';for(i=H0;i<H1;i++)lab+='<div style="height:'+PX+'px">'+(i%12||12)+(i<12?'a':'p')+'</div>';
  var cls=function(x){return 'blk'+(x.imp?' imp':'')+(x.done?' done':'')+(x.rm?' rm':'')};
  var head='<div></div>'+ks.map(function(k){var d=new Date(k+'T00:00:00'),e=S.hist[k];return '<button class="wh'+(k===tk?' today':'')+'" data-k="'+k+'">'+d.toLocaleDateString(undefined,{weekday:'short'})+'<b>'+d.getDate()+'</b>'+(e?'<small>⭐'+e.n+'</small>':'')+'</button>'}).join('');
  var all='<div class="ad">all day</div>'+ks.map(function(k){return '<div class="adc" data-k="'+k+'">'+items(k).filter(function(x){return !x.t}).map(function(x){return '<span class="'+cls(x)+'">'+esc(x.text)+'</span>'}).join('')+'</div>'}).join('');
  var cols='<div>'+lab+'</div>'+ks.map(function(k){return '<div class="wc" data-k="'+k+'" style="height:'+(H1-H0)*PX+'px">'+items(k).filter(function(x){return x.t}).map(function(x){var h=+x.t.slice(0,2)+ +x.t.slice(3)/60;if(h<H0||h>=H1)return '';return '<span class="'+cls(x)+'" style="top:'+(h-H0)*PX+'px;height:'+(PX-2)+'px">'+x.t+' '+esc(x.text)+'</span>'}).join('')+'</div>'}).join('');
  $('weekV').innerHTML='<div class="wkwrap"><div class="mini" id="mini"></div><div class="wscroll"><div class="wk">'+head+all+cols+'</div></div></div>';miniD=null;miniRender()}
 function schedRender(){var h='',k0=key(new Date());
  for(var i=0;i<60;i++){var k=addDays(k0,i),L=items(k).sort(function(a,b){return (a.t||'').localeCompare(b.t||'')});
   if(L.length)h+='<h3 class="sh" data-k="'+k+'">'+new Date(k+'T00:00:00').toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long'})+'</h3>'+L.map(function(x){return '<div class="sit" data-k="'+k+'"><span class="blk'+(x.imp?' imp':'')+(x.rm?' rm':'')+'">'+(x.t||'all day')+'</span> '+(x.imp?'⭐ ':'')+esc(x.text)+'</div>'}).join('')}
  $('schedV').innerHTML=h||'<p class="empty">Nothing planned yet. Open a day and press + to add a task.</p>'}
 function fmtMin(m){var h=Math.floor(m/60),r=m%60;return (h?h+' hr ':'')+((r||!h)?r+' min':'')}
 function detail(){
  if(calV!=='day')return;
  var e=S.hist[sel]||{n:0,m:0},st=S.stick[sel]||[],all=S.msgs.filter(function(m){return m.d===sel}),notes=all.filter(function(m){return m.type==='note'&&m.text}),
   tk=S.tasks.filter(function(t){return t.d===sel}).sort(function(a,b){return (a.done-b.done)||((b.id===S.active?1:0)-(a.id===S.active?1:0))||(a.t||'').localeCompare(b.t||'')}),
   pct=Math.min(100,Math.round(e.m/120*100));
  $('detail').innerHTML=
   '<div class="dsec"><div class="th"><h3>Tasks</h3><button class="ib" id="tPlus" aria-label="Add task">'+ic('plus')+'</button></div><div class="add" id="tForm" hidden><input type="text" id="dTask" placeholder="New task" maxlength="80" aria-label="Task"><input type="time" id="dTime" aria-label="Reminder time"><button id="dAdd">Add</button></div><ul>'+(tk.length?tk.map(taskLi).join(''):'<li class="empty">Nothing planned for this day.</li>')+'</ul><p class="hint">The star marks your focus task. Add a time and the task arrives as a reminder in your chat.</p></div>'+
   '<div class="dsec"><h3>Focus Sessions</h3><div class="stars">'+(e.n?'⭐'.repeat(Math.min(e.n,12))+(e.n>12?' +'+(e.n-12):''):'<span class="hint">No sessions yet</span>')+'</div><div class="fsr"><div class="pbar" title="Goal: 2 hours"><i style="width:'+pct+'%"></i></div><div class="fst"><b>'+fmtMin(e.m)+'</b><span>'+e.n+' session'+(e.n===1?'':'s')+'</span></div></div></div>'+
   '<div class="dsec"><h3>Mood</h3><div class="pal">'+MOODS.map(function(m){return '<button data-mood="'+m.k+'" aria-pressed="'+(S.mood[sel]===m.k)+'" aria-label="'+m.l+'">'+faceSvg(m.x,m.t,34)+'</button>'}).join('')+'</div></div>'+
   stickerSection(st)+
   (notes.length?'<div class="dsec"><h3>Journal</h3>'+notes.map(function(m){return '<div class="jn">'+esc(m.text)+'</div>'}).join('')+'</div>':'')+
   '<button class="ghost sm" id="goChat">Open chat messages from this day ('+all.length+')</button>'}
 $('detail').onclick=function(e){var t=e.target,x;
  if(t.closest('#dayBack')){calV='month';cal();return}
  if(t.closest('#goChat')){show('chat');var el=document.querySelector('#thread [data-d="'+sel+'"]');if(el)el.scrollIntoView();return}
  if(t.closest('#tPlus')){var f=$('tForm');f.hidden=!f.hidden;if(!f.hidden)$('dTask').focus();return}
  if(x=t.closest('[data-mood]')){S.mood[sel]=x.dataset.mood;save();cal();return}
  if(x=t.closest('[data-stab]')){stkTab=x.dataset.stab;cal();return}
  if(x=t.closest('[data-st]')){(S.stick[sel]=S.stick[sel]||[]).push(x.dataset.st);save();cal();return}
  if(x=t.closest('[data-rm]')){S.stick[sel].splice(+x.dataset.rm,1);save();cal();return}
  if(t.closest('#dAdd')){var v=$('dTask').value.trim();if(!v)return;newTask(v,sel,$('dTime').value);tasks();cal();return}
  if(t.closest('li[data-id]'))taskClick(e)};
 $('weekV').onclick=function(e){var mn=e.target.closest('[data-mn]');
  if(mn){var m=$('mini');miniD=new Date(+m.dataset.y,+m.dataset.m+ +mn.dataset.mn,1);miniRender();return}
  var md=e.target.closest('.md');if(md){sel=md.dataset.k;cal();return}
  var x=e.target.closest('[data-k]');if(x)openDay(x.dataset.k)};
 $('schedV').onclick=function(e){var x=e.target.closest('[data-k]');if(x)openDay(x.dataset.k)};
 $('calGrid').onclick=function(e){var b=e.target.closest('.day[data-k]');if(b)openDay(b.dataset.k)};
 $('calTabs').onclick=function(e){var b=e.target.closest('[data-v]');if(!b)return;var v=b.dataset.v;
  if(v==='today'){sel=key(new Date());calV='day'}else calV=v;view=new Date(sel+'T00:00:00');view.setDate(1);cal()};
 function step(n){
  if(calV==='month'){view.setMonth(view.getMonth()+n);var t=new Date();sel=t.getFullYear()===view.getFullYear()&&t.getMonth()===view.getMonth()?key(t):key(view)}
  else if(calV==='year'){var d=new Date(sel+'T00:00:00');d.setFullYear(d.getFullYear()+n);sel=key(d);view=new Date(sel+'T00:00:00');view.setDate(1)}
  else{sel=addDays(sel,calV==='day'?n:7*n);view=new Date(sel+'T00:00:00');view.setDate(1)}
  cal()}
 $('backM').onclick=function(){calV='month';cal()};
 var tx=null;
 $('calSec').addEventListener('touchstart',function(e){tx=e.changedTouches[0].clientX},{passive:true});
 $('calSec').addEventListener('touchend',function(e){if(tx===null)return;var dx=e.changedTouches[0].clientX-tx;tx=null;var w=e.target.closest('.wscroll');if(w&&w.scrollWidth>w.clientWidth+2)return;if(Math.abs(dx)>70)step(dx<0?1:-1)},{passive:true});
 document.addEventListener('keydown',function(e){if(!$('calSec').classList.contains('show')||/INPUT|TEXTAREA/.test(e.target.tagName)||!$('ymPop').hidden)return;if(e.key==='ArrowLeft')step(-1);if(e.key==='ArrowRight')step(1)});
 function yearRender(){var Y=new Date(sel+'T00:00:00').getFullYear(),tk=key(new Date()),h='';
  for(var m=0;m<12;m++){var first=new Date(Y,m,1),n=new Date(Y,m+1,0).getDate(),g='',i;
   for(i=0;i<first.getDay();i++)g+='<i></i>';
   for(var d=1;d<=n;d++){var k=key(new Date(Y,m,d)),e=S.hist[k],c=e?e.n:0,l=c?(c>=7?3:c>=4?2:1):0,has=S.tasks.some(function(t){return t.d===k});
    g+='<button class="yd'+(l?' l'+l:'')+(k===tk?' today':'')+(has?' has':'')+'" data-k="'+k+'" aria-label="'+k+'">'+d+'</button>'}
   h+='<div><button class="mmt" data-m="'+m+'">'+first.toLocaleDateString(undefined,{month:'long'})+'</button><div class="ymg">'+g+'</div></div>'}
  $('yearV').innerHTML='<div class="ygrid">'+h+'</div>'}
 $('yearV').onclick=function(e){var d=e.target.closest('[data-k]');if(d){openDay(d.dataset.k);return}
  var m=e.target.closest('[data-m]');if(m){var y=new Date(sel+'T00:00:00').getFullYear();view=new Date(y,+m.dataset.m,1);sel=key(view);calV='month';cal()}};
 var ymY=null,MN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
 function ymRender(){var cur=new Date(sel+'T00:00:00'),Y0=new Date().getFullYear(),h='';ymY=ymY||cur.getFullYear();
  for(var y=Y0-3;y<=Y0+10;y++){h+='<button class="yr'+(y===ymY?' on':'')+'" data-y="'+y+'">'+y+'</button>';
   if(y===ymY&&calV!=='year')h+='<div class="mg">'+MN.map(function(m,i){return '<button data-pm="'+i+'" class="'+(y===cur.getFullYear()&&i===cur.getMonth()?'cur':'')+'">'+m+'</button>'}).join('')+'</div>'}
  $('ymPop').innerHTML=h;var on=$('ymPop').querySelector('.yr.on');if(on)on.scrollIntoView({block:'nearest'})}
 $('ymBtn').onclick=function(e){e.stopPropagation();var p=$('ymPop');p.hidden=!p.hidden;if(!p.hidden){ymY=null;ymRender()}};
 $('ymPop').onclick=function(e){e.stopPropagation();var y=e.target.closest('[data-y]'),m;
  if(y){if(calV==='year'){var d=new Date(sel+'T00:00:00');d.setFullYear(+y.dataset.y);sel=key(d);$('ymPop').hidden=true;cal()}else{ymY=+y.dataset.y;ymRender()}return}
  if(m=e.target.closest('[data-pm]')){var o=new Date(sel+'T00:00:00'),mi=+m.dataset.pm,t=new Date(ymY,mi,1);t.setDate(Math.min(o.getDate(),new Date(ymY,mi+1,0).getDate()));
   sel=key(t);view=new Date(ymY,mi,1);$('ymPop').hidden=true;cal()}};
 document.addEventListener('click',function(e){if(!e.target.closest('#ymPop,#ymBtn'))$('ymPop').hidden=true});

 var stW=0,stM='n';
 function streaks(){var set={},ks=Object.keys(S.hist).filter(function(k){return S.hist[k].n>0}).sort();ks.forEach(function(k){set[k]=1});
  var cur=0,d=key(new Date());if(!set[d])d=addDays(d,-1);while(set[d]){cur++;d=addDays(d,-1)}
  var best=0,run=0,prev=null;ks.forEach(function(k){run=(prev&&addDays(prev,1)===k)?run+1:1;if(run>best)best=run;prev=k});return {cur:cur,best:best}}
 function statsRender(){
  var H=S.hist,tot=0,min=0,i;Object.keys(H).forEach(function(k){tot+=H[k].n;min+=H[k].m});
  var sk=streaks();$('kStreak').textContent=sk.cur;$('kBest').textContent=sk.best;$('kSess').textContent=tot;$('kMin').textContent=min;
  var d0=new Date();d0.setDate(d0.getDate()-d0.getDay()+7*stW);
  var days=[],val=function(k){return H[k]?H[k][stM]:0};
  for(i=0;i<7;i++){var x=new Date(d0);x.setDate(d0.getDate()+i);days.push(x)}
  var vals=days.map(function(x){return val(key(x))}),mx=Math.max.apply(null,vals.concat([1])),sum=0,prev=0,tk=key(new Date());
  vals.forEach(function(v){sum+=v});
  for(i=0;i<7;i++){var y=new Date(d0);y.setDate(d0.getDate()-7+i);prev+=val(key(y))}
  $('bars').innerHTML=days.map(function(x,i){return '<div class="bar'+(key(x)===tk?' today':'')+'"><b>'+(vals[i]||'')+'</b><i style="height:'+(vals[i]?Math.max(6,vals[i]/mx*70):2)+'%"></i><span>'+x.toLocaleDateString(undefined,{weekday:'short'})+'</span></div>'}).join('');
  $('stRange').textContent=days[0].toLocaleDateString(undefined,{day:'numeric',month:'short'})+' – '+days[6].toLocaleDateString(undefined,{day:'numeric',month:'short'});
  var diff=sum-prev;$('stNote').textContent=(stW===0?'This week: ':'That week: ')+sum+(stM==='n'?' session'+(sum===1?'':'s'):' minutes')+((prev||sum)?' ('+(diff>0?'+':'')+diff+' vs the week before).':'.')}
 $('stM').onclick=function(e){var b=e.target.closest('[data-m]');if(!b)return;stM=b.dataset.m;document.querySelectorAll('#stM button').forEach(function(x){x.setAttribute('aria-pressed',x===b)});statsRender()};
 $('stPrev').onclick=function(){stW--;statsRender()};$('stNext').onclick=function(){stW++;statsRender()};

 var DN=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],dlg={},dragging=false;
 function pad(n){return (n<10?'0':'')+n}
 function repTxt(a){var d=a.days&&a.days.length?a.days:(a.rep?[0,1,2,3,4,5,6]:[]);if(!d.length)return 'Once';if(d.length===7)return 'Every day';
  if(d.length===5&&[1,2,3,4,5].every(function(x){return d.indexOf(x)>=0}))return 'Weekdays';return d.slice().sort().map(function(x){return DN[x]}).join(', ')}
 function dialSvg(){
  var c=120,R1=96,R2=60,items=[],sp,h='',sel,pos=function(i,r){var a=(i*30-90)*Math.PI/180;return [c+r*Math.cos(a),c+r*Math.sin(a)]};
  if(dlg.mode==='h'){for(var i=0;i<12;i++){var n1=i===0?12:i,n2=i===0?0:i+12;items.push({v:n1,p:pos(i,R1),t:''+n1,f:14});items.push({v:n2,p:pos(i,R2),t:pad(n2),f:12})}
   sel=dlg.h;sp=pos(dlg.h%12,(dlg.h===0||dlg.h>12)?R2:R1)}
  else{for(var j=0;j<12;j++)items.push({v:j*5,p:pos(j,R1),t:pad(j*5),f:14});sel=dlg.m;var a=(dlg.m*6-90)*Math.PI/180;sp=[c+R1*Math.cos(a),c+R1*Math.sin(a)]}
  h+='<circle cx="120" cy="120" r="116" style="fill:color-mix(in srgb,var(--accent) 14%,var(--card))"/><line x1="120" y1="120" x2="'+sp[0]+'" y2="'+sp[1]+'" style="stroke:var(--accent);stroke-width:2"/><circle cx="120" cy="120" r="3.5" style="fill:var(--accent)"/><circle cx="'+sp[0]+'" cy="'+sp[1]+'" r="17" style="fill:var(--accent)"/>';
  if(dlg.mode==='m'&&dlg.m%5)h+='<circle cx="'+sp[0]+'" cy="'+sp[1]+'" r="2.5" style="fill:var(--on)"/>';
  items.forEach(function(it){h+='<text x="'+it.p[0]+'" y="'+it.p[1]+'" text-anchor="middle" dominant-baseline="central" font-size="'+it.f+'" font-weight="600" style="fill:'+(it.v===sel?'var(--on)':'var(--ink)')+';pointer-events:none">'+it.t+'</text>'});
  return '<svg id="dial" viewBox="0 0 240 240" role="img" aria-label="Clock dial">'+h+'</svg>'}
 function dialUpdate(){$('dH').textContent=pad(dlg.h);$('dM').textContent=pad(dlg.m);$('dH').classList.toggle('on',dlg.mode==='h');$('dM').classList.toggle('on',dlg.mode==='m');$('dialBox').innerHTML=dialSvg()}
 function dialPt(e){var r=$('dial').getBoundingClientRect(),x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2,ang=(Math.atan2(y,x)*180/Math.PI+90+360)%360,dist=Math.sqrt(x*x+y*y)/(r.width/240);
  if(dlg.mode==='h'){var q=Math.round(ang/30)%12;dlg.h=dist<78?(q===0?0:q+12):(q===0?12:q)}else dlg.m=Math.round(ang/6)%60;dialUpdate()}
 function openAlarm(a){
  dlg={h:a?+a.t.slice(0,2):new Date().getHours(),m:a?+a.t.slice(3):new Date().getMinutes(),mode:'h',days:a?(a.days&&a.days.length?a.days.slice():(a.rep?[0,1,2,3,4,5,6]:[])):[],id:a?a.id:null};
  var tone=a&&a.tone||'classic',vib=a?a.vib!==false:true;
  modal('<div class="sh-h"><button class="ib" data-close aria-label="Cancel">'+ic('x')+'</button><b>'+(a?'Edit alarm':'Set alarm')+'</b><button class="ib" id="alOk" aria-label="Save alarm">'+ic('check')+'</button></div>'+
   '<div class="bigt"><button id="dH"></button><span>:</span><button id="dM"></button></div><div id="dialBox" class="dialbox"></div>'+
   '<div id="kbBox" hidden><input type="time" id="kbT" aria-label="Type the time"></div><div class="kbrow"><button class="ib" id="dKb" aria-label="Type the time instead">'+ic('kb')+'</button></div>'+
   '<div class="opts"><div class="orow"><span class="oi">'+ic('repeat')+'</span><div><b>Repeat</b><small id="repT"></small><div class="dchips" id="dDays">'+['S','M','T','W','T','F','S'].map(function(l,i){return '<button data-d="'+i+'" aria-label="'+DN[i]+'" aria-pressed="false">'+l+'</button>'}).join('')+'</div></div></div>'+
   '<div class="orow"><span class="oi">'+ic('bell')+'</span><div><b>Alarm sound</b><br><select id="dTone" aria-label="Alarm sound"><option value="classic">Classic beep</option><option value="chime">Chime</option><option value="digital">Digital</option><option value="soft">Soft</option></select></div></div>'+
   '<div class="orow"><span class="oi">'+ic('vib')+'</span><div><b>Vibrate</b></div><input type="checkbox" class="tgl" id="dVib" aria-label="Vibrate"></div>'+
   '<div class="orow"><span class="oi">'+ic('tag')+'</span><div><input type="text" id="dLab" placeholder="Label" maxlength="40" aria-label="Label" style="width:100%"></div></div></div>');
  $('modal').firstChild.classList.add('sheet');
  $('dTone').value=tone;$('dVib').checked=vib;$('dLab').value=a&&a.label||'';
  var days=function(){document.querySelectorAll('#dDays button').forEach(function(b){b.setAttribute('aria-pressed',dlg.days.indexOf(+b.dataset.d)>=0)});$('repT').textContent=repTxt({days:dlg.days})};days();dialUpdate();
  $('dH').onclick=function(){dlg.mode='h';dialUpdate()};$('dM').onclick=function(){dlg.mode='m';dialUpdate()};
  var box=$('dialBox');
  box.onpointerdown=function(e){dragging=true;try{box.setPointerCapture(e.pointerId)}catch(x){}dialPt(e)};
  box.onpointermove=function(e){if(dragging)dialPt(e)};
  box.onpointerup=function(){if(!dragging)return;dragging=false;if(dlg.mode==='h'){dlg.mode='m';dialUpdate()}};
  $('dDays').onclick=function(e){var b=e.target.closest('[data-d]');if(!b)return;var d=+b.dataset.d,i=dlg.days.indexOf(d);if(i<0)dlg.days.push(d);else dlg.days.splice(i,1);days()};
  $('dTone').onchange=function(){playTone(this.value,false)};
  $('dKb').onclick=function(){var k=$('kbBox').hidden;if(k)$('kbT').value=pad(dlg.h)+':'+pad(dlg.m);else if($('kbT').value){dlg.h=+$('kbT').value.slice(0,2);dlg.m=+$('kbT').value.slice(3);dialUpdate()}
   $('kbBox').hidden=!k;box.hidden=k};
  $('alOk').onclick=function(){if(!$('kbBox').hidden&&$('kbT').value){dlg.h=+$('kbT').value.slice(0,2);dlg.m=+$('kbT').value.slice(3)}
   var t=pad(dlg.h)+':'+pad(dlg.m),rec={t:t,label:$('dLab').value.trim(),days:dlg.days.slice(),rep:dlg.days.length>0,on:true,last:t<=hmOf(new Date())?key(new Date()):'',tone:$('dTone').value,vib:$('dVib').checked};
   if(dlg.id){var o=S.alarms.filter(function(x){return x.id===dlg.id})[0];if(o)for(var f in rec)o[f]=rec[f]}else{rec.id=uid();S.alarms.push(rec)}
   save();alRender();closeModal();getCtx();keepAwake();toast('Alarm set for '+t+' · '+repTxt(rec))}}
 $('alNew').onclick=function(){openAlarm(null)};
 var miniD=null;
 function miniRender(){var b=miniD||new Date(sel+'T00:00:00'),Y=b.getFullYear(),M=b.getMonth(),f=new Date(Y,M,1),n=new Date(Y,M+1,0).getDate(),tk=key(new Date()),sw=new Date(sel+'T00:00:00');sw.setDate(sw.getDate()-sw.getDay());
  var w0=key(sw),w6=addDays(w0,6),h='<div class="mh"><b>'+f.toLocaleDateString(undefined,{month:'long',year:'numeric'})+'</b><span><button data-mn="-1" aria-label="Previous month">‹</button><button data-mn="1" aria-label="Next month">›</button></span></div><div class="mg7">'+['S','M','T','W','T','F','S'].map(function(d){return '<i>'+d+'</i>'}).join(''),i;
  for(i=0;i<f.getDay();i++)h+='<i></i>';
  for(i=1;i<=n;i++){var k=key(new Date(Y,M,i));h+='<button class="md'+(k===tk?' today':'')+(k>=w0&&k<=w6?' inwk':'')+'" data-k="'+k+'">'+i+'</button>'}
  $('mini').innerHTML=h+'</div>';$('mini').dataset.y=Y;$('mini').dataset.m=M}
 document.addEventListener('mouseover',function(e){var b=e.target.closest&&e.target.closest('button[aria-label]');if(b&&!b.title)b.title=b.getAttribute('aria-label')});

 var FD='<circle cx="14" cy="17" r="1.7" fill="currentColor" stroke="none"/><circle cx="26" cy="17" r="1.7" fill="currentColor" stroke="none"/>',
  FACES={grin:'<path d="M11 17q3-4 6 0M23 17q3-4 6 0"/><path d="M12 23q8 10 16 0z" fill="currentColor" fill-opacity=".22"/>',
   smile:FD+'<path d="M14 24q6 5 12 0"/>',wink:'<circle cx="14" cy="17" r="1.7" fill="currentColor" stroke="none"/><path d="M23 17h6"/><path d="M13 24q7 6 14 0"/>',
   tongue:FD+'<path d="M13 23q7 7 14 0"/><path d="M18 27q2 6 4 0" fill="currentColor" fill-opacity=".3"/>',surprised:FD+'<circle cx="20" cy="27" r="3.2"/>',
   flat:FD+'<path d="M15 27h10"/>',sleepy:'<path d="M11 18h6M23 18h6"/><path d="M17 27h6"/><path d="M30 8h4l-4 4h4" stroke-width="1.4"/>',
   frown:FD+'<path d="M14 28q6-5 12 0"/>',worried:FD+'<path d="M10 12l6 2.5M30 12l-6 2.5"/><path d="M13 28q2-2.4 4 0t4 0t4 0"/>',angry:FD+'<path d="M10 13l7 3.5M30 13l-7 3.5"/><path d="M14 28q6-4.5 12 0"/>'},
  TINT=[24,38,52,66,80],
  LABELS=['Focus','Study time','Exam','Break','Goals','Deadline','Done','Review','Notes','Keep going','Homework','Quiz','Read','Practice','Little win','Proud of me','You got this','Priority','To-do','Today','Reminder','Checklist','Urgent',"Don't forget",'Schedule','Self care','Me time','Happy day'],
  STUDY=['Maths','Science','English','Computer','Coding','Networks','DBMS','OS','Electronics','Physics','Chemistry','Biology','History','Geography','Economics','Lab record','Practical','Viva','Assignment','Revision','Definition','Key points','Summary','Well done!','Excellent','Super!','You did it!','Good job'],
  MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'],
  QUOTES=['Be kind','You are doing great','One day at a time','Small steps every day','Keep going','Do it for you','Enjoy the little things','Make yourself proud','Believe in yourself','Progress, not perfection','You got this','Slow down, you are doing fine'],
  SHAPES=['pill','round','arch','rect','blob'],
  LCOL=[['#FDE2E4','#8A3B4A'],['#E2ECE9','#2E5E55'],['#FFF1C9','#7A5B00'],['#DDE7FF','#2B4A8A'],['#EBDDFB','#5A3A8A'],['#FFE0CC','#8A4B1F'],['#D9F2D9','#2F6B3A'],['#D6EEF7','#1F5F7A']],
  stkTab='faces';
 var RAIN=[['#C9B6E4',0],['#E7B5D6',0],['#F4B6B0',0],['#F7C59F',0],['#F9E08B',0],['#CFE5A0',0],['#A8DCC4',0],['#9ED7DA',0],['#A9D4F5',0],['#B6C0F0',0],['#8E7CC3',1],['#4F9D8C',1],['#3F7FBF',1],['#E0645C',1]],
  PALS=[['#CFEFE6','#2F8F83','#1F5E55'],['#FFD9C7','#E4743B','#8A3F17'],['#E5D7FA','#8C63D6','#4F2E94'],['#CBE6FA','#3D8BD6','#1E4F85'],['#FFF0B3','#E0B000','#7A5B00'],['#FFD3E1','#E5528B','#8A1F4B'],['#D9EDC8','#6AA84F','#3A6B22'],['#FFC9C2','#E5584B','#8A2A21'],['#1F4E79','#0F2F4F','#CFE8FF'],['#8A5BC4','#5A3592','#FBF6EE']],
  MC=['#A8E2DE','#F5B7B8','#BDEBC3','#FAD3A6','#D9C0F2','#A8D6F7','#C5EBC3','#F4A9A9','#9CC7F2','#E3BE55','#FAD08A','#CDB4F0'],
  BURST=(function(){var p=[],n=14,a,r;for(var i=0;i<n*2;i++){a=Math.PI*i/n-Math.PI/2;r=i%2?.8:1;p.push((50+48*r*Math.cos(a)).toFixed(1)+','+(26+24*r*Math.sin(a)).toFixed(1))}return '<polygon points="'+p.join(' ')+'"/>'})(),
  RS={pill:'<rect x="2" y="2" width="96" height="48" rx="24"/>',oval:'<ellipse cx="50" cy="26" rx="48" ry="24"/>',
   cloud:'<path d="M14 14A9 9 0 0 1 32 14A9 9 0 0 1 50 14A9 9 0 0 1 68 14A9 9 0 0 1 86 14A12 12 0 0 1 86 38A9 9 0 0 1 68 38A9 9 0 0 1 50 38A9 9 0 0 1 32 38A9 9 0 0 1 14 38A12 12 0 0 1 14 14Z"/>',
   burst:BURST,ribbon:'<path d="M2 4H98L90 26L98 48H2L10 26Z"/>',bubble:'<path d="M12 3H88Q98 3 98 13V30Q98 40 88 40H38L24 50L26 40H12Q2 40 2 30V13Q2 3 12 3Z"/>',
   tag:'<path d="M2 4H82L98 26L82 48H2Z"/>',note:'<rect x="3" y="3" width="94" height="46" rx="8"/><rect x="8" y="8" width="84" height="36" rx="5" fill="none" stroke-dasharray="3 3"/>',
   blob:'<path d="M10 10C30 0 70 2 90 10C102 24 100 36 88 46C68 52 30 52 12 46C0 36 -2 22 10 10Z"/>'},
  RSH=['pill','cloud','burst','ribbon','bubble','oval','tag','note'],
  FL=(function(){var c='',a;for(var k=0;k<8;k++){a=k*Math.PI/4;c+='<circle cx="'+(50+30*Math.cos(a)).toFixed(1)+'" cy="'+(50+30*Math.sin(a)).toFixed(1)+'" r="19"/>'}return c+'<circle cx="50" cy="50" r="28"/>'})(),
  QS={circle:'<circle cx="50" cy="50" r="47"/>',heart:'<path d="M50 90C12 66 3 40 12 24C22 8 42 12 50 28C58 12 78 8 88 24C97 40 88 66 50 90Z"/>',flower:'<g>'+FL+'</g><g style="stroke:none">'+FL+'</g>',
   arch:'<path d="M4 96V50A46 46 0 0 1 96 50V96Z"/>',blob2:'<path d="M20 14C40 -2 80 6 92 32C100 54 82 90 54 94C26 98 2 80 4 52C5 36 10 22 20 14Z"/>'},
  QSH=['circle','pill','heart','bubble','arch','note','flower','ribbon','blob'];
 function faceSvg(x,t,sz,rain){var fill,col;
  if(rain){var R=RAIN[(+t||0)%RAIN.length];fill=R[0];col=R[1]?'#FBF6EE':'#33291F'}
  else{var P=TINT[(+t||0)%5];fill='color-mix(in srgb,var(--accent) '+P+'%,var(--card))';col='var('+(P>=60?'--on':'--ink')+')'}
  return '<svg class="face" width="'+sz+'" height="'+sz+'" viewBox="0 0 40 40" role="img" aria-label="'+x+' face" style="color:'+col+'"><path d="M20 1.5C30.5 1 38.6 9 38.6 20S31 38.7 20 38.6 1.3 31 1.4 20 9.5 2 20 1.5z" style="fill:'+fill+'"/><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+FACES[x]+'</g></svg>'}
 function colorfulFaces(){var ks=Object.keys(FACES),r=[];for(var j=0;j<20;j++)r.push('c:'+ks[j%10]+':'+((j*3+(j>9?1:0))%14));return r}
 function sk(t,i){var sh=RSH[i%8],p=PALS[(i*3+Math.floor(i/8))%10];
  return '<span class="sk '+sh+' f'+(i%3)+'" style="color:'+p[2]+';transform:rotate('+(((i%3)-1)*2)+'deg)"><svg viewBox="0 0 100 52" preserveAspectRatio="none" aria-hidden="true"><g style="fill:'+p[0]+';stroke:'+p[1]+'">'+RS[sh]+'</g></svg><b>'+esc(t)+'</b></span>'}
 function qk(t,i){var sh=QSH[i%9],sq=sh==='circle'||sh==='heart'||sh==='flower'||sh==='arch',n=[28,42,56,70,84][i%5],
   fill='color-mix(in srgb,var(--accent) '+n+'%,var(--card))',tc=n>=56?'var(--on)':'var(--ink)';
  return '<span class="sk '+(sq?'sq ':'qq ')+sh+' q'+(i%4)+'" style="color:'+tc+'"><svg viewBox="'+(sq?'0 0 100 100':'0 0 100 52')+'" preserveAspectRatio="none" aria-hidden="true"><g style="fill:'+fill+';stroke:color-mix(in srgb,var(--accent) 90%,var(--ink))">'+(sq?QS[sh]:RS[sh])+'</g></svg><b>'+esc(t)+'</b></span>'}
 function mon(i){return '<span class="mon" style="--mc:'+MC[i]+'"><b>'+MONTHS[i].toUpperCase()+'</b><i>'+MONTHS[i]+'</i></span>'}
 function stk(id,sz){var p=String(id).split(':'),i=+p[1];
  if(p[0]==='f'&&FACES[p[1]])return faceSvg(p[1],p[2],sz||40);
  if(p[0]==='c'&&FACES[p[1]])return faceSvg(p[1],p[2],sz||40,true);
  if(p[0]==='l'&&LABELS[i])return sk(LABELS[i],i);
  if(p[0]==='s'&&STUDY[i])return sk(STUDY[i],i+5);
  if(p[0]==='m'&&MONTHS[i])return mon(i);
  if(p[0]==='q'&&QUOTES[i])return qk(QUOTES[i],i);
  return '<span class="em">'+esc(String(id))+'</span>'}
 function stkMini(id){var p=String(id).split(':'),i=+p[1],d=function(c){return '<i style="display:block;width:10px;height:10px;border-radius:50%;background:'+c+'"></i>'};
  if(p[0]==='f'&&FACES[p[1]])return faceSvg(p[1],p[2],16);
  if(p[0]==='c'&&FACES[p[1]])return faceSvg(p[1],p[2],16,true);
  if(p[0]==='q')return d('color-mix(in srgb,var(--accent) 60%,var(--card))');
  if(p[0]==='l')return d(PALS[(i*3+Math.floor(i/8))%10][1]);
  if(p[0]==='s')return d(PALS[((i+5)*3+Math.floor((i+5)/8))%10][1]);
  if(p[0]==='m')return d(MC[i]);
  return esc(String(id))}
 function stickerSection(st){
  var items={faces:colorfulFaces(),labels:LABELS.map(function(l,i){return 'l:'+i}),study:STUDY.map(function(l,i){return 's:'+i}),quotes:QUOTES.map(function(q,i){return 'q:'+i}),months:MONTHS.map(function(m,i){return 'm:'+i}),emoji:STK},
   tabs=[['faces','Faces'],['study','Study'],['emoji','Emoji']];
  return '<div class="dsec"><h3>Stickers</h3><div class="stks">'+(st.map(function(x,i){return '<button data-rm="'+i+'" aria-label="Remove sticker">'+stk(x,44)+'</button>'}).join('')||'<span class="hint">Pick one below to stick it on this day. Tap a placed sticker to remove it.</span>')+'</div>'+
   '<div class="ftabs" style="margin:10px 0 8px">'+tabs.map(function(t){return '<button data-stab="'+t[0]+'" aria-pressed="'+(stkTab===t[0])+'">'+t[1]+'</button>'}).join('')+'</div>'+
   '<div class="spal">'+items[stkTab].map(function(x){return '<button data-st="'+x+'" aria-label="Add sticker">'+stk(x,40)+'</button>'}).join('')+'</div></div>'}

 // ===== icons, panels
 var ICO={timer:'<path d="M6 3h12M6 21h12M8 3v4l4 5-4 5v4M16 3v4l-4 5 4 5v4"/>',tasks:'<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  cal:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',chat:'<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  files:'<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  guide:'<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon:'<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  vol:'<path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
  mute:'<path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M23 9l-6 6M17 9l6 6"/>',menu:'<path d="M3 6h18M3 12h18M3 18h18"/>',bulb:'<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>',book:'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M8 7h8M8 11h6"/>',spark:'<path d="M11 3l1.8 5.2L18 10l-5.2 1.8L11 17l-1.8-5.2L4 10l5.2-1.8z"/><path d="M19 15l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z"/>',
  x:'<path d="M18 6L6 18M6 6l12 12"/>',check:'<path d="M20 6L9 17l-5-5"/>',kb:'<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
  bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/>',repeat:'<path d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3"/>',
  vib:'<rect x="8" y="3" width="8" height="18" rx="2"/><path d="M3 8v8M21 8v8"/>',tag:'<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8zM7 7h.01"/>',
  star:'<polygon points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.3 12 2"/>',starf:'<polygon fill="currentColor" points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.3 12 2"/>',
  trash:'<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>',alarm:'<circle cx="12" cy="13" r="7"/><path d="M12 10v3l2 1M5 3L2 6M19 3l3 3"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',mic:'<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4"/>',send:'<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>',stop:'<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>'};
 function calIc(){return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><text id="calDay" x="12" y="19" text-anchor="middle" font-size="8.5" font-weight="700" fill="currentColor" stroke="none">'+new Date().getDate()+'</text></svg>'}
 function ic(n){return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+ICO[n]+'</svg>'}
 var NAV=[['timer','Timer'],['cal','Calendar'],['chat','Chat']],chatDate=null,ff='all';
 function buildRail(){
  $('rail').innerHTML=NAV.map(function(n){return '<button data-go="'+n[0]+'" aria-label="'+n[1]+'">'+(n[0]==='cal'?calIc():ic(n[0]))+n[1]+(n[0]==='chat'?'<span class="bd" hidden></span>':'')+'</button>'}).join('');
  $('rail').onclick=function(e){var b=e.target.closest('[data-go]');if(b)show(b.dataset.go)};
 }
 function show(p){
  if(locked&&p!=='timer')return;
  ['timer','cal','chat','tips'].forEach(function(n){document.querySelectorAll('[data-p="'+n+'"]').forEach(function(e){e.classList.toggle('show',n===p)})});
  document.querySelectorAll('#rail button').forEach(function(b){b.setAttribute('aria-current',b.dataset.go===p?'page':'false')});
  if(p==='chat'){S.unread=0;save();badge();chatRender()}if(p==='tips')tipsRender();if(p==='cal'){if(calV==='day')calV='month';cal()}
 }
 function badge(){var b=document.querySelector('#rail .bd');if(b){b.hidden=!S.unread;b.textContent=S.unread}}
 $('menuBtn').onclick=function(){$('themePop').hidden=!$('themePop').hidden};$('tipsBtn').onclick=function(){$('themePop').hidden=true;show('tips')};
 document.addEventListener('click',function(e){if(!e.target.closest('.hdr'))$('themePop').hidden=true});
 function clk(){var n=new Date(),cd=document.getElementById('calDay');if(cd&&cd.textContent!=n.getDate())cd.textContent=n.getDate();$('bigT').textContent=n.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'});$('bigD').textContent=n.toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
 var tt;function toast(m){var t=$('toast');t.textContent=m;t.hidden=false;clearTimeout(tt);tt=setTimeout(function(){t.hidden=true},3800)}
 function modal(h){var m=$('modal');m.innerHTML='<div class="mbox" role="dialog" aria-modal="true">'+h+(h.indexOf('data-close')<0?'<button class="ghost sm" data-close>Close</button>':'')+'</div>';m.hidden=false}
 function closeModal(){$('modal').hidden=true;$('modal').innerHTML='';ytWatch=null}
 $('modal').onclick=function(e){if(e.target===this||e.target.closest('[data-close]'))closeModal();else chipClick(e)};
 document.addEventListener('keydown',function(e){if(e.key==='Escape')closeModal()});

 // ===== storage: files in IndexedDB ("files" = chat copy, "offline" = offline copy)
 function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
 function findAtt(id){var r=null;S.msgs.forEach(function(m){m.atts.forEach(function(a){if(a.id===id)r=a})});return r}
 function allAtts(){var r=[];S.msgs.forEach(function(m){if(m.type==='rem'&&!m.fired)return;m.atts.forEach(function(a){r.push({a:a,d:m.d})})});return r.sort(function(x,y){return y.d.localeCompare(x.d)})}
 function kindIc(k){return {link:'🔗',image:'🖼',video:'🎞',doc:'📄',audio:'🎤'}[k]}
 function addMsg(d,t,text,files){
  var atts=[],ps=[];
  (text.match(/https?:\/\/\S+/g)||[]).forEach(function(u){atts.push({id:uid(),name:u.replace(/^https?:\/\//,'').slice(0,50),kind:'link',url:u,off:false})});
  Array.prototype.forEach.call(files||[],function(f){var a={id:uid(),name:f.name,kind:kindOf(f),off:false};atts.push(a);ps.push(idb('files','put',a.id,f))});
  return Promise.all(ps).then(function(r){
   if(r.some(function(x){return !x}))toast('Some files could not be stored (browser storage may be full or blocked).');
   S.msgs.push({id:uid(),d:d,t:t,text:text,atts:atts,type:t?'rem':'note',fired:false,ts:Date.now()});save();due();
  });
 }
 function dl(a){
  if(a.kind==='link'){a.off=true;save();return Promise.resolve(true)}
  var fromFiles=function(){return idb('files','get',a.id).then(function(f){if(!f){a.off=false;save();toast('This file is no longer stored here. Attach it again to open it.');return false}
   return idb('offline','put',a.id,f).then(function(ok){if(ok){a.off=true;save()}return ok})})};
  if(a.off)return idb('offline','get',a.id).then(function(o){return o?true:fromFiles()});
  return fromFiles();
 }
 function openAtt(a){if(locked&&study(a)==='no'){toast('Blocked in strict mode: this does not look study related.');return}
  dl(a).then(function(ok){refresh();if(!ok)return;
  if(a.kind==='link'){var y=ytId(a.url);if(y)focusPlayer(y,a.name);else if(locked)toast('Only videos open while the screen is locked.');else window.open(a.url,'_blank','noopener');return}
  idb('offline','get',a.id).then(function(f){if(!f)return;var u=URL.createObjectURL(f);
   if(a.kind==='image')modal('<img src="'+u+'" alt="'+esc(a.name)+'">');
   else if(a.kind==='video')modal('<video src="'+u+'" controls></video>');
   else if(a.kind==='audio')modal('<audio src="'+u+'" controls></audio>');
   else if(locked)modal('<iframe src="'+u+'" title="'+esc(a.name)+'" style="width:100%;height:70vh;border:0"></iframe>');else openDoc(a,f,u)})})}
 function openDoc(a,f,u){var t=(f.type||'').toLowerCase(),n=(a.name||'').toLowerCase();
  if(t==='application/pdf'||/\.pdf$/.test(n)||t.indexOf('text/')===0||/\.(txt|md)$/.test(n)){modal('<iframe src="'+u+'" title="'+esc(a.name)+'" style="width:100%;height:70vh;border:0"></iframe>');return}
  var l=document.createElement('a');l.href=u;l.download=a.name||'document';document.body.appendChild(l);l.click();l.remove();toast('Saved to your downloads. Open it in PowerPoint, Word or your files app.')}
 function prefetch(){var k=key(new Date()),L=allAtts().filter(function(x){return x.d===k&&!x.a.off});if(!L.length)return;
  Promise.all(L.map(function(x){return dl(x.a)})).then(function(){toast(L.length+' item'+(L.length===1?'':'s')+' from today saved for offline study');refresh()})}
 function askClean(manual){
  var L=allAtts().filter(function(x){return x.a.off});
  if(!L.length){if(manual===true)toast('No offline copies to delete.');return}
  modal('<h2>'+(manual===true?'Clean up offline data':'Task done! Delete offline copies?')+'</h2><p class="hint">Only the offline copies are deleted. Your chat keeps every item, so you can use Download in the chat on that date to get it again.</p><div class="clist">'+
   L.map(function(x){return '<label><input type="checkbox" value="'+x.a.id+'"> '+kindIc(x.a.kind)+' '+esc(x.a.name)+' <em class="hint">'+x.d+'</em></label>'}).join('')+
   '</div><div class="crow"><button class="ghost" data-close>Keep all</button><button class="main-btn sm" id="delSel">Delete selected</button></div>');
  $('delSel').onclick=function(){var ids=[].slice.call(document.querySelectorAll('.clist input:checked')).map(function(i){return i.value});
   ids.forEach(function(id){var a=findAtt(id);if(a){a.off=false;idb('offline','del',id)}});save();closeModal();refresh();toast(ids.length?ids.length+' offline cop'+(ids.length===1?'y':'ies')+' deleted':'Nothing selected')};
 }
 function chip(a,d){var v=study(a),y=a.kind==='link'&&ytId(a.url);
  return '<div class="chip" data-a="'+a.id+'"><span>'+kindIc(a.kind)+' '+esc(a.name)+'</span><b class="tag t-'+v+'">'+({yes:'Study',no:'Not study',maybe:'Unsure'})[v]+'</b><em>'+(d?d+' · ':'')+(a.off?'Saved offline':'In chat only')+'</em><button class="ghost sm" data-act="open">'+(y?'Watch':'Open')+'</button>'+(a.off?'':'<button class="ghost sm" data-act="dl">Download</button>')+'</div>'}
 function chipClick(e){var b=e.target.closest('[data-act]'),c=e.target.closest('.chip');if(!b||!c)return;var a=findAtt(c.dataset.a);if(!a)return;
  if(b.dataset.act==='open')openAtt(a);else dl(a).then(function(ok){if(ok)toast('Saved for offline use');refresh()})}
 function refresh(){chatRender();filesRender()}

 // ===== chat + reminders
 function arrAt(m){return m.type==='rem'?new Date((m.sd||m.d)+'T'+(m.st||m.t)+':00'):new Date(m.ts)}
 function stamp(d){return d.toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short',year:'numeric'})+' · '+d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
 function bub(m){return '<div class="bub '+(m.type==='rem'?'rem':'me')+'" data-d="'+m.d+'"><small>'+stamp(arrAt(m))+' · '+(m.helper?'Study helper':m.type==='rem'?'Reminder from you':'Note')+'</small>'+(m.text?'<p>'+esc(m.text)+'</p>':'')+m.atts.map(function(a){return chip(a)}).join('')+'</div>'}
 function chatRender(){
  var all=S.msgs.filter(function(m){return !(m.type==='rem'&&!m.fired)}).sort(function(a,b){return arrAt(a)-arrAt(b)}),
   pend=S.msgs.filter(function(m){return m.type==='rem'&&!m.fired}).sort(function(a,b){return arrAt(a)-arrAt(b)});
  var h=all.length?all.map(bub).join(''):'<p class="empty">Say hi to yourself. Send a note, or attach files and set a time to get them back as a reminder.</p>';
  if(pend.length)h+='<div class="sched"><b>Scheduled</b>'+pend.map(function(m){return '<div>'+stamp(arrAt(m))+' · '+esc(m.text||'')+(m.atts.length?' ('+m.atts.length+' attached)':'')+' <button class="x" data-cancel="'+m.id+'" aria-label="Cancel reminder">×</button></div>'}).join('')+'</div>';
  var th=$('thread');th.innerHTML=h;th.scrollTop=th.scrollHeight}
 $('chTabs').onclick=function(e){var b=e.target.closest('[data-ch]');if(!b)return;var f=b.dataset.ch==='files';$('chatMain').hidden=f;$('chatFiles').hidden=!f;
  document.querySelectorAll('#chTabs button').forEach(function(x){x.setAttribute('aria-pressed',x===b)});if(f)filesRender();else chatRender()};
 $('thread').onclick=function(e){var c=e.target.closest('[data-cancel]');
  if(c){var id=c.dataset.cancel,m=S.msgs.filter(function(x){return x.id===id})[0];if(m){m.atts.forEach(function(a){idb('files','del',a.id);idb('offline','del',a.id)});S.msgs=S.msgs.filter(function(x){return x.id!==id});save();chatRender();cal()}return}
  chipClick(e)};
 $('flist').onclick=chipClick;
 function todayK(){return key(new Date())}
 var pend=[],sch={d:'',t:''},rec=null,chunks=[];
 function kindOf(f){return f.type.indexOf('image')===0?'image':f.type.indexOf('video')===0?'video':f.type.indexOf('audio')===0?'audio':'doc'}
 function composerUI(){
  var h=pend.map(function(f,i){return '<span class="pc">'+kindIc(kindOf(f))+' '+esc(f.name)+' <button class="x" data-rp="'+i+'" aria-label="Remove">×</button></span>'}).join('');
  if(sch.t)h+='<span class="pc">'+ic('alarm')+' arrives '+(sch.d||todayK())+' '+sch.t+' <button class="x" data-rs="1" aria-label="Clear time">×</button></span>';
  $('pendBar').innerHTML=h;var has=$('msgIn').value.trim()||pend.length;
  $('micBtn').innerHTML=ic(rec?'stop':has?'send':'mic');$('micBtn').setAttribute('aria-label',rec?'Stop recording':has?'Send':'Record a voice note')}
 function composerInit(){$('dictBtn').innerHTML=ic('book');$('menuBtn').innerHTML=ic('menu');$('tipsBtn').innerHTML=ic('bulb')+' Help';$('plusBtn').innerHTML=ic('plus');$('cuteBtn').innerHTML=ic('alarm');composerUI()}
 $('plusBtn').onclick=function(){$('fileIn').click()};
 $('fileIn').onchange=function(){Array.prototype.forEach.call(this.files,function(f){pend.push(f)});this.value='';composerUI()};
 $('msgIn').oninput=function(){this.style.height='auto';this.style.height=Math.min(this.scrollHeight,120)+'px';this.style.overflowY=this.scrollHeight>120?'auto':'hidden';this.classList.toggle('scrolls',this.scrollHeight>120);composerUI()};
 $('msgIn').onkeydown=function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMsg()}};
 $('pendBar').onclick=function(e){var r=e.target.closest('[data-rp]');if(r){pend.splice(+r.dataset.rp,1);composerUI()}
  if(e.target.closest('[data-rs]')){sch={d:'',t:''};$('schT').value='';composerUI()}};
 $('cuteBtn').onclick=function(){var p=$('schPop');p.hidden=!p.hidden;if(!p.hidden){$('schD').value=sch.d||todayK();schTasks()}};
 $('schD').onchange=function(){sch.d=this.value;schTasks();composerUI()};
 $('schT').onchange=$('schT').oninput=function(){sch.t=this.value;composerUI()};
 function schTasks(){var d=$('schD').value||todayK(),L=S.tasks.filter(function(t){return t.d===d});
  $('schList').innerHTML=L.length?'<b>To-do on '+d+'</b>'+L.map(function(t){return '<div>'+(t.imp?'⭐ ':'')+esc(t.text)+(t.t?' · '+t.t:'')+'</div>'}).join(''):'<span class="hint">No to-do planned for this day.</span>'}
 function sendMsg(){var t=$('msgIn').value.trim();if(!t&&!pend.length)return;var d=sch.d||todayK(),tm=sch.t;
  try{if(tm&&window.Notification&&Notification.permission==='default')Notification.requestPermission()}catch(e){}
  addMsg(d,tm,t,pend).then(function(){$('msgIn').value='';$('msgIn').style.height='auto';$('msgIn').classList.remove('scrolls');pend=[];sch={d:'',t:''};$('schT').value='';$('schPop').hidden=true;composerUI();chatRender();cal();toast(tm?'Reminder set for '+d+' at '+tm:'Saved to your journal')})}
 $('micBtn').onclick=function(){if(rec){rec.stop();return}if($('msgIn').value.trim()||pend.length){sendMsg();return}
  if(!navigator.mediaDevices||!window.MediaRecorder){toast('Voice notes are not supported here.');return}
  navigator.mediaDevices.getUserMedia({audio:true}).then(function(st){chunks=[];rec=new MediaRecorder(st);
   rec.ondataavailable=function(e){chunks.push(e.data)};
   rec.onstop=function(){st.getTracks().forEach(function(t){t.stop()});var b=new Blob(chunks,{type:rec.mimeType||'audio/webm'});rec=null;
    pend.push(new File([b],'voice-note-'+new Date().toTimeString().slice(0,5).replace(':','')+'.webm',{type:b.type}));composerUI()};
   rec.start();composerUI()}).catch(function(){toast('Microphone permission was declined or is blocked on this page.')})};
 var ctx=null,ringIv=null,ringQ=[],wake=null,wakeTry=0;
 function getCtx(){try{if(!ctx)ctx=new (window.AudioContext||window.webkitAudioContext)();if(ctx.state==='suspended')ctx.resume()}catch(e){}return ctx}
 document.addEventListener('pointerdown',getCtx);document.addEventListener('keydown',getCtx);
 function note(f,t,d,ty){var c=getCtx();if(!c)return;var o=c.createOscillator(),g=c.createGain(),T=c.currentTime+t;o.type=ty||'sine';o.frequency.value=f;o.connect(g);g.connect(c.destination);
  g.gain.setValueAtTime(.0001,T);g.gain.exponentialRampToValueAtTime(.25,T+.02);g.gain.exponentialRampToValueAtTime(.0001,T+d);o.start(T);o.stop(T+d+.03)}
 function beep(){if(!S.sound)return;note(660,0,.2);note(880,.25,.2);note(660,.5,.2)}
 var TONES={classic:{f:[880,1100,880,1100],d:.18,s:.25,ty:'sine'},chime:{f:[523,659,784,1047],d:.5,s:.3,ty:'sine'},digital:{f:[1400,0,1400,0,1400],d:.08,s:.14,ty:'square'},soft:{f:[440,554,659],d:.4,s:.35,ty:'sine'}};
 function playTone(n,vib){var T=TONES[n]||TONES.classic;T.f.forEach(function(f,i){if(f)note(f,i*T.s,T.d,T.ty)});if(vib!==false)try{navigator.vibrate&&navigator.vibrate([300,150,300])}catch(e){}}
 function ringOnce(){var o=ringQ[0]||{};playTone(o.tone,o.vib)}
 function ring(o){ringQ.push(o);if(ringQ.length===1)showRing()}
 function showRing(){var o=ringQ[0],acts=o.actions||[o.snooze&&{l:'Snooze 5 min',fn:o.snooze},(o.open&&!locked)&&{l:'Open chat',fn:o.open},{l:'Dismiss',p:1}].filter(Boolean);
  o._acts=acts;$('ringT').textContent=o.title;$('ringB').textContent=o.body||'';$('ringTip').textContent=o.tip||'';
  $('ringBtns').innerHTML=acts.map(function(a,i){return '<button class="'+(a.p?'main-btn':'ghost')+'" data-ra="'+i+'">'+esc(a.l)+'</button>'}).join('');
  $('ring').hidden=false;ringOnce();clearInterval(ringIv);ringIv=setInterval(ringOnce,2000);
  try{if(document.hidden&&window.Notification&&Notification.permission==='granted')new Notification(o.title,{body:o.body})}catch(e){}}
 function endRing(i){clearInterval(ringIv);var o=ringQ.shift();$('ring').hidden=true;try{navigator.vibrate&&navigator.vibrate(0)}catch(e){}
  var a=o&&o._acts&&o._acts[i];if(a&&a.fn)a.fn();if(ringQ.length)showRing()}
 $('ringBtns').onclick=function(e){var b=e.target.closest('[data-ra]');if(b)endRing(+b.dataset.ra)};
 function hmOf(d){return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2)}
 function due(){
  if(S.day!==new Date().toDateString()){dayReset();dots();save()}
  var n=new Date(),k=key(n),hm=hmOf(n),mins=n.getHours()*60+n.getMinutes(),c=0;
  S.msgs.forEach(function(m){var dd=m.sd||m.d,tt=m.st||m.t;if(m.type==='rem'&&!m.fired&&(dd<k||(dd===k&&tt<=hm))){m.fired=true;c++;ping(m)}});
  S.alarms.forEach(function(a){if(!a.on||a.last===k)return;if(a.days&&a.days.length&&a.days.indexOf(n.getDay())<0)return;var diff=mins-(+a.t.slice(0,2)*60+ +a.t.slice(3));
   if(diff>=0){a.last=k;c++;if(!a.rep)a.on=false;if(diff<=10)ring({title:a.label||'Alarm',body:a.t+' · '+repTxt(a),tone:a.tone,vib:a.vib,snooze:function(){snoozeAlarm(a)}})}});
  if(c){save();badge();refresh();alRender();cal()}
  keepAwake()}
 function ping(m){S.unread=(S.unread||0)+1;var x=m.text||(m.atts.length+' item(s) for you');
  ring({title:'Reminder from you',body:x+(m.atts.length?' · '+m.atts.length+' attached':''),snooze:function(){var d=new Date(Date.now()+3e5);m.sd=key(d);m.st=hmOf(d);m.fired=false;save();refresh()},open:function(){show('chat')}})}
 function snoozeAlarm(a){var d=new Date(Date.now()+3e5);S.alarms.push({id:uid(),t:hmOf(d),label:a.label,rep:false,days:[],tone:a.tone,vib:a.vib,on:true,last:''});save();alRender()}
 function nextMs(){var n=Date.now(),best=1e15,d=key(new Date());
  S.msgs.forEach(function(m){if(m.type==='rem'&&!m.fired){var ms=new Date((m.sd||m.d)+'T'+(m.st||m.t)+':00').getTime()-n;if(ms<best)best=ms}});
  S.alarms.forEach(function(a){if(!a.on)return;var t=new Date();t.setHours(+a.t.slice(0,2),+a.t.slice(3),0,0);var ms=t.getTime()-n;if(ms<0&&a.last!==d)ms=0;if(ms<0)ms+=864e5;if(ms<best)best=ms});return best}
 function keepAwake(){var need=nextMs()<=3*36e5;
  if(need&&!wake&&!document.hidden&&navigator.wakeLock&&Date.now()-wakeTry>3e4){wakeTry=Date.now();navigator.wakeLock.request('screen').then(function(w){wake=w;w.addEventListener('release',function(){wake=null})}).catch(function(){})}
  if(!need&&wake){wake.release();wake=null}}
 function alRender(){var L=S.alarms.slice().sort(function(a,b){return a.t.localeCompare(b.t)});
  $('alList').innerHTML=L.length?L.map(function(a){return '<li class="al" data-al="'+a.id+'"><b>'+a.t+'</b><label style="cursor:default">'+esc(a.label||'Alarm')+' <small class="hint">'+repTxt(a)+'</small></label><input type="checkbox" '+(a.on?'checked':'')+' aria-label="Alarm on"><button class="ib" data-del aria-label="Delete alarm">'+ic('trash')+'</button></li>'}).join(''):'<li class="empty">No alarms yet.</li>'}
 $('alList').onclick=function(e){var li=e.target.closest('[data-al]');if(!li)return;var a=S.alarms.filter(function(x){return x.id===li.dataset.al})[0];if(!a)return;
  if(e.target.closest('[data-del]'))S.alarms=S.alarms.filter(function(x){return x!==a});
  else if(e.target.type==='checkbox'){a.on=e.target.checked;a.last=a.t<=hmOf(new Date())?key(new Date()):''}else{openAlarm(a);return}save();alRender()};
 var sw={run:false,t0:0,acc:0,iv:null,laps:[]};
 function swFmt(ms){var m=Math.floor(ms/6e4),x=Math.floor(ms%6e4/1e3);return (m<10?'0':'')+m+':'+(x<10?'0':'')+x+'.'+Math.floor(ms%1e3/100)}
 function swEl(){return sw.acc+(sw.run?Date.now()-sw.t0:0)}
 $('swGo').onclick=function(){if(sw.run){sw.acc=swEl();sw.run=false;clearInterval(sw.iv);this.textContent='Resume'}else{sw.t0=Date.now();sw.run=true;sw.iv=setInterval(function(){$('swT').textContent=swFmt(swEl())},100);this.textContent='Pause'}};
 $('swLap').onclick=function(){if(!sw.run)return;sw.laps.unshift(swFmt(swEl()));$('swLaps').innerHTML=sw.laps.map(function(l,i){return '<li>Lap '+(sw.laps.length-i)+': '+l+'</li>'}).join('')};
 $('swRst').onclick=function(){clearInterval(sw.iv);sw.run=false;sw.acc=0;sw.laps=[];$('swT').textContent='00:00.0';$('swGo').textContent='Start';$('swLaps').innerHTML=''};
 function setTp(v){document.querySelector('main').setAttribute('data-tp',v);if(v==='stats')statsRender();
  document.querySelectorAll('#tpTabs button').forEach(function(b){b.setAttribute('aria-pressed',b.dataset.tp===v)});
  var c={alarm:'cAlarm',sw:'cSw',clock:'cTime'};['cAlarm','cSw','cTime'].forEach(function(id){$(id).hidden=id!==c[v]})}
 $('tpTabs').onclick=function(e){var b=e.target.closest('[data-tp]');if(b&&!locked)setTp(b.dataset.tp)};
 var LOWST=['🌙','☁️','☕'],HIGHST=['🌈','🌸','🍀','🎀'],
  TIPS={great:['Do your hardest subject first in a full 25-minute focus session.','Kaizen: beat yesterday by one small step, like one extra page.','End with a 3-line hansei (reflection): what went well and what to fix.'],
   ok:['Start with one 25-minute focus session, then decide about the next.','Tidy your desk first and keep only what you need on it.','Pick just 3 tasks for today.'],
   tired:['Use a shorter session: 15 minutes, then a proper break.','Do easy review work, like re-reading notes, instead of new topics.','Drink water, stretch, and plan an earlier night.'],
   low:['5-minute rule: study for just 5 minutes. You are allowed to stop after that. Starting is usually the hardest part.','Kaizen: pick the tiniest step, like opening the book and reading one paragraph.','Tidy your desk for 2 minutes. It often makes starting easier.'],
   stressed:['Brain dump: write everything on your mind as tasks, then pick only one.','Do one 10-minute session on that single task.','Breathe slowly for 1 minute or take a short walk before you start.']},
  STARTER=['Tidy your desk (2 min)','Kaizen step: study one small topic for 10 min','One 25-minute focus session on your hardest subject','Review yesterday\'s notes (5 min)','Hansei: write 3 lines on what went well and what to fix','Plan tomorrow\'s top 3 tasks'];
 function starterRender(){$('starter').innerHTML=STARTER.map(function(t,i){return '<div class="stl"><span>'+esc(t)+'</span><button class="ib" data-sa="'+i+'" aria-label="Add to today">'+ic('plus')+'</button></div>'}).join('')}
 function tipsRender(){}
 function moodRender(){var k=todayK(),m=S.mood[k],st=S.stick[k]||[],why='';
  $('moodRow').innerHTML=MOODS.map(function(x){return '<button data-mood="'+x.k+'" aria-pressed="'+(m===x.k)+'" aria-label="'+x.l+'" title="'+x.l+'">'+faceSvg(x.x,x.t,38)+'</button>'}).join('');
  if(!m){if(st.some(function(x){return LOWST.indexOf(x)>=0})){m='low';why='Your stickers look low-energy. '}else if(st.some(function(x){return HIGHST.indexOf(x)>=0})){m='great';why='Your stickers look upbeat. '}}
  $('moodTip').innerHTML=m?why+'<b>'+MOODS.filter(function(x){return x.k===m})[0].l+':</b> '+TIPS[m][0]+(m==='low'||m==='tired'?' <button class="ghost sm" id="five">Start 5 minutes</button>':''):'Tap a face and I will suggest how to start.'}
 document.addEventListener('click',function(e){var x=e.target.closest('#moodRow [data-mood]');
  if(x){S.mood[todayK()]=x.dataset.mood;save();moodRender();cal();return}
  if(e.target.closest('#five')){if(locked)return;setMode('focus');total=left=300;render();setTp('timer');show('timer');toast('5 minutes only. You may stop after that.');return}
  var a=e.target.closest('[data-sa]');if(a){newTask(STARTER[+a.dataset.sa],todayK(),'');tasks();cal();toast('Added to today');return}
  if(e.target.closest('#starterAll')){STARTER.forEach(function(t){newTask(t,todayK(),'')});tasks();cal();toast('Added 6 tasks to today')}});
 // ===== break time: suggestions
 var BRK={stretch:['Roll your shoulders back 10 times, then tilt your head gently side to side.','Stand up, reach both arms overhead for 20 seconds, then bend forward slowly.','Rotate your wrists and stretch your fingers, then shake out your hands.'],
  phone:['Keep your phone face down or in another room for this break.','No scrolling: look out of the window or walk around instead.'],
  recall:['Close your notes and say out loud what you just learned.','Write three key points from memory, then check them against your notes.'],
  eyes:['Look at something about 6 metres (20 ft) away for 20 seconds and blink slowly.','Cover your closed eyes with your palms for 30 seconds.']};
 function pick(a){return a[Math.floor(Math.random()*a.length)]}
 function breakUI(){var c=$('breakCard');c.hidden=mode==='focus';if(mode==='focus')return;
  $('breakList').innerHTML=[['Stretch','stretch'],['No phone','phone'],['Recall','recall'],['Eyes','eyes']].map(function(x){return '<li><b>'+x[0]+':</b> '+pick(BRK[x[1]])+'</li>'}).join('');
}

 // ===== start of the day: mood, then starter tasks (editable)
 function onboard(){
  var k=todayK();if(S.askDay===k||locked)return;
  function done(){S.askDay=k;save()}
  function step2(){
   if(S.starterDone||S.tasks.some(function(t){return t.d===k||!t.d})){closeModal();return}
   modal('<h2>Starter tasks for beginners</h2><p class="hint">Tick the ones you want and edit the text if you like. They are added to today\'s tasks.</p><div id="obList">'+STARTER.map(function(t,i){return '<label class="obrow"><input type="checkbox" checked data-i="'+i+'" aria-label="Add task '+(i+1)+'"><input type="text" value="'+esc(t)+'" maxlength="80" data-t="'+i+'" aria-label="Task '+(i+1)+'"></label>'}).join('')+'</div><div class="crow"><button class="ghost sm" id="obHelp2">Help</button><button class="ghost" data-close id="obSkip2">Skip</button><button class="main-btn sm" id="obAdd">Add selected</button></div>');
   $('obSkip2').addEventListener('click',function(){S.starterDone=true;save()});
   $('obHelp2').onclick=function(){closeModal();show('tips')};
   $('obAdd').onclick=function(){var n=0;document.querySelectorAll('#obList .obrow').forEach(function(r){if(r.querySelector('input[type=checkbox]').checked){var v=r.querySelector('input[type=text]').value.trim();if(v){newTask(v,k,'');n++}}});S.starterDone=true;save();tasks();cal();closeModal();toast(n?n+' task'+(n===1?'':'s')+' added to today':'No tasks added')}}
  modal('<h2>Welcome to Synergy</h2><p>How do you feel today?</p><div class="pal" id="obMood">'+MOODS.map(function(x){return '<button data-mood="'+x.k+'" aria-pressed="'+(S.mood[k]===x.k)+'" aria-label="'+x.l+'" title="'+x.l+'">'+faceSvg(x.x,x.t,42)+'</button>'}).join('')+'</div><p class="hint" id="obTip">Tap a face and I will suggest how to start.</p><div class="crow"><button class="ghost sm" id="obHelp">Help</button><button class="ghost" data-close id="obSkip">Skip</button><button class="main-btn sm" id="obNext">Next</button></div>');
  $('obMood').onclick=function(e){var b=e.target.closest('[data-mood]');if(!b)return;S.mood[k]=b.dataset.mood;save();moodRender();cal();
   document.querySelectorAll('#obMood button').forEach(function(x){x.setAttribute('aria-pressed',x===b)});$('obTip').textContent=TIPS[b.dataset.mood][0]};
  $('obSkip').addEventListener('click',done);
  $('obHelp').onclick=function(){done();closeModal();show('tips')};
  $('obNext').onclick=function(){done();step2()}}
 function dbStateUI(){var el=$('dbState');if(el)el.textContent=SERVER?'Data is saved on the server (MySQL).':'Data is saved in this browser only.'}
 syncHook=function(st){var el=$('dbState');if(el)el.textContent=st==='ok'?'Data is saved on the server (MySQL).':'Server not reachable. Saved in this browser.'};

 // ===== files panel
 function filesRender(){
  var L=allAtts().filter(function(x){return ff==='all'||x.a.kind===ff});
  document.querySelectorAll('#ftabs button').forEach(function(b){b.setAttribute('aria-pressed',b.dataset.f===ff)});
  $('flist').innerHTML=L.length?L.map(function(x){return chip(x.a,x.d)}).join(''):'<p class="empty">Nothing saved here yet.</p>';storUI();
 }
 $('ftabs').onclick=function(e){var b=e.target.closest('[data-f]');if(b){ff=b.dataset.f;filesRender()}};
 $('fSave').onclick=function(){var l=$('fLink').value.trim(),f=$('fFiles').files;if(!l&&!f.length)return;
  addMsg(key(new Date()),'',l,f).then(function(){$('fLink').value='';$('fFiles').value='';refresh();cal();toast('Saved to storage')})};
 $('cleanBtn').onclick=function(){askClean(true)};

 // ===== strict mode, focus player, study check, helper
 var locked=false,leaves=0,hideAt=0;
 function modeUI(){document.querySelectorAll('#modeSw button').forEach(function(b){b.setAttribute('aria-pressed',(b.dataset.s==='1')===!!S.strict)});
  $('modeHint').textContent=S.strict?'Strict: everything locks during focus except notes.':'Easy: every feature stays open.'}
 $('modeSw').onclick=function(e){var b=e.target.closest('[data-s]');if(!b)return;if(timer||locked){toast('Change the mode while the timer is stopped.');return}S.strict=b.dataset.s==='1';save();modeUI()};
 function lock(on){locked=on;document.body.classList.toggle('locked',on);
  if(on){leaves=0;$('lkLeaves').textContent='0'}$('lkTitle').textContent=on?'Strict focus is on':'Notes';$('lkInfo').hidden=!on;$('lkHint').hidden=!on;$('giveUp').hidden=!on;
  window.onbeforeunload=on?function(e){e.preventDefault();e.returnValue='';return ''}:null}
 document.addEventListener('visibilitychange',function(){if(!locked)return;
  if(document.hidden)hideAt=Date.now();else{leaves++;$('lkLeaves').textContent=leaves;toast('You left for '+Math.round((Date.now()-hideAt)/1000)+'s. Stay with it!')}});
 function typed(title,text,ph,btn,go){
  modal('<h2>'+title+'</h2><p>'+text+'</p><p class="hint">Type: <b>'+ph+'</b></p><input type="text" id="chIn" autocomplete="off" autocapitalize="off"><div class="crow"><button class="ghost" data-close>Not now</button><button class="main-btn sm" id="chGo" disabled>'+btn+'</button></div>');
  $('chIn').oninput=function(){$('chGo').disabled=this.value.trim().toLowerCase()!==ph.toLowerCase()};
  $('chGo').onclick=function(){closeModal();go()}}
 function challenge(){typed('Strict mode challenge','Once you start, you cannot pause, reset or skip until the timer ends. Notes, the dictionary and your saved study items still work. Are you sure?','I will stay focused','Start locked',function(){lock(true);start()})}
 $('giveUp').onclick=function(){typed('Give up this session?','The timer stops and this session will not count.','I am giving up','Give up',function(){lock(false);stop();setMode('focus')})};
 $('lkSave').onclick=function(){var t=$('lkNote').value.trim();if(!t)return;addMsg(key(new Date()),'',t,[]).then(function(){$('lkNote').value='';cal();toast('Note saved to today\'s journal')})};
 $('lkItems').onclick=function(){var L=allAtts().slice(0,30);
  modal('<h2>Saved items</h2><p class="hint">Items that do not look study related are blocked while locked.</p>'+(L.length?L.map(function(x){return chip(x.a,x.d)}).join(''):'<p class="empty">Nothing saved yet.</p>')+'<button class="ghost sm" data-close>Close</button>')};
 function ytId(u){try{var x=new URL(u),h=x.hostname.replace(/^www\.|^m\./,''),m;
  if(h==='youtu.be')return /^[\w-]{11}$/.test(x.pathname.slice(1,12))?x.pathname.slice(1,12):null;
  if(h==='youtube.com'||h==='music.youtube.com'){if(x.pathname==='/watch'){var v=x.searchParams.get('v');return v&&/^[\w-]{11}$/.test(v)?v:null}
   m=x.pathname.match(/^\/(embed|live|shorts)\/([\w-]{11})/);if(m)return m[2]}}catch(e){}return null}
 var ytWatch=null,lastWarn=0;
 function notify(title,body){toast(title+(body?': '+body:''));note(300,0,.35);try{if(window.Notification&&Notification.permission==='granted'&&document.hidden)new Notification(title,{body:body})}catch(e){}}
 function focusPlayer(id,name){
  var o=(location.protocol==='http:'||location.protocol==='https:')?'&origin='+encodeURIComponent(location.origin):'';
  try{if(window.Notification&&Notification.permission==='default')Notification.requestPermission()}catch(e){}
  modal('<div class="vid" id="vidBox"><iframe id="ytf" src="https://www.youtube-nocookie.com/embed/'+id+'?rel=0&modestbranding=1&playsinline=1&enablejsapi=1'+o+'" title="'+esc(name)+'" allow="fullscreen; encrypted-media" allowfullscreen sandbox="allow-scripts allow-same-origin allow-presentation" referrerpolicy="strict-origin-when-cross-origin"></iframe></div><p class="hint">Focus player: only this saved video plays. You get a warning if another video opens or you leave this page. If the area stays blank, this host or browser blocks embedded videos.</p><button class="ghost sm" data-close>Close</button>');
  ytWatch={id:id,src:$('ytf').src};var f=$('ytf');
  f.onload=function(){try{f.contentWindow.postMessage(JSON.stringify({event:'listening',id:1,channel:'widget'}),'*')}catch(e){}}}
 window.addEventListener('message',function(e){
  if(!ytWatch||!/youtube/.test(e.origin||''))return;var d;try{d=typeof e.data==='string'?JSON.parse(e.data):e.data}catch(x){return}
  if(!d||d.event!=='infoDelivery'||!d.info)return;var i=d.info;
  if(i.videoData&&i.videoData.video_id&&i.videoData.video_id!==ytWatch.id){notify('Another video opened','Only your saved video is allowed.');var f=$('ytf');if(f)f.src=ytWatch.src;return}
  if(i.playerState===0){var b=$('vidBox');if(b){b.innerHTML='<p class="empty" style="padding:30px;text-align:center">Video finished. Go back to your notes.</p>'}}});
 document.addEventListener('visibilitychange',function(){if(!ytWatch)return;if(document.hidden)ytWatch.hid=Date.now();else notify('You left the page','Back to your video. Use only saved material.')});
 ['wheel','touchmove'].forEach(function(ev){$('modal').addEventListener(ev,function(e){if(!ytWatch||e.target.closest('.vid'))return;if(Date.now()-lastWarn>4000){lastWarn=Date.now();notify('Stay with your video','Scrolling away is not part of this session.')}},{passive:true})});
 var BAD=/(tiktok|instagram|facebook|snapchat|reddit|twitch|netflix|9gag|pinterest|twitter|\/\/x\.com)/i,
  GOOD=/(wikipedia|\.edu|\.ac\.|khanacademy|coursera|edx|nptel|geeksforgeeks|w3schools|stackoverflow|stackexchange|github|developer\.mozilla|tutorialspoint|javatpoint|ncert|arxiv|scholar\.google|leetcode|freecodecamp)/i,
  BADN=/(meme|funny|reel|wallpaper|movie|game|prank|vlog|trailer|gossip)/i,
  GOODN=/(note|chapter|unit|lab|assignment|syllabus|lecture|exam|study|tutorial|theory|practical|slides|question|paper)/i;
 function study(a){if(a.verdict)return a.verdict;var n=a.kind==='link'?a.url:a.name;
  if(a.kind==='audio')return 'yes';
  if(a.kind==='link'){if(BAD.test(n))return 'no';if(GOOD.test(n))return 'yes';return 'maybe'}
  if(BADN.test(n))return 'no';if(GOODN.test(n))return 'yes';return 'maybe'}
 // ===== dictionary (server -> online API -> built-in glossary)
 var GLOSS={algorithm:'A step-by-step set of instructions for solving a problem.',array:'A list of items stored one after another and found by position number.',bandwidth:'The amount of data a connection can carry in a given time.',binary:'A number system that uses only 0 and 1.',bug:'A mistake in a program that makes it behave in the wrong way.',cache:'A small fast store that keeps recently used data so it can be reached quickly.',compiler:'A program that translates code written by a person into machine code.',database:'An organised collection of data that can be searched, added to and updated.',debugging:'Finding and fixing mistakes in a program.',encryption:'Scrambling data so that only someone with the key can read it.',firewall:'Software or hardware that blocks unwanted network traffic.',function:'A named block of code that does one job and can be used again.',kernel:'The core part of an operating system that controls the hardware.',latency:'The delay before data starts to move after a request.',loop:'Code that repeats until a condition is met.',normalization:'Organising database tables to reduce repeated data.',packet:'A small piece of data sent across a network.',protocol:'A set of rules that computers follow to communicate.',query:'A request for data from a database.',recursion:'When a function calls itself to solve smaller parts of a problem.',router:'A device that sends data between networks.',schema:'The design or structure of a database.',server:'A computer that provides data or services to other computers.',variable:'A named place in memory that stores a value.'};
 Object.assign(GLOSS,{api:'A set of rules that lets one program ask another program for data or actions.',framework:'Ready-made code structure that you build your own application on top of.',frontend:'The part of an application that users see and interact with.',backend:'The part of an application that runs on the server and handles data and logic.',html:'The markup language that gives a web page its structure.',css:'The language that controls how a web page looks.',javascript:'A programming language that makes web pages interactive.',http:'The protocol browsers and servers use to exchange web pages and data.',dns:'The system that turns website names into IP addresses.',ip:'A number that identifies a device on a network.',ram:'Fast temporary memory that holds the data a computer is using right now.',cpu:'The processor that carries out the instructions of a computer.',sql:'A language for asking questions of and changing data in a database.',json:'A simple text format for storing and sending structured data.',pointer:'A variable that stores the memory address of another value.',stack:'A list where the last item added is the first one removed.',queue:'A list where the first item added is the first one removed.',object:'A bundle of data and the functions that work on that data.',class:'A blueprint that describes what its objects will contain and do.',interrupt:'A signal that makes a processor pause its current task to handle an urgent event.',microcontroller:'A small computer on one chip that controls a device.'});
 Object.assign(GLOSS,{bit:'The smallest unit of data in a computer, either 0 or 1.',byte:'A group of eight bits.',browser:'A program used to open and use web pages, such as Chrome or Firefox.',cloud:'Computers on the internet that store data and run programs for you.',cookie:'A small piece of data a website saves in your browser.',domain:'The readable name of a website, such as example.com.',git:'A tool that records the history of changes made to files.',github:'A website that hosts Git projects so people can share and work on them together.',hosting:'A service that keeps a website on a server so that people can open it.',deploy:'To put a finished application on a server or website so that people can use it.',iteration:'One repeat of a loop, or one round of improving something.',malware:'Software made to harm a computer or steal information.',phishing:'A trick that uses fake messages or sites to steal passwords or money.',pixel:'The smallest dot of colour on a screen.',sensor:'A device that measures something such as light, heat or movement.',syntax:'The rules for how code must be written so that a computer can understand it.',url:'The address of a page or file on the internet.',string:'A piece of text in a program.',integer:'A whole number without a decimal point.',boolean:'A value that is either true or false.',repository:'A folder where the files and history of a project are kept.',responsive:'A design that adjusts itself to the size of the screen.',pwa:'A website that can be installed like an app and can work offline.',localstorage:'Small storage inside the browser that keeps data after the page is closed.',indexeddb:'A database inside the browser that can store large data such as files.',pomodoro:'A study method of 25 minutes of focus followed by a short break.',synergy:'Different parts working together to give a better result than they could alone.',procrastination:'Delaying a task that should be done now.',kaizen:'A Japanese idea of getting better through many tiny steps.',hansei:'A Japanese habit of reflecting on what went well and what to improve.',focus:'To give your full attention to one thing.'});
 function txt(h){try{return (new DOMParser().parseFromString(h||'','text/html').body.textContent||'').replace(/\s+/g,' ').trim()}catch(e){return ''}}
 function jf(u,ms){var c=window.AbortController?new AbortController():null,t=setTimeout(function(){c&&c.abort()},ms||7000);return fetch(u,c?{signal:c.signal}:{}).then(function(r){clearTimeout(t);return r},function(e){clearTimeout(t);throw e})}
 function srcA(x){return jf('https://api.dictionaryapi.dev/api/v2/entries/en/'+encodeURIComponent(x)).then(function(r){if(r.status===404)return null;if(!r.ok)throw 0;return r.json().then(function(a){var e=(a&&a[0])||{},ms=[];(e.meanings||[]).slice(0,3).forEach(function(m,i){(m.definitions||[]).slice(0,i?1:2).forEach(function(d){if(d.definition)ms.push({pos:m.partOfSpeech||'',def:d.definition,ex:d.example||''})})});return ms.length?{found:true,word:e.word||x,phonetic:e.phonetic||'',meanings:ms,source:'Free Dictionary API'}:null})})}
 function srcB(x){return jf('https://en.wiktionary.org/api/rest_v1/page/definition/'+encodeURIComponent(x)).then(function(r){if(r.status===404)return null;if(!r.ok)throw 0;return r.json().then(function(j){var ms=[];(j.en||[]).slice(0,3).forEach(function(p,i){(p.definitions||[]).slice(0,i?1:2).forEach(function(d){var t=txt(d.definition);if(t)ms.push({pos:(p.partOfSpeech||'').toLowerCase(),def:t,ex:txt((d.examples||[])[0])})})});return ms.length?{found:true,word:x,meanings:ms,source:'Wiktionary'}:null})})}
 function forms(x){var a=[x],st;if(/ies$/.test(x))a.push(x.slice(0,-3)+'y');if(/ied$/.test(x))a.push(x.slice(0,-3)+'y');if(/(s|x|ch|sh)es$/.test(x))a.push(x.slice(0,-2));if(/s$/.test(x))a.push(x.slice(0,-1));
  if(/(ing|ed)$/.test(x)){st=x.replace(/(ing|ed)$/,'');if(/([b-df-hj-np-tv-z])\1$/.test(st))a.push(st.slice(0,-1));a.push(st);a.push(st+'e')}
  return a.filter(function(v,i){return (i===0||v.length>2)&&a.indexOf(v)===i}).slice(0,5)}
 function dist(a,b){var p=[],i,j,c;for(j=0;j<=b.length;j++)p[j]=j;for(i=1;i<=a.length;i++){var q=[i];for(j=1;j<=b.length;j++){c=a[i-1]===b[j-1]?0:1;q[j]=Math.min(p[j]+1,q[j-1]+1,p[j-1]+c)}p=q}return p[b.length]}
 function near(w){var pool=Object.keys(GLOSS).concat(S.words.map(function(x){return x.w})),lim=w.length<5?1:2;
  return pool.filter(function(v,i){return pool.indexOf(v)===i&&v!==w&&Math.abs(v.length-w.length)<=lim&&dist(v,w)<=lim}).sort(function(a,b){return dist(a,w)-dist(b,w)}).slice(0,5)}
 function lookup(w){
  w=w.trim().toLowerCase().replace(/\s+/g,' ');
  var cache=S.dcache=S.dcache||{},cands=forms(w),off=false,g=GLOSS[w];
  if(cache[w])return Promise.resolve(Object.assign({},cache[w],{source:(cache[w].source||'')+' (saved copy)'}));
  function one(x){return srcA(x).then(function(r){return r||srcB(x)},function(){return srcB(x)})}
  function run(i){if(i>=cands.length)return Promise.resolve(null);return one(cands[i]).then(function(r){return r||run(i+1)},function(){off=true;return null})}
  return run(0).then(function(r){
   if(g){r=r||{found:true,word:w,meanings:[],source:'Built-in glossary'};r.meanings=[{pos:'term',def:g,ex:''}].concat(r.meanings)}
   if(r){cache[w]=r;var k=Object.keys(cache);if(k.length>150)delete cache[k[0]];save();return r}
   var mine=S.words.filter(function(x){return x.w===w})[0];
   if(mine&&mine.m)return {found:true,word:w,meanings:[{pos:'',def:mine.m,ex:''}],source:'My words (saved on this device)'};
   if(off)return {found:false,word:w,off:true,sugg:near(w)};
   return jf('https://api.datamuse.com/sug?s='+encodeURIComponent(w)+'&max=5',5000).then(function(x){return x.json()}).then(function(a){var l=a.map(function(x){return x.word}).filter(function(v){return v!==w}).slice(0,5);return {found:false,word:w,sugg:l.length?l:near(w)}},function(){return {found:false,word:w,sugg:near(w)}})})}
 function dictShow(r){
  var el=$('dRes');
  if(!r.found){var sg=r.sugg&&r.sugg.length;
   el.innerHTML='<p class="empty">'+(r.off?'Could not reach the online dictionary for "'+esc(r.word)+'". Check your internet connection and try again. Built-in IT words and your saved words work without internet.'+(sg?' Similar words you can try:':''):'No meaning found for "'+esc(r.word)+'".'+(sg?' Did you mean:':' Check the spelling.'))+'</p>'+(sg?'<div class="spal">'+r.sugg.map(function(x){return '<button class="ghost sm" data-w="'+esc(x)+'">'+esc(x)+'</button>'}).join('')+'</div>':'');return}
  el.innerHTML='<div class="dword">'+esc(r.word)+(r.phonetic?'<span class="dph">'+esc(r.phonetic)+'</span>':'')+'</div>'+
   r.meanings.map(function(m){return '<div class="dm">'+(m.pos?'<b>'+esc(m.pos)+'</b> ':'')+esc(m.def)+(m.ex?'<small>Example: '+esc(m.ex)+'</small>':'')+'</div>'}).join('')+
   '<div class="crow"><button class="main-btn sm" id="dSave">'+(S.words.some(function(x){return x.w===r.word})?'Saved':'Save word')+'</button><span class="hint">Source: '+esc(r.source||'')+'</span></div>';
  $('dSave').onclick=function(){if(!S.words.some(function(x){return x.w===r.word}))S.words.push({w:r.word,m:(r.meanings[0]||{}).def||''});save();dictWords();$('dSave').textContent='Saved';toast('Word saved')}}
 function dictWords(){var b=$('dWords');if(!b)return;
  b.innerHTML=S.words.length?S.words.map(function(x){return '<span class="wrd"><button class="ghost sm" data-w="'+esc(x.w)+'">'+esc(x.w)+'</button><button class="ib" data-wd="'+esc(x.w)+'" aria-label="Remove '+esc(x.w)+'">×</button></span>'}).join(''):'<span class="hint">Words you save appear here.</span>'}
 function openDict(){
  modal('<h2>Dictionary</h2><div class="add"><input type="text" id="dq" placeholder="Type a word" maxlength="40" aria-label="Word" autocapitalize="off" autocomplete="off" spellcheck="false"><button id="dGo">Search</button></div><div id="dRes"></div><h3 style="margin:14px 0 6px;font-size:.95rem">My words</h3><div class="spal" id="dWords"></div><div class="crow"><button class="ghost sm" data-close>Close</button></div>');
  var go=function(w){w=(w||$('dq').value).trim();if(!w)return;$('dq').value=w;$('dRes').innerHTML='<p class="hint">Looking up...</p>';lookup(w).then(dictShow)};
  $('dGo').onclick=function(){go()};$('dq').onkeydown=function(e){if(e.key==='Enter')go()};
  $('dRes').onclick=function(e){var a=e.target.closest('[data-w]');if(a)go(a.dataset.w)};$('dWords').onclick=function(e){var a=e.target.closest('[data-w]'),d=e.target.closest('[data-wd]');if(a)go(a.dataset.w);if(d){S.words=S.words.filter(function(x){return x.w!==d.dataset.wd});save();dictWords()}};
  dictWords();$('dq').focus()}
 $('dictBtn').onclick=openDict;
 function storUI(){var el=$('stor');if(!navigator.storage||!navigator.storage.estimate){el.textContent='';return}
  navigator.storage.estimate().then(function(e){var mb=function(b){return (b/1048576).toFixed(1)+' MB'};
   el.textContent='Browser storage used: '+mb(e.usage||0)+' of about '+mb(e.quota||0)+' available. A saved file counts twice while it also has an offline copy.'}).catch(function(){})}

 load(function(){
  buildRail();modeUI();applyTheme();soundUI();tasks();dots();cal();setMode('focus');clk();setInterval(clk,1000);show('timer');badge();alRender();composerInit();starterRender();moodRender();setTp('timer');openDB(due);setInterval(due,1000);dbStateUI();onboard();
 });
})();
if('serviceWorker' in navigator&&/^https?:/.test(location.protocol))window.addEventListener('load',function(){navigator.serviceWorker.register('sw.js').catch(function(){})});
