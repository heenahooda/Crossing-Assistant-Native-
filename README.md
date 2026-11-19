# Crossing Assistant (native Android and iOS app, research prototype)

Assistive app for blind and visually impaired pedestrians: crosswalk and traffic-signal reporting with voice and vibration.
**Research prototype. Not validated for independent road crossing.** The app only reports detections. It never says it is safe to cross.

## Technology choice (differs from the Flutter preference)
Built with **Capacitor**: the existing, tested web app (`www/`) runs inside a real native Android and iOS shell (`android/`, `ios/`),
with native plugins for text-to-speech, haptics, speech recognition, geolocation and a custom Android emergency-call plugin.
Reasons: (1) your working code is preserved, not rewritten; (2) Flutter and the Android SDK cannot be installed or built in the
environment where this was written, so a Flutter app could not have been compiled or tested; the web layer could be tested in a real browser.
Trade-off: camera frames are processed in a WebView (TFLite WebAssembly), which is slower than a native TFLite delegate.

## What works, and how sure we are
| Status | Features |
|---|---|
| Implemented and tested in a real browser (Chromium, fake camera) | Home with Start/Stop, camera preview, status list; settings screen with saved settings (language, detection start distance, camera-to-crossing design distance, speech-rate slider, volume slider, verbosity, vibration patterns, voice-command and speech switches, emergency contact and consents, logging consent, disclaimer, reset); message priority (danger > signal > distance); voice commands start, stop, help, repeat, language, volume; disclaimer shown always and spoken once per launch; camera-angle monitor (tilt sensor); 30 s warning and 60 s auto-stop when the road is not seen; red-signal danger alert within 2 m; emergency countdown with Cancel; consent-gated logging; adjustable crop box, resize and model-selector (four models) |
| Implemented, **not yet tested on a phone** | Native speech (TTS), haptics, native speech recognition loop, location, the Android `EmergencyCallPlugin.java` (not compiled yet), portrait lock, permissions, Android and iOS builds. Tested only against stand-ins for these plugins |
| Placeholder (clearly labelled "simulated") | The "Research demo controls" buttons and the status "Simulated (no model loaded)" |
| Awaiting the model | Real crosswalk and signal detection, distance, left/right offset, kerb detection, flashing-green handling, signal accuracy (target 95%) and speed (target 100 ms per frame) |
| Not implemented | Online natural-sounding voice (offline device voice only), vehicle detection, automatic SMS sending, Google Play policy review for the call permission |

No performance target is claimed as achieved. Nothing has been evaluated with users.

## Run it
In a browser (development): `cd www && python3 -m http.server 8080`, open http://localhost:8080 (Chrome, allow camera). `npm test` runs the browser tests (needs `pip install playwright` and its Chromium).

### Android (do this first)
Needs Node 22+, JDK 21, Android Studio with SDK 36.
1. `npm install`
2. `npx cap sync android`
3. `npx cap open android`, then Run on a phone (USB debugging) or Build > Build APK(s).
4. Allow camera, microphone, location and phone permissions when asked.
If the Java file `android/app/src/main/java/com/heena/crossingassistant/EmergencyCallPlugin.java` shows an error, tell me the message: it was written without being compiled.

### iPhone
Needs a Mac with Xcode and CocoaPods: `npm install`, `npx cap sync ios`, `npx cap open ios`, choose a signing team, Run.
iPhone limits: apps cannot place calls by themselves (the dialer opens and you confirm); vibration uses the system haptic engine with simpler patterns.

## Safety behaviour
* Messages say only "Green signal detected", "Red signal detected" and similar. Never "cross" or "safe".
* Priority: danger, then traffic signal, then distance. Minimum 5 s between voice messages (6 s far away); safety messages interrupt. Red warning repeats every 10 s.
* Red signal and within 2 m: danger warning with strong vibration.
* No road seen for 30 s: voice asks you to adjust the camera. 60 s later: assistance stops.
* Emergency alert (danger with a vehicle, or the Help screen button): only if you allowed it in Settings. A 10-second countdown with a large Cancel button always comes first, then the dialer opens (Android: automatic call only if you also switched that on). Location message only with consent, and you press send.
* Logging is off until you consent. No images, audio, speech text or location are logged.

## Folders
`www/` app (index.html, lab.js model lab and crop, ext.js settings and safety layer, vendor/ TFLite engine, models/ put model files here) ·
`android/`, `ios/` native projects · `docs/` model integration and testing plans · `tests/` browser tests.

## Known limits
Voice commands need the phone's speech recognition (may need internet on some phones). Camera-angle check uses the tilt sensor, not the image.
The model decoder in `lab.js` is a placeholder based on the lab poster and is switched off for announcements until you confirm it in Research testing.
