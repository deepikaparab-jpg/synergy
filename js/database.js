/* ==========================================================================
   database.js  -  data layer of Synergy
   Two ways to keep data (the app works in both):
     A) SERVER MODE (XAMPP / WAMP): the page asks the PHP backend for the saved
        state (backend/api/state.php) and sends it back after every change.
        The backend stores it in MySQL tables (database/schema.sql).
        Chat files are uploaded to backend/uploads (backend/api/files.php).
     B) BROWSER MODE (no backend): everything stays in the browser
        (localStorage + IndexedDB).
   Mode A is used when js/config.js sets window.SYNERGY_API and the backend
   answers. The browser copy is always kept as a cache.
   This file must be loaded BEFORE app.js.
   ========================================================================== */
var API_BASE=window.SYNERGY_API||'';
var SERVER=false;          /* true when the PHP backend is reachable */
var SAVE_KEY='synergy-v1';
var syncHook=null;         /* app.js sets this to show the save status */

/* ---- 1. State object with default values ---- */
var S={dur:{focus:25,short:5,long:15},sound:true,theme:'default',tone:'',msgs:[],unread:0,strict:false,stick:{},mood:{},alarms:[],words:[],askDay:'',starterDone:false,done:0,tasks:[],hist:{},active:null,day:new Date().toDateString()};
function fixShape(){
 ['hist','stick','mood'].forEach(function(k){if(!S[k]||Array.isArray(S[k]))S[k]={}});
 ['msgs','alarms','tasks','words'].forEach(function(k){if(!Array.isArray(S[k]))S[k]=[]});
 if(!S.dur)S.dur={focus:25,short:5,long:15}}
function dayReset(){if(S.day!==new Date().toDateString()){S.day=new Date().toDateString();S.done=0}}

/* ---- 2. load(cb) / save() ---- */
function load(cb){
 try{var r=localStorage.getItem(SAVE_KEY)||localStorage.getItem('pomodoro-v1');if(r){var d=JSON.parse(r);for(var k in d)S[k]=d[k]}}catch(e){}
 fixShape();dayReset();
 if(!API_BASE){cb&&cb();return}
 fetch(API_BASE+'state.php',{cache:'no-store'}).then(function(r){if(!r.ok)throw 0;return r.json()})
 .then(function(j){if(j&&j.ok){SERVER=true;
   if(j.state){for(var k in j.state)S[k]=j.state[k];fixShape();dayReset();try{localStorage.setItem(SAVE_KEY,JSON.stringify(S))}catch(e){}}
   else pushNow()}})
 .catch(function(){}).then(function(){cb&&cb()})}
var saveTimer=null;
function save(){
 try{localStorage.setItem(SAVE_KEY,JSON.stringify(S))}catch(e){}
 if(SERVER){clearTimeout(saveTimer);saveTimer=setTimeout(pushNow,500)}}
function pushNow(){
 if(!SERVER)return;
 fetch(API_BASE+'state.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(S)})
 .then(function(r){return r.json()}).then(function(j){syncHook&&syncHook(j&&j.ok?'ok':'error')}).catch(function(){syncHook&&syncHook('error')})}

/* ---- 3. Files: "files" store = chat copy (server or IndexedDB), "offline" store = copy on this device ---- */
var db=null;
function openDB(cb){try{var r=indexedDB.open('synergy-files',1);r.onupgradeneeded=function(){r.result.createObjectStore('files');r.result.createObjectStore('offline')};r.onsuccess=function(){db=r.result;cb()};r.onerror=cb}catch(e){cb()}}
function srvFile(op,k,v){
 var u=API_BASE+'files.php?id='+encodeURIComponent(k);
 if(op==='put'){var fd=new FormData();fd.append('id',k);fd.append('file',v,v.name||k);return fetch(API_BASE+'files.php',{method:'POST',body:fd}).then(function(r){return r.ok?true:null}).catch(function(){return null})}
 if(op==='get')return fetch(u).then(function(r){return r.ok?r.blob():null}).catch(function(){return null});
 return fetch(u,{method:'DELETE'}).then(function(r){return r.ok?true:null}).catch(function(){return null})}
function idb(st,op,k,v){
 if(st==='files'&&SERVER)return srvFile(op,k,v);
 return new Promise(function(res){if(!db)return res(null);try{var t=db.transaction(st,op==='get'?'readonly':'readwrite'),o=t.objectStore(st),q=op==='get'?o.get(k):op==='put'?o.put(v,k):o.delete(k);
  t.oncomplete=function(){res(op==='get'?(q.result||null):true)};t.onerror=t.onabort=function(){res(null)}}catch(e){res(null)}})}
