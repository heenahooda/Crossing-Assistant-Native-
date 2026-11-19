/* Crossing Assistant extension layer: settings, speech and vibration control, message priority, camera-angle monitor,
   emergency workflow, voice commands, consent-based logging. Loaded after the main script and lab.js.
   It replaces a few main-script functions (say, speakText, haptic, handleCommand, emergencyCall, ...) by reassigning them. */
var Ext = (function () {
'use strict';
const NATIVE = !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
const NP = n => (NATIVE && window.Capacitor.Plugins && window.Capacitor.Plugins[n]) || null;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const $q = id => document.getElementById(id);
const DEFV = { start:[80], crosswalk:[80], distance:[80, 70, 80], red:[400, 300, 400], green:[80, 80, 80, 80, 80, 80], uncertain:[120, 50, 120, 50, 120, 50, 120], danger:[500, 150, 500, 150, 500, 150, 500] };
const EVENTS = Object.keys(DEFV);
const DEF = () => ({ speechRate:1, volume:1, verbosity:'normal', startDist:10, designDist:10, ecAlert:false, ecLocation:false, ecCall:false, logConsent:false, vib:JSON.parse(JSON.stringify(DEFV)) });
const TIMING = { alignTol:15, alignAfterMs:3000, alignRepeatMs:30000, emCountdownS:10 };   // tunable constants

const saved = store.get('settings2', {});
const s = Object.assign(DEF(), saved); s.vib = Object.assign(JSON.parse(JSON.stringify(DEFV)), saved.vib || {});
const save = () => store.set('settings2', s);
Object.assign(PATTERNS, s.vib);
const events = [];
function logEvent(name, data){ if(!s.logConsent) return; events.push(Object.assign({ time:new Date().toISOString(), event:name }, data || {})); }

/* ---------- strings ---------- */
const X = {
en:{ extSpeechHeading:"Speech and sound", extRate:"Speech speed", extRateSlow:"Slower", extRateFast:"Faster", extVol:"Volume", extTestSpeech:"Test speech",
  extVerb:"Message detail", extVerbMin:"Minimal", extVerbNorm:"Normal", extVerbDet:"Detailed",
  extVerbDesc:"Minimal: danger and signal messages only. Normal: adds distance messages. Detailed: adds left or right offset when available.",
  extDistHeading:"Detection distances", extStartDist:"Detection starting distance (metres)", extDesignDist:"Camera-to-crossing design distance (metres)",
  extDistDesc:"Crossings farther than the design distance are treated as unavailable. Distance messages start only inside the starting distance.",
  extVibHeading:"Vibration patterns", extVibDesc:"Numbers are milliseconds: buzz, pause, buzz… For example 80,60,80. Use numbers from 10 to 2000.", extVibTest:"Test", extVibBad:"Not saved. Use 1 to 12 numbers from 10 to 2000, separated by commas.", extVibReset:"Reset patterns",
  vibEv_start:"Start", vibEv_crosswalk:"Crosswalk", vibEv_distance:"Distance", vibEv_red:"Red signal", vibEv_green:"Green signal", vibEv_uncertain:"Uncertain", vibEv_danger:"Danger",
  extEcHeading:"Emergency alerts", extEcAlert:"Allow emergency alerts to my contact", extEcAlertDesc:"Needed before the app can start an alert. A 10-second countdown with a Cancel button always comes first.",
  extEcLoc:"Include my live location", extEcLocDesc:"Needs location permission and internet. A message with a map link is prepared for you to send.",
  extEcCall:"Call automatically after the countdown", extEcCallDesc:"Android app only. Android asks for call permission. On iPhone and in a browser the dialer opens and you confirm the call.",
  extLogHeading:"Research data logging", extLogConsent:"I consent to logging", extLogDesc:"Logs technical results and interaction events on this device only. No images, audio or location are logged.",
  extDisc:"Disclaimer", extReset:"Reset all settings", extResetConfirm:"Press again to confirm reset", extResetDone:"Settings were reset.",
  disclaimerFull:"Research prototype. Not validated for independent road crossing. Always use your own judgement and established mobility techniques.",
  disclaimer:"Research prototype. Not validated for independent road crossing. Always use your own judgement and established mobility techniques.",
  startAssist:"Assistance started.",
  emText:"In a real emergency in Japan, call 110 for police or 119 for fire and ambulance. This app can only alert your own emergency contact, if you set one up and allow it in Settings. It does not call emergency services.",
  extEmBtn:"ALERT MY EMERGENCY CONTACT", extEmTitle:"Emergency alert", emCountdown:"Alerting {name} in {n} seconds.", emCancel:"CANCEL", emClose:"CLOSE", emNow:"ALERT NOW", emSms:"SEND LOCATION MESSAGE",
  emCalling:"Calling {name}.", emOff:"Emergency alerts are switched off. You can turn them on in Settings.", emCancelled:"Emergency alert cancelled.", emLocFail:"Your location is not available.",
  emSmsBody:"Emergency alert from Crossing Assistant. My location: {url}", volSet:"Volume {n} percent.",
  lblAlign:"Camera angle", align_ok:"Straight ahead", align_down:"Tilted down {n}°", align_up:"Tilted up {n}°", align_unavail:"Unavailable on this device", align_wait:"Checking…",
  alignDown:"The camera is pointing down. Please tilt the phone up so it faces straight ahead.", alignUp:"The camera is pointing up. Please tilt the phone down so it faces straight ahead." },
ja:{ extSpeechHeading:"音声と音量", extRate:"話す速さ", extRateSlow:"遅く", extRateFast:"速く", extVol:"音量", extTestSpeech:"音声をテスト",
  extVerb:"案内の詳しさ", extVerbMin:"最小", extVerbNorm:"標準", extVerbDet:"詳細",
  extVerbDesc:"最小：危険と信号の案内のみ。標準：距離の案内を追加。詳細：分かる場合は左右のずれも案内します。",
  extDistHeading:"検出距離", extStartDist:"検出開始距離（メートル）", extDesignDist:"カメラから横断歩道までの設計距離（メートル）",
  extDistDesc:"設計距離より遠い横断歩道は「利用不可」として扱います。距離の案内は開始距離の内側でのみ始まります。",
  extVibHeading:"振動パターン", extVibDesc:"数値はミリ秒です：振動、休止、振動… 例：80,60,80。10〜2000の数値を使ってください。", extVibTest:"テスト", extVibBad:"保存しませんでした。10〜2000の数値を1〜12個、カンマ区切りで入力してください。", extVibReset:"パターンをリセット",
  vibEv_start:"開始", vibEv_crosswalk:"横断歩道", vibEv_distance:"距離", vibEv_red:"赤信号", vibEv_green:"青信号", vibEv_uncertain:"不確か", vibEv_danger:"危険",
  extEcHeading:"緊急通知", extEcAlert:"緊急連絡先への通知を許可", extEcAlertDesc:"通知を始めるために必要です。常に10秒のカウントダウンとキャンセルボタンが先に表示されます。",
  extEcLoc:"現在地を含める", extEcLocDesc:"位置情報の許可とインターネットが必要です。地図リンク付きのメッセージを作成します（送信はご自身で行います）。",
  extEcCall:"カウントダウン後に自動で電話", extEcCallDesc:"Androidアプリのみ。通話の許可を求めます。iPhoneとブラウザでは電話アプリが開き、ご自身で発信を確認します。",
  extLogHeading:"研究データの記録", extLogConsent:"記録に同意します", extLogDesc:"技術的な結果と操作イベントをこの端末にのみ記録します。画像、音声、位置情報は記録しません。",
  extDisc:"免責事項", extReset:"すべての設定をリセット", extResetConfirm:"もう一度押すとリセットします", extResetDone:"設定をリセットしました。",
  disclaimerFull:"研究用プロトタイプです。単独での道路横断には検証されていません。ご自身の判断と、確立された歩行技術を必ず使ってください。",
  disclaimer:"研究用プロトタイプです。単独での道路横断には検証されていません。ご自身の判断と、確立された歩行技術を必ず使ってください。",
  startAssist:"支援を開始しました。",
  emText:"日本で緊急の場合は、警察は110番、消防・救急は119番に電話してください。このアプリは、設定で許可した場合にご自身の緊急連絡先へ知らせるだけで、緊急通報はしません。",
  extEmBtn:"緊急連絡先に知らせる", extEmTitle:"緊急通知", emCountdown:"{n}秒後に{name}に知らせます。", emCancel:"キャンセル", emClose:"閉じる", emNow:"今すぐ知らせる", emSms:"位置情報メッセージを送る",
  emCalling:"{name}に電話します。", emOff:"緊急通知はオフです。設定でオンにできます。", emCancelled:"緊急通知をキャンセルしました。", emLocFail:"現在地を取得できません。",
  emSmsBody:"横断アシスタントからの緊急通知です。現在地：{url}", volSet:"音量{n}パーセント。",
  lblAlign:"カメラの向き", align_ok:"正面", align_down:"{n}°下向き", align_up:"{n}°上向き", align_unavail:"この端末では利用できません", align_wait:"確認中…",
  alignDown:"カメラが下を向いています。正面を向くようにスマートフォンを上に傾けてください。", alignUp:"カメラが上を向いています。正面を向くようにスマートフォンを下に傾けてください。" }
};
Object.assign(STR.en, X.en); Object.assign(STR.ja, X.ja);

/* ---------- speech: rate, volume, verbosity, message priority, native TTS ---------- */
const PRI = { danger:3, signal:2, distance:1, info:1 };
const catOf = key => (/^danger\d$/.test(key) || key === 'dangerClear') ? 'danger' : (key === 'red' || key === 'green' || key === 'uncertain') ? 'signal'
  : (/^dist\d+$/.test(key) || key === 'crosswalk' || key === 'onCrossing' || key === 'vehicleNear') ? 'distance' : 'info';
let curPri = 0, busyUntil = 0, disclaimerSpoken = false;
refreshAudioStatus = function(){
  const tts = !!NP('TextToSpeech');
  if(!synthOK && !tts) S.audio = 'unavail'; else if(!spokenOn) S.audio = 'off';
  else if(lang === 'ja' && !tts && voices.length && !voices.some(v => normLang(v.lang).startsWith('ja'))) S.audio = 'nojp'; else S.audio = 'ready';
  renderStatus();
};
speakText = function(text, interrupt){
  const N = NP('TextToSpeech');
  if(N){ N.speak({ text, lang:lang === 'ja' ? 'ja-JP' : 'en-US', rate:s.speechRate, volume:s.volume, category:'ambient', queueStrategy:interrupt ? 0 : 1 }).catch(() => { S.audio = 'unavail'; renderStatus(); }); return; }
  try{
    if(interrupt) speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text), target = lang === 'ja' ? 'ja-JP' : 'en-US';
    u.lang = target; u.rate = s.speechRate; u.volume = s.volume;
    const v = voices.find(v => normLang(v.lang) === target.toLowerCase()) || voices.find(v => normLang(v.lang).startsWith(lang)); if(v) u.voice = v;
    u.onerror = ev => { if(ev && (ev.error === 'synthesis-unavailable' || ev.error === 'language-unavailable')){ S.audio = 'unavail'; renderStatus(); } };
    speechSynthesis.speak(u);
  }catch(e){ S.audio = 'unavail'; renderStatus(); }
};
say = function(key, o){
  o = o || {};
  const cat = o.cat || catOf(key), pri = PRI[cat], now = Date.now();
  if(s.verbosity === 'minimal' && cat === 'distance') return false;            // Minimal: danger, signal and essential status only
  if(now < busyUntil && curPri > pri) return false;                              // a higher-priority message is still being spoken
  const text = key.charAt(0) === '=' ? key.slice(1) : t(key);
  curPri = pri; busyUntil = now + 500 + text.length * 70 / Math.max(0.5, s.speechRate);
  if(o.remember !== false) lastKey = key;
  $('guidanceText').textContent = text; $('announce').textContent = ''; $('alert').textContent = '';
  const interrupt = o.interrupt !== undefined ? o.interrupt : true;
  if((synthOK || NP('TextToSpeech')) && spokenOn) speakText(text, interrupt);
  else setTimeout(() => { (o.urgent ? $('alert') : $('announce')).textContent = text; }, 60);   // screen-reader live regions
  return true;
};

/* ---------- vibration: custom patterns, native haptics ---------- */
function playVib(p){
  const H = NP('Haptics');
  if(H){ let at = 0; p.forEach((ms, i) => { if(i % 2 === 0) setTimeout(() => { try{ H.vibrate({ duration:ms }); }catch(e){} }, at); at += ms; }); return; }
  if(vibOK){ try{ navigator.vibrate(p); }catch(e){} }
}
haptic = function(name){ showPattern(name); playVib(PATTERNS[name]); };
if(NP('Haptics')){ S.vib = 'available'; }

/* ---------- voice commands: start, stop, help, repeat, language, volume ---------- */
function setVolume(delta){ s.volume = Math.round(clamp(s.volume + delta, 0, 1) * 10) / 10; save(); renderSettings(); say('=' + t('volSet').replace('{n}', String(Math.round(s.volume * 100))), { remember:false, cat:'info' }); }
handleCommand = function(said){
  said = (said || '').toLowerCase();
  const act = n => logEvent('voice_command', { command:n });                      // the spoken words are not stored
  if(/\bstop\b|停止|終了|止めて/.test(said)){ act('stop'); stopAssistance(); }
  else if(/\brepeat\b|もう一度|繰り返/.test(said)){ act('repeat'); if(lastKey) say(lastKey); }
  else if(/\blanguage\b|言語/.test(said)){ act('language'); setLang(lang === 'en' ? 'ja' : 'en'); }
  else if(/volume (up|louder|higher)|音量.*(上げ|大き)/.test(said)){ act('volume_up'); setVolume(0.2); }
  else if(/volume (down|quieter|lower)|音量.*(下げ|小さ)/.test(said)){ act('volume_down'); setVolume(-0.2); }
  else if(/\bstart\b|\bcamera\b|開始|スタート|カメラ/.test(said)){ act('start'); startAssistance(); }
  else if(/\bhelp\b|ヘルプ|助けて/.test(said)){ act('help'); show('help'); }
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
let nativeRun = false;
async function nativeListen(){
  const P = NP('SpeechRecognition'); if(!P || nativeRun) return; nativeRun = true;
  try{
    const a = await P.available(); if(!a.available){ S.voice = 'unavail'; renderStatus(); nativeRun = false; return; }
    const p = await P.requestPermissions(); if(p.speechRecognition !== 'granted'){ S.voice = 'denied'; renderStatus(); nativeRun = false; return; }
  }catch(e){ S.voice = 'unavail'; renderStatus(); nativeRun = false; return; }
  let errors = 0;
  while(nativeRun && voiceCmdOn){
    S.voice = 'listening'; renderStatus();
    try{ const r = await P.start({ language:lang === 'ja' ? 'ja-JP' : 'en-US', maxResults:1, partialResults:false, popup:false }); errors = 0; if(r && r.matches && r.matches[0]) handleCommand(r.matches[0]); }
    catch(e){ if(++errors >= 5){ S.voice = 'unavail'; renderStatus(); break; } await sleep(600); }
    await sleep(250);
  }
  nativeRun = false;
}
if(NP('SpeechRecognition')){
  startListening = function(){ nativeListen(); };
  stopListening = function(){ nativeRun = false; try{ NP('SpeechRecognition').stop(); }catch(e){} S.voice = 'off'; renderStatus(); };
  if(voiceCmdOn){ S.voice = 'starting'; renderStatus(); nativeListen(); } else { S.voice = 'off'; renderStatus(); }
}

/* ---------- camera angle monitor (phone tilt sensor, not image analysis) ---------- */
let beta = null, badSince = 0, lastAlign = 0, alignTimer = null, oriOn = false;
S.align = 'wait'; S.alignDeg = 0;
const onOri = e => { if(typeof e.beta === 'number') beta = e.beta; };
function renderAlign(){ const el = $q('stAlign'); if(el) el.textContent = t('align_' + S.align).replace('{n}', String(S.alignDeg)); }
async function startAlign(){
  S.align = 'wait'; renderAlign(); badSince = 0;
  if(!oriOn && typeof DeviceOrientationEvent !== 'undefined'){
    try{ const r = DeviceOrientationEvent.requestPermission ? await DeviceOrientationEvent.requestPermission() : 'granted'; if(r === 'granted'){ window.addEventListener('deviceorientation', onOri); oriOn = true; } }catch(e){}
  }
  clearInterval(alignTimer); alignTimer = setInterval(alignTick, 500);
}
function stopAlign(){ clearInterval(alignTimer); alignTimer = null; badSince = 0; S.align = 'wait'; renderAlign(); }
function alignTick(){
  if(!active) return;
  if(beta == null){ S.align = 'unavail'; renderAlign(); return; }
  const tilt = Math.round(beta - 90);                      // 0 = phone upright with the camera level; negative = pointing down
  S.alignDeg = Math.abs(tilt); S.align = S.alignDeg <= TIMING.alignTol ? 'ok' : (tilt < 0 ? 'down' : 'up'); renderAlign();
  const now = Date.now();
  if(S.align === 'ok'){ badSince = 0; return; }
  if(!badSince) badSince = now;
  if(now - badSince >= TIMING.alignAfterMs && now - lastAlign >= TIMING.alignRepeatMs && say(S.align === 'down' ? 'alignDown' : 'alignUp', { cat:'info' })){ lastAlign = now; haptic('uncertain'); logEvent('align_prompt', { state:S.align }); }   // if the prompt was held back by a higher-priority message, try again on the next check
}

/* ---------- start / stop wrappers ---------- */
const _start = startAssistance, _stop = stopAssistance;
startAssistance = function(){
  const was = active, first = !disclaimerSpoken; _start();
  if(!active || was) return;
  startAlign(); logEvent('start');
  if(first){ disclaimerSpoken = true; say('=' + t('disclaimerFull'), { remember:false, interrupt:false, cat:'info' }); }   // spoken once per launch, queued after the start message
  if(NP('SpeechRecognition') && voiceCmdOn) nativeListen();
};
stopAssistance = function(r){ const was = active; _stop(r); if(was){ stopAlign(); logEvent('stop', { reason:typeof r === 'string' ? r : 'user' }); } };
const _setLang = setLang;
setLang = function(l){ const before = lang; _setLang(l); if(lang !== before) logEvent('language', { to:lang }); };

/* ---------- emergency workflow: consent, countdown, cancel ---------- */
let emTimer = null, emCount = 0;
const contact = () => ({ name:String(store.get('ecName', '') || '').trim(), num:String(store.get('ecNumber', '') || '').trim() });
function showEm(c, speak){
  $q('emOverlay').hidden = false; $q('emCancel').textContent = t('emCancel'); $q('emNow').hidden = false;
  const txt = t('emCountdown').replace('{name}', c.name || c.num).replace('{n}', String(emCount)); $q('emText').textContent = txt;
  if(speak) say('=' + txt, { urgent:true, remember:false, cat:'danger' });
}
function endEm(){ clearInterval(emTimer); emTimer = null; $q('emOverlay').hidden = true; $q('emSms').hidden = true; }
async function getPos(){
  const G = NP('Geolocation');
  if(G){ await G.requestPermissions(); const p = await G.getCurrentPosition({ enableHighAccuracy:true, timeout:8000 }); return { lat:p.coords.latitude, lon:p.coords.longitude }; }
  return new Promise((res, rej) => navigator.geolocation ? navigator.geolocation.getCurrentPosition(p => res({ lat:p.coords.latitude, lon:p.coords.longitude }), rej, { enableHighAccuracy:true, timeout:8000 }) : rej(new Error('no geolocation')));
}
async function fireEmergency(c){
  clearInterval(emTimer); emTimer = null; logEvent('emergency_fired');
  const msg = t('emCalling').replace('{name}', c.name || c.num); $q('emText').textContent = msg; $q('emNow').hidden = true; $q('emCancel').textContent = t('emClose');
  say('=' + msg, { urgent:true, remember:false, cat:'danger' });
  const clean = c.num.replace(/[^\d+]/g, ''), N = NP('EmergencyCall');
  if(N && s.ecCall){ try{ await N.call({ number:clean }); }catch(e){ openDialer('tel:' + clean); } } else openDialer('tel:' + clean);
  if(s.ecLocation){
    try{ const p = await getPos(), body = t('emSmsBody').replace('{url}', 'https://maps.google.com/?q=' + p.lat + ',' + p.lon), a = $q('emSms');
      a.href = 'sms:' + clean + '?body=' + encodeURIComponent(body); a.hidden = false; logEvent('location_message_prepared'); }
    catch(e){ say('emLocFail', { urgent:true, remember:false, cat:'info', interrupt:false }); }
  }
}
emergencyCall = function(){
  const c = contact();
  if(!s.ecAlert){ say('emOff', { urgent:true, remember:false, cat:'danger' }); logEvent('emergency_blocked_no_consent'); return; }
  if(!c.num){ say('noContact', { urgent:true, remember:false, cat:'danger' }); return; }
  if(emTimer) return;
  emCount = TIMING.emCountdownS; showEm(c, true); $q('emCancel').focus(); logEvent('emergency_countdown');
  emTimer = setInterval(() => { emCount--; if(emCount <= 0) fireEmergency(c); else showEm(c, emCount === 5); }, 1000);
};

/* ---------- settings screen ---------- */
function sw(id, label, desc){ return '<div class="row"><div><strong id="l_' + id + '" data-i18n="' + label + '"></strong><p class="desc" data-i18n="' + desc + '"></p></div><button type="button" role="switch" id="' + id + '" class="sw" aria-checked="false" aria-labelledby="l_' + id + '"></button></div>'; }
function build(){
  const css = document.createElement('style');
  css.textContent = 'input[type=range]{width:100%;min-height:44px;accent-color:var(--accent)}.overlay{position:fixed;inset:0;z-index:50;background:rgba(8,4,14,.97);display:flex;flex-direction:column;justify-content:center;gap:16px;padding:24px;max-width:480px;margin:0 auto}.vrow{display:flex;flex-direction:column;gap:6px;border-top:1px solid var(--line);padding:10px 0}.vrow input{min-height:48px;border:2px solid var(--line);border-radius:12px;background:var(--surface);color:var(--text);font:inherit;padding:0 12px}.rl{display:flex;justify-content:space-between;color:var(--muted);font-size:.9rem}';
  document.head.appendChild(css);
  const st = $q('screen-settings'), box = document.createElement('div'); box.style.cssText = 'display:flex;flex-direction:column;gap:16px';
  box.innerHTML = '<h2 data-i18n="extSpeechHeading">Speech and sound</h2>' +
    '<label class="field"><span><span data-i18n="extRate">Speech speed</span>: <b id="rateVal"></b></span><input type="range" id="rate" min="0.5" max="1.6" step="0.1"></label><div class="rl"><span data-i18n="extRateSlow">Slower</span><span data-i18n="extRateFast">Faster</span></div>' +
    '<label class="field"><span><span data-i18n="extVol">Volume</span>: <b id="volVal"></b></span><input type="range" id="vol" min="0" max="1" step="0.1"></label>' +
    '<button type="button" class="small-btn" id="rateTest" data-i18n="extTestSpeech">Test speech</button>' +
    '<label class="field"><span data-i18n="extVerb">Message detail</span><select id="verb"><option value="minimal" data-i18n="extVerbMin">Minimal</option><option value="normal" data-i18n="extVerbNorm">Normal</option><option value="detailed" data-i18n="extVerbDet">Detailed</option></select></label><p class="desc" data-i18n="extVerbDesc"></p>' +
    '<h2 data-i18n="extDistHeading">Detection distances</h2><label class="field"><span data-i18n="extStartDist">Detection starting distance</span><input id="startDist" type="number" min="2" max="30" step="1"></label>' +
    '<label class="field"><span data-i18n="extDesignDist">Design distance</span><input id="designDist" type="number" min="2" max="30" step="1"></label><p class="desc" data-i18n="extDistDesc"></p>' +
    '<h2 data-i18n="extVibHeading">Vibration patterns</h2><p class="desc" data-i18n="extVibDesc"></p><div id="vibRows"></div><p class="notice" id="vibMsg" role="status" hidden></p><button type="button" class="small-btn" id="vibReset" data-i18n="extVibReset">Reset patterns</button>' +
    '<h2 data-i18n="extEcHeading">Emergency alerts</h2>' + sw('swEcAlert', 'extEcAlert', 'extEcAlertDesc') + sw('swEcLoc', 'extEcLoc', 'extEcLocDesc') + sw('swEcCall', 'extEcCall', 'extEcCallDesc') +
    '<h2 data-i18n="extLogHeading">Research data logging</h2>' + sw('swLog', 'extLogConsent', 'extLogDesc') +
    '<h2 data-i18n="extDisc">Disclaimer</h2><p data-i18n="disclaimerFull"></p>' +
    '<button type="button" class="big secondary" id="resetAll" data-i18n="extReset">Reset all settings</button><p class="notice" id="resetMsg" role="status" hidden></p>';
  st.appendChild(box);
  const dial = $q('swDial'); if(dial) dial.closest('.row').hidden = true;            // replaced by the consent-based workflow below
  const vr = $q('vibRows');
  EVENTS.forEach(ev => { const row = document.createElement('div'); row.className = 'vrow';
    const lab = document.createElement('label'); lab.setAttribute('for', 'vib_' + ev); lab.dataset.vibLabel = ev; const inp = document.createElement('input'); inp.id = 'vib_' + ev; inp.type = 'text'; inp.inputMode = 'numeric';
    const b = document.createElement('button'); b.type = 'button'; b.className = 'small-btn'; b.dataset.vibTest = ev; row.appendChild(lab); row.appendChild(inp); row.appendChild(b); vr.appendChild(row);
    inp.addEventListener('change', () => { const arr = inp.value.split(',').map(x => parseInt(x, 10));
      if(arr.length >= 1 && arr.length <= 12 && arr.every(v => v >= 10 && v <= 2000) && /^[\d,\s]+$/.test(inp.value)){ s.vib[ev] = arr; PATTERNS[ev] = arr; save(); $q('vibMsg').hidden = true; }
      else { $q('vibMsg').hidden = false; $q('vibMsg').textContent = t('extVibBad'); inp.value = PATTERNS[ev].join(','); } });
    b.addEventListener('click', () => haptic(ev)); });
  $q('rate').oninput = e => { s.speechRate = parseFloat(e.target.value); save(); renderSettings(); };
  $q('vol').oninput = e => { s.volume = parseFloat(e.target.value); save(); renderSettings(); };
  $q('rateTest').onclick = () => say('testSpeechMsg', { remember:false, cat:'info' });
  $q('verb').onchange = e => { s.verbosity = e.target.value; save(); };
  $q('startDist').onchange = e => { s.startDist = clamp(parseInt(e.target.value, 10) || 10, 2, 30); if(s.startDist > s.designDist) s.designDist = s.startDist; save(); renderSettings(); };
  $q('designDist').onchange = e => { s.designDist = clamp(parseInt(e.target.value, 10) || 10, 2, 30); if(s.designDist < s.startDist) s.startDist = s.designDist; save(); renderSettings(); };
  $q('vibReset').onclick = () => { s.vib = JSON.parse(JSON.stringify(DEFV)); Object.assign(PATTERNS, s.vib); save(); renderSettings(); };
  [['swEcAlert', 'ecAlert'], ['swEcLoc', 'ecLocation'], ['swEcCall', 'ecCall'], ['swLog', 'logConsent']].forEach(([id, k]) => $q(id).addEventListener('click', () => { s[k] = !s[k]; save(); renderSettings(); if(k === 'logConsent' && !s.logConsent){ events.length = 0; } }));
  let armed = 0;
  $q('resetAll').onclick = () => { const r = $q('resetMsg'), now = Date.now();
    if(now - armed > 5000){ armed = now; r.hidden = false; r.textContent = t('extResetConfirm'); return; }
    armed = 0; Object.keys(s).forEach(k => delete s[k]); Object.assign(s, DEF()); Object.assign(PATTERNS, s.vib); save(); events.length = 0;
    ['ecName', 'ecNumber'].forEach(k => store.set(k, '')); store.set('spoken', true); store.set('voiceCmd', true); store.set('ecDial', false);
    spokenOn = true; voiceCmdOn = true; ecDial = false; $q('ecName').value = ''; $q('ecNumber').value = ''; if(typeof Lab !== 'undefined') Lab.resetCfg();
    renderSwitches(); refreshAudioStatus(); renderSettings(); r.hidden = false; r.textContent = t('extResetDone'); };
  // Help screen: real alert button, and the emergency overlay
  const sos = $q('sosBtn'); const b = document.createElement('button'); b.type = 'button'; b.id = 'emAlertBtn'; b.className = 'big stop'; b.dataset.i18n = 'extEmBtn'; sos.before(b); b.onclick = () => emergencyCall();
  const ov = document.createElement('div'); ov.id = 'emOverlay'; ov.className = 'overlay'; ov.hidden = true; ov.setAttribute('role', 'alertdialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-labelledby', 'emTitle');
  ov.innerHTML = '<h2 id="emTitle" data-i18n="extEmTitle">Emergency alert</h2><p id="emText" style="font-size:1.3rem;font-weight:800"></p><button type="button" id="emCancel" class="big secondary"></button><button type="button" id="emNow" class="big stop" data-i18n="emNow">ALERT NOW</button><a id="emSms" class="big" href="#" hidden data-i18n="emSms">SEND LOCATION MESSAGE</a>';
  document.body.appendChild(ov);
  $q('emCancel').onclick = () => { const was = !!emTimer; endEm(); if(was){ say('emCancelled', { remember:false, cat:'danger' }); logEvent('emergency_cancelled'); } };
  $q('emNow').onclick = () => { const c = contact(); if(c.num && s.ecAlert) fireEmergency(c); };
  const li = document.createElement('li'); li.innerHTML = '<span class="k" data-i18n="lblAlign">Camera angle</span><strong class="v" id="stAlign"></strong>'; document.querySelector('#screen-home ul.status').appendChild(li);
}
function renderSettings(){
  if(!$q('rate')) return;
  $q('rate').value = s.speechRate; $q('rateVal').textContent = s.speechRate.toFixed(1) + '×'; $q('vol').value = s.volume; $q('volVal').textContent = Math.round(s.volume * 100) + '%';
  $q('verb').value = s.verbosity; $q('startDist').value = s.startDist; $q('designDist').value = s.designDist;
  EVENTS.forEach(ev => { $q('vib_' + ev).value = PATTERNS[ev].join(','); });
  document.querySelectorAll('[data-vib-label]').forEach(l => { l.textContent = t('vibEv_' + l.dataset.vibLabel); });
  document.querySelectorAll('[data-vib-test]').forEach(b => { b.textContent = t('extVibTest'); b.setAttribute('aria-label', t('extVibTest') + ': ' + t('vibEv_' + b.dataset.vibTest)); });
  [['swEcAlert', 'ecAlert'], ['swEcLoc', 'ecLocation'], ['swEcCall', 'ecCall'], ['swLog', 'logConsent']].forEach(([id, k]) => { const b = $q(id); b.setAttribute('aria-checked', String(!!s[k])); b.textContent = t(s[k] ? 'on' : 'off'); });
  renderAlign();
}
const _applyLang = applyLang;
applyLang = function(){ _applyLang(); renderSettings(); };

build(); applyLang(); refreshAudioStatus();
return { s, events, logEvent, logConsent:() => !!s.logConsent, NATIVE, _t:{ resetBusy:() => { busyUntil = 0; curPri = 0; }, TIMING, DEFV, PRI, catOf, emergencyCall, fireEmergency, alignTick, setVolume, getBeta:() => beta, setBeta:v => { beta = v; }, startAlign, endEm, contact } };
})();
