// =============================================
//  SOUND EFFECTS — Web Audio API (no files needed)
// =============================================
const SFX = (() => {
  let actx = null;

  function getCtx() {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }

  // Simple oscillator tone helper
  function tone(c, freq, type, start, dur, vol) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(vol, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
    osc.start(start);
    osc.stop(start + dur + 0.01);
  }

  // Happy ascending jingle when game starts
  function playStart() {
    const c = getCtx();
    const now = c.currentTime;
    [523, 659, 784, 1047].forEach((f, i) =>
      tone(c, f, 'triangle', now + i * 0.1, 0.22, 0.28)
    );
  }

  // Wah-wah-wah when Mom catches Amelia
  function playCaught() {
    const c = getCtx();
    const now = c.currentTime;
    [440, 370, 311, 220].forEach((f, i) =>
      tone(c, f, 'sawtooth', now + i * 0.13, 0.2, 0.22)
    );
  }

  // Quick whoosh when changing rooms
  function playRoomTransition() {
    const c = getCtx();
    const now = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(250, now);
    osc.frequency.exponentialRampToValueAtTime(700, now + 0.18);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  // Satisfying bubble pop in the minigame
  function playBubblePop() {
    const c = getCtx();
    const now = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    const filter = c.createBiquadFilter();
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);
    filter.type = 'bandpass';
    filter.frequency.value = 900;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(700, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.12);
    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  // Sad trombone-ish game over tune
  function playGameOver() {
    const c = getCtx();
    const now = c.currentTime;
    [370, 349, 311, 220].forEach((f, i) =>
      tone(c, f, 'triangle', now + i * 0.2, 0.28, 0.28)
    );
  }

  // Soft footstep — throttled
  let _lastStep = 0;
  function playFootstep() {
    const now = Date.now();
    if (now - _lastStep < 300) return;
    _lastStep = now;
    const c = getCtx();
    const t = c.currentTime;
    const samples = Math.floor(c.sampleRate * 0.055);
    const buf = c.createBuffer(1, samples, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < samples; i++) data[i] = (Math.random() * 2 - 1);
    const src = c.createBufferSource();
    src.buffer = buf;
    const gain = c.createGain();
    const filter = c.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1200;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);
    gain.gain.setValueAtTime(0.07, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
    src.start(t);
    src.stop(t + 0.06);
  }

  // ---- Background music ----
  // Cheerful Hawaiian-ish melody loop (C pentatonic)
  const MELODY = [
    [523,0.4],[659,0.4],[784,0.4],[880,0.4],
    [784,0.4],[659,0.4],[523,0.4],[659,0.8],
    [523,0.4],[784,0.4],[880,0.4],[1047,0.4],
    [880,0.4],[784,0.4],[659,0.4],[523,0.8]
  ];
  // Bass line (one octave down, slower)
  const BASS = [
    [131,0.8],[165,0.8],[196,0.8],[131,0.8],
    [165,0.8],[196,0.8],[131,0.8],[131,0.8]
  ];

  let _bgActive = false;
  let _bgTimeouts = [];
  let _bgStep = 0;
  let _bassStep = 0;

  function _scheduleNote(c, noteList, stepRef, getter, setter, volScale) {
    if (!_bgActive) return;
    const [freq, dur] = noteList[getter() % noteList.length];
    setter((getter() + 1) % noteList.length);
    const now = c.currentTime;
    tone(c, freq * 0.5, 'triangle', now, dur * 0.85, 0.05 * volScale);
    const id = setTimeout(() => _scheduleNote(c, noteList, stepRef, getter, setter, volScale), dur * 1000);
    _bgTimeouts.push(id);
  }

  function startBgMusic() {
    if (_bgActive) return;
    _bgActive = true;
    _bgStep = 0;
    _bassStep = 0;
    const c = getCtx();
    // Melody
    (function melodyLoop() {
      if (!_bgActive) return;
      const [freq, dur] = MELODY[_bgStep % MELODY.length];
      _bgStep++;
      const now = c.currentTime;
      tone(c, freq * 0.5, 'triangle', now, dur * 0.82, 0.07);
      const id = setTimeout(melodyLoop, dur * 1000);
      _bgTimeouts.push(id);
    })();
    // Bass (offset slightly)
    setTimeout(() => {
      (function bassLoop() {
        if (!_bgActive) return;
        const [freq, dur] = BASS[_bassStep % BASS.length];
        _bassStep++;
        const now = c.currentTime;
        tone(c, freq, 'sine', now, dur * 0.7, 0.06);
        const id = setTimeout(bassLoop, dur * 1000);
        _bgTimeouts.push(id);
      })();
    }, 200);
  }

  function stopBgMusic() {
    _bgActive = false;
    _bgTimeouts.forEach(clearTimeout);
    _bgTimeouts = [];
  }

  return {
    getCtx,
    playStart,
    playCaught,
    playRoomTransition,
    playBubblePop,
    playGameOver,
    playFootstep,
    startBgMusic,
    stopBgMusic
  };
})();
