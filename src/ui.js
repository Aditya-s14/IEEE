import {
  FINGERSPELLING_ENABLED, VoiceRecognitionCtor
} from './constants.js';
import {
  convertSentenceToGloss, getUnmatchedWords, getUnmatchedForDisplay, buildGlossSequence, semanticIndexState,
  AVAILABLE_WORD_SET, RECOGNIZED_PHRASES, ALIAS_TO_CANONICAL
} from './grammar.js';
import { 
  loadWord, play, pause, stop, stepOnce, startSentencePlayback, stopSentencePlayback, rerenderCurrentFrame, 
  frames, fps, frameIndex, playing, setPlayerCallbacks, sentenceMode
} from './player.js';
import { setRenderControls, syncCanvasSize } from './render.js';
import { fingerspellingState, initFingerspellPopup } from './fingerspell.js';

// UI State
export let lastConversion = null;

export const voiceCapture = {
  supported: !!VoiceRecognitionCtor,
  recognition: null,
  listening: false,
  finalTranscript: '',
  interimTranscript: ''
};

// DOM Elements
const sentenceInputEl = document.getElementById('sentenceInput');
const convertBtn = document.getElementById('convertBtn');
const voiceBtn = document.getElementById('voiceBtn');
const voiceStatusEl = document.getElementById('voiceStatus');
const wordEl = document.getElementById('word'); // For single word playback
const statusEl = document.getElementById('status');
const btnLoad = document.getElementById('load'); // For single word playback
const btnPlayPause = document.getElementById('playPause'); // For single word playback
const btnStop = document.getElementById('stop'); // For single word playback
const btnStep = document.getElementById('step'); // For single word playback
const hudEl = document.getElementById('hud');

// Render controls
const flipYEl = document.getElementById('flipY');
const autofitEl = document.getElementById('autofit');
const showBBoxEl = document.getElementById('showBBox');
const ptSizeEl = document.getElementById('ptSize');
const ptSizeValEl = document.getElementById('ptSizeVal');
const ptColorEl = document.getElementById('ptColor');
const edgeColorEl = document.getElementById('edgeColor');
const ptSwatch = document.getElementById('ptSwatch');
const edgeSwatch = document.getElementById('edgeSwatch');
const zoom3dEl = document.getElementById('zoom3d');
const zoom3dValEl = document.getElementById('zoom3dVal');

// ---------- UI helpers ----------
export function setStatus(text) { statusEl.textContent = 'Status: ' + text; }
export function enableControls(ready) {
  if (btnPlayPause) btnPlayPause.disabled = !ready;
  if (btnStop) btnStop.disabled = !ready;
  if (btnStep) btnStep.disabled = !ready;
}
export function updateHud(extra='') {
  const len = Array.isArray(frames) ? frames.length : 0;
  if (hudEl) {
    hudEl.textContent =
`frames: ${len}
fps: ${fps}
frameIndex: ${frameIndex}${extra ? '\n'+extra : ''}`;
  }
}
export function setVoiceStatus(text) {
  if (voiceStatusEl) voiceStatusEl.textContent = 'Voice: ' + text;
}

export function renderWarnings(conversion) {
  const warningsEl = document.getElementById('warnings');
  if (!warningsEl) return;
  if (!conversion) {
    warningsEl.textContent = '';
    warningsEl.classList.remove('show');
    warningsEl.style.display = 'none';
    return;
  }

  const unmatched = getUnmatchedWords(conversion.tokens);
  const droppedSemantic = conversion.tokens
    .filter(token => token.kind === 'semantic' && token.accepted === false)
    .map(token => token.original.toLowerCase());
  const activeSemantic = conversion.tokens
    .filter(token => token.kind === 'semantic' && token.accepted !== false);

  const messages = [];
  const skipped = [...unmatched, ...droppedSemantic];
  if (skipped.length) {
    if (FINGERSPELLING_ENABLED) {
      messages.push(`⚠ Words not in dataset (will be fingerspelled): ${skipped.join(', ')}`);
    } else {
      messages.push(`⚠ Words not in dataset (skipped): ${skipped.join(', ')}`);
    }
  }
  if (activeSemantic.length) {
    const detail = activeSemantic
      .map(token => `${token.original.toLowerCase()}→${token.canonical.toUpperCase()} (${(token.score || 0).toFixed(2)})`)
      .join(', ');
    messages.push(`✓ Semantic fallback applied: ${detail}`);
  }

  if (messages.length) {
    warningsEl.textContent = messages.join(' | ');
    warningsEl.classList.add('show');
    warningsEl.style.display = 'block';
  } else {
    warningsEl.textContent = '';
    warningsEl.classList.remove('show');
    warningsEl.style.display = 'none';
  }
}

export function renderSemanticPanel(conversion) {
  const panel = document.getElementById('semanticPanel');
  const listEl = document.getElementById('semanticMatches');
  if (!panel || !listEl) return;
  if (!conversion) {
    panel.style.display = 'none';
    listEl.innerHTML = '';
    return;
  }

  const semanticTokens = conversion.tokens
    .map((token, index) => ({ token, index }))
    .filter(item => item.token.kind === 'semantic');

  if (!semanticTokens.length) {
    panel.style.display = 'none';
    listEl.innerHTML = '';
    return;
  }

  panel.style.display = 'block';
  const markup = semanticTokens.map(({ token, index }) => {
    const score = (token.score || 0).toFixed(2);
    const checked = token.accepted === false ? '' : 'checked';
    return `<label class="semantic-match">
      <input type="checkbox" class="semantic-toggle" data-token="${index}" ${checked}>
      <span>${token.original} → ${token.canonical.toUpperCase()} (${score})</span>
    </label>`;
  }).join('');
  listEl.innerHTML = markup;
}

export function refreshConversionViews() {
  const glossDisplay = document.getElementById('glossDisplay');
  const glossText = document.getElementById('glosses');
  const playBtn = document.getElementById('playSentence');
  const sentenceProgressEl = document.getElementById('sentenceProgress');

  if (!lastConversion) {
    if (glossDisplay) glossDisplay.style.display = 'none';
    if (glossText) glossText.textContent = '';
    if (playBtn) {
      playBtn.disabled = true;
      playBtn.dataset.glosses = '[]';
    }
    if (sentenceProgressEl) sentenceProgressEl.textContent = '';
    renderWarnings(null);
    renderSemanticPanel(null);
    return;
  }

  lastConversion.currentGlosses = buildGlossSequence(lastConversion.tokens);
  const glosses = lastConversion.currentGlosses;

  if (glosses.length) {
    if (glossText) glossText.textContent = glosses.map(g => g.toUpperCase()).join(' → ');
    if (glossDisplay) glossDisplay.style.display = 'block';
    if (playBtn) {
      playBtn.disabled = false;
      playBtn.dataset.glosses = JSON.stringify(glosses);
    }
    setStatus(`Converted to ${glosses.length} signs`);
  } else {
    if (glossText) glossText.textContent = '';
    if (glossDisplay) glossDisplay.style.display = 'none';
    if (playBtn) {
      playBtn.disabled = true;
      playBtn.dataset.glosses = '[]';
    }
    setStatus('No valid words found in sentence');
  }

  renderWarnings(lastConversion);
  renderSemanticPanel(lastConversion);
}

export async function runSentenceConversion(sentence) {
  if (!convertBtn) return;
  convertBtn.disabled = true;
  setStatus('Converting sentence …');
  const panel = document.getElementById('semanticPanel');
  if (panel) panel.style.display = 'none';
  try {
    lastConversion = await convertSentenceToGloss(sentence);
    refreshConversionViews();
  } catch (err) {
    console.error('Sentence conversion failed:', err);
    setStatus('Conversion failed');
    lastConversion = null;
    refreshConversionViews();
  } finally {
    convertBtn.disabled = false;
  }
}

// ---------- Real-time Dataset Preview ----------
export function showDatasetPreview(sentence) {
  const previewEl = document.getElementById('datasetPreview');
  const matchesEl = document.getElementById('datasetMatches');
  
  if (!previewEl || !matchesEl) return;

  if (!sentence || sentence.trim().length === 0) {
    previewEl.style.display = 'none';
    return;
  }
  
  const text = sentence.toLowerCase().replace(/[.,!?;:]/g, '');
  const words = text.split(/\s+/).filter(w => w.length > 0);
  
  if (words.length === 0) {
    previewEl.style.display = 'none';
    return;
  }
  
  // Find all possible matches in dataset (longest first)
  const matches = new Set();
  const allPhrases = [...RECOGNIZED_PHRASES].sort((a, b) => b.split(' ').length - a.split(' ').length);
  
  for (const phrase of allPhrases) {
    const phraseWords = phrase.split(' ');
    // Check if this phrase appears in the sentence
    for (let i = 0; i <= words.length - phraseWords.length; i++) {
      const candidate = words.slice(i, i + phraseWords.length).join(' ');
      if (candidate === phrase) {
        const canonical = AVAILABLE_WORD_SET.has(phrase) ? phrase : (ALIAS_TO_CANONICAL[phrase] || phrase);
        matches.add(canonical);
      }
    }
  }
  
  if (matches.size > 0) {
    const matchItems = Array.from(matches)
      .map(m => `<span class="match-item">${m.toUpperCase()}</span>`)
      .join('');
    matchesEl.innerHTML = matchItems;
    previewEl.style.display = 'block';
  } else {
    matchesEl.innerHTML = '<span class="no-matches">No matching words in dataset</span>';
    previewEl.style.display = 'block';
  }
}

export function updateZoomDisplay() {
  if (!zoom3dEl || !zoom3dValEl) return;
  const value = Number(zoom3dEl.value) || 1;
  zoom3dValEl.textContent = value.toFixed(1) + 'x';
}

const voiceBtnDefaultLabel = voiceBtn ? voiceBtn.textContent : '🎙 Speak';

export function initVoiceRecognition() {
  if (!voiceCapture.supported) {
    if (voiceBtn) voiceBtn.disabled = true;
    setVoiceStatus('Voice input not supported in this browser');
    return null;
  }
  if (voiceCapture.recognition) return voiceCapture.recognition;
  try {
    voiceCapture.recognition = new VoiceRecognitionCtor();
  } catch (err) {
    console.warn('SpeechRecognition init failed:', err);
    voiceCapture.supported = false;
    if (voiceBtn) voiceBtn.disabled = true;
    setVoiceStatus('Microphone unavailable');
    return null;
  }

  const rec = voiceCapture.recognition;
  rec.lang = 'en-US';
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  rec.continuous = false;

  rec.onstart = () => {
    voiceCapture.listening = true;
    voiceCapture.finalTranscript = '';
    voiceCapture.interimTranscript = '';
    if (voiceBtn) {
      voiceBtn.textContent = 'Stop';
      voiceBtn.classList.add('live');
    }
    setVoiceStatus('Listening… speak now');
  };

  rec.onerror = (event) => {
    console.warn('SpeechRecognition error:', event.error);
    setVoiceStatus(`Mic error: ${event.error}`);
    voiceCapture.finalTranscript = '';
  };

  rec.onresult = (event) => {
    let finalText = voiceCapture.finalTranscript;
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        finalText += result[0].transcript;
      } else {
        interim += result[0].transcript;
      }
    }
    voiceCapture.finalTranscript = finalText;
    voiceCapture.interimTranscript = interim;
    const combined = (finalText + ' ' + interim).trim();
    if (combined && sentenceInputEl) {
      sentenceInputEl.value = combined;
    }
  };

  rec.onend = () => {
    voiceCapture.listening = false;
    if (voiceBtn) {
      voiceBtn.textContent = voiceBtnDefaultLabel;
      voiceBtn.classList.remove('live');
    }
    if (voiceCapture.finalTranscript && voiceCapture.finalTranscript.trim()) {
      if (sentenceInputEl) {
        sentenceInputEl.value = voiceCapture.finalTranscript.trim();
      }
      setVoiceStatus('Transcribing complete');
      runSentenceConversion(sentenceInputEl ? sentenceInputEl.value : voiceCapture.finalTranscript);
    } else {
      setVoiceStatus('Mic idle');
    }
    voiceCapture.finalTranscript = '';
    voiceCapture.interimTranscript = '';
  };

  return rec;
}

export function attachVoiceButton() {
  if (!voiceBtn) {
    setVoiceStatus('Voice control unavailable');
    return;
  }
  if (!voiceCapture.supported) {
    voiceBtn.disabled = true;
    setVoiceStatus('Voice input not supported in this browser');
    return;
  }
  setVoiceStatus('Tap mic to speak');
  voiceBtn.addEventListener('click', () => {
    const rec = initVoiceRecognition();
    if (!rec) return;
    if (voiceCapture.listening) {
      try { rec.stop(); } catch (err) { console.warn('stop failed', err); }
    } else {
      voiceCapture.finalTranscript = '';
      voiceCapture.interimTranscript = '';
      try {
        rec.start();
        setVoiceStatus('Listening…');
      } catch (err) {
        console.warn('SpeechRecognition start failed:', err);
        setVoiceStatus('Unable to access microphone');
      }
    }
  });
}

export function setupEventListeners() {
  // Sentence conversion
  if (convertBtn) {
    convertBtn.addEventListener('click', () => {
      const sentence = sentenceInputEl ? (sentenceInputEl.value || '') : '';
      runSentenceConversion(sentence);
    });
  }
  
  if (sentenceInputEl) {
    sentenceInputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') runSentenceConversion(sentenceInputEl.value || '');
    });
  }
  
  // Real-time dataset preview as user types
  if (sentenceInputEl) {
    sentenceInputEl.addEventListener('input', (e) => {
    showDatasetPreview(e.target.value);
    });
  }

  const semanticMatchesEl = document.getElementById('semanticMatches');
  if (semanticMatchesEl) {
    semanticMatchesEl.addEventListener('change', (event) => {
      if (!event.target.classList.contains('semantic-toggle')) return;
      const idx = Number(event.target.dataset.token);
      if (!lastConversion || Number.isNaN(idx)) return;
      const token = lastConversion.tokens[idx];
      if (!token) return;
      token.accepted = event.target.checked;
      refreshConversionViews();
    });
  }
  
  const playSentenceBtn = document.getElementById('playSentence');
  if (playSentenceBtn) {
    playSentenceBtn.addEventListener('click', () => {
      const glosses = JSON.parse(playSentenceBtn.dataset.glosses || '[]');
      startSentencePlayback(glosses);
    });
  }
  
  const stopSentenceBtn = document.getElementById('stopSentence');
  if (stopSentenceBtn) {
    stopSentenceBtn.addEventListener('click', () => {
      stopSentencePlayback();
    });
  }
  
  // Single word playback
  if (btnLoad) btnLoad.addEventListener('click', () => loadWord(wordEl.value));
  if (btnPlayPause) btnPlayPause.addEventListener('click', () => (playing ? pause() : play()));
  if (btnStop) btnStop.addEventListener('click', stop);
  if (btnStep) btnStep.addEventListener('click', stepOnce);
  if (wordEl) wordEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') loadWord(wordEl.value); });
  
  window.addEventListener('keydown', (e) => {
    const active = document.activeElement;
    const isTyping = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');

    // ⏯️ Space toggles only when not typing in a field
    if (e.key === ' ' && !isTyping) {
      e.preventDefault();
      if (btnPlayPause && !btnPlayPause.disabled) playing ? pause() : play();
    }

    // ▶️ Step with right arrow (same rule)
    if (e.key === 'ArrowRight' && !isTyping) {
      e.preventDefault();
      stepOnce();
    }
  });

  if (zoom3dEl) {
    updateZoomDisplay();
    zoom3dEl.addEventListener('input', () => {
      updateZoomDisplay();
      rerenderCurrentFrame();
    });
  } else if (zoom3dValEl) {
    zoom3dValEl.textContent = '1.0x';
  }

  // live UI updates for render options
  if (ptSizeEl) ptSizeEl.addEventListener('input', () => { if (ptSizeValEl) ptSizeValEl.textContent = ptSizeEl.value; rerenderCurrentFrame(); });
  if (ptColorEl) ptColorEl.addEventListener('input', () => { if (ptSwatch) ptSwatch.style.background = ptColorEl.value; rerenderCurrentFrame(); });
  if (edgeColorEl) edgeColorEl.addEventListener('input', () => { if (edgeSwatch) edgeSwatch.style.background = edgeColorEl.value; rerenderCurrentFrame(); });
  if (flipYEl) flipYEl.addEventListener('change', rerenderCurrentFrame);
  if (autofitEl) autofitEl.addEventListener('change', rerenderCurrentFrame);
  if (showBBoxEl) showBBoxEl.addEventListener('change', rerenderCurrentFrame);

  // Set render controls for render.js
  setRenderControls({
    flipYEl, autofitEl, showBBoxEl, ptSizeEl, ptColorEl, edgeColorEl, zoom3dEl
  });

  // Set player callbacks for player.js
  setPlayerCallbacks({
    setStatus: setStatus,
    enableControls: enableControls,
    updateHud: updateHud,
    updateSentenceProgress: (text) => {
      const sentenceProgressEl = document.getElementById('sentenceProgress');
      if (sentenceProgressEl) sentenceProgressEl.textContent = text;
    }
  });
}

export function initializeUI() {
  initFingerspellPopup();
  attachVoiceButton();
  setupEventListeners();
  setStatus('ready - enter a sentence to convert to ISL glosses');
  updateHud();
  refreshConversionViews();
}