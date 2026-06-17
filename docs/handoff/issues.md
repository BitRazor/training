# issues.md — open problems (training app)

**`wu_sled.gif` is 8.6 MB**
- Plain English: the backward-treadmill warm-up gif the user supplied is large — slow/expensive on cellular.
- Technical: `gifs/wu_sled.gif` ≈ 8.8 MB. It IS lazy-loaded (only when the warm-up section is opened + scrolled). Fix = compress (`gifsicle`/`ffmpeg`) or swap a smaller clip. Not blocking.
- Status: open, low priority.

_(No other open issues — the app is feature-complete and verified live.)_
