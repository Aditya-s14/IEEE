// ---------- MediaPipe Skeleton Definitions ----------
// Pose landmark indices
export const POSE = { 
  L_SHOULDER: 11, R_SHOULDER: 12, 
  L_ELBOW: 13, R_ELBOW: 14, 
  L_WRIST: 15, R_WRIST: 16, 
  L_HIP: 23, R_HIP: 24, 
  L_KNEE: 25, R_KNEE: 26, 
  L_ANKLE: 27, R_ANKLE: 28,
  NOSE: 0, L_EYE: 2, R_EYE: 5, L_EAR: 7, R_EAR: 8,
  MOUTH_LEFT: 9, MOUTH_RIGHT: 10
};

// Custom anatomical pose connections (same-side only, human-like)
// Uses MediaPipe Pose indices via POSE constants.
export const CUSTOM_EDGES = [
  // Head (facial anchors)
  [POSE.NOSE, POSE.L_EYE], [POSE.L_EYE, POSE.L_EAR],
  [POSE.NOSE, POSE.R_EYE], [POSE.R_EYE, POSE.R_EAR],
  // Face outline/contour (creates shield shape around face)
  [POSE.L_EAR, POSE.MOUTH_LEFT],
  [POSE.MOUTH_LEFT, POSE.MOUTH_RIGHT],
  [POSE.MOUTH_RIGHT, POSE.R_EAR],
  // Clavicle
  [POSE.L_SHOULDER, POSE.R_SHOULDER],
  // Torso to hips
  [POSE.L_SHOULDER, POSE.L_HIP], [POSE.R_SHOULDER, POSE.R_HIP],
  [POSE.L_HIP, POSE.R_HIP],
  // Left arm chain
  [POSE.L_SHOULDER, POSE.L_ELBOW], [POSE.L_ELBOW, POSE.L_WRIST],
  // Left wrist to pose finger tips (thumb/index/pinky proxies)
  [POSE.L_WRIST, 21], [POSE.L_WRIST, 19], [POSE.L_WRIST, 17],
  // Right arm chain
  [POSE.R_SHOULDER, POSE.R_ELBOW], [POSE.R_ELBOW, POSE.R_WRIST],
  // Right wrist to pose finger tips (thumb/index/pinky proxies)
  [POSE.R_WRIST, 22], [POSE.R_WRIST, 20], [POSE.R_WRIST, 18],
  // Legs
  [POSE.L_HIP, POSE.L_KNEE], [POSE.L_KNEE, POSE.L_ANKLE], [POSE.L_ANKLE, 29],
  [POSE.R_HIP, POSE.R_KNEE], [POSE.R_KNEE, POSE.R_ANKLE], [POSE.R_ANKLE, 30]
];

// Landmark offsets in MediaPipe output (pose=0-32, left_hand=33-53, right_hand=54-74)
export const LH_OFFSET = 33;
export const RH_OFFSET = 54;

// MediaPipe Hand connections (21 points per hand)
export const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
  [0, 5], [5, 6], [6, 7], [7, 8], // Index
  [9, 10], [10, 11], [11, 12], // Middle
  [13, 14], [14, 15], [15, 16], // Ring
  [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
  [5, 9], [9, 13] // Palm connections
];

// ---------- ISL Dataset & Grammar Constants ----------
export const AVAILABLE_WORDS = [
  'alright', 'beautiful', 'bed', 'bedroom', 'blind', 'cell phone', 'chair', 
  'clock', 'computer', 'deaf', 'door', 'dream', 'dress', 'fan', 'friday',
  'good afternoon', 'good morning', 'happy', 'hat', 'hello', 'how are you',
  'lamp', 'loud', 'monday', 'quiet', 'sad', 'saturday', 'shirt', 'skirt',
  'suit', 'sunday', 'table', 'thursday', 'today', 'tuesday', 'ugly',
  'wednesday', 'window'
];

export const WORD_TO_FILENAME = {
  'alright': 'Alright', 'beautiful': 'Beautiful', 'bed': 'Bed', 'bedroom': 'Bedroom',
  'blind': 'Blind', 'cell phone': 'Cell phone', 'chair': 'Chair', 'clock': 'Clock',
  'computer': 'Computer', 'deaf': 'Deaf', 'door': 'Door', 'dream': 'Dream',
  'dress': 'Dress', 'fan': 'Fan', 'friday': 'Friday', 'good afternoon': 'Good afternoon',
  'good morning': 'Good Morning', 'happy': 'happy', 'hat': 'Hat', 'hello': 'Hello',
  'how are you': 'How are you', 'lamp': 'Lamp', 'loud': 'loud', 'monday': 'Monday',
  'quiet': 'quiet', 'sad': 'sad', 'saturday': 'Saturday', 'shirt': 'Shirt',
  'skirt': 'Skirt', 'suit': 'Suit', 'sunday': 'Sunday', 'table': 'Table',
  'thursday': 'Thursday', 'today': 'Today', 'tuesday': 'Tuesday', 'ugly': 'Ugly',
  'wednesday': 'Wednesday', 'window': 'Window'
};

export const MULTI_WORD_SIGNS = {
  'cell phone': 'cell phone',
  'good afternoon': 'good afternoon',
  'good morning': 'good morning',
  'how are you': 'how are you'
};

export const TIME_WORDS = new Set([
  'today', 'tomorrow', 'yesterday', 'monday', 'tuesday', 'wednesday',
  'thursday', 'friday', 'saturday', 'sunday'
]);

export const FUNCTION_WORDS = new Set([
  'a', 'an', 'the', 'is', 'am', 'are', 'was', 'were', 'be', 'been',
  'will', 'would', 'can', 'could', 'should', 'shall', 'may', 'might',
  'to', 'at', 'in', 'on', 'of', 'for', 'with', 'from', 'by', 'about',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her',
  'us', 'them', 'my', 'your', 'our', 'their', 'mine', 'yours', 'ours', 'theirs', 'its'
]);

export const SEMANTIC_ALIASES = {
  'alright': ['okay', 'ok', 'fine'],
  'beautiful': ['pretty', 'gorgeous', 'lovely'],
  'bed': ['bunk', 'cot'],
  'bedroom': ['bed room', 'room', 'sleeping room'],
  'blind': ['visionless', 'sightless', 'visually impaired', 'vision impaired'],
  'cell phone': ['mobile phone', 'mobile', 'phone', 'smartphone', 'cellphone'],
  'chair': ['seat', 'stool', 'armchair'],
  'clock': ['watch', 'timepiece'],
  'computer': ['pc', 'laptop', 'desktop', 'computer system'],
  'deaf': ['hearing impaired', 'hard of hearing'],
  'door': ['gate', 'entryway'],
  'dream': ['vision', 'fantasy', 'imagine'],
  'dress': ['gown', 'frock'],
  'fan': ['cooler', 'blower', 'ceiling fan'],
  'friday': ['fri'],
  'good afternoon': ['afternoon greeting', 'good noon'],
  'good morning': ['morning greeting', 'gm', 'good day'],
  'happy': ['glad', 'joyful', 'cheerful', 'pleased'],
  'hat': ['cap', 'beanie'],
  'hello': ['hi', 'hey', 'greetings'],
  'how are you': ['how r u', 'how are ya', 'how you doing'],
  'lamp': ['light', 'lantern'],
  'loud': ['noisy', 'booming'],
  'monday': ['mon'],
  'quiet': ['silent', 'hushed', 'calm'],
  'sad': ['unhappy', 'upset', 'sorrowful'],
  'saturday': ['sat'],
  'shirt': ['top', 'tshirt', 't-shirt', 'tee'],
  'skirt': ['mini', 'skirts', 'pleated skirt'],
  'suit': ['blazer', 'tuxedo', 'coat and pants'],
  'sunday': ['sun'],
  'table': ['desk', 'dining table'],
  'thursday': ['thu'],
  'today': ['present day', 'nowadays'],
  'tuesday': ['tue'],
  'ugly': ['unattractive', 'plain'],
  'wednesday': ['wed'],
  'window': ['pane', 'glass window']
};

export const LEMMA_OVERRIDES = {
  'better': 'good',
  'best': 'good',
  'worse': 'bad',
  'worst': 'bad',
  'happier': 'happy',
  'happiest': 'happy',
  'sadder': 'sad',
  'saddest': 'sad',
  'children': 'child',
  'men': 'man',
  'women': 'woman',
  'people': 'person',
  'phones': 'phone',
  'cellphones': 'cellphone'
};

export const LEMMA_SUFFIX_RULES = [
  { suffix: 'ies', replacement: 'y', min: 4 },
  { suffix: 'ves', replacement: 'f', min: 4 },
  { suffix: 'ing', replacement: '', min: 5 },
  { suffix: 'ed', replacement: '', min: 4 },
  { suffix: 'est', replacement: '', min: 5 },
  { suffix: 'er', replacement: '', min: 4 },
  { suffix: 's', replacement: '', min: 4, skipDouble: true }
];

export const AVAILABLE_WORD_SET = new Set(AVAILABLE_WORDS);
// ALIAS_TO_CANONICAL and RECOGNIZED_PHRASES will be built in grammar.js
// export const ALIAS_TO_CANONICAL = buildAliasMap(SEMANTIC_ALIASES);
// export const RECOGNIZED_PHRASES = [...new Set([...AVAILABLE_WORDS, ...Object.keys(ALIAS_TO_CANONICAL)])];

export const SEMANTIC_CATEGORY_KEYWORDS = {
  greeting: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'how are you'],
  time: ['today', 'tomorrow', 'yesterday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
  clothing: ['hat', 'dress', 'shirt', 'skirt', 'suit'],
  furniture: ['bed', 'bedroom', 'chair', 'table'],
  device: ['computer', 'cell', 'phone', 'fan', 'lamp'],
  feeling_pos: ['happy', 'alright', 'beautiful', 'good'],
  feeling_neg: ['sad', 'ugly', 'loud', 'quiet'],
  household: ['door', 'window', 'lamp'],
  accessibility: ['blind', 'deaf'],
  imagination: ['dream']
};

export const SEMANTIC_CATEGORY_LIST = Object.keys(SEMANTIC_CATEGORY_KEYWORDS);
export const LOCAL_EMBED_DIM = 64;
export const LOCAL_EMBED_EXTRA = SEMANTIC_CATEGORY_LIST.length + 2;
export const LOCAL_EMBED_HASH_SPACE = Math.max(16, LOCAL_EMBED_DIM - LOCAL_EMBED_EXTRA);

export const SEMANTIC_MATCH_SETTINGS = {
  minSimilarity: 0.85,
  endpoint: window.ISL_EMBEDDING_ENDPOINT || null,
  apiKey: window.ISL_EMBEDDING_API_KEY || null
};

// ---------- Image-Based Fingerspelling Configuration ----------
export const FINGERSPELLING_ENABLED = true;

export const FINGERSPELL_IMAGE_PATH = 'IEEE_Anveshan/ISL_FINGERSPELL/';
export const FINGERSPELL_LETTER_DELAY_MS = 600; // Time to show each letter
export const FINGERSPELL_END_DELAY_MS = 800; // Time to show complete word before closing

// Fingerspelling state (will be managed in fingerspell.js)
// export const fingerspellingState = {
//   active: false,
//   currentWord: '',
//   popupElement: null
// };

// Semantic index state (will be managed in grammar.js)
// export const semanticIndexState = {
//   method: SEMANTIC_MATCH_SETTINGS.endpoint ? 'remote' : 'local',
//   ready: false,
//   entries: [],
//   dimension: LOCAL_EMBED_DIM,
//   loading: null
// };

export const EMBEDDING_CACHE = new Map();
export let lastConversion = null; // Will be managed in main.js or ui.js

export const VoiceRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition || null;
// Voice capture state (will be managed in ui.js)
// export const voiceCapture = {
//   supported: !!VoiceRecognitionCtor,
//   recognition: null,
//   listening: false,
//   finalTranscript: '',
//   interimTranscript: ''
// };

// Player state (will be managed in player.js)
// export let frames = null, fps = 30, raf = null, startTime = 0, frameIndex = 0, pausedAt = 0, playing = false;

// Sentence playback state (will be managed in player.js)
// export let sentenceMode = {
//   active: false,
//   glosses: [],
//   currentIndex: 0,
//   loop: false
// };