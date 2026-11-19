# Testing and evaluation plan

Targets (not yet achieved or measured): signal-state accuracy at least 95%; frame processing 100 ms or less.
Metrics: accuracy, F1, **false-green rate (highest priority: red classified as green)**, false-red rate, latency. Report each with the number of images and conditions.

Order of work: (1) model confirmation in Research testing; (2) same test images on every model (CSV); (3) latency on the target phones;
(4) controlled outdoor test, daytime and clear weather only, with a sighted guide; (5) sighted pilot participants, then visually impaired participants (10 to 15).
Measure task success and errors, response time, SUS, NASA-TLX, interviews.
**Do not test with participants before university ethics and safety approval.** Do not claim performance in night, rain or other difficult conditions.
Automated tests: `npm test` (browser tests of the app logic with a fake camera and plugin stand-ins).
