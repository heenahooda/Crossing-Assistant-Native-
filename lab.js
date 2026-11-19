/* Crossing Assistant model lab. Loaded after the main script (see index.html). */
var Lab = (function () {
'use strict';
const MODELS = [
  {
    id: 'canonical_pseudo_fp16',
    label: 'Canonical Pseudo FP16',
    file: './canonical_pseudo_fp16.tflite'
  }
];
const LAB = {
en:{ labModel:"Detection model", labStatus_idle:"Not loaded", labStatus_loading:"Loading…", labStatus_ready:"Ready", labStatus_missing:"File not found", labStatus_error:"Error",
  labChoose:"Choose file…", labLoad:"Load", labCropHeading:"Crop and resize", labSmaller:"Smaller crop", labLarger:"Larger crop", labReset:"Reset crop", labFull:"Full frame",
  labLock:"Lock to model shape", labInput:"What the model sees", labRecord:"Record results", labExport:"Download CSV", labExportJson:"Download JSON", labClear:"Clear log",
  labLabHeading:"Model lab", labFiles:"Model files", labNorm:"Input normalisation", labNorm0:"0 to 1", labNormI:"ImageNet mean and std", labNormS:"−1 to 1",
  labVerHeading:"Confirm before the app announces", labVerLight:"Signal class order (confirm with the model owner)", labVerCross:"Crossing score and box format", labVerDepth:"Depth output is in metres",
  labConfirmed:"Confirmed", labBoxFmt:"Box format", labThr:"Crossing score threshold", labTest:"Run test images on all four models", labUseCrop:"Use the current crop on test images", labRun:"Run test images",
  labRunning:"Running…", labResults:"Results", labNoEngine:"The TFLite engine did not load.", labMissing:"Model file not found. Choose the file in Research testing.",
  labInspect:"Inspection mode: results are shown and logged but not spoken until the checks in Research testing are confirmed.",
  labAhead:"Crosswalk ahead, {d} metres.", labLeft:" On your left.", labRight:" On your right.", labNoModelSpeech:"The detection model is not loaded. Detections are simulated.",
  det_live:"Live model, announcing", det_inspect:"Live model, inspection only", labWarnOrder:"Signal class order is not confirmed: false-green and F1 below are not valid.",
  labLogRows:"Logged rows: {n}", labShapes:"Input {i}. Outputs {o}.", labNeedConsent:"Turn on research logging consent in Settings to record results.",
  labInspectSpeech:"A model is running in inspection mode. Detections are not announced.", labDetLive:"Detection (live model)" },
ja:{ labModel:"検出モデル", labStatus_idle:"未読み込み", labStatus_loading:"読み込み中…", labStatus_ready:"準備完了", labStatus_missing:"ファイルが見つかりません", labStatus_error:"エラー",
  labChoose:"ファイルを選択…", labLoad:"読み込み", labCropHeading:"切り抜きとリサイズ", labSmaller:"切り抜きを小さく", labLarger:"切り抜きを大きく", labReset:"切り抜きをリセット", labFull:"全体",
  labLock:"モデルの縦横比に固定", labInput:"モデルに入力される画像", labRecord:"結果を記録", labExport:"CSVをダウンロード", labExportJson:"JSONをダウンロード", labClear:"記録を消去",
  labLabHeading:"モデルラボ", labFiles:"モデルファイル", labNorm:"入力の正規化", labNorm0:"0〜1", labNormI:"ImageNetの平均と標準偏差", labNormS:"−1〜1",
  labVerHeading:"音声案内の前に確認", labVerLight:"信号クラスの順序（モデルの作成者に確認）", labVerCross:"横断歩道スコアとボックス形式", labVerDepth:"深度出力の単位はメートル",
  labConfirmed:"確認済み", labBoxFmt:"ボックス形式", labThr:"横断歩道スコアのしきい値", labTest:"4つのモデルでテスト画像を実行", labUseCrop:"テスト画像にも現在の切り抜きを使う", labRun:"テスト画像を実行",
  labRunning:"実行中…", labResults:"結果", labNoEngine:"TFLiteエンジンを読み込めませんでした。", labMissing:"モデルファイルが見つかりません。研究テスト画面でファイルを選択してください。",
  labInspect:"検査モード：結果は表示・記録されますが、研究テスト画面の確認が済むまで音声案内はしません。",
  labAhead:"前方に横断歩道があります。{d}メートル。", labLeft:"左側です。", labRight:"右側です。", labNoModelSpeech:"検出モデルが読み込まれていません。検出は模擬です。",
  det_live:"ライブモデル（案内中）", det_inspect:"ライブモデル（検査のみ）", labWarnOrder:"信号クラスの順序が未確認のため、下の誤青信号率とF1は無効です。",
  labLogRows:"記録行数：{n}", labShapes:"入力 {i}。出力 {o}。", labNeedConsent:"結果を記録するには、設定で研究データ記録への同意をオンにしてください。",
  labInspectSpeech:"モデルは検査モードで動作中です。検出は音声で案内されません。", labDetLive:"検出（ライブモデル）" }
};
Object.assign(STR.en, LAB.en); Object.assign(STR.ja, LAB.ja);

/* ---------- settings (saved on the device) ---------- */
const DEFCFG = () => ({ sel:MODELS[0].id, norm:'zero_one', lightOrder:['none','green','red'], lightOk:false, crossOk:false, bboxFmt:'xyxy', objThr:0.5,
  depthOk:false, lock:true, cropForImages:false, crop:{ x:0, y:0.3, w:1, h:0.4 } });
const cfg = Object.assign(DEFCFG(), store.get('labCfg', {}));
const E = () => (window.Ext && Ext.s) || { startDist:10, designDist:10, verbosity:'normal', logConsent:false };
const save = () => store.set('labCfg', cfg);
const st = {}; MODELS.forEach(m => st[m.id] = { status:'idle', model:null, info:null, buf:null, src:'', msg:'', pending:null });
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const byId = id => MODELS.find(m => m.id === id);

/* ---------- saved model files (IndexedDB) so they work offline ---------- */
const idb = { db:null,
  open(){ return new Promise((res, rej) => { if(!('indexedDB' in window)) return rej(new Error('no idb')); const r = indexedDB.open('crossing-models', 1); r.onupgradeneeded = () => r.result.createObjectStore('m'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
  async get(k){ try{ const db = this.db || (this.db = await this.open()); return await new Promise(res => { const q = db.transaction('m').objectStore('m').get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); }); }catch(e){ return null; } },
  async set(k, v){ try{ const db = this.db || (this.db = await this.open()); await new Promise((res, rej) => { const tx = db.transaction('m', 'readwrite'); tx.objectStore('m').put(v, k); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); return true; }catch(e){ return false; } } };

/* ---------- loading a model and reading its real tensor shapes ---------- */
async function getBuffer(m){
  if(st[m.id].buf) return { buf:st[m.id].buf, src:'chosen file' };
  const saved = await idb.get(m.id); if(saved) return { buf:saved, src:'saved on this device' };
  try{ const r = await fetch(m.file); if(r.ok){ const b = await r.arrayBuffer(); if(b.byteLength > 1000) return { buf:b, src:'app folder' }; } }catch(e){}
  return null;
}
async function ensure(m){
  const s = st[m.id];
  if(s.model) return s;
  if(!s.pending){
    s.pending = (async () => {
      s.status = 'loading'; s.msg = ''; render();
      if(typeof tflite === 'undefined' || typeof tf === 'undefined') throw new Error(t('labNoEngine'));
      const got = await getBuffer(m);
      if(!got){ s.status = 'missing'; throw new Error(t('labMissing')); }
      const model = await tflite.loadTFLiteModel(got.buf);
      const pick = a => (a || []).map(x => ({ name:x.name, shape:Array.from(x.shape || []), dtype:x.dtype }));
      s.model = model; s.src = got.src; s.info = { inputs:pick(model.inputs), outputs:pick(model.outputs) }; s.status = 'ready';
      return s;
    })();
  }
  try{ return await s.pending; }
  catch(e){ if(s.status !== 'missing') s.status = 'error'; s.msg = String(e.message || e); throw e; }
  finally{ s.pending = null; render(); }
}
function inputSpec(s){
  const i = s.info.inputs[0], sh = i.shape; let H, W, nchw = false;
  if(sh.length === 4){ if(sh[3] === 3){ H = sh[1]; W = sh[2]; } else if(sh[1] === 3){ nchw = true; H = sh[2]; W = sh[3]; } }
  if(!H || !W) throw new Error('Unsupported input shape [' + sh.join(',') + ']');
  if(i.dtype !== 'float32' && i.dtype !== 'int32' && i.dtype !== 'uint8') throw new Error('Unsupported input type ' + i.dtype);
  return { H, W, nchw, raw: i.dtype !== 'float32', dtype:i.dtype };
}

/* ---------- crop + resize + normalise: this is what the model really receives ---------- */
const work = document.createElement('canvas');
function prep(src, sw, sh, crop, spec){
  work.width = spec.W; work.height = spec.H;
  const ctx = work.getContext('2d', { willReadFrequently:true });
  const c = crop || { x:0, y:0, w:1, h:1 };
  ctx.drawImage(src, c.x * sw, c.y * sh, c.w * sw, c.h * sh, 0, 0, spec.W, spec.H);
  const px = ctx.getImageData(0, 0, spec.W, spec.H).data, n = spec.W * spec.H, out = new Float32Array(n * 3);
  const mean = [0.485, 0.456, 0.406], std = [0.229, 0.224, 0.225];
  for(let i = 0; i < n; i++) for(let k = 0; k < 3; k++){
    const v = px[i * 4 + k]; let q;
    if(spec.raw) q = v; else if(cfg.norm === 'imagenet') q = (v / 255 - mean[k]) / std[k]; else if(cfg.norm === 'minus1_1') q = v / 127.5 - 1; else q = v / 255;
    out[spec.nchw ? k * n + i : i * 3 + k] = q;
  }
  const pv = document.getElementById('modelIn');
  if(pv){ pv.width = spec.W; pv.height = spec.H; pv.getContext('2d').drawImage(work, 0, 0); }
  return out;
}
async function infer(s, data, spec){
  const t0 = performance.now();
  const x = tf.tensor(data, spec.nchw ? [1, 3, spec.H, spec.W] : [1, spec.H, spec.W, 3], spec.raw ? 'int32' : 'float32');
  let out; try{ out = s.model.predict(x); } finally { x.dispose(); }
  const list = (out && typeof out.data === 'function') ? [['out0', out]] : Array.isArray(out) ? out.map((o, i) => ['out' + i, o]) : Object.entries(out);
  const outs = []; for(const [name, tt] of list){ outs.push({ name, shape:Array.from(tt.shape), data:await tt.data() }); tt.dispose(); }
  return { ms: performance.now() - t0, outs };
}

/* ---------- decode the outputs (layout from the SAES2026 poster; confirm in Research testing) ---------- */
function dstats(a, W, H, x0, y0, x1, y1){
  const xs = clamp(Math.floor(x0 * W), 0, W), xe = clamp(Math.ceil(x1 * W), 0, W), ys = clamp(Math.floor(y0 * H), 0, H), ye = clamp(Math.ceil(y1 * H), 0, H), v = [];
  for(let y = ys; y < ye; y += 2) for(let x = xs; x < xe; x += 2){ const q = a[y * W + x]; if(isFinite(q)) v.push(q); }
  if(!v.length) return null; v.sort((p, q) => p - q); return { med:v[v.length >> 1], min:v[0], max:v[v.length - 1] };
}
function decode(res, spec){
  const byN = {}; res.outs.forEach(o => { if(!byN[o.data.length]) byN[o.data.length] = o; });
  const o = { depth:byN[spec.W * spec.H], light:byN[3], obj:byN[4], bbox:byN[16], corners:byN[32] };
  const d = { missing:Object.keys(o).filter(k => !o[k]) };
  if(o.light){ let p = Array.from(o.light.data); const sum = p.reduce((a, b) => a + b, 0);
    if(!(p.every(v => v >= 0 && v <= 1) && Math.abs(sum - 1) < 0.05)){ const mx = Math.max(...p), e = p.map(v => Math.exp(v - mx)), se = e.reduce((a, b) => a + b, 0); p = e.map(v => v / se); }
    d.lightP = p; d.lightIdx = p.indexOf(Math.max(...p)); d.light = cfg.lightOrder[d.lightIdx]; }
  if(o.obj){ const raw = Array.from(o.obj.data), sg = raw.some(v => v < 0 || v > 1) ? raw.map(v => 1 / (1 + Math.exp(-v))) : raw; d.slot = sg.indexOf(Math.max(...sg)); d.score = sg[d.slot]; d.obj = sg; }
  if(o.bbox){ const s0 = (d.slot || 0) * 4; let b = Array.from(o.bbox.data).slice(s0, s0 + 4);
    if(Math.max(...b.map(Math.abs)) > 1.5) b = [b[0] / spec.W, b[1] / spec.H, b[2] / spec.W, b[3] / spec.H];
    if(cfg.bboxFmt === 'cxcywh') b = [b[0] - b[2] / 2, b[1] - b[3] / 2, b[0] + b[2] / 2, b[1] + b[3] / 2];
    d.bbox = b; }
  if(o.corners){ const s0 = (d.slot || 0) * 8; d.corners = Array.from(o.corners.data).slice(s0, s0 + 8); }
  if(o.depth){ d.depthAll = dstats(o.depth.data, spec.W, spec.H, 0, 0, 1, 1);
    if(d.bbox){ const [x0, y0, x1, y1] = d.bbox, y0s = Math.max(y0, y1 - 0.2 * (y1 - y0)); d.depthBox = dstats(o.depth.data, spec.W, spec.H, Math.min(x0, x1), y0s, Math.max(x0, x1), y1); } }
  return d;
}

/* ---------- log (same format for live frames and test images) ---------- */
const log = []; let recording = false;
const f4 = v => (v == null || !isFinite(v)) ? '' : Number(v).toFixed(4);
function record(source, m, spec, ms, d, expected){
  const c = source.startsWith('live') ? cfg.crop : (cfg.cropForImages ? cfg.crop : { x:0, y:0, w:1, h:1 });
  const row = { time:new Date().toISOString(), source, model_id:m.id, model:m.label, ms:f4(ms), input:spec.W + 'x' + spec.H, norm:spec.raw ? 'raw' : cfg.norm,
    crop:[c.x, c.y, c.w, c.h].map(f4).join(' '), light_order_confirmed:cfg.lightOk ? 1 : 0, light_class:d.light || '', p0:f4(d.lightP && d.lightP[0]), p1:f4(d.lightP && d.lightP[1]), p2:f4(d.lightP && d.lightP[2]),
    expected_light:expected || '', crossing_score:f4(d.score), bbox:(d.bbox || []).map(f4).join(' '), corners:(d.corners || []).map(f4).join(' '),
    depth_median_all:f4(d.depthAll && d.depthAll.med), depth_median_box:f4(d.depthBox && d.depthBox.med), missing_outputs:d.missing.join(' ') };
  if(E().logConsent) log.push(row);
  return row;
}
function download(name, text, mime){ const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type:mime })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
function toCsv(){ if(!log.length) return ''; const keys = Object.keys(log[0]); return [keys.join(',')].concat(log.map(r => keys.map(k => '"' + String(r[k]).replace(/"/g, '""') + '"').join(','))).join('\n'); }

/* ---------- live loop ---------- */
let looping = false, busy = false, lastMs = [], last = { sig:'none', cross:'none', stage:99, redAt:0, spokenAt:0 }, vote = [];
const canAnnounce = () => cfg.lightOk || cfg.crossOk;
const sleep = ms => new Promise(r => setTimeout(r, ms));
function announceLive(u){
  const now = Date.now(); if(danger > 0) return;
  const near = D.dist != null && D.dist <= 5, gapOk = now - last.spokenAt >= (near ? 5000 : 6000), speak = (k, hp, cat) => { say(k, { cat }); if(hp) haptic(hp); last.spokenAt = now; };   // never below 5 s; a little more often when near
  if(u.sig && u.sig !== last.sig){ last.sig = u.sig; if(u.sig === 'green'){ speak('green', 'green', 'signal'); return; } if(u.sig === 'red'){ last.redAt = now; speak('red', 'red', 'signal'); return; } }
  if(u.sig === 'red' && now - last.redAt >= 10000 && gapOk){ last.redAt = now; speak('red', 'red', 'signal'); return; }
  if(u.cross === 'yes' && D.dist != null && D.dist <= E().startDist && gapOk){
    const stage = D.dist <= 2 ? 2 : D.dist <= 5 ? 5 : D.dist <= 10 ? 10 : 99;
    if(last.cross !== 'yes' || stage < last.stage){
      const b = last.bbox, side = (b && E().verbosity === 'detailed') ? ((b[0] + b[2]) / 2 < 0.4 ? t('labLeft') : (b[0] + b[2]) / 2 > 0.6 ? t('labRight') : '') : '';
      speak('=' + t('labAhead').replace('{d}', String(Math.round(D.dist))) + side, 'crosswalk', 'distance'); last.stage = stage;
    }
  }
  if(u.cross) last.cross = u.cross; if(u.cross === 'none') last.stage = 99;
}
function applyLive(d){
  const u = {};
  if(cfg.lightOk && d.light){ vote.push(d.light); if(vote.length > 3) vote.shift(); if(vote.length === 3 && vote.every(v => v === vote[0])) u.sig = vote[0] === 'green' ? 'green' : vote[0] === 'red' ? 'red' : 'none'; }
  if(cfg.crossOk && d.score != null){ u.cross = d.score >= cfg.objThr ? 'yes' : 'none'; last.bbox = d.bbox;
    u.dist = (u.cross === 'yes' && cfg.depthOk && d.depthBox) ? Math.max(0, Math.round(d.depthBox.med * 10) / 10) : null;
    if(u.dist != null && u.dist > E().designDist) u.dist = null; }   // beyond the design distance: treated as unavailable
  if(!Object.keys(u).length) return;
  updateScene(u); announceLive(u);
}
function showStats(m, ms, d, outs){
  lastMs.push(ms); if(lastMs.length > 20) lastMs.shift();
  const avg = lastMs.reduce((a, b) => a + b, 0) / lastMs.length, el = document.getElementById('infStats');
  if(el) el.textContent = m.label + ' · ' + avg.toFixed(0) + ' ms · ' + (1000 / avg).toFixed(1) + ' FPS';
  const raw = document.getElementById('rawOut');
  if(raw) raw.textContent = ['light p: ' + (d.lightP ? d.lightP.map(f4).join(', ') : 'n/a') + (d.light ? '  → ' + d.light : ''), 'crossing score: ' + f4(d.score) + (d.bbox ? '  box: ' + d.bbox.map(f4).join(' ') : ''),
    'depth median (all / box): ' + f4(d.depthAll && d.depthAll.med) + ' / ' + f4(d.depthBox && d.depthBox.med), 'outputs: ' + outs.map(o => '[' + o.shape.join('x') + ']').join(' ') + (d.missing.length ? '  missing: ' + d.missing.join(',') : '')].join('\n');
}
async function frame(){
  const v = document.getElementById('camVideo'), m = byId(cfg.sel), s = st[m.id];
  if(!s.model || !v || v.hidden || !v.videoWidth) return;
  const spec = inputSpec(s), data = prep(v, v.videoWidth, v.videoHeight, cfg.crop, spec), r = await infer(s, data, spec), d = decode(r, spec);
  showStats(m, r.ms, d, r.outs);
  if(recording){ record('live', m, spec, r.ms, d); updateCount(); }
  if(canAnnounce()) applyLive(d);
}
async function loop(){
  while(looping){
    const t0 = Date.now();
    if(!busy){ busy = true; try{ await frame(); }catch(e){ const el = document.getElementById('infStats'); if(el) el.textContent = String(e.message || e); } busy = false; }
    await sleep(Math.max(30, 200 - (Date.now() - t0)));        // about 5 checks per second (signal checking 2 to 5 per second)
  }
}
function onStart(){
  last = { sig:'none', cross:'none', stage:99, redAt:0, spokenAt:0 }; vote = []; lastMs = []; looping = true;
  const m = byId(cfg.sel);
  ensure(m).then(() => { if(!looping) return; S.det = canAnnounce() ? 'live' : 'inspect'; renderStatus(); setHeading(true); if(!canAnnounce()){ document.getElementById('infStats').textContent = t('labInspect'); say('=' + t('labInspectSpeech'), { remember:false, interrupt:false, cat:'info' }); } loop(); })
    .catch(() => { S.det = 'sim'; renderStatus(); say('=' + t('labNoModelSpeech'), { remember:false, interrupt:false }); });
}
function setHeading(live){ const h = document.querySelector('#livePanel h3[data-i18n="detHeading"], #livePanel h3[data-i18n="labDetLive"]'); if(h){ h.dataset.i18n = live ? 'labDetLive' : 'detHeading'; h.textContent = t(h.dataset.i18n); } }
function onStop(){ looping = false; S.det = 'sim'; setHeading(false); renderStatus(); }

/* ---------- crop box on the camera preview ---------- */
let drag = null, cropEl = null;
const aspectNorm = () => { const v = document.getElementById('camVideo'), s = st[cfg.sel], sp = s && s.info ? (() => { try{ return inputSpec(s); }catch(e){ return null; } })() : null;
  const ma = sp ? sp.W / sp.H : 2, vw = (v && v.videoWidth) || 4, vh = (v && v.videoHeight) || 3; return ma * vh / vw; };   // crop w/h that gives the model's pixel aspect
function placeCrop(){ if(!cropEl) return; const c = cfg.crop; Object.assign(cropEl.style, { left:c.x * 100 + '%', top:c.y * 100 + '%', width:c.w * 100 + '%', height:c.h * 100 + '%' }); }
function setCrop(c){ cfg.crop = c; placeCrop(); save(); }
function resetCrop(){ const ar = aspectNorm(); let w = 1, h = 1 / ar; if(h > 1){ h = 1; w = ar; } setCrop({ x:(1 - w) / 2, y:(1 - h) / 2, w, h }); }
function scaleCrop(f){ const c = cfg.crop, ar = aspectNorm(), cx = c.x + c.w / 2, cy = c.y + c.h / 2; let w = clamp(c.w * f, 0.08, 1), h = cfg.lock ? w / ar : clamp(c.h * f, 0.08, 1);
  if(h > 1){ h = 1; if(cfg.lock) w = ar; } setCrop({ x:clamp(cx - w / 2, 0, 1 - w), y:clamp(cy - h / 2, 0, 1 - h), w, h }); }
function resizeCrop(c0, handle, dx, dy){
  const right = handle[1] === 'r', bottom = handle[0] === 'b', ar = aspectNorm(), ox = right ? c0.x : c0.x + c0.w, oy = bottom ? c0.y : c0.y + c0.h;
  const nx = clamp((right ? c0.x + c0.w : c0.x) + dx, 0, 1), ny = clamp((bottom ? c0.y + c0.h : c0.y) + dy, 0, 1), maxW = right ? 1 - ox : ox, maxH = bottom ? 1 - oy : oy;
  let w = Math.abs(nx - ox), h = Math.abs(ny - oy);
  if(cfg.lock){ if(w / Math.max(h, 1e-6) > ar) w = h * ar; w = clamp(Math.min(w, maxW, maxH * ar), 0.08, 1); h = w / ar; }
  else { w = clamp(Math.min(w, maxW), 0.08, 1); h = clamp(Math.min(h, maxH), 0.08, 1); }
  return { x:right ? ox : ox - w, y:bottom ? oy : oy - h, w, h };
}
function fitCam(){ const v = document.getElementById('camVideo'), box = document.getElementById('camBox'); if(!v || !v.videoWidth) return;
  box.style.aspectRatio = v.videoWidth + ' / ' + v.videoHeight; box.style.maxWidth = Math.round(0.6 * window.innerHeight * v.videoWidth / v.videoHeight) + 'px'; box.style.margin = '0 auto'; box.style.width = '100%'; }
function initCrop(){
  const box = document.getElementById('camBox'); cropEl = document.createElement('div'); cropEl.className = 'crop'; cropEl.id = 'cropBox'; cropEl.setAttribute('role', 'img');
  cropEl.setAttribute('aria-label', 'Crop area sent to the model'); cropEl.innerHTML = '<i data-h="tl"></i><i data-h="tr"></i><i data-h="bl"></i><i data-h="br"></i>'; box.appendChild(cropEl); placeCrop();
  cropEl.addEventListener('pointerdown', e => { drag = { mode:(e.target.dataset && e.target.dataset.h) || 'move', sx:e.clientX, sy:e.clientY, c:Object.assign({}, cfg.crop) }; try{ cropEl.setPointerCapture(e.pointerId); }catch(x){} e.preventDefault(); });
  cropEl.addEventListener('pointermove', e => { if(!drag) return; const r = box.getBoundingClientRect(), dx = (e.clientX - drag.sx) / (r.width || 1), dy = (e.clientY - drag.sy) / (r.height || 1);
    if(drag.mode === 'move'){ const c = drag.c; setCrop({ x:clamp(c.x + dx, 0, 1 - c.w), y:clamp(c.y + dy, 0, 1 - c.h), w:c.w, h:c.h }); } else setCrop(resizeCrop(drag.c, drag.mode, dx, dy)); });
  const end = () => { drag = null; }; cropEl.addEventListener('pointerup', end); cropEl.addEventListener('pointercancel', end);
  const v = document.getElementById('camVideo'); ['loadedmetadata', 'resize'].forEach(ev => v.addEventListener(ev, () => { fitCam(); if(!cfg.cropSet){ cfg.cropSet = true; resetCrop(); } }));
}

/* ---------- test images on all four models (same inputs, same crop settings) ---------- */
function expectedFrom(name){ const n = name.toLowerCase(); return /red/.test(n) ? 'red' : /green/.test(n) ? 'green' : /no[-_ ]?light|none/.test(n) ? 'none' : ''; }
function summarize(rows){
  const per = {}; MODELS.forEach(m => per[m.id] = { m, n:0, lab:0, ok:0, fg:0, fr:0, ms:[], cm:{} });
  rows.forEach(r => { const p = per[r.model_id]; if(!p) return; p.n++; p.ms.push(parseFloat(r.ms)); if(r.expected_light){ p.lab++; if(r.light_class === r.expected_light) p.ok++; if(r.light_class === 'green' && r.expected_light === 'red') p.fg++; if(r.light_class === 'red' && r.expected_light === 'green') p.fr++;
    const c = p.cm; ['none', 'green', 'red'].forEach(k => c[k] = c[k] || { tp:0, fp:0, fn:0 }); if(r.light_class === r.expected_light) c[r.expected_light].tp++; else { if(c[r.light_class]) c[r.light_class].fp++; c[r.expected_light].fn++; } } });
  return Object.values(per).filter(p => p.n).map(p => { const f1s = ['none', 'green', 'red'].filter(k => p.cm[k] && (p.cm[k].tp + p.cm[k].fn) > 0).map(k => { const c = p.cm[k], pr = c.tp / Math.max(1, c.tp + c.fp), rc = c.tp / Math.max(1, c.tp + c.fn); return pr + rc ? 2 * pr * rc / (pr + rc) : 0; });
    const ms = p.ms.slice().sort((a, b) => a - b); return { model:p.m.label, images:p.n, labeled:p.lab, correct:p.ok, falseGreen:p.fg, falseRed:p.fr, f1:f1s.length ? f1s.reduce((a, b) => a + b, 0) / f1s.length : null, msMean:p.ms.reduce((a, b) => a + b, 0) / p.ms.length, msMedian:ms[ms.length >> 1] }; });
}
async function runImages(files){
  const stat = document.getElementById('runStat'), out = document.getElementById('resTable'), rows = [];
  for(const m of MODELS){ try{ await ensure(m); }catch(e){} }
  const ready = MODELS.filter(m => st[m.id].model);
  if(!ready.length){ stat.textContent = t('labMissing'); return; }
  for(const m of ready){ try{ const s = st[m.id], sp = inputSpec(s); await infer(s, new Float32Array(sp.W * sp.H * 3), sp); }catch(e){} }   // warm-up
  for(const f of files){ const bmp = await createImageBitmap(f), exp = expectedFrom(f.name);
    for(const m of ready){ stat.textContent = t('labRunning') + ' ' + f.name + ' · ' + m.label;
      try{ const s = st[m.id], sp = inputSpec(s), data = prep(bmp, bmp.width, bmp.height, cfg.cropForImages ? cfg.crop : null, sp), r = await infer(s, data, sp); rows.push(record('image:' + f.name, m, sp, r.ms, decode(r, sp), exp)); }catch(e){ stat.textContent = m.label + ': ' + (e.message || e); } }
    if(bmp.close) bmp.close(); }
  updateCount(); stat.textContent = '';
  const sum = summarize(rows), tb = document.createElement('table'); tb.className = 'res';
  tb.innerHTML = '<tr><th>Model</th><th>Images</th><th>Labelled</th><th>Correct</th><th>False green</th><th>False red</th><th>Signal F1</th><th>ms mean</th><th>ms median</th></tr>';
  sum.forEach(s => { const tr = document.createElement('tr'); [s.model, s.images, s.labeled, s.correct, s.falseGreen, s.falseRed, s.f1 == null ? '' : s.f1.toFixed(3), s.msMean.toFixed(1), s.msMedian.toFixed(1)].forEach(v => { const td = document.createElement('td'); td.textContent = v; tr.appendChild(td); }); tb.appendChild(tr); });
  out.textContent = ''; if(!cfg.lightOk){ const w = document.createElement('p'); w.className = 'notice'; w.textContent = t('labWarnOrder'); out.appendChild(w); } out.appendChild(tb);
}

/* ---------- interface ---------- */
const $q = id => document.getElementById(id);
function updateCount(){ const a = $q('recCount'), b = $q('logCount'); const txt = t('labLogRows').replace('{n}', String(log.length)); if(a) a.textContent = txt; if(b) b.textContent = txt; }
function render(){
  const sel = $q('modelSel'); if(!sel) return;
  const s = st[cfg.sel], m = byId(cfg.sel);
  $q('modelStatus').textContent = m.label + ': ' + t('labStatus_' + s.status) + (s.src && s.status === 'ready' ? ' (' + s.src + ')' : '') + (s.msg ? '. ' + s.msg : '');
  const rows = $q('modelRows'); rows.textContent = '';
  MODELS.forEach(mm => { const x = st[mm.id], row = document.createElement('div'); row.className = 'mrow';
    const nm = document.createElement('strong'); nm.textContent = mm.label; const stt = document.createElement('span'); stt.textContent = t('labStatus_' + x.status) + (x.msg ? ': ' + x.msg : '');
    const sh = document.createElement('span'); sh.className = 'desc'; if(x.info) sh.textContent = t('labShapes').replace('{i}', x.info.inputs.map(i => '[' + i.shape.join('x') + ' ' + i.dtype + ']').join(' ')).replace('{o}', x.info.outputs.map(o => '[' + o.shape.join('x') + ']').join(' '));
    const b1 = document.createElement('button'); b1.type = 'button'; b1.className = 'small-btn'; b1.textContent = t('labLoad'); b1.dataset.load = mm.id;
    const b2 = document.createElement('button'); b2.type = 'button'; b2.className = 'small-btn'; b2.textContent = t('labChoose'); b2.dataset.choose = mm.id; b2.setAttribute('aria-label', t('labChoose') + ' ' + mm.label); b1.setAttribute('aria-label', t('labLoad') + ' ' + mm.label);
    [nm, stt, sh, b1, b2].forEach(e => row.appendChild(e)); rows.appendChild(row); });
  $q('normSel').value = cfg.norm; $q('lightOrder').value = cfg.lightOrder.join(','); $q('okLight').checked = !!cfg.lightOk; $q('okCross').checked = !!cfg.crossOk; $q('okDepth').checked = !!cfg.depthOk;
  $q('boxFmt').value = cfg.bboxFmt; $q('objThr').value = cfg.objThr; $q('cLock').setAttribute('aria-pressed', String(!!cfg.lock)); $q('useCropImg').checked = !!cfg.cropForImages; $q('recBtn').setAttribute('aria-pressed', String(recording)); updateCount();
}
function build(){
  const home = document.querySelector('#screen-home ul.status'), blk = document.createElement('div'); blk.className = 'card';
  blk.innerHTML = '<label class="field"><span data-i18n="labModel">Detection model</span><select id="modelSel"></select></label><p class="desc" id="modelStatus" role="status"></p>'; home.after(blk);
  const cap = document.querySelector('#livePanel .caption'), ctl = document.createElement('div'); ctl.className = 'ctl';
  ctl.innerHTML = '<h3 data-i18n="labCropHeading">Crop and resize</h3><div class="grid"><button type="button" class="small-btn" id="cSmall" data-i18n="labSmaller">Smaller crop</button><button type="button" class="small-btn" id="cLarge" data-i18n="labLarger">Larger crop</button>' +
    '<button type="button" class="small-btn" id="cReset" data-i18n="labReset">Reset crop</button><button type="button" class="small-btn" id="cFull" data-i18n="labFull">Full frame</button></div>' +
    '<button type="button" class="small-btn" id="cLock" aria-pressed="true" data-i18n="labLock">Lock to model shape</button><h3 data-i18n="labInput">What the model sees</h3><canvas id="modelIn" class="mi" width="512" height="256" role="img" aria-label="Model input preview"></canvas>' +
    '<p class="desc" id="infStats" role="status"></p><pre class="raw" id="rawOut"></pre><button type="button" class="small-btn" id="recBtn" aria-pressed="false" data-i18n="labRecord">Record results</button><p class="desc" id="recCount"></p>'; cap.after(ctl);
  const lab = document.createElement('div'); lab.className = 'card'; lab.innerHTML = '<h2 data-i18n="labLabHeading">Model lab</h2><p class="notice" data-i18n="labInspect"></p><h3 data-i18n="labFiles">Model files</h3><div id="modelRows"></div>' +
    '<label class="field"><span data-i18n="labNorm">Input normalisation</span><select id="normSel"><option value="zero_one" data-i18n="labNorm0">0 to 1</option><option value="imagenet" data-i18n="labNormI">ImageNet</option><option value="minus1_1" data-i18n="labNormS">-1 to 1</option></select></label>' +
    '<h3 data-i18n="labVerHeading">Confirm before the app announces</h3>' +
    '<label class="field"><span data-i18n="labVerLight">Signal class order</span><select id="lightOrder"><option>none,green,red</option><option>none,red,green</option><option>green,none,red</option><option>green,red,none</option><option>red,none,green</option><option>red,green,none</option></select></label>' +
    '<label class="chk"><input type="checkbox" id="okLight"><span data-i18n="labConfirmed">Confirmed</span></label>' +
    '<label class="field"><span data-i18n="labVerCross">Crossing score and box format</span><select id="boxFmt"><option value="xyxy">x1 y1 x2 y2</option><option value="cxcywh">cx cy w h</option></select></label>' +
    '<label class="field"><span data-i18n="labThr">Crossing score threshold</span><input id="objThr" type="number" min="0" max="1" step="0.05"></label><label class="chk"><input type="checkbox" id="okCross"><span data-i18n="labConfirmed">Confirmed</span></label>' +
    '<label class="chk"><input type="checkbox" id="okDepth"><span data-i18n="labVerDepth">Depth output is in metres</span></label>' +
    '<h3 data-i18n="labTest">Run test images on all four models</h3><input type="file" id="imgIn" accept="image/*" multiple><label class="chk"><input type="checkbox" id="useCropImg"><span data-i18n="labUseCrop">Use the current crop</span></label>' +
    '<button type="button" class="big secondary" id="runImgs" data-i18n="labRun">Run test images</button><p class="desc" id="runStat" role="status"></p><div id="resTable"></div>' +
    '<div class="grid"><button type="button" class="small-btn" id="csvBtn" data-i18n="labExport">Download CSV</button><button type="button" class="small-btn" id="jsonBtn" data-i18n="labExportJson">Download JSON</button></div>' +
    '<button type="button" class="small-btn" id="clearBtn" data-i18n="labClear">Clear log</button><p class="desc" id="logCount"></p><input type="file" id="modelPick" accept=".tflite" hidden>'; $q('screen-research').appendChild(lab);
  const sel = $q('modelSel'); MODELS.forEach(m => { const o = document.createElement('option'); o.value = m.id; o.textContent = m.label; sel.appendChild(o); }); sel.value = cfg.sel;
  sel.addEventListener('change', () => { cfg.sel = sel.value; save(); vote = []; render(); const was = looping; if(active){ ensure(byId(cfg.sel)).then(() => { S.det = canAnnounce() ? 'live' : 'inspect'; renderStatus(); if(was && !looping) { looping = true; loop(); } }).catch(() => { S.det = 'sim'; renderStatus(); }); } });
  $q('cSmall').onclick = () => scaleCrop(0.9); $q('cLarge').onclick = () => scaleCrop(1.1); $q('cReset').onclick = resetCrop; $q('cFull').onclick = () => { cfg.lock = false; setCrop({ x:0, y:0, w:1, h:1 }); render(); };
  $q('cLock').onclick = () => { cfg.lock = !cfg.lock; if(cfg.lock) scaleCrop(1); save(); render(); };
  $q('recBtn').onclick = () => { if(!E().logConsent){ $q('recCount').textContent = t('labNeedConsent'); return; } recording = !recording; render(); };
  $q('normSel').onchange = e => { cfg.norm = e.target.value; save(); }; $q('lightOrder').onchange = e => { cfg.lightOrder = e.target.value.split(','); cfg.lightOk = false; save(); render(); };
  $q('okLight').onchange = e => { cfg.lightOk = e.target.checked; save(); }; $q('okCross').onchange = e => { cfg.crossOk = e.target.checked; save(); }; $q('okDepth').onchange = e => { cfg.depthOk = e.target.checked; save(); };
  $q('boxFmt').onchange = e => { cfg.bboxFmt = e.target.value; cfg.crossOk = false; save(); render(); }; $q('objThr').onchange = e => { cfg.objThr = clamp(parseFloat(e.target.value) || 0.5, 0, 1); save(); };
  $q('useCropImg').onchange = e => { cfg.cropForImages = e.target.checked; save(); };
  $q('runImgs').onclick = () => { const f = Array.from($q('imgIn').files || []); if(f.length) runImages(f); };
  $q('csvBtn').onclick = () => download('crossing-results.csv', toCsv(), 'text/csv'); $q('jsonBtn').onclick = () => download('crossing-results.json', JSON.stringify({ rows:log, events:(window.Ext ? Ext.events : []) }, null, 1), 'application/json');
  $q('clearBtn').onclick = () => { log.length = 0; updateCount(); };
  let pickFor = null;
  $q('modelRows').addEventListener('click', e => { const b = e.target.closest('button'); if(!b) return; if(b.dataset.load){ ensure(byId(b.dataset.load)).catch(() => {}); } if(b.dataset.choose){ pickFor = b.dataset.choose; $q('modelPick').value = ''; $q('modelPick').click(); } });
  $q('modelPick').onchange = async e => { const f = e.target.files[0]; if(!f || !pickFor) return; const s = st[pickFor]; s.buf = await f.arrayBuffer(); s.model = null; s.info = null; s.status = 'idle'; await idb.set(pickFor, s.buf); ensure(byId(pickFor)).catch(() => {}); };
  window.addEventListener('resize', fitCam);
}
build(); initCrop(); applyLang(); render();
try{ if(typeof tf !== 'undefined') tf.setBackend('cpu'); if(typeof tflite !== 'undefined') tflite.setWasmPath(new URL('vendor/', location.href).href); }catch(e){}
function resetCfg(){ Object.keys(cfg).forEach(k => delete cfg[k]); Object.assign(cfg, DEFCFG()); save(); resetCrop(); render(); }
return { onStart, onStop, render, resetCfg, running:() => looping, canAnnounceAny:canAnnounce, _t:{ MODELS, cfg, st, ensure, inputSpec, prep, decode, infer, applyLive, summarize, expectedFrom, resizeCrop, scaleCrop, resetCrop, record, log, toCsv, runImages, frame, setRecording:v => { recording = v; } } };
})();
