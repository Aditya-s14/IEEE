import { FINGERSPELL_IMAGE_PATH, FINGERSPELL_LETTER_DELAY_MS, FINGERSPELL_END_DELAY_MS } from './constants.js';

// Fingerspelling state
export const fingerspellingState = {
  active: false,
  currentWord: '',
  popupElement: null
};

// Map letter to image filename (handles both uppercase and numbers)
function getLetterImagePath(char) {
  const upper = char.toUpperCase();
  // Check if it's A-Z or 0-9
  if (/^[A-Z0-9]$/.test(upper)) {
    return `${FINGERSPELL_IMAGE_PATH}${upper}.jpg`;
  }
  // Return null for unsupported characters (spaces, punctuation, etc.)
  return null;
}

// Initialize the popup (called once on page load)
export function initFingerspellPopup() {
  const popup = document.getElementById('fingerspellPopup');
  const closeBtn = document.getElementById('fingerspellClose');
  
  if (!popup) {
    console.error('❌ Fingerspell popup element not found! Make sure #fingerspellPopup exists in the DOM.');
    return;
  }
  
  console.log('✅ Fingerspell popup initialized successfully');
  fingerspellingState.popupElement = popup;
  
  // Close button handler
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      hideFingerspellPopup();
    });
  } else {
    console.warn('Close button not found for fingerspell popup');
  }
}

// Show the popup
function showFingerspellPopup() {
  if (fingerspellingState.popupElement) {
    console.log('📢 Showing fingerspell popup');
    fingerspellingState.popupElement.classList.add('visible');
  } else {
    console.error('Cannot show popup - popup element not initialized');
  }
}

// Hide the popup
export function hideFingerspellPopup() {
  if (fingerspellingState.popupElement) {
    console.log('📢 Hiding fingerspell popup');
    fingerspellingState.popupElement.classList.remove('visible');
    fingerspellingState.active = false;
    fingerspellingState.currentWord = '';
  }
}

// Update the popup content with highlighted current letter
function updateFingerspellPopup(word, currentLetter, letterIndex, totalLetters) {
  const wordDisplay = document.getElementById('fingerspellWord');
  const letterInfo = document.getElementById('fingerspellLetterInfo');
  const letterImage = document.getElementById('fingerspellLetterImage');
  const closeBtn = document.getElementById('fingerspellClose');
  
  if (wordDisplay) {
    // Build HTML with individual letter spans for highlighting
    const letters = word.toUpperCase().split('');
    const html = letters.map((letter, idx) => {
      const isCurrent = currentLetter && idx === letterIndex;
      const className = isCurrent ? 'letter current' : 'letter';
      return `<span class="${className}">${letter}</span>`;
    }).join('');
    wordDisplay.innerHTML = html;
  }
  
  if (letterInfo) {
    if (currentLetter) {
      letterInfo.textContent = `Letter ${letterIndex + 1} of ${totalLetters}: ${currentLetter.toUpperCase()}`;
    } else {
      letterInfo.textContent = 'Complete!';
    }
  }
  
  if (letterImage && currentLetter) {
    const imagePath = getLetterImagePath(currentLetter);
    if (imagePath) {
      letterImage.src = imagePath;
      letterImage.alt = `ISL sign for letter ${currentLetter}`;
      letterImage.style.display = 'block';
  } else {
      letterImage.style.display = 'none';
    }
  } else if (letterImage) {
    letterImage.style.display = 'none';
  }
  
  // Show close button when complete
  if (closeBtn) {
    closeBtn.style.display = currentLetter ? 'none' : 'inline-block';
  }
}

/**
 * Main fingerspelling function: Spell out a word letter by letter
 * @param {string} word - The word to fingerspell
 * @returns {Promise<boolean>} - True if successful, false otherwise
 */
export async function fingerspell(word, setStatusCallback = (text) => console.log('Status:', text)) {
  if (!word || typeof word !== 'string') {
    console.warn('Cannot fingerspell: invalid word', word);
    return false;
  }

  // Normalize: remove punctuation, keep only letters and numbers
  const normalized = word.toUpperCase().replace(/[^A-Z0-9]/g, '');
  
  if (normalized.length === 0) {
    console.warn('Cannot fingerspell: no valid characters in word', word);
    return false;
  }
  
  console.log(`🤟 Fingerspelling word: ${normalized}`);

  fingerspellingState.active = true;
  fingerspellingState.currentWord = normalized;
  
  // Show popup
  showFingerspellPopup();
  
  // Iterate through letters
  const letters = normalized.split('');
  let displayedCount = 0;
  
  for (let i = 0; i < letters.length; i++) {
    const letter = letters[i];
    const imagePath = getLetterImagePath(letter);
    
    if (!imagePath) {
      console.warn(`Skipping unsupported character: ${letter}`);
      continue;
    }
    
    // Check if image exists (preload)
    const img = new Image();
    const imageLoaded = await new Promise(resolve => {
      img.onload = () => resolve(true);
      img.onerror = () => {
        console.warn(`Image not found for letter: ${letter} at ${imagePath}`);
        resolve(false);
      };
      img.src = imagePath;
    });
    
    if (!imageLoaded) {
      console.warn(`Skipping letter ${letter} - image not available`);
      continue;
    }
    
    displayedCount++;
    
    // Update popup with current letter (use 'i' for correct position in word)
    updateFingerspellPopup(normalized, letter, i, letters.length);
    
    // Update main status (optional)
    setStatusCallback(`Fingerspelling: ${normalized} [${letter}]`);
    
    // Wait before next letter
    await new Promise(resolve => setTimeout(resolve, FINGERSPELL_LETTER_DELAY_MS));
  }
  
  if (displayedCount === 0) {
    console.warn(`No displayable letters in word: ${normalized}`);
    hideFingerspellPopup();
    return false;
  }
  
  // All letters shown - display completion
  updateFingerspellPopup(normalized, null, 0, letters.length);
  setStatusCallback(`Fingerspelling complete: ${normalized}`);
  
  // Wait a bit before auto-closing (or user can click close button)
  await new Promise(resolve => setTimeout(resolve, FINGERSPELL_END_DELAY_MS));
  
  // Auto-hide (user can also manually close)
  hideFingerspellPopup();
  
  return true;
}