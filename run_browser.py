"""Real-browser tests (Chromium via Playwright, fake camera). Run: python3 tests/run_browser.py"""
import http.server, threading, functools, json, time, sys, os
from playwright.sync_api import sync_playwright

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'www')
Handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
Handler.log_message = lambda *a, **k: None
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 8765), Handler); threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = 'http://127.0.0.1:8765/index.html'
fails = []
def ok(c, m):
    print(('  ok  : ' if c else '  FAIL: ') + m)
    if not c: fails.append(m)

STUBS = """
window.__spoken=[];window.__vib=[];window.__dialed=null;
window.SpeechSynthesisUtterance=class{constructor(t){this.text=t;}};
Object.defineProperty(window,'speechSynthesis',{value:{speaking:false,cancel(){},getVoices:()=>[{lang:'en-US'},{lang:'ja-JP'}],speak(u){window.__spoken.push({text:u.text,rate:u.rate,volume:u.volume,lang:u.lang});},onvoiceschanged:null},configurable:true});
Object.defineProperty(navigator,'vibrate',{value:p=>{window.__vib.push(p);return true;},configurable:true});
"""
NATIVE = """
window.__n={tts:[],hap:[],call:[],sr:0};
window.Capacitor={isNativePlatform:()=>true,Plugins:{
 TextToSpeech:{speak:async o=>{window.__n.tts.push(o);}},
 Haptics:{vibrate:async o=>{window.__n.hap.push(o.duration);}},
 EmergencyCall:{call:async o=>{window.__n.call.push(o.number);}},
 Geolocation:{requestPermissions:async()=>({}),getCurrentPosition:async()=>({coords:{latitude:33.8834,longitude:130.8752}})},
 SpeechRecognition:{available:async()=>({available:true}),requestPermissions:async()=>({speechRecognition:'granted'}),stop:async()=>{},
   start:async()=>{window.__n.sr++; await new Promise(r=>setTimeout(r,300)); return {matches:[window.__n.sr===2?'start':'']};}}}};
"""
def S(page, js): return page.evaluate(js)
def spoken(page): return [x['text'] for x in S(page, 'window.__spoken')]

with sync_playwright() as p:
    br = p.chromium.launch(args=['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'])
    ctx = br.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, permissions=['camera', 'microphone', 'geolocation'], geolocation={'latitude': 33.8834, 'longitude': 130.8752}, locale='en-US')
    ctx.add_init_script(STUBS)
    page = ctx.new_page(); errs = []; bad = []
    page.on('pageerror', lambda e: errs.append(str(e))); page.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'status of 404' not in m.text and 'bad HTTP response code (404)' not in m.text else None)
    page.on('response', lambda r: bad.append(r.url) if r.status >= 400 and not any(k in r.url for k in ('favicon', '/sw.js', '/models/')) else None)
    page.goto(URL); page.wait_for_function('typeof Ext!=="undefined" && typeof Lab!=="undefined" && typeof tflite!=="undefined"', timeout=15000)

    print('\n== load, theme, disclaimer, engine ==')
    ok(not errs and not bad, 'no console errors or failed requests ' + str(errs[:2] + bad[:2]))
    ok(S(page, 'getComputedStyle(document.body).backgroundColor') == 'rgb(27, 17, 39)', 'deep plum background')
    ok(S(page, 'getComputedStyle(document.querySelector("h1")).color') == 'rgb(211, 192, 255)', 'lavender headings')
    ok('Not validated for independent road crossing. Always use your own judgement' in S(page, 'document.querySelector("#screen-home .disclaimer").textContent'), 'required disclaimer shown on home')
    ok(S(page, 'getComputedStyle(document.querySelector("#mainBtn")).backgroundColor') == 'rgb(232, 163, 192)', 'muted rose Start button')
    r = S(page, '(async()=>{try{await tflite.loadTFLiteModel(new ArrayBuffer(64));return "loaded"}catch(e){return String(e.message||e).slice(0,140)}})()')
    print('        engine answer to a garbage file:', r)
    ok(r != 'loaded' and 'fetch' not in r.lower() and '404' not in r, 'TFLite WASM engine starts offline and rejects a bad file cleanly')
    ok([o['text'] for o in S(page, 'Array.from(document.querySelectorAll("#modelSel option")).map(o=>({text:o.textContent}))')] == ['Canonical GT FP16', 'Canonical Pseudo FP16', 'Normal GT FP16', 'Normal Pseudo FP16'], 'model selector has the four exact options')

    print('\n== settings persist ==')
    page.click('[data-nav=settings]')
    S(page, '(()=>{const r=document.getElementById("rate");r.value="1.4";r.dispatchEvent(new Event("input"));const v=document.getElementById("vol");v.value="0.6";v.dispatchEvent(new Event("input"));const b=document.getElementById("verb");b.value="detailed";b.dispatchEvent(new Event("change"));const d=document.getElementById("startDist");d.value="8";d.dispatchEvent(new Event("change"));})()')
    page.screenshot(path='/tmp/shots/settings.png', full_page=True)
    page.reload(); page.wait_for_function('typeof Ext!=="undefined"')
    ok(S(page, 'Ext.s.speechRate') == 1.4 and S(page, 'Ext.s.volume') == 0.6 and S(page, 'Ext.s.verbosity') == 'detailed' and S(page, 'Ext.s.startDist') == 8, 'speech rate, volume, verbosity and distance survive a reload')
    ok(S(page, 'document.getElementById("rateVal").textContent') == '1.4×', 'slider label shows saved speed')

    print('\n== start, camera, disclaimer once ==')
    S(page, 'Ext.s.verbosity="normal"; Ext.s.startDist=10; Ext.s.speechRate=1.4; Ext.s.volume=0.5;')
    page.click('#mainBtn'); page.wait_for_function('document.getElementById("stCam").textContent==="On"', timeout=8000)
    sp = spoken(page)
    ok('Assistance started.' in sp, 'announces start')
    ok(sum('Not validated for independent road crossing' in x for x in sp) == 1, 'disclaimer spoken once')
    ok(S(page, 'window.__spoken[0].rate') == 1.4 and S(page, 'window.__spoken[0].volume') == 0.5, 'speech uses saved rate and volume')
    page.click('#mainBtn'); page.click('#mainBtn'); time.sleep(0.4)
    ok(sum('Not validated for independent road crossing' in x for x in spoken(page)) == 1, 'disclaimer not repeated on second start')
    ok(S(page, 'document.getElementById("camVideo").videoWidth') > 0, 'real camera preview running (fake device)')
    page.screenshot(path='/tmp/shots/live.png', full_page=True)

    print('\n== crop box ==')
    page.locator('#cropBox').scroll_into_view_if_needed(); box = page.locator('#camBox').bounding_box(); crop = page.locator('#cropBox').bounding_box()
    c0 = S(page, 'Object.assign({},Lab._t.cfg.crop)')
    cx, cy = crop['x'] + crop['width'] / 2, crop['y'] + crop['height'] / 2
    page.mouse.move(cx, cy); page.mouse.down(); page.mouse.move(cx, cy + 30, steps=5); page.mouse.up()
    c1 = S(page, 'Object.assign({},Lab._t.cfg.crop)')
    ok(abs(c1['y'] - c0['y']) > 0.01 and abs(c1['w'] - c0['w']) < 1e-6, 'dragging the box moves it: y %.3f -> %.3f' % (c0['y'], c1['y']))
    page.locator('#cropBox').scroll_into_view_if_needed(); crop = page.locator('#cropBox').bounding_box(); hx, hy = crop['x'] + crop['width'] - 4, crop['y'] + crop['height'] - 4
    page.mouse.move(hx, hy); page.mouse.down(); page.mouse.move(hx - 60, hy - 20, steps=6); page.mouse.up()
    c2 = S(page, 'Object.assign({},Lab._t.cfg.crop)')
    vw, vh = S(page, '[document.getElementById("camVideo").videoWidth,document.getElementById("camVideo").videoHeight]')
    ok(c2['w'] < c1['w'], 'corner handle shrinks it: w %.3f -> %.3f' % (c1['w'], c2['w']))
    ok(abs((c2['w'] * vw) / (c2['h'] * vh) - 2) < 0.05, 'locked to the model shape (2:1 pixels): %.3f' % ((c2['w'] * vw) / (c2['h'] * vh)))
    page.click('#cSmall'); c3 = S(page, 'Object.assign({},Lab._t.cfg.crop)'); page.click('#cLarge'); page.click('#cLarge'); c4 = S(page, 'Object.assign({},Lab._t.cfg.crop)')
    ok(c3['w'] < c2['w'] < c4['w'] + 1e-9 or c4['w'] > c3['w'], 'Smaller / Larger buttons change the crop')
    # the crop must change what the model receives
    A = S(page, '(()=>{const v=document.getElementById("camVideo"),sp={H:256,W:512,nchw:false,raw:false};const a=Lab._t.prep(v,v.videoWidth,v.videoHeight,{x:0,y:0,w:1,h:1},sp);const b=Lab._t.prep(v,v.videoWidth,v.videoHeight,{x:0.4,y:0.4,w:0.2,h:0.1},sp);let d=0,mn=9,mx=-9;for(let i=0;i<a.length;i+=1){mn=Math.min(mn,a[i]);mx=Math.max(mx,a[i]);if(i%97===0)d+=Math.abs(a[i]-b[i]);}return {n:a.length,d:d,min:mn,max:mx}})()')
    ok(A['n'] == 512 * 256 * 3 and A['d'] > 1 and 0 <= A['min'] and A['max'] <= 1, 'crop + resize produce 512x256x3 input that differs by crop (diff %.1f)' % A['d'])
    ok(S(page, '(()=>{const sp={H:100,W:300,nchw:true,raw:false};const v=document.getElementById("camVideo");return Lab._t.prep(v,v.videoWidth,v.videoHeight,null,sp).length})()') == 300 * 100 * 3, 'adapts to another model input size and channel-first layout')
    ok(S(page, 'document.getElementById("modelIn").width') in (512, 300) and S(page, 'document.getElementById("modelIn").height') in (256, 100), '"what the model sees" preview is drawn')
    page.screenshot(path='/tmp/shots/crop.png', full_page=True)

    print('\n== priority, verbosity, custom vibration ==')
    page.click('#mainBtn')   # stop
    S(page, 'window.__spoken.length=0; Ext.s.verbosity="minimal"; say("crosswalk")')
    ok(len(spoken(page)) == 0, 'Minimal hides distance messages')
    S(page, 'say("red")'); ok(spoken(page)[-1:] == ['Red pedestrian signal detected. Please wait.'], 'Minimal still speaks signal messages')
    S(page, 'Ext.s.verbosity="normal"; window.__spoken.length=0; say("danger2"); say("crosswalk")')
    ok(len(spoken(page)) == 1, 'a distance message cannot interrupt a danger message')
    S(page, 'say("danger3")'); ok(spoken(page)[-1] == 'Danger! Vehicle approaching. Stop immediately.', 'danger interrupts')
    page.click('[data-nav=settings]') if S(page, 'document.getElementById("screen-home").classList.contains("active")') else None
    page.fill('#vib_red', '100,50,100'); page.dispatch_event('#vib_red', 'change')
    S(page, 'window.__vib.length=0; haptic("red")'); ok(S(page, 'window.__vib[0]') == [100, 50, 100], 'custom red vibration pattern is used')
    page.fill('#vib_red', '5,abc'); page.dispatch_event('#vib_red', 'change')
    ok(S(page, 'PATTERNS.red.join()') == '100,50,100' and not S(page, 'document.getElementById("vibMsg").hidden'), 'invalid pattern is rejected with a message')

    print('\n== voice commands ==')
    S(page, 'show("home"); window.__spoken.length=0; Ext.s.speechRate=1; Ext.s.volume=0.4;')
    S(page, 'handleCommand("start")'); ok(S(page, 'active') is True, '"start" starts')
    S(page, 'window.__spoken.length=0; say("camNone"); window.__spoken.length=0; handleCommand("repeat")'); ok(len(spoken(page)) == 1, '"repeat" repeats the last message')
    S(page, 'handleCommand("volume up")'); ok(abs(S(page, 'Ext.s.volume') - 0.6) < 1e-9, '"volume up" raises volume to 60%')
    S(page, 'handleCommand("volume down")'); ok(abs(S(page, 'Ext.s.volume') - 0.4) < 1e-9, '"volume down" lowers it')
    S(page, 'handleCommand("language")'); ok(S(page, 'lang') == 'ja', '"language" switches to Japanese'); S(page, 'handleCommand("言語")'); ok(S(page, 'lang') == 'en', 'Japanese command switches back')
    S(page, 'handleCommand("stop")'); ok(S(page, 'active') is False, '"stop" stops')
    S(page, 'handleCommand("help")'); ok(page.locator('#screen-help').evaluate('e=>e.classList.contains("active")'), '"help" opens Help')

    print('\n== camera angle monitor ==')
    S(page, 'show("home"); Ext._t.TIMING.alignAfterMs=200; Ext._t.TIMING.alignRepeatMs=60000; window.__spoken.length=0; startAssistance()'); time.sleep(0.3)
    S(page, 'Ext._t.resetBusy(); Ext._t.setBeta(60)'); time.sleep(1.4)
    ok('Tilted down 30°' == S(page, 'document.getElementById("stAlign").textContent'), 'status shows tilt: ' + S(page, 'document.getElementById("stAlign").textContent'))
    ok('The camera is pointing down. Please tilt the phone up so it faces straight ahead.' in spoken(page), 'voice asks to tilt the phone up')
    S(page, 'Ext._t.setBeta(92)'); time.sleep(0.8); ok(S(page, 'document.getElementById("stAlign").textContent') == 'Straight ahead', 'straight ahead recognised')
    S(page, 'stopAssistance()')

    print('\n== emergency workflow ==')
    S(page, 'Ext.s.ecAlert=false; window.__spoken.length=0; emergencyCall()')
    ok('Emergency alerts are switched off. You can turn them on in Settings.' in spoken(page) and S(page, 'document.getElementById("emOverlay").hidden'), 'blocked without consent')
    S(page, 'Ext.s.ecAlert=true; store.set("ecName","Mom"); store.set("ecNumber","090-1234-5678"); openDialer=function(h){window.__dialed=h;}; emergencyCall()')
    ok(not S(page, 'document.getElementById("emOverlay").hidden') and '10 seconds' in S(page, 'document.getElementById("emText").textContent'), 'countdown overlay appears')
    page.screenshot(path='/tmp/shots/emergency.png')
    page.click('#emCancel'); time.sleep(0.2)
    ok(S(page, 'document.getElementById("emOverlay").hidden') and S(page, 'window.__dialed') is None, 'Cancel stops the alert, no call placed')
    S(page, 'Ext._t.TIMING.emCountdownS=2; Ext.s.ecLocation=true; emergencyCall()'); time.sleep(3.6)
    ok(S(page, 'window.__dialed') == 'tel:09012345678', 'after the countdown the dialer opens with the number')
    href = S(page, 'document.getElementById("emSms").getAttribute("href")')
    ok(href.startswith('sms:09012345678?body=') and 'maps.google.com' in __import__('urllib.parse').parse.unquote(href), 'location message prepared with a map link (consent on)')

    page.click('#emCancel')   # the alert screen stays until it is closed
    print('\n== logging consent, reset ==')
    S(page, 'Ext.s.logConsent=false; Ext.events.length=0; startAssistance(); stopAssistance();'); ok(S(page, 'Ext.events.length') == 0, 'no events logged without consent')
    S(page, 'Ext.s.logConsent=true; startAssistance(); stopAssistance();'); ok(S(page, 'Ext.events.length') >= 2, 'events logged with consent (%d)' % S(page, 'Ext.events.length'))
    ok(not any(k in json.dumps(S(page, 'Ext.events')) for k in ['said', 'transcript', 'lat', 'lon']), 'events contain no speech text or location')
    page.click('[data-nav=settings]') if S(page, 'document.getElementById("screen-home").classList.contains("active")') else None
    page.click('#resetAll'); page.click('#resetAll')
    ok(S(page, 'Ext.s.speechRate') == 1 and S(page, 'Ext.s.ecAlert') is False and S(page, 'store.get("ecNumber","x")') == '' and S(page, 'PATTERNS.red.join()') == '400,300,400', 'Reset all settings restores defaults and clears the contact')
    ok(not errs, 'no script errors during the run ' + str(errs[:2]))

    print('\n== native plugin paths (stand-ins for the phone plugins) ==')
    ctx2 = br.new_context(viewport={'width': 390, 'height': 844}, permissions=['camera', 'microphone', 'geolocation'], geolocation={'latitude': 33.88, 'longitude': 130.87})
    ctx2.add_init_script(NATIVE); pg = ctx2.new_page(); e2 = []; pg.on('pageerror', lambda e: e2.append(str(e)))
    pg.goto(URL); pg.wait_for_function('typeof Ext!=="undefined"'); time.sleep(0.5)
    ok(S(pg, 'document.getElementById("stAudio").textContent') == 'Ready' and S(pg, 'document.getElementById("stVib").textContent') == 'Available', 'native TTS and haptics are reported as available')
    S(pg, 'Ext.s.speechRate=0.8; Ext.s.volume=0.7; say("camNone")'); t = S(pg, 'window.__n.tts.slice(-1)[0]')
    ok(t['rate'] == 0.8 and t['volume'] == 0.7 and t['lang'] == 'en-US', 'native speech gets rate, volume, language: ' + json.dumps(t))
    pg.wait_for_function('active===true', timeout=6000); ok(True, 'native voice-command loop heard "start" and started assistance (plugin stand-in)')
    S(pg, 'stopAssistance(); voiceCmdOn=false; window.__n.hap.length=0; haptic("distance")'); time.sleep(0.4); hp = S(pg, 'window.__n.hap'); ok(hp.count(80) == 2 and len(hp) == 2, 'native haptics play the pattern buzzes (80 ms x2): %s' % hp)
    S(pg, 'stopAssistance(); Ext.s.ecAlert=true; Ext.s.ecCall=true; store.set("ecName","Mom"); store.set("ecNumber","09011112222"); Ext._t.TIMING.emCountdownS=1; emergencyCall()'); time.sleep(2.5)
    ok(S(pg, 'window.__n.call') == ['09011112222'], 'native call plugin used only after consent + countdown')
    ok(not e2, 'no script errors in native mode ' + str(e2[:2]))
    # screenshots of other screens
    pg.goto(URL.replace('index', 'warm')); time.sleep(0.8)
    page.goto(URL); time.sleep(0.8); page.screenshot(path='/tmp/shots/home.png', full_page=True)
    page.click('[data-nav=research]'); page.screenshot(path='/tmp/shots/research.png', full_page=True)
    br.close()
print('\nFAILURES: %d' % len(fails) if fails else '\nALL BROWSER CHECKS PASSED'); sys.exit(1 if fails else 0)
