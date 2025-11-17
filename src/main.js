import { initCanvas, applyCanonicalFrame, syncCanvasSize } from './render.js';
import { initializeUI } from './ui.js';

// Expose applyCanonicalFrame globally as requested
window.applyCanonicalFrame = applyCanonicalFrame;

document.addEventListener('DOMContentLoaded', () => {
  const threeViewContainer = document.getElementById('threeView');
  if (threeViewContainer) {
    initCanvas(threeViewContainer);
    syncCanvasSize(); // Initial canvas size sync
  } else {
    console.error('Container for 3D view (#threeView) not found.');
  }
  
  initializeUI();

  // Re-sync canvas size on window resize
  window.addEventListener('resize', () => {
    syncCanvasSize();
    applyCanonicalFrame([], 0); // Re-render to adjust to new size
  });
});