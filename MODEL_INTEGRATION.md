# Connecting the final model

The app does not select or bundle a model. Model files are supplied by you, and the app reads each file's real input and output shapes when it loads.

1. **Files required:** the `.tflite` file(s). For the four-model comparison: canonical_gt_fp16, canonical_pseudo_fp16, normal_gt_fp16, normal_pseudo_fp16.
2. **Where to put them:** `www/models/` (names in `MODELS` at the top of `www/lab.js`), then `npx cap sync`. Or, with no rebuild, open Research testing in the app and press "Choose file…": the file is saved on the phone and works offline.
3. **Code to modify (only after you share the model):**
   * `www/lab.js` `inputSpec()` and `prep()`: input shape, channel order and normalisation (also selectable in the app).
   * `www/lab.js` `decode()`: maps output tensors to depth, signal class, crossing score, box and corners. Today it identifies outputs by element count from the poster (depth H×W, light 3, score 4, box 16, corners 32). This is an assumption.
   * `www/lab.js` `applyLive()` and `announceLive()`: turns decoded results into announcements (3-frame voting, stages, distance).
   * Nothing in `ext.js`, the settings or the native shell needs to change.
4. **Connect:** load the model in Research testing. The tensor shapes appear under "Model files". Tick the three confirmations (signal class order, crossing score and box format, depth in metres) only after the model owner confirms them. Until then the model runs in inspection mode: results are shown and logged, but nothing is announced.
5. **Test the predictions:** use "Run test images on all four models". Name test images with `red`, `green` or `none` to get false-green, false-red, accuracy, F1 and timing. Download CSV or JSON. Depth error by range and IoU need ground-truth files; the log holds the raw outputs for offline scoring.
6. **Deploy:** `npx cap sync android` and rebuild the APK (or `ios`). Test on the actual phone for speed.
