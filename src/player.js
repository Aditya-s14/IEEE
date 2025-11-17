import { WORD_TO_FILENAME, FINGERSPELLING_ENABLED } from './constants.js';
import { applyCanonicalFrame } from './render.js';
import * as fingerspellModule from './fingerspell.js';

// Player state
export let frames = null;
export let fps = 30;
export let raf = null;
export let startTime = 0;
export let frameIndex = 0;
export let pausedAt = 0;
export let playing = false;

// Sentence playback state
export let sentenceMode = {
  active: false,
  glosses: [],
  currentIndex: 0,
  loop: false
};

// UI update callbacks (to be set by ui.js)
export let setStatusCallback = (text) => console.log('Status:', text);
export let enableControlsCallback = (ready) => {};
export let updateHudCallback = (extra='') => {};
export let updateSentenceProgressCallback = (text) => {};

export function setPlayerCallbacks(callbacks) {
  if (callbacks.setStatus) setStatusCallback = callbacks.setStatus;
  if (callbacks.enableControls) enableControlsCallback = callbacks.enableControls;
  if (callbacks.updateHud) updateHudCallback = callbacks.updateHud;
  if (callbacks.updateSentenceProgress) updateSentenceProgressCallback = callbacks.updateSentenceProgress;
}

// ---------- JSON normalization ----------
function normalizeJson(json) {
  let arr = null, localFps = fps;
  if (Array.isArray(json)) {
    arr = json;
    if (window.__canonicalMeta && typeof window.__canonicalMeta.fps === 'number') {
      localFps = Number(window.__canonicalMeta.fps) || 30;
    }
  } else if (json && typeof json === 'object') {
    if (Array.isArray(json.frames)) arr = json.frames;
    if (Array.isArray(json.sequence)) arr = json.sequence;
    if (typeof json.fps === 'number') localFps = json.fps;
    if (typeof json.frame_rate === 'number') localFps = json.frame_rate;
  }
  return { arr, localFps: Math.max(1, Math.min(120, Number(localFps) || 30)) };
}

async function loadWordByName(word) {
  const actualFilename = WORD_TO_FILENAME[word.toLowerCase()] || word;
  const url = `IEEE_Anveshan/canonical/${actualFilename}_canonical_median.json`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return { success: true, json, word };
  } catch (e) {
    console.error(`Error loading ${word}:`, e);
    return { success: false, error: e.message, word };
  }
}

async function playNextWordInSentence() {
  if (!sentenceMode.active || sentenceMode.currentIndex >= sentenceMode.glosses.length) {
    // End of sentence
    if (sentenceMode.loop && sentenceMode.glosses.length > 0) {
      sentenceMode.currentIndex = 0;
      await playNextWordInSentence();
    } else {
      stopSentencePlayback();
    }
    return;
  }

  const word = sentenceMode.glosses[sentenceMode.currentIndex];
  const wordDisplay = word.toUpperCase().replace(/\b\w/g, l => l.toUpperCase());
  
  updateSentenceProgressCallback(`Word ${sentenceMode.currentIndex + 1}/${sentenceMode.glosses.length}: ${wordDisplay}`);
  setStatusCallback(`playing: ${wordDisplay}`);

  const result = await loadWordByName(word);
  
  if (result.success) {
    const { arr, localFps } = normalizeJson(result.json);
    if (arr && arr.length) {
      frames = arr;
      fps = localFps;
      frameIndex = 0;
      pausedAt = 0;
      
      // Play this word's real world emulation
      playing = true;
      startTime = performance.now();
      raf = requestAnimationFrame(tick);
      
      // Wait for the emulation to complete
      await waitForWordComplete(arr.length);
      
      if (sentenceMode.active) {
        sentenceMode.currentIndex++;
        await playNextWordInSentence();
      }
    } else {
      setStatusCallback(`Error: no frames in ${word}`);
      sentenceMode.currentIndex++;
      await playNextWordInSentence();
    }
  } else {
    // Word not found - use new image-based fingerspelling fallback
    if (FINGERSPELLING_ENABLED) {
      setStatusCallback(`Word not found: ${word} - fingerspelling...`);
      await fingerspellModule.fingerspell(word);
      // Move to next word after fingerspelling completes
      sentenceMode.currentIndex++;
      await playNextWordInSentence();
        return;
    }
    
    // Fingerspelling disabled, skip word
    setStatusCallback(`Error loading ${word}: ${result.error} (skipped)`);
    sentenceMode.currentIndex++;
    await playNextWordInSentence();
  }
}

function waitForWordComplete(totalFrames) {
  return new Promise(resolve => {
    const checkComplete = () => {
      // Check if sentenceMode is still active and if fingerspelling is active
      // If fingerspelling is active, we wait for it to complete, not the 3D animation.
      if (!sentenceMode.active || (frameIndex >= totalFrames - 1 && !fingerspellModule.fingerspellingState.active)) {
        resolve();
      } else {
        requestAnimationFrame(checkComplete);
      }
    };
    checkComplete();
  });
}

export function startSentencePlayback(glosses) {
  if (glosses.length === 0) return;
  
  sentenceMode.active = true;
  sentenceMode.glosses = glosses;
  sentenceMode.currentIndex = 0;
  sentenceMode.loop = document.getElementById('loopSentence').checked; // Assuming this element exists in ui.js
  
  // UI updates
  document.getElementById('playSentence').disabled = true; // Assuming this element exists in ui.js
  document.getElementById('stopSentence').disabled = false; // Assuming this element exists in ui.js
  
  playNextWordInSentence();
}

export function stopSentencePlayback() {
  sentenceMode.active = false;
  sentenceMode.currentIndex = 0;
  
  // Stop fingerspelling if active - hide popup
  fingerspellModule.hideFingerspellPopup();
  
  playing = false;
  if (raf) cancelAnimationFrame(raf);
  raf = null;
  
  // UI updates
  document.getElementById('playSentence').disabled = false; // Assuming this element exists in ui.js
  document.getElementById('stopSentence').disabled = true; // Assuming this element exists in ui.js
  updateSentenceProgressCallback('');
  setStatusCallback('sentence playback stopped');
}

export async function loadWord(wordToLoad) {
  const w = (wordToLoad || '').trim().toLowerCase();
  if (!w) { setStatusCallback('error: enter a word'); return; }
  
  // Stop any sentence playback
  if (sentenceMode.active) {
    stopSentencePlayback();
  }
  
  const url = `IEEE_Anveshan/canonical/${encodeURIComponent(w)}_canonical_median.json`;
  setStatusCallback(`loading ${url} …`);
  stop();

  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    const { arr, localFps } = normalizeJson(json);
    if (!arr || !arr.length) throw new Error('no frames found');

    frames = arr; fps = localFps; frameIndex = 0; pausedAt = 0;
    setStatusCallback(`ready: ${frames.length} frames @ ${fps} fps`);
    enableControlsCallback(true);

    applyCanonicalFrame(frames[0], 0); // show first frame
    updateHudCallback();
    play();                                   // auto-play so you see motion
  } catch (e) {
    frames = null; enableControlsCallback(false);
    setStatusCallback('error: ' + (e && e.message ? e.message : 'load failed'));
    updateHudCallback();
  }
}

export function tick(t) {
  if (!playing || !frames || !frames.length) return;
  const msPerFrame = 1000 / fps;
  if (!startTime) startTime = t;
  const elapsed = t - startTime;
  const nextIdx = Math.floor(elapsed / msPerFrame);
  if (nextIdx !== frameIndex) frameIndex = nextIdx;

  if (frameIndex >= frames.length) {
    pause(); setStatusCallback('done'); updateHudCallback(); return;
  }

  try { applyCanonicalFrame(frames[frameIndex], frameIndex); } catch(e) { console.warn(e); }
  raf = requestAnimationFrame(tick);
  updateHudCallback();
}

export function play() {
  if (!frames || !frames.length) { setStatusCallback('nothing loaded'); return; }
  playing = true;
  // UI update
  const btnPlayPause = document.getElementById('playPause'); // Assuming this element exists in ui.js
  if (btnPlayPause) btnPlayPause.textContent = 'Pause';
  setStatusCallback('playing');
  startTime = pausedAt > 0 ? performance.now() - pausedAt * (1000 / fps) : performance.now();
  raf = requestAnimationFrame(tick); updateHudCallback();
}

export function pause() {
  playing = false; if (raf) cancelAnimationFrame(raf); raf = null;
  pausedAt = frameIndex;
  // UI update
  const btnPlayPause = document.getElementById('playPause'); // Assuming this element exists in ui.js
  if (btnPlayPause) btnPlayPause.textContent = 'Play';
  setStatusCallback('paused'); updateHudCallback();
}

export function stop() {
  playing = false; if (raf) cancelAnimationFrame(raf); raf = null;
  frameIndex = 0; pausedAt = 0;
  // UI update
  const btnPlayPause = document.getElementById('playPause'); // Assuming this element exists in ui.js
  if (btnPlayPause) btnPlayPause.textContent = 'Play';
  updateHudCallback();
}

export function stepOnce() {
  if (!frames || !frames.length) return;
  pause(); frameIndex = Math.min(frameIndex + 1, frames.length - 1);
  applyCanonicalFrame(frames[frameIndex], frameIndex);
  setStatusCallback('stepping'); updateHudCallback();
}

export function rerenderCurrentFrame() {
  if (!frames || !frames.length) return;
  const idx = Math.min(frameIndex, frames.length - 1);
  const frame = frames[idx];
  if (!frame) return;
  try {
    applyCanonicalFrame(frame, idx);
  } catch (err) {
    console.warn('Failed to rerender frame', err);
  }
}