import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { POSE, CUSTOM_EDGES, LH_OFFSET, RH_OFFSET, HAND_CONNECTIONS } from './constants.js';

// --- minimal THREE setup ---
let __three = null;
let canvas = null;
let ctx = null;

// Render controls (these will be passed from ui.js or main.js)
let flipYEl = { checked: false };
let autofitEl = { checked: true };
let showBBoxEl = { checked: false };
let ptSizeEl = { value: 4 };
let ptColorEl = { value: '#ff1a1a' };
let edgeColorEl = { value: '#00a3ff' };
let zoom3dEl = { value: 1 };

export function setRenderControls(controls) {
  flipYEl = controls.flipYEl;
  autofitEl = controls.autofitEl;
  showBBoxEl = controls.showBBoxEl;
  ptSizeEl = controls.ptSizeEl;
  ptColorEl = controls.ptColorEl;
  edgeColorEl = controls.edgeColorEl;
  zoom3dEl = controls.zoom3dEl;
}

export function initCanvas(container) {
  canvas = document.createElement('canvas');
  container.appendChild(canvas);
  ctx = canvas.getContext('2d');
  return canvas;
}

export function getThreeViewSize() {
  const container = document.getElementById('threeView');
  if (!container) return { width: 960, height: 540 };
  const rect = container.getBoundingClientRect();
  const width = Math.max(320, Math.floor(rect.width || container.clientWidth || 960));
  const height = Math.max(240, Math.floor(rect.height || container.clientHeight || width * (9 / 16)));
  return { width, height };
}

export function syncCanvasSize() {
  const { width, height } = getThreeViewSize();
  if (canvas) {
    canvas.width = width;
    canvas.height = height;
  }
  return { width, height };
}

function clearCanvas() {
  if (!ctx || !canvas) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';               // bright background so colors pop
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// recurse to collect ANY arrays of {x,y} or [x,y] (even nested)
function collectPointArrays(obj, out) {
  if (!obj) return;
  if (Array.isArray(obj)) {
    if (obj.length && Array.isArray(obj[0]) && obj[0].length >= 2 && isFinite(obj[0][0]) && isFinite(obj[0][1])) {
      out.push(obj.map(p => [Number(p[0]), Number(p[1]), Number(p[2] ?? 0)])); return;
    }
    if (obj.length && typeof obj[0] === 'object' && obj[0] && 'x' in obj[0] && 'y' in obj[0]) {
      out.push(obj.map(p => [Number(p.x), Number(p.y), Number(('z' in p) ? p.z : 0)])); return;
    }
    for (const el of obj) collectPointArrays(el, out);
    return;
  }
  if (typeof obj === 'object') {
    for (const k in obj) collectPointArrays(obj[k], out);
  }
}
function mergePointSets(pointSets) {
  const merged = []; for (const arr of pointSets) for (const p of arr) merged.push(p); return merged;
}

function computeBBox(pts) {
  let minX= Infinity, minY= Infinity, maxX=-Infinity, maxY=-Infinity;
  for (const [x,y] of pts) { if (x<minX)minX=x; if (y<minY)minY=y; if (x>maxX)maxX=x; if (y>maxY)maxY=y; }
  return {minX, minY, maxX, maxY, w:maxX-minX, h:maxY-minY};
}

function computeBBox3D(pts) {
  let minX= Infinity, minY= Infinity, minZ= Infinity;
  let maxX=-Infinity, maxY=-Infinity, maxZ=-Infinity;
  for (const [x, y, zRaw] of pts) {
    const z = Number.isFinite(zRaw) ? zRaw : 0;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  return { minX, minY, minZ, maxX, maxY, maxZ, w: maxX - minX, h: maxY - minY, d: maxZ - minZ };
}

function expandBBox(bbox, fraction = 0.08) {
  if (!bbox || !Number.isFinite(bbox.minX) || !Number.isFinite(bbox.maxX) ||
      !Number.isFinite(bbox.minY) || !Number.isFinite(bbox.maxY)) {
    return { minX: -1, maxX: 1, minY: -1, maxY: 1, w: 2, h: 2 };
  }
  const padX = Math.max(Math.abs(bbox.w) * fraction, 0.01);
  const padY = Math.max(Math.abs(bbox.h) * fraction, 0.01);
  return {
    minX: bbox.minX - padX,
    maxX: bbox.maxX + padX,
    minY: bbox.minY - padY,
    maxY: bbox.maxY + padY,
    w: (bbox.w || 0) + padX * 2,
    h: (bbox.h || 0) + padY * 2
  };
}

function expandBBox3D(bbox, fraction = 0.08) {
  if (!bbox || !Number.isFinite(bbox.minX) || !Number.isFinite(bbox.minY) || !Number.isFinite(bbox.minZ)) {
    return { minX: -1, maxX: 1, minY: -1, maxY: 1, minZ: -1, maxZ: 1, w: 2, h: 2, d: 2 };
  }
  const padX = Math.max(Math.abs(bbox.w) * fraction, 0.01);
  const padY = Math.max(Math.abs(bbox.h) * fraction, 0.01);
  const padZ = Math.max(Math.abs(bbox.d) * fraction, 0.01);
  return {
    minX: bbox.minX - padX,
    maxX: bbox.maxX + padX,
    minY: bbox.minY - padY,
    maxY: bbox.maxY + padY,
    minZ: bbox.minZ - padZ,
    maxZ: bbox.maxZ + padZ,
    w: (bbox.w || 0) + padX * 2,
    h: (bbox.h || 0) + padY * 2,
    d: (bbox.d || 0) + padZ * 2
  };
}

function drawDebugBBox(ctx, bbox) {
  if (!bbox || !ctx) return;
  ctx.save();
  ctx.strokeStyle = '#22c55e';
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = 2;
  ctx.strokeRect(bbox.minX, bbox.minY, Math.max(0, bbox.maxX - bbox.minX), Math.max(0, bbox.maxY - bbox.minY));
  ctx.restore();
}

function updateBoxExtents(box, x, y, z) {
  if (x < box.minX) box.minX = x;
  if (x > box.maxX) box.maxX = x;
  if (y < box.minY) box.minY = y;
  if (y > box.maxY) box.maxY = y;
  if (z < box.minZ) box.minZ = z;
  if (z > box.maxZ) box.maxZ = z;
}

function safeDim(value) {
  return Number.isFinite(value) && Math.abs(value) > 1e-5 ? Math.abs(value) : 1e-2;
}

function create2DTransform(bbox, PAD, W, H, flipY, autofit, padding = 0.9) {
  if (!bbox || !Number.isFinite(bbox.minX) || !Number.isFinite(bbox.maxX)) {
    return {
      map: () => [PAD, PAD],
      screenBBox: null,
      scale: 1,
      center: { x: 0, y: 0 }
    };
  }
  const safeW = safeDim(bbox.w);
  const safeH = safeDim(bbox.h);
  const scaleBase = Math.min(W / safeW, H / safeH);
  let scale = scaleBase * padding;
  if (!autofit) scale = 1;
  const cx = (bbox.minX + bbox.maxX) / 2;
  const cy = (bbox.minY + bbox.maxY) / 2;
  const originX = PAD + W / 2;
  const originY = PAD + H / 2;
  const map = (x, y) => {
    const px = (x - cx) * scale + originX;
    const signedY = (y - cy) * scale;
    const py = flipY ? originY - signedY : originY + signedY;
    return [px, py];
  };

  const corners = [
    [bbox.minX, bbox.minY],
    [bbox.maxX, bbox.minY],
    [bbox.maxX, bbox.maxY],
    [bbox.minX, bbox.maxY]
  ];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of corners) {
    const [px, py] = map(x, y);
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  }

  return {
    map,
    screenBBox: { minX, minY, maxX, maxY },
    scale,
    center: { x: cx, y: cy }
  };
}

function create3DTransform(bbox, canvasW, canvasH, padding = 0.9) {
  if (!bbox || !Number.isFinite(bbox.minX)) {
    return {
      scale: 1,
      center: { x: 0, y: 0, z: 0 }
    };
  }
  const safeW = safeDim(bbox.w);
  const safeH = safeDim(bbox.h);
  const scaleBase = Math.min(canvasW / safeW, canvasH / safeH);
  const scale = scaleBase * padding;
  const center = {
    x: (bbox.minX + bbox.maxX) / 2,
    y: (bbox.minY + bbox.maxY) / 2,
    z: (bbox.minZ + bbox.maxZ) / 2
  };
  return { scale, center };
}

function initThree(containerW=960, containerH=540) {
  const viewContainer = document.getElementById('threeView');
  if (!viewContainer) return;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, containerW/containerH, 0.1, 10000);
  camera.position.set(0, 0, 450);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(containerW, containerH);
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = 'auto';
  let badge = viewContainer.querySelector('.viewBadge');
  if (!badge) {
    badge = document.createElement('div');
    badge.className = 'viewBadge';
    viewContainer.appendChild(badge);
  }
  viewContainer.insertBefore(renderer.domElement, badge);
  badge.textContent = '3D';

  const light = new THREE.DirectionalLight(0xffffff, 1.0);
  light.position.set(0, 0, 1);
  scene.add(light);
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));

  __three = { scene, camera, renderer, points: null, lines: null, bboxHelper: null, headHalo: null };
}

function resizeThreeRenderer(width, height) {
  if (!__three || !width || !height) return;
  __three.renderer.setSize(width, height);
  __three.camera.aspect = width / height;
  __three.camera.updateProjectionMatrix();
}

function ensureGeometries(numPoints, totalSegments) {
  if (!__three.points || __three.points.geometry.attributes.position.count !== numPoints) {
    if (__three.points) __three.scene.remove(__three.points);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(numPoints * 3), 3));
    const m = new THREE.PointsMaterial({ color: 0xff1a1a, size: 6, sizeAttenuation: false });
    __three.points = new THREE.Points(g, m);
    __three.scene.add(__three.points);
  }
  const lineVerts = totalSegments * 2;
  if (!__three.lines || __three.lines.geometry.attributes.position.count !== lineVerts) {
    if (__three.lines) __three.scene.remove(__three.lines);
    const gL = new THREE.BufferGeometry();
    gL.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(lineVerts * 3), 3));
    const mL = new THREE.LineBasicMaterial({ color: 0x00a3ff, linewidth: 2 });
    __three.lines = new THREE.LineSegments(gL, mL);
    __three.scene.add(__three.lines);
  }
}

// Compute extra anatomical 3D segments not present as raw landmark pairs
function computeExtraSegments3D(pts) {
  const segments = [];
  const get = (idx) => (pts[idx] ? pts[idx] : null);
  const LS = POSE.L_SHOULDER, RS = POSE.R_SHOULDER;
  const LH = POSE.L_HIP, RH = POSE.R_HIP;
  const NOSE = POSE.NOSE;
  const pLS = get(LS), pRS = get(RS);
  const pLH = get(LH), pRH = get(RH);
  // Neck at midpoint of shoulders
  if (pLS && pRS) {
    const neck = [(pLS[0] + pRS[0]) / 2, (pLS[1] + pRS[1]) / 2, (pLS[2] + pRS[2]) / 2];
    segments.push([neck, pLS], [neck, pRS]); // neck→left/right shoulder
    const pNose = get(NOSE);
    if (pNose) segments.push([pNose, neck]); // optional aesthetic nose→neck
  }
  // Hip center at midpoint of hips
  if (pLH && pRH) {
    const hipC = [(pLH[0] + pRH[0]) / 2, (pLH[1] + pRH[1]) / 2, (pLH[2] + pRH[2]) / 2];
    segments.push([hipC, pLH], [hipC, pRH]); // hip center→left/right hip
  }
  return segments;
}

function buildSkeletonEdges(numPoints) {
  // Only use custom pose edges; ignore full hand skeletons to avoid cross-hand links.
  const valid = CUSTOM_EDGES.filter(([a, b]) => a < numPoints && b < numPoints);
  
  // Remove any cross-hand links (left hand indices ↔ right hand indices)
  // and remove any direct wrist-to-wrist line if present
  const isLeftHand = (i) => i >= LH_OFFSET && i < RH_OFFSET;
  const isRightHand = (i) => i >= RH_OFFSET;
  return valid.filter(([a, b]) => {
    // no left-hand to right-hand direct connections
    if ((isLeftHand(a) && isRightHand(b)) || (isLeftHand(b) && isRightHand(a))) return false;
    // no direct L_WRIST ↔ R_WRIST
    if ((a === POSE.L_WRIST && b === POSE.R_WRIST) || (a === POSE.R_WRIST && b === POSE.L_WRIST)) return false;
    return true;
  });
}

function updateThreeDebugBox(box) {
  if (!__three) return;
  if (box && showBBoxEl && showBBoxEl.checked) {
    if (!__three.bboxHelper) {
      __three.bboxHelper = new THREE.Box3Helper(new THREE.Box3(), 0x22c55e);
      __three.scene.add(__three.bboxHelper);
    }
    __three.bboxHelper.box.min.set(box.minX, box.minY, box.minZ);
    __three.bboxHelper.box.max.set(box.maxX, box.maxY, box.maxZ);
    __three.bboxHelper.visible = true;
  } else if (__three && __three.bboxHelper) {
    __three.bboxHelper.visible = false;
  }
}

function drawEdges(edges, pts, mapper, edgeColor) {
  if (!Array.isArray(edges) || !ctx) return;
  ctx.beginPath();
  for (const e of edges) {
    if (!Array.isArray(e) || e.length < 2) continue;
    const a = e[0], b = e[1];
    if (!pts[a] || !pts[b]) continue;
    const p1 = mapper(pts[a][0], pts[a][1]);
    const p2 = mapper(pts[b][0], pts[b][1]);
    ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]);
  }
  ctx.lineWidth = 3;
  ctx.strokeStyle = edgeColor;
  ctx.stroke();
}

export function applyCanonicalFrame(frame, i) {
  clearCanvas();

  // collect points (robust, nested)
  const sets = []; collectPointArrays(frame, sets);
  if (!sets.length) {
    if (ctx) {
      ctx.fillStyle = '#111'; ctx.font = '14px ui-monospace, monospace';
      ctx.fillText('No 2D points detected in this frame.', 12, 22);
    }
    if (i % 10 === 0) console.log('Frame (no 2D points)', i, frame);
    return;
  }

  // merge all sets (pose + hands, etc.)
  const pts = mergePointSets(sets);
  const { width: canvasWidth, height: canvasHeight } = syncCanvasSize();
  const PAD = 30, W = canvasWidth - PAD * 2, H = canvasHeight - PAD * 2;
  const rawBBox = computeBBox(pts);
  const renderBBox = expandBBox(rawBBox);
  const flipY = flipYEl.checked;
  const autofit = !!(autofitEl && autofitEl.checked);
  const showBBox = showBBoxEl && showBBoxEl.checked;
  const transform2D = create2DTransform(renderBBox, PAD, W, H, flipY, autofit);
  const screenBBox = showBBox ? transform2D.screenBBox : null;
  const bbox3D = expandBBox3D(computeBBox3D(pts));
  const threeTransform = create3DTransform(bbox3D, canvasWidth, canvasHeight);

  // Build skeleton edges based on number of points (MediaPipe structure)
  const edges = buildSkeletonEdges(pts.length);

  // ----- 2D canvas draw (under the 3D view) -----
  drawEdges(edges, pts, (x, y) => transform2D.map(x, y), edgeColorEl.value);
  const r2d = Number(ptSizeEl.value) || 4;
  if (ctx) {
    ctx.fillStyle = ptColorEl.value;
    for (const [x, y] of pts) {
      const [px, py] = transform2D.map(x, y);
      ctx.beginPath(); ctx.arc(px, py, r2d, 0, Math.PI * 2); ctx.fill();
    }
    if (showBBox && screenBBox) {
      drawDebugBBox(ctx, screenBBox);
    }
  }

  // ----- HEAD HALO CIRCLE (drawn above skeleton) -----
  // Identify head landmark: prefer topmost point among head keypoints
  const headCandidates = [POSE.NOSE, POSE.L_EYE, POSE.R_EYE, POSE.L_EAR, POSE.R_EAR]
    .filter(idx => idx < pts.length && pts[idx])
    .map(idx => ({ idx, pt: pts[idx] }));
  
  if (headCandidates.length > 0 && ctx) {
    // Find topmost point (lowest y value in data coordinates)
    const headLandmark = headCandidates.reduce((top, curr) => 
      curr.pt[1] < top.pt[1] ? curr : top
    );
    
    // Calculate halo radius proportional to scale
    const baseRadius = 25; // Base radius in pixels
    const scaleFactor = Math.min(Math.max(transform2D.scale / 400, 0.8), 1.4);
    const haloRadius = baseRadius * scaleFactor;
    
    // Draw circle centered on head landmark
    const [hx, hy] = transform2D.map(headLandmark.pt[0], headLandmark.pt[1]);
    ctx.beginPath();
    ctx.arc(hx, hy, haloRadius, 0, Math.PI * 2);
    ctx.strokeStyle = "#4cc9f0";
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  // ----------------------------------------------

  // 3D render path with THREE.js
  if (!__three) {
    initThree(canvasWidth, canvasHeight);
  } else {
    resizeThreeRenderer(canvasWidth, canvasHeight);
  }
  const extraSegments = computeExtraSegments3D(pts);
  ensureGeometries(pts.length, edges.length + extraSegments.length);

  const flipY3D = -1;
  const transformedPts = new Array(pts.length);
  const scaledBox = { minX: Infinity, minY: Infinity, minZ: Infinity, maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity };
  const cameraExtent = Math.max(safeDim(bbox3D.w), safeDim(bbox3D.h), safeDim(bbox3D.d));
  const zoomFactorRaw = zoom3dEl ? Number(zoom3dEl.value) : 1;
  const zoomFactor = Number.isFinite(zoomFactorRaw) && zoomFactorRaw > 0 ? zoomFactorRaw : 1;
  const cameraDistanceBase = cameraExtent * threeTransform.scale * 1.2 + 250;
  const cameraDistance = cameraDistanceBase / zoomFactor;
  __three.camera.position.set(0, 0, cameraDistance);
  __three.camera.lookAt(0, 0, 0);
  __three.camera.updateProjectionMatrix();

  // update point positions
  {
    const arr = __three.points.geometry.attributes.position.array;
    for (let i = 0; i < pts.length; i++) {
      const src = pts[i];
      const tx = (src[0] - threeTransform.center.x) * threeTransform.scale;
      const ty = (src[1] - threeTransform.center.y) * threeTransform.scale * flipY3D;
      const tz = ((src[2] || 0) - threeTransform.center.z) * threeTransform.scale;
      transformedPts[i] = [tx, ty, tz];
      updateBoxExtents(scaledBox, tx, ty, tz);
      const k = i * 3;
      arr[k] = tx; arr[k+1] = ty; arr[k+2] = tz;
    }
    __three.points.geometry.attributes.position.needsUpdate = true;
  }

  // update line segments: base skeleton edges + extra anatomical segments
  {
    const arr = __three.lines.geometry.attributes.position.array;
    let k = 0;
    for (let i = 0; i < edges.length; i++) {
      const a = edges[i][0], b = edges[i][1];
      const [ax, ay, az] = transformedPts[a];
      const [bx, by, bz] = transformedPts[b];
      arr[k] = ax; arr[k+1] = ay; arr[k+2] = az; k += 3;
      arr[k] = bx; arr[k+1] = by; arr[k+2] = bz; k += 3;
    }
    for (let i = 0; i < extraSegments.length; i++) {
      const A = extraSegments[i][0], B = extraSegments[i][1];
      const ax = (A[0] - threeTransform.center.x) * threeTransform.scale;
      const ay = (A[1] - threeTransform.center.y) * threeTransform.scale * flipY3D;
      const az = ((A[2] || 0) - threeTransform.center.z) * threeTransform.scale;
      const bx = (B[0] - threeTransform.center.x) * threeTransform.scale;
      const by = (B[1] - threeTransform.center.y) * threeTransform.scale * flipY3D;
      const bz = ((B[2] || 0) - threeTransform.center.z) * threeTransform.scale;
      updateBoxExtents(scaledBox, ax, ay, az);
      updateBoxExtents(scaledBox, bx, by, bz);
      arr[k] = ax; arr[k+1] = ay; arr[k+2] = az; k += 3;
      arr[k] = bx; arr[k+1] = by; arr[k+2] = bz; k += 3;
    }
    __three.lines.geometry.attributes.position.needsUpdate = true;
  }

  // ----- 3D HEAD HALO CIRCLE (drawn above skeleton) -----
  // Create or update head halo in 3D space
  const headCandidates3D = [POSE.NOSE, POSE.L_EYE, POSE.R_EYE, POSE.L_EAR, POSE.R_EAR]
    .filter(idx => idx < pts.length && pts[idx])
    .map(idx => ({ idx, pt: pts[idx] }));
  
  if (headCandidates3D.length > 0) {
    // Find topmost point (lowest y value in data coordinates)
    const headLandmark3D = headCandidates3D.reduce((top, curr) => 
      curr.pt[1] < top.pt[1] ? curr : top
    );
    
    // Calculate halo radius based on 3D scale
    const baseRadius3D = 0.08; // Base radius in world units
    const haloRadius3D = baseRadius3D * threeTransform.scale;
    
    // Create halo if it doesn't exist
    if (!__three.headHalo) {
      const circleGeometry = new THREE.RingGeometry(haloRadius3D * 0.9, haloRadius3D, 32);
      const circleMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x4cc9f0, 
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9
      });
      __three.headHalo = new THREE.Mesh(circleGeometry, circleMaterial);
      __three.scene.add(__three.headHalo);
    }
    
    // Update halo position and size
    const hx = (headLandmark3D.pt[0] - threeTransform.center.x) * threeTransform.scale;
    const hy = (headLandmark3D.pt[1] - threeTransform.center.y) * threeTransform.scale * flipY3D;
    const hz = ((headLandmark3D.pt[2] || 0) - threeTransform.center.z) * threeTransform.scale;
    
    __three.headHalo.position.set(hx, hy, hz);
    __three.headHalo.scale.set(1, 1, 1);
    
    // Make halo face camera
    __three.headHalo.lookAt(__three.camera.position);
    __three.headHalo.visible = true;
  } else if (__three.headHalo) {
    __three.headHalo.visible = false;
  }
  // ----------------------------------------------

  if (!Number.isFinite(scaledBox.minX)) {
    updateThreeDebugBox(null);
  } else {
    updateThreeDebugBox(showBBox ? scaledBox : null);
  }

  // render the scene
  __three.renderer.render(__three.scene, __three.camera);
}