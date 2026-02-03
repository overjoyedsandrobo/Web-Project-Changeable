const canvas = document.getElementById("generation-canvas");
const ctx = canvas.getContext("2d");

const authFlag = document.body ? document.body.dataset.auth : null;
window.IS_AUTHENTICATED = authFlag === "true";
const currentUserId = document.body && document.body.dataset.userId
  ? Number(document.body.dataset.userId)
  : null;

const colsInput = document.getElementById("cols");
const rowsInput = document.getElementById("rows");
const clearBtn = document.getElementById("clearBtn");

const helpBtn = document.getElementById("helpBtn");
const helpModal = document.getElementById("helpModal");
const helpClose = document.getElementById("helpClose");
const helpBackdrop = document.getElementById("helpBackdrop");

const legendEl = document.getElementById("legend");

const generateBtn = document.getElementById("generateBtn");
const stepsInput = document.getElementById("steps");
const seedModeEl = document.getElementById("seedMode");
const showGridEl = document.getElementById("showGrid");
const seedInput = document.getElementById("seed");
const saveBtn = document.getElementById("saveBtn");
const loadBtn = document.getElementById("loadBtn");
const designNameInput = document.getElementById("designName");
const openSaveModalBtn = document.getElementById("openSaveModal");
const openLoadModalBtn = document.getElementById("openLoadModal");
const saveModal = document.getElementById("saveModal");
const loadModal = document.getElementById("loadModal");
const saveBackdrop = document.getElementById("saveBackdrop");
const loadBackdrop = document.getElementById("loadBackdrop");
const saveClose = document.getElementById("saveClose");
const loadClose = document.getElementById("loadClose");
const togglePrivateViewBtn = document.getElementById("togglePrivateView");
const publicGallerySection = document.getElementById("publicGallerySection");
const privateGallerySection = document.getElementById("privateGallerySection");
const publicSearchInput = document.getElementById("publicSearch");
const publicDesignGrid = document.getElementById("publicDesignGrid");
const privateDesignGrid = document.getElementById("privateDesignGrid");
const designContextMenu = document.getElementById("designContextMenu");
const designDeleteBtn = document.getElementById("designDeleteBtn");
const randomizeSeedEl = document.getElementById("randomizeSeed");
const mirrorXBtn = document.getElementById("mirrorXBtn");
const mirrorYBtn = document.getElementById("mirrorYBtn");
const rotateBtn = document.getElementById("rotateBtn");
const exportPngBtn = document.getElementById("exportPngBtn");
const undoBtn = document.getElementById("undoBtn");
const redoBtn = document.getElementById("redoBtn");

const previewModal = document.getElementById("previewModal");
const previewBackdrop = document.getElementById("previewBackdrop");
const previewClose = document.getElementById("previewClose");
const previewCanvas = document.getElementById("previewCanvas");
const previewRegenerateBtn = document.getElementById("previewRegenerateBtn");
const previewExportPngBtn = document.getElementById("previewExportPngBtn");
const previewMeta = document.getElementById("previewMeta");

const pctx = previewCanvas.getContext("2d");


const undoStack = [];
const redoStack = [];
const HISTORY_LIMIT = 100;
const ruleCount = 12
const ruleColors = Array(ruleCount + 1).fill(null);

let saveTimer = null;

let cols = parseInt(colsInput.value, 10);
let rows = parseInt(rowsInput.value, 10);

let grid = [];
let hoverCell = null;
let isPainting = false;
let activeRule = 1; // default paint rule
let paintEraseMode = false;


const colorPicker = document.getElementById("ruleColorPicker");
let ruleColorPicker = document.getElementById("ruleColorPicker");
if (!ruleColorPicker) {
  ruleColorPicker = document.createElement("input");
  ruleColorPicker.type = "color";
  ruleColorPicker.id = "ruleColorPicker";
  document.body.appendChild(ruleColorPicker);
}

// IMPORTANT: do NOT use display:none
ruleColorPicker.style.position = "fixed";
ruleColorPicker.style.opacity = "0.01";
ruleColorPicker.style.width = "1px";
ruleColorPicker.style.height = "1px";
ruleColorPicker.style.border = "0";
ruleColorPicker.style.padding = "0";
ruleColorPicker.style.zIndex = "999999";
ruleColorPicker.style.pointerEvents = "auto";
ruleColorPicker.style.left = "-9999px";
ruleColorPicker.style.top = "-9999px";


// Which rule are we editing right now?
let colorEditRule = null;

function ensureDefaultRuleColors() {
  for (let r = 1; r <= ruleCount; r++) {
    if (!ruleColors[r]) {
      // default: grayscale like before
      const t = (r - 1) / Math.max(1, (ruleCount - 1));
      const v = Math.floor(60 + t * 160);
      ruleColors[r] = `rgb(${v},${v},${v})`;
    }
  }
}
// --- Canvas sizing (rectangular-friendly) ---
function resizeCanvas() {
  const container = document.getElementById("canvas-container");
  const maxWidth = container.clientWidth * 0.95;
  const maxHeight = container.clientHeight * 0.95;

  // Use a pleasant wide aspect ratio for the workspace
  const aspect = 16 / 10;

  let width = maxWidth;
  let height = width / aspect;

  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspect;
  }

  canvas.width = Math.floor(width);
  canvas.height = Math.floor(height);

  draw();
}

window.addEventListener("resize", resizeCanvas);

// --- Grid state ---
function createGrid(r, c) {
  const g = new Array(r);
  for (let y = 0; y < r; y++) {
    g[y] = new Array(c).fill(0);
  }
  return g;
}

function clampInt(v, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function applySettings() {
  cols = clampInt(colsInput.value, 4, 64);
  rows = clampInt(rowsInput.value, 4, 64);

  colsInput.value = cols;
  rowsInput.value = rows;

  grid = createGrid(rows, cols);

  hoverCell = null;

  draw();
  renderLegend(); 
  ensureDefaultRuleColors();
  scheduleSaveState();
}

// --- Rendering ---
function ruleToFill(rule) {
  // if user picked a color, use it
  if (ruleColors[rule]) return ruleColors[rule];

  // fallback (your grayscale logic)
  const t = (rule - 1) / Math.max(1, (ruleCount - 1)); // assuming ruleCount = number of rules
  const v = Math.floor(50 + t * 170);
  const c = `rgb(${v},${v},${v})`;
  return c;
}



function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const cellW = canvas.width / cols;
  const cellH = canvas.height / rows;

  // draw painted rules
 for (let y = 0; y < rows; y++) {
    const y0 = Math.round(y * cellH);
    const y1 = Math.round((y + 1) * cellH);
    const h  = y1 - y0;

    for (let x = 0; x < cols; x++) {
      const rule = grid[y][x];
      if (rule === 0) continue;

      const x0 = Math.round(x * cellW);
      const x1 = Math.round((x + 1) * cellW);
      const w  = x1 - x0;

      ctx.fillStyle = ruleToFill(rule);
      ctx.fillRect(x0, y0, w, h);
    }
  }

  // grid lines + hover
  const showGrid = showGridEl ? showGridEl.checked : true;
  if (showGrid) {
    ctx.strokeStyle = "#1f1f1f";
    ctx.lineWidth = 1;

    for (let x = 0; x <= cols; x++) {
      ctx.beginPath();
      ctx.moveTo(Math.round(x * cellW) + 0.5, 0);
      ctx.lineTo(Math.round(x * cellW) + 0.5, canvas.height);
      ctx.stroke();
    }

    for (let y = 0; y <= rows; y++) {
      ctx.beginPath();
      ctx.moveTo(0, Math.round(y * cellH) + 0.5);
      ctx.lineTo(canvas.width, Math.round(y * cellH) + 0.5);
      ctx.stroke();
    }

    if (hoverCell) {
      const { x, y } = hoverCell;
      ctx.strokeStyle = "#3a3a3a";
      ctx.lineWidth = 2;
      ctx.strokeRect(x * cellW + 1, y * cellH + 1, cellW - 2, cellH - 2);
    }
  }
}

function renderLegend() {
  legendEl.innerHTML = "";

  for (let r = 1; r <= ruleCount; r++) {
    const item = document.createElement("div");
    item.className = "legend-item" + (r === activeRule ? " selected" : "");
    item.dataset.rule = String(r);

    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.background = ruleToFill(r);

    const label = document.createElement("span");
    label.className = "legend-label";
    label.textContent = `${r}`;

    item.appendChild(swatch);
    item.appendChild(label);

    // Left click = select rule
    item.addEventListener("click", (e) => {
      // If user is currently right-clicking, ignore
      if (e.button === 2) return;
      activeRule = r;
      renderLegend();
      scheduleSaveState();
    });

    // Right click = set color
    item.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Don't allow changing color for "empty" rule if you have one
      if (r === 0) return;
      openRuleColorPicker(r, e.clientX, e.clientY);
    });

    legendEl.appendChild(item);
  }
}

function openRuleColorPicker(rule, clientX, clientY) {
  colorEditRule = rule;

  // set current value (must be hex)
  ruleColorPicker.value = rgbToHex(ruleToFill(rule));

  // Move it under the cursor for 1 frame so browser allows it
  ruleColorPicker.style.left = `${clientX}px`;
  ruleColorPicker.style.top = `${clientY}px`;

  // open native picker in the same user gesture
  ruleColorPicker.focus({ preventScroll: true });
  if (typeof ruleColorPicker.showPicker === "function") {
    ruleColorPicker.showPicker();
  } else {
    ruleColorPicker.click();
  }

  // hide again shortly after (but keep it in DOM)
  setTimeout(() => {
    ruleColorPicker.style.left = "-9999px";
    ruleColorPicker.style.top = "-9999px";
  }, 0);
}



// When user picks a color
ruleColorPicker.addEventListener("input", () => {
  if (colorEditRule == null) return;
  ruleColors[colorEditRule] = ruleColorPicker.value; // already "#rrggbb"
  renderLegend();
  draw();
  scheduleSaveState();
});

ruleColorPicker.addEventListener("change", () => {
  colorEditRule = null;
});



function rgbToHex(cssColor) {
  // If already hex
  if (cssColor.startsWith("#")) return cssColor;

  // If rgb(r,g,b)
  const m = cssColor.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  if (!m) return "#ffffff";

  const r = Number(m[1]), g = Number(m[2]), b = Number(m[3]);
  return "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
}


function setCell(x, y, value) {
  grid[y][x] = value;
}

function paintCell(x, y, erase) {
  setCell(x, y, erase ? 0 : activeRule);
}

function scheduleSaveState() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveState, 120);
}

async function saveState() {
  if (!window.IS_AUTHENTICATED) return;
  try {
    await fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(getDesignState()),
    });
  } catch (e) {
    // ignore network/storage errors
  }
}

async function loadState() {
  if (!window.IS_AUTHENTICATED) return;
  try {
    const res = await fetch("/api/state");
    if (!res.ok) return;
    const payload = await res.json();
    if (payload && payload.state) importDesign(payload.state);
  } catch (e) {
    // ignore corrupted or unavailable data
  }
}

async function saveDesignToDb(name, isPublic) {
  try {
    const res = await fetch("/api/designs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        is_public: isPublic,
        state: getDesignStateForGallery(),
      }),
    });
    if (!res.ok) {
      const msg = await getErrorMessage(res, "Save failed.");
      alert(msg);
      return;
    }
    await refreshDesignGrids();
    closeSaveModal();
  } catch (e) {
    alert("Save failed.");
  }
}

async function deleteDesign(id) {
  try {
    const res = await fetch(`/api/designs/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const msg = await getErrorMessage(res, "Delete failed.");
      alert(msg);
      return;
    }
    await refreshDesignGrids();
  } catch (e) {
    alert("Delete failed.");
  }
}

async function loadDesignFromDb(id) {
  try {
    const res = await fetch(`/api/designs/${id}`);
    if (!res.ok) {
      const msg = await getErrorMessage(res, "Load failed.");
      alert(msg);
      return;
    }
    const payload = await res.json();
    if (payload && payload.state) {
      if (payload.state.ruleColors) delete payload.state.ruleColors;
      importDesign(payload.state);
    }
  } catch (e) {
    alert("Load failed.");
  }
}

async function getErrorMessage(res, fallback) {
  try {
    const data = await res.json();
    if (data && data.error) return data.error;
  } catch (e) {
    // ignore
  }
  return fallback;
}

async function refreshDesignGrids() {
  if (!window.IS_AUTHENTICATED) return;
  await Promise.all([refreshPublicGrid(), refreshPrivateGrid()]);
}

async function refreshPublicGrid() {
  if (!publicDesignGrid) return;
  try {
    const res = await fetch("/api/designs?scope=public&include_state=1");
    if (!res.ok) return;
    const payload = await res.json();
    const list = payload.designs || [];
    const query = publicSearchInput ? publicSearchInput.value.trim().toLowerCase() : "";
    const filtered = query
      ? list.filter((d) => String(d.name || "").toLowerCase().includes(query))
      : list;
    renderDesignGrid(publicDesignGrid, filtered);
  } catch (e) {
    // ignore
  }
}

async function refreshPrivateGrid() {
  if (!privateDesignGrid) return;
  try {
    const res = await fetch("/api/designs?scope=private&private_only=1&include_state=1");
    if (!res.ok) return;
    const payload = await res.json();
    renderDesignGrid(privateDesignGrid, payload.designs || []);
  } catch (e) {
    // ignore
  }
}

function renderDesignGrid(container, designs) {
  container.innerHTML = "";
  if (!designs.length) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "No designs yet.";
    container.appendChild(empty);
    return;
  }

  for (const d of designs) {
    const card = document.createElement("div");
    card.className = "design-card";
    card.dataset.id = String(d.id);

    const thumb = document.createElement("canvas");
    thumb.className = "design-thumb";
    const body = document.createElement("div");
    body.className = "design-card-body";

    const title = document.createElement("div");
    title.className = "design-card-title";
    title.textContent = d.name || `Design ${d.id}`;

    const meta = document.createElement("div");
    meta.className = "design-card-meta";
    meta.textContent = d.is_public ? "Public" : "Private";

    body.appendChild(title);
    body.appendChild(meta);
    card.appendChild(thumb);
    card.appendChild(body);

    card.addEventListener("click", () => {
      document.querySelectorAll(".design-card").forEach((el) => el.classList.remove("selected"));
      card.classList.add("selected");
    });

    card.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      if (!currentUserId || d.user_id !== currentUserId) return;
      openDesignContextMenu(e.clientX, e.clientY, d);
    });

    container.appendChild(card);
    drawDesignThumbnail(thumb, d.state);
  }
}

let contextDesignId = null;

function openDesignContextMenu(x, y, design) {
  if (!designContextMenu) return;
  contextDesignId = design.id;
  designContextMenu.classList.remove("hidden");

  const rect = designContextMenu.getBoundingClientRect();
  const margin = 8;
  const maxX = window.innerWidth - rect.width - margin;
  const maxY = window.innerHeight - rect.height - margin;
  const px = Math.max(margin, Math.min(x, maxX));
  const py = Math.max(margin, Math.min(y, maxY));

  designContextMenu.style.left = `${px}px`;
  designContextMenu.style.top = `${py}px`;
}

function closeDesignContextMenu() {
  if (!designContextMenu) return;
  designContextMenu.classList.add("hidden");
  contextDesignId = null;
}

function drawDesignThumbnail(canvasEl, state) {
  if (!canvasEl || !state || !state.grid) return;
  const ctx2 = canvasEl.getContext("2d");
  const w = 280;
  const h = 175;
  canvasEl.width = w;
  canvasEl.height = h;
  ctx2.setTransform(1, 0, 0, 1, 0, 0);

  const prev = {
    cols,
    rows,
    grid,
    ruleColors: ruleColors.slice(),
  };

  cols = state.cols || (state.grid[0] ? state.grid[0].length : cols);
  rows = state.rows || state.grid.length;
  grid = state.grid;
  if (Array.isArray(state.ruleColors)) {
    for (let i = 0; i < ruleColors.length; i++) ruleColors[i] = state.ruleColors[i] ?? ruleColors[i];
  }

  const seed = Number.isFinite(state.seed) ? state.seed : 0;
  renderAbstractPainting(seed, canvasEl, ctx2, w, h);

  cols = prev.cols;
  rows = prev.rows;
  grid = prev.grid;
  for (let i = 0; i < prev.ruleColors.length; i++) ruleColors[i] = prev.ruleColors[i];
}

function openSaveModal() {
  if (!window.IS_AUTHENTICATED) {
    alert("Please log in to save.");
    return;
  }
  saveModal.classList.remove("hidden");
  if (designNameInput) {
    designNameInput.value = "";
    designNameInput.focus();
  }
}

function closeSaveModal() {
  saveModal.classList.add("hidden");
}

function openLoadModal() {
  if (!window.IS_AUTHENTICATED) {
    alert("Please log in to load.");
    return;
  }
  loadModal.classList.remove("hidden");
  setLoadView("public");
  refreshDesignGrids();
}

function closeLoadModal() {
  loadModal.classList.add("hidden");
}

function setLoadView(view) {
  const isPublic = view === "public";
  if (publicGallerySection) publicGallerySection.classList.toggle("hidden", !isPublic);
  if (privateGallerySection) privateGallerySection.classList.toggle("hidden", isPublic);
  if (togglePrivateViewBtn) {
    togglePrivateViewBtn.textContent = isPublic ? "My Private" : "Back to Public";
  }
}


// --- Mouse to cell ---
function getCellFromEvent(evt) {
  const rect = canvas.getBoundingClientRect();
  const mx = evt.clientX - rect.left;
  const my = evt.clientY - rect.top;

  const x = Math.floor((mx / rect.width) * cols);
  const y = Math.floor((my / rect.height) * rows);

  if (x < 0 || x >= cols || y < 0 || y >= rows) return null;
  return { x, y };
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function getDesignState() {
  return {
    cols,
    rows,
    seed: clampInt(seedInput.value, 0, 999999999),
    grid,
    ruleColors,
    showGrid: showGridEl ? !!showGridEl.checked : true,
    activeRule,
    randomizeSeed: randomizeSeedEl ? !!randomizeSeedEl.checked : false,
    undoStack,
    redoStack,
  };
}

function getDesignStateForGallery() {
  const state = getDesignState();
  delete state.ruleColors;
  return state;
}

function exportDesign() {
  return JSON.stringify(getDesignState());
}

function importDesign(data) {
  const obj = typeof data === "string" ? JSON.parse(data) : data;

  cols = clampInt(obj.cols, 4, 64);
  rows = clampInt(obj.rows, 4, 64);

  colsInput.value = cols;
  rowsInput.value = rows;

  seedInput.value = clampInt(obj.seed ?? 0, 0, 999999999);
  if (showGridEl && typeof obj.showGrid === "boolean") {
    showGridEl.checked = obj.showGrid;
  }
  if (randomizeSeedEl && typeof obj.randomizeSeed === "boolean") {
    randomizeSeedEl.checked = obj.randomizeSeed;
  }

  grid = obj.grid;
  hoverCell = null;

  // restore colors if present
  if (Array.isArray(obj.ruleColors)) {
    for (let i = 0; i < obj.ruleColors.length; i++) {
      ruleColors[i] = obj.ruleColors[i];
    }
  }

  if (Number.isFinite(obj.activeRule)) {
    activeRule = clampInt(obj.activeRule, 1, ruleCount);
  }

  if (Array.isArray(obj.undoStack)) {
    undoStack.length = 0;
    for (const s of obj.undoStack.slice(-HISTORY_LIMIT)) {
      if (s && Array.isArray(s.grid)) undoStack.push(s);
    }
  }

  if (Array.isArray(obj.redoStack)) {
    redoStack.length = 0;
    for (const s of obj.redoStack.slice(-HISTORY_LIMIT)) {
      if (s && Array.isArray(s.grid)) redoStack.push(s);
    }
  }

  renderLegend();
  resizeCanvas();
  draw();
  updateHistoryButtons();
  scheduleSaveState();
}

function mirrorX() {
  pushHistory();
  const newGrid = cloneGrid(grid);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      newGrid[y][cols - 1 - x] = grid[y][x];
    }
  }

  grid = newGrid;
  draw();
  scheduleSaveState();
}
function mirrorY() {
  pushHistory();
  const newGrid = cloneGrid(grid);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      newGrid[rows - 1 - y][x] = grid[y][x];
    }
  }

  grid = newGrid;
  draw();
  scheduleSaveState();
}
function rotate90() {
  pushHistory();
  const newRows = cols;
  const newCols = rows;

  const newGrid = Array.from({ length: newRows }, () => Array(newCols).fill(0));

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      // (x, y) -> (y, newCols - 1 - x) for clockwise rotation
      newGrid[x][newCols - 1 - y] = grid[y][x];
    }
  }

  rows = newRows;
  cols = newCols;

  rowsInput.value = rows;
  colsInput.value = cols;

  grid = newGrid;
  hoverCell = null;

  resizeCanvas();
  draw();
  scheduleSaveState();
}

function exportPNG() {
  // Export the current canvas as-is
  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = `changeable_${Date.now()}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function snapshotState() {
  return {
    rows,
    cols,
    grid: cloneGrid(grid),
  };
}

function applyState(state) {
  rows = state.rows;
  cols = state.cols;
  grid = cloneGrid(state.grid);

  rowsInput.value = rows;
  colsInput.value = cols;


  hoverCell = null;

  renderLegend();
  resizeCanvas();
  draw();
}



function pushHistory() {
  undoStack.push(snapshotState());
  if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  redoStack.length = 0; // clear redo on new action
  updateHistoryButtons();
}

function undo() {
  if (undoStack.length === 0) return;
  redoStack.push(snapshotState());
  const prev = undoStack.pop();
  applyState(prev);
  updateHistoryButtons();
  scheduleSaveState();
}

function redo() {
  if (redoStack.length === 0) return;
  undoStack.push(snapshotState());
  const next = redoStack.pop();
  applyState(next);
  updateHistoryButtons();
  scheduleSaveState();
}

function updateHistoryButtons() {
  if (undoBtn) undoBtn.disabled = undoStack.length === 0;
  if (redoBtn) redoBtn.disabled = redoStack.length === 0;
}

let lastPreviewSeed = 0;

function openPreview() {
  previewModal.classList.remove("hidden");
}

function closePreview() {
  previewModal.classList.add("hidden");
}

function getSeedForPreview() {
  let seed;
  if (randomizeSeedEl && randomizeSeedEl.checked) {
    seed = (Math.random() * 1e9) >>> 0;
    seedInput.value = seed;
  } else {
    seed = clampInt(seedInput.value, 0, 999999999);
    seedInput.value = seed;
  }
  return seed >>> 0;
}

function resizePreviewCanvas() {
  const c = previewCanvas; // <canvas id="previewCanvas">
  const rect = c.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  c.width = Math.floor(rect.width * dpr);
  c.height = Math.floor(rect.height * dpr);

  pctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS pixels
}


// This is now your Generate button handler
function generatePreview() {
  openPreview();
  // wait a tick so canvas has layout size
  requestAnimationFrame(() => {
    resizePreviewCanvas();
    lastPreviewSeed = getSeedForPreview();
    renderAbstractPainting(lastPreviewSeed);
  });
}
function lerp(a, b, t) { return a + (b - a) * t; }

function smoothstep(t) { return t * t * (3 - 2 * t); }

// Sample the rule grid smoothly at normalized coords u,v in [0,1]
function sampleRuleField(u, v) {
  const gx = u * (cols - 1);
  const gy = v * (rows - 1);

  const x0 = Math.floor(gx), y0 = Math.floor(gy);
  const x1 = Math.min(cols - 1, x0 + 1);
  const y1 = Math.min(rows - 1, y0 + 1);

  const tx = smoothstep(gx - x0);
  const ty = smoothstep(gy - y0);

  const a = grid[y0][x0];
  const b = grid[y0][x1];
  const c = grid[y1][x0];
  const d = grid[y1][x1];

  const ab = lerp(a, b, tx);
  const cd = lerp(c, d, tx);
  return lerp(ab, cd, ty); 
}

// Cheap deterministic “noise” based on seed (no big libraries)
function hash2D(ix, iy, seed) {
  // All integer math in 32-bit space (no BigInt)
  let x = ix | 0;
  let y = iy | 0;
  let s = seed | 0;

  // Mix coordinates + seed
  let n = (x * 374761393) ^ (y * 668265263) ^ (s * 1442695041);
  n = (n ^ (n >>> 13)) | 0;
  n = Math.imul(n, 1274126177);
  n = (n ^ (n >>> 16)) >>> 0;

  return n / 4294967296; // [0,1)
}

// Smooth value noise
function valueNoise(u, v, seed) {
  const x = u * 8;   // scale controls “turbulence”
  const y = v * 8;

  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = x0 + 1, y1 = y0 + 1;

  const tx = smoothstep(x - x0);
  const ty = smoothstep(y - y0);

  const a = hash2D(x0, y0, seed);
  const b = hash2D(x1, y0, seed);
  const c = hash2D(x0, y1, seed);
  const d = hash2D(x1, y1, seed);

  const ab = lerp(a, b, tx);
  const cd = lerp(c, d, tx);
  return lerp(ab, cd, ty); // 0..1
}

function renderAbstractPainting(seed, targetCanvas = previewCanvas, targetCtx = pctx, cssWOverride = null, cssHOverride = null) {
  const shade = makeStyleShader(seed);

  // 8 “looks” within the same family
  const variant = ((seed >>> 0) % 8);

  // rng for grain + accents (decoupled from shader seed slightly)
  const rng = mulberry32(((seed ^ 0x9e3779b9) >>> 0) ^ (variant * 0x85ebca6b));

  const rect = targetCanvas.getBoundingClientRect();
  const cssW = Math.max(1, Math.floor(cssWOverride ?? rect.width ?? targetCanvas.width));
  const cssH = Math.max(1, Math.floor(cssHOverride ?? rect.height ?? targetCanvas.height));

  // Internal render resolution (cap for speed)
  const maxW = 1400;
  const down = Math.min(1, maxW / cssW);
  const W = Math.max(1, Math.floor(cssW * down));
  const H = Math.max(1, Math.floor(cssH * down));

  // Offscreen pixel buffer
  const off = document.createElement("canvas");
  off.width = W;
  off.height = H;
  const octx = off.getContext("2d", { willReadFrequently: true });

  const img = octx.createImageData(W, H);
  const data = img.data;

  // Variant knobs (subtle differences)
  const V = getVariantParams(variant);

  let i = 0;
  let avgLum = 0;

  for (let y = 0; y < H; y++) {
    const v = (y / (H - 1)) * 2 - 1;

    for (let x = 0; x < W; x++) {
      const u = (x / (W - 1)) * 2 - 1;

      let r, g, b, k;
      try {
        [r, g, b, k] = shade(u, v);
      } catch {
        r = g = b = 0.5; k = 0.5;
      }

      // SAFETY: NaN/Inf guard + clamp
      if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b) || !Number.isFinite(k)) {
        r = g = b = 0.5; k = 0.5;
      }
      r = clamp01(r); g = clamp01(g); b = clamp01(b); k = clamp01(k);

      // Variant-driven vignette (different “space” feeling)
      const rr = u * u + v * v;
      const vig = 1.0 - V.vignette * rr * (0.35 + 0.65 * k);

      // Grain (variant strength)
      const grain = (rng() - 0.5) * V.grain;

      // Very mild tone curve (variant gamma)
      r = Math.pow(clamp01(r * vig + grain), V.gamma);
      g = Math.pow(clamp01(g * vig + grain), V.gamma);
      b = Math.pow(clamp01(b * vig + grain), V.gamma);

      // Optional tiny “color grade” (warm/cool/green shift)
      const gr = V.grade;
      r = clamp01(r + gr.r);
      g = clamp01(g + gr.g);
      b = clamp01(b + gr.b);

      // Track brightness to avoid “black seed”
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      avgLum += lum;

      data[i++] = (r * 255) | 0;
      data[i++] = (g * 255) | 0;
      data[i++] = (b * 255) | 0;
      data[i++] = 255;
    }
  }

  avgLum /= (W * H);

  // If too dark, lift it (prevents empty/black results)
  if (avgLum < 0.035) {
    liftImageData(img.data, 1.7);
  }

  octx.putImageData(img, 0, 0);

  // Draw into preview (pctx is already setTransform(dpr,...))
  targetCtx.clearRect(0, 0, cssW, cssH);
  targetCtx.imageSmoothingEnabled = true;
  targetCtx.drawImage(off, 0, 0, cssW, cssH);
  renderGridObject(targetCtx, shade, cssW, cssH);


  // Post look pass (keeps background feel but adds variety)
  applyPostLook(targetCtx, rng, cssW, cssH, variant);

  // Accents (same idea, but variant biases modes + strength)
  renderAccents(targetCtx, shade, rng, cssW, cssH, variant);

  targetCtx.globalAlpha = 1;

  if (previewMeta && targetCanvas === previewCanvas) {
    previewMeta.textContent = `Seed: ${seed} • Style: expr-tree • v${variant}`;
  }
}

function clamp01(x) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function liftImageData(data, gain) {
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, data[i] * gain);
    data[i + 1] = Math.min(255, data[i + 1] * gain);
    data[i + 2] = Math.min(255, data[i + 2] * gain);
  }
}

function getVariantParams(v) {
  // All subtle: still “background”, but with different mood/contrast
  const params = [
    { vignette: 0.38, grain: 0.06, gamma: 1.05, grade: { r: 0.00, g: 0.00, b: 0.00 } }, // neutral
    { vignette: 0.30, grain: 0.05, gamma: 0.95, grade: { r: 0.06, g: 0.01, b: -0.02 } }, // warm
    { vignette: 0.44, grain: 0.045, gamma: 1.10, grade: { r: -0.02, g: 0.02, b: 0.06 } }, // cool
    { vignette: 0.22, grain: 0.07, gamma: 1.00, grade: { r: 0.02, g: 0.03, b: 0.00 } }, // airy
    { vignette: 0.55, grain: 0.035, gamma: 1.15, grade: { r: -0.01, g: -0.01, b: 0.00 } }, // deep
    { vignette: 0.34, grain: 0.08, gamma: 0.92, grade: { r: 0.03, g: 0.00, b: 0.03 } }, // dreamy
    { vignette: 0.42, grain: 0.05, gamma: 1.00, grade: { r: 0.00, g: 0.04, b: -0.01 } }, // greenish
    { vignette: 0.26, grain: 0.055, gamma: 1.08, grade: { r: 0.00, g: 0.00, b: 0.00 } }, // crisp
  ];
  return params[v] || params[0];
}

function applyPostLook(ctx, rng, W, H, variant) {
  ctx.save();

  // subtle film/paper texture
  const specks = Math.floor((W * H) / (1400 + rng() * 1000));
  ctx.globalAlpha = 0.04 + rng() * 0.03;
  ctx.fillStyle = "rgba(255,255,255,1)";
  for (let i = 0; i < specks; i++) {
    const x = rng() * W, y = rng() * H;
    ctx.fillRect(x, y, 1 + rng() * 2, 1 + rng() * 2);
  }

  // occasional soft blur “bloom” but not always
  if (variant === 3 || variant === 5) {
    ctx.globalAlpha = 0.10;
    for (let k = 0; k < 2; k++) {
      const dx = (rng() - 0.5) * 10;
      const dy = (rng() - 0.5) * 10;
      ctx.drawImage(ctx.canvas, dx, dy, W, H);
    }
  }

  // faint scanline / weave for one variant
  if (variant === 4) {
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = "rgba(0,0,0,1)";
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
  }

  ctx.restore();
}

function pickMode(rng, variant) {
  // Bias per variant so “shape language” changes
  // modes: 0 ribbon, 1 shard, 2 hatch, 3 ring, 4 plate
  const t = rng();

  if (variant === 0) return t < 0.40 ? 4 : t < 0.65 ? 3 : t < 0.80 ? 0 : t < 0.92 ? 2 : 1;
  if (variant === 1) return t < 0.50 ? 0 : t < 0.72 ? 4 : t < 0.88 ? 3 : 2;
  if (variant === 2) return t < 0.45 ? 3 : t < 0.75 ? 2 : t < 0.90 ? 4 : 0;
  if (variant === 3) return t < 0.55 ? 4 : t < 0.78 ? 2 : t < 0.92 ? 0 : 3;
  if (variant === 4) return t < 0.45 ? 2 : t < 0.70 ? 1 : t < 0.88 ? 3 : 4;
  if (variant === 5) return t < 0.60 ? 4 : t < 0.80 ? 0 : t < 0.92 ? 3 : 2;
  if (variant === 6) return t < 0.55 ? 3 : t < 0.78 ? 4 : t < 0.92 ? 2 : 0;
  return t < 0.50 ? 4 : t < 0.72 ? 3 : t < 0.88 ? 2 : 0;
}

function renderAccents(pctx, shade, rng, cssW, cssH, variant) {
  // Fewer + softer accents (background feel), but different per variant
  const base = 2 + Math.floor(rng() * 6);
  const accents = base + (variant === 4 ? 2 : 0);

  pctx.globalAlpha = (0.06 + rng() * 0.10) * (variant === 5 ? 0.7 : 1.0);

  for (let a = 0; a < accents; a++) {
    const x = rng() * cssW;
    const y = rng() * cssH;

    const uu = (x / cssW) * 2 - 1;
    const vv = (y / cssH) * 2 - 1;
    let [rr, gg, bb] = shade(uu, vv);

    if (!Number.isFinite(rr) || !Number.isFinite(gg) || !Number.isFinite(bb)) {
      rr = gg = bb = 0.6;
    }
    rr = clamp01(rr); gg = clamp01(gg); bb = clamp01(bb);

    pctx.strokeStyle = `rgb(${(rr * 255) | 0}, ${(gg * 255) | 0}, ${(bb * 255) | 0})`;
    pctx.fillStyle = pctx.strokeStyle;

    const mode = pickMode(rng, variant);

    pctx.save();
    pctx.translate(x, y);
    pctx.rotate((rng() - 0.5) * Math.PI * 2);

    if (mode === 0) {
      // ribbon stroke
      pctx.lineWidth = 2 + rng() * (variant === 1 ? 14 : 9);
      pctx.beginPath();
      pctx.moveTo(-220, 0);
      for (let t = 0; t < 8; t++) {
        pctx.quadraticCurveTo(-160 + t * 62, (rng() - 0.5) * 140, -110 + t * 62, (rng() - 0.5) * 140);
      }
      pctx.stroke();

    } else if (mode === 1) {
      // shard polygon (rarer except variant 4)
      const n = 3 + Math.floor(rng() * 6);
      pctx.beginPath();
      for (let k = 0; k < n; k++) {
        const ang = (k / n) * Math.PI * 2;
        const rad = 30 + rng() * (variant === 4 ? 260 : 160);
        pctx.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
      }
      pctx.closePath();
      pctx.globalAlpha *= 0.75;
      pctx.fill();
      pctx.globalAlpha /= 0.75;

    } else if (mode === 2) {
      // hatch block
      const w = 120 + rng() * 520;
      const h = 60 + rng() * 280;
      pctx.globalAlpha *= 0.45;
      pctx.fillRect(-w / 2, -h / 2, w, h);
      pctx.globalAlpha *= 2.2;
      pctx.lineWidth = 1;
      for (let t = -w / 2; t < w / 2; t += 7 + rng() * 12) {
        pctx.beginPath();
        pctx.moveTo(t, -h / 2);
        pctx.lineTo(t + (rng() - 0.5) * 50, h / 2);
        pctx.stroke();
      }

    } else if (mode === 3) {
      // ring arc
      pctx.lineWidth = 2 + rng() * 7;
      pctx.beginPath();
      pctx.arc(0, 0, 50 + rng() * 260, 0, Math.PI * (0.7 + rng() * 1.3));
      pctx.stroke();

    } else {
      // soft plate (most common)
      const w = 180 + rng() * 680;
      const h = 120 + rng() * 480;
      const grad = pctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(w, h));
      grad.addColorStop(0, `rgba(${(rr * 255) | 0}, ${(gg * 255) | 0}, ${(bb * 255) | 0}, 0.35)`);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      pctx.fillStyle = grad;
      pctx.fillRect(-w / 2, -h / 2, w, h);
    }

    pctx.restore();
  }

  pctx.globalAlpha = 1;
}

function renderGridObject(ctx, shade, W, H) {

  const off = document.createElement("canvas");
  off.width = W;
  off.height = H;
  const octx = off.getContext("2d", { willReadFrequently: true });

  const img = octx.createImageData(W, H);
  const d = img.data;

  // controls edge softness (small = crisp blocks, bigger = softer)
  const edge = 1.25;

  // per-rule “effect table” (change/add as you want)
  // NOTE: rule 0 is still treated as empty internally.
  const effects = {
    1: { type: "stretchX", amt: 0.55 },
    2: { type: "fadeRight", amt: 1.00 },
    3: { type: "chaosColor", amt: 1.00 },
    4: { type: "swirl", amt: 1.10 },
    5: { type: "pixelate", amt: 10.0 },
    6: { type: "wave", amt: 0.90 },
    7: { type: "holes", amt: 1.00 },
    8: { type: "outline", amt: 1.00 },
    9: { type: "angular", amt: 1.00 },
    10:{ type: "drip", amt: 1.00 },
    11:{ type: "mirror", amt: 1.00 },
    12:{ type: "invert", amt: 1.00 },
  };

  // render object pixels
  let idx = 0;
  for (let y = 0; y < H; y++) {
    const fy = (y + 0.5) / H;           // 0..1
    const v01 = fy;
    const v = v01 * 2 - 1;             // -1..1

    const gy = Math.floor(v01 * rows);
    const cy = Math.max(0, Math.min(rows - 1, gy));
    const cellY0 = (cy / rows) * H;
    const cellY1 = ((cy + 1) / rows) * H;

    // local inside cell in [-1,1]
    const lv = ((fy * rows) - cy) * 2 - 1;

    for (let x = 0; x < W; x++) {
      const fx = (x + 0.5) / W;
      const u01 = fx;
      const u = u01 * 2 - 1;

      const gx = Math.floor(u01 * cols);
      const cx = Math.max(0, Math.min(cols - 1, gx));

      const rule = grid[cy][cx] | 0;

      if (rule === 0) {
        // empty
        d[idx++] = 0; d[idx++] = 0; d[idx++] = 0; d[idx++] = 0;
        continue;
      }

      const cellX0 = (cx / cols) * W;
      const cellX1 = ((cx + 1) / cols) * W;
      const lu = ((fx * cols) - cx) * 2 - 1;
 
      // rule effect
      const ef = applyEffect(rule, u, v, lu, lv, cx, cy);

      // base alpha: block edges
      let a = boxAlpha(x + 0.5, y + 0.5, cellX0, cellY0, cellX1, cellY1);

      // add rule silhouette shaping
      a *= shapeAlpha(ef.shapeMode, lu, lv, cx, cy);

      // alpha from effect (fade etc)
      a *= ef.alphaMul;

      if (a <= 0.0001) {
        d[idx++] = 0; d[idx++] = 0; d[idx++] = 0; d[idx++] = 0;
        continue;
      }

      let [r, g, b] = shade(ef.uu, ef.vv);

      // your existing lift + sat
      const lum = 0.2126*r + 0.7152*g + 0.0722*b;
      const lift = 0.18;
      r = clamp01(r + lift); g = clamp01(g + lift); b = clamp01(b + lift);
      const sat = 1.35;
      r = clamp01(lum + (r - lum) * sat);
      g = clamp01(lum + (g - lum) * sat);
      b = clamp01(lum + (b - lum) * sat);

      // apply material mode
      [r, g, b] = applyMaterial(ef.materialMode, r, g, b, u, v, lu, lv, cx, cy);

      const alpha = clamp01(a) * 0.92;

      d[idx++] = (r * 255) | 0;
      d[idx++] = (g * 255) | 0;
      d[idx++] = (b * 255) | 0;
      d[idx++] = (alpha * 255) | 0;
    }
  }
  function clamp01(x){ return x<0?0:x>1?1:x; }
  function lerp(a,b,t){ return a+(b-a)*t; }
  function smoothstep(t){ return t*t*(3-2*t); }
  function shapeAlpha(shapeMode, lu, lv, cx, cy) {
    // lu/lv are -1..1 inside cell
    const r0 = cellRand01(cx, cy, 700);
    const r1 = cellRand01(cx, cy, 701);

    // base: rectangle
    let a = 1.0;

    if (shapeMode === 1) {
      // chamfer corners: cut off corners by distance
      const t = 0.78 + r0 * 0.12;
      if (Math.abs(lu) + Math.abs(lv) > t) a = 0.0;
    }

    if (shapeMode === 2) {
      // holes: 2–5 circular holes
      const n = 2 + ((r0 * 4) | 0);
      for (let k = 0; k < n; k++) {
        const hx = (cellRandSigned(cx, cy, 800 + k)) * 0.55;
        const hy = (cellRandSigned(cx, cy, 900 + k)) * 0.55;
        const rr = 0.18 + cellRand01(cx, cy, 1000 + k) * 0.22;
        if (Math.hypot(lu - hx, lv - hy) < rr) return 0.0;
      }
    }

    if (shapeMode === 3) {
      // fractured: keep only some shards by slicing lines
      const ang = r0 * Math.PI;
      const nx = Math.cos(ang), ny = Math.sin(ang);
      const cut = (lu * nx + lv * ny);
      if (cut > (0.15 + r1 * 0.25)) a *= 0.0;
      // second cut
      const ang2 = r1 * Math.PI;
      const nx2 = Math.cos(ang2), ny2 = Math.sin(ang2);
      const cut2 = (lu * nx2 + lv * ny2);
      if (cut2 < (-0.10 - r0 * 0.25)) a *= 0.0;
    }

    if (shapeMode === 4) {
      // triangle-ish
      if (Math.abs(lu) + Math.abs(lv) > 0.92) a = 0.0;
      if (lv > 0.85) a = 0.0;
    }

    if (shapeMode === 5) {
      // drip: thinner top, thicker bottom
      const t = lv * 0.5 + 0.5; // 0 top -> 1 bottom
      const width = 0.25 + 0.75 * t;
      if (Math.abs(lu) > width) a = 0.0;
    }

    return a;
  }
  function applyMaterial(materialMode, r, g, b, u, v, lu, lv, cx, cy) {
    const r0 = cellRand01(cx, cy, 1200);
    const lum = 0.2126*r + 0.7152*g + 0.0722*b;

    if (materialMode === 1) {
      // glassy: lighten + mild blue tint
      r = clamp01(r + 0.10);
      g = clamp01(g + 0.12);
      b = clamp01(b + 0.18);
    }

    if (materialMode === 2) {
      // glitch/noise: channel shifts
      const n = (hash2D((u*40)|0, (v*40)|0, (cx*977 + cy*131)>>>0) - 0.5) * 0.35;
      r = clamp01(r + n);
      g = clamp01(g - n*0.7);
      b = clamp01(b + n*0.5);
    }

    if (materialMode === 3) {
      // swirl = more saturation
      const sat = 1.75;
      r = clamp01(lum + (r - lum) * sat);
      g = clamp01(lum + (g - lum) * sat);
      b = clamp01(lum + (b - lum) * sat);
    }

    if (materialMode === 4) {
      // stripes/hatch: dark stripes inside cell
      const stripes = Math.sin((lu * 10 + lv * 4 + r0 * 6.0) * Math.PI);
      const m = stripes > 0 ? 1.0 : 0.45;
      r *= m; g *= m; b *= m;
    }

    if (materialMode === 5) {
      // cracked veins: dark lines
      const vein = Math.abs(Math.sin((lu*9 + lv*11 + r0*10) * 3.0));
      const m = vein < 0.20 ? 0.25 : 1.0;
      r *= m; g *= m; b *= m;
    }

    if (materialMode === 6) {
      // mirrored fold highlight
      const fold = 1.0 - Math.min(1, Math.abs(lu) * 3.5);
      r = clamp01(r + fold * 0.15);
      g = clamp01(g + fold * 0.12);
      b = clamp01(b + fold * 0.08);
    }

    if (materialMode === 7) {
      // invert + posterize
      r = 1 - r; g = 1 - g; b = 1 - b;
      const q = 5;
      r = Math.round(r*q)/q;
      g = Math.round(g*q)/q;
      b = Math.round(b*q)/q;
    }

    return [r, g, b];
  }



  // soft box alpha (for nice edges)
  function boxAlpha(px, py, cx0, cy0, cx1, cy1) {
    // distance to nearest edge
    const dx = Math.min(px - cx0, cx1 - px);
    const dy = Math.min(py - cy0, cy1 - py);
    const dd = Math.min(dx, dy);
    // dd in pixels: fade within 'edge'
    const t = clamp01(dd / edge);
    return smoothstep(t);
  }

  function fract(x){ return x - Math.floor(x); }

  function cellRand01(cx, cy, salt = 0) {
    // stable 0..1 per cell (no flicker), uses your existing hash2D
    return hash2D(cx, cy, (salt >>> 0));
  }
  function cellRandSigned(cx, cy, salt = 0) {
    return cellRand01(cx, cy, salt) * 2 - 1; // -1..1
  }


  function applyEffect(rule, u, v, lu, lv, cx, cy) {
    let uu = u, vv = v;
    let alphaMul = 1.0;

    // how the block shape is cut (0=plain rect)
    let shapeMode = 0;

    // how the color/material looks
    let materialMode = 0;

    // useful stable cell params
    const r0 = cellRand01(cx, cy, 11);
    const r1 = cellRand01(cx, cy, 22);
    const r2 = cellRand01(cx, cy, 33);

    switch (rule) {
      case 1: { // CHAMFER / bevel corners (strong shape difference)
        shapeMode = 1;
        break;
      }

      case 2: { // GLASS FADE: horizontal transparency gradient + slight refraction
        const t = lu * 0.5 + 0.5; // 0..1
        alphaMul *= (0.15 + 0.85 * (1.0 - t));
        uu = u + (lv * 0.08);  // refraction-ish
        vv = v + (lu * 0.04);
        materialMode = 1;
        break;
      }

      case 3: { // NOISY / glitch material (strong color change)
        materialMode = 2;
        // jitter sample coords with stable per-cell phase
        const ph = r0 * 6.28318;
        uu = u + Math.sin((u * 10 + v * 6) + ph) * 0.12;
        vv = v + Math.cos((v * 11 - u * 5) + ph) * 0.12;
        break;
      }

      case 4: { // SWIRL inside cell (strong local warp)
        const r = Math.hypot(lu, lv);
        const a = Math.atan2(lv, lu) + (0.8 + r0 * 1.6) * r * 2.0;
        const nx = Math.cos(a) * r;
        const ny = Math.sin(a) * r;
        uu = u + nx * 0.20;
        vv = v + ny * 0.20;
        materialMode = 3;
        break;
      }

      case 5: { // STRIPES / hatch inside the block (very visible)
        materialMode = 4;
        break;
      }

      case 6: { // WAVE / ripples (strong)
        const ph = r0 * 6.28318;
        const amp = 0.08 + r1 * 0.10;
        uu = u + Math.sin(v * 10 + ph) * amp;
        vv = v + Math.sin(u * 8 + ph * 0.7) * amp * 0.6;
        break;
      }

      case 7: { // HOLES: stable “punched” circles per cell (not a sin pattern)
        shapeMode = 2;
        break;
      }

      case 8: { // CRACKED / fractured (cuts + dark veins)
        shapeMode = 3;
        materialMode = 5;
        break;
      }

      case 9: { // TRIANGLE / angular clip
        shapeMode = 4;
        break;
      }

      case 10: { // DRIP downward (shape stretch + smear)
        const s = Math.max(0, lv * 0.5 + 0.5);
        vv = v - s * (0.15 + r0 * 0.25);
        shapeMode = 5;
        break;
      }

      case 11: { // MIRROR inside cell + symmetrical “fold”
        if (lu > 0) uu = u - lu * 0.35;
        materialMode = 6;
        break;
      }

      case 12: { // INVERT + posterize (very visible)
        materialMode = 7;
        break;
      }
    }

    return { uu, vv, alphaMul, shapeMode, materialMode };
  }



  octx.putImageData(img, 0, 0);

    // POP SETTINGS (tweak these)
  const SHADOW_ALPHA = 0.55;
  const SHADOW_BLUR  = 22;
  const SHADOW_Y     = 10;

  const RIM_ALPHA = 0.25;    // soft glow edge
  const OUTLINE_ALPHA = 0.85;
  const OUTLINE_PX = 2;      // thickness

  ctx.save();

  // 1) Shadow (darkens behind shape => separation)
  ctx.globalCompositeOperation = "multiply";
  ctx.globalAlpha = SHADOW_ALPHA;
  ctx.filter = `blur(${SHADOW_BLUR}px)`;
  ctx.drawImage(off, 0, SHADOW_Y);

  // 2) Solid object (normal)
  ctx.filter = "none";
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1.0;
  ctx.drawImage(off, 0, 0);

  // 3) Rim light / glow (optional, helps on dark BG)
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = RIM_ALPHA;
  ctx.filter = "blur(6px)";
  ctx.drawImage(off, 0, 0);

  // 4) Crisp outline (makes silhouette readable always)
  ctx.filter = "none";
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = OUTLINE_ALPHA;

  // outline trick: stamp mask around itself
  for (let oy = -OUTLINE_PX; oy <= OUTLINE_PX; oy++) {
    for (let ox = -OUTLINE_PX; ox <= OUTLINE_PX; ox++) {
      if (ox === 0 && oy === 0) continue;
      ctx.drawImage(off, ox, oy);
    }
  }

  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = "overlay"; // punchy
  ctx.globalAlpha = 0.25;                  // keep subtle
  ctx.filter = "contrast(1.25) saturate(1.35)";
  ctx.drawImage(off, 0, 0);               // apply only where mask is
  
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.globalAlpha = 0.18;
  ctx.filter = "blur(10px)";
  ctx.drawImage(off, 0, 0);
  ctx.restore();

}


// 1) Seed -> RNG
function xorshift32(seed) {
  let x = seed >>> 0;
  return () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17; x >>>= 0;
    x ^= x << 5;  x >>>= 0;
    return (x >>> 0) / 4294967296;
  };
}

// 2) Build an expression tree from the seed
function buildNode(rng, depth) {
  if (depth <= 0) {
    const t = rng();
    if (t < 0.33) return { type: "x" };
    if (t < 0.66) return { type: "y" };
    return { type: "const", v: rng() * 2 - 1 };
  }

  const pick = rng();

  if (pick < 0.15)
    return { type: "sin", a: buildNode(rng, depth - 1), f: 1 + rng() * 6 };

  if (pick < 0.28)
    return { type: "abs", a: buildNode(rng, depth - 1) };

  if (pick < 0.42)
    return {
      type: "mix",
      a: buildNode(rng, depth - 1),
      b: buildNode(rng, depth - 1),
      t: buildNode(rng, depth - 1),
    };

  if (pick < 0.56)
    return {
      type: "warp",
      a: buildNode(rng, depth - 1),
      wx: buildNode(rng, depth - 1),
      wy: buildNode(rng, depth - 1),
      amp: 0.15 + rng() * 1.6,
    };

  if (pick < 0.68)
    return {
      type: "ridged",
      a: buildNode(rng, depth - 1),
    };

  if (pick < 0.80)
    return {
      type: "cell",
      s: (rng() * 1e9) >>> 0,
      scale: 1.5 + rng() * 10,
    };

  if (pick < 0.90)
    return {
      type: "rotate",
      src: buildNode(rng, depth - 1),
      a: rng() * Math.PI * 2,
    };

  return {
    type: "noise",
    s: (rng() * 1e9) >>> 0,
    scale: 0.5 + rng() * 6,
  };
}


function evalNode(node, x, y) {
  switch (node.type) {
    case "x": return x;
    case "y": return y;
    case "const": return node.v;

    case "sin":
      return Math.sin(evalNode(node.a, x, y) * node.f);

    case "abs":
      return Math.abs(evalNode(node.a, x, y));

    case "mix": {
      const a = evalNode(node.a, x, y);
      const b = evalNode(node.b, x, y);
      const t = 0.5 + 0.5 * evalNode(node.t, x, y);
      return a * (1 - t) + b * t;
    }

    case "warp": {
      const wx = evalNode(node.wx, x, y) * node.amp;
      const wy = evalNode(node.wy, x, y) * node.amp;
      return evalNode(node.a, x + wx, y + wy);
    }

    case "noise": {
      const n = valueNoise(x * node.scale, y * node.scale, node.s);
      return n * 2 - 1;
    }

    /* ---------- NEW ---------- */

    case "ridged": {
      const v = evalNode(node.a, x, y);
      return 1 - Math.abs(v); // sharp ridges
    }

    case "cell": {
      const nx = Math.floor(x * node.scale);
      const ny = Math.floor(y * node.scale);
      const n = hash2D(nx, ny, node.s);
      return n * 2 - 1;
    }

    case "rotate": {
      const c = Math.cos(node.a);
      const s = Math.sin(node.a);
      const xr = c * x - s * y;
      const yr = s * x + c * y;
      return evalNode(node.src, xr, yr);
    }
  }
}


// 3) Seed -> style program (3 different trees = different “language”)
function makeStyleShader(seed) {
  const rng = xorshift32(seed);
  const depth = 3 + Math.floor(rng() * 4);

  const rTree = buildNode(rng, depth);
  const gTree = buildNode(rng, depth);
  const bTree = buildNode(rng, depth);
  const maskTree = buildNode(rng, depth);

  const gamma = 0.7 + rng() * 1.8;
  const contrast = 0.8 + rng() * 2.2;

  // NEW: global coordinate skew per style
  const skewX = (rng() - 0.5) * 0.6;
  const skewY = (rng() - 0.5) * 0.6;
  const scale = 0.7 + rng() * 0.8;

  return function shade(u, v) {
    // style-dependent coordinate transform
    const x = (u + v * skewX) * scale;
    const y = (v + u * skewY) * scale;

    let r = evalNode(rTree, x, y);
    let g = evalNode(gTree, x, y);
    let b = evalNode(bTree, x, y);
    let m = evalNode(maskTree, x, y);

    r = Math.tanh(r * contrast);
    g = Math.tanh(g * contrast);
    b = Math.tanh(b * contrast);

    const sat = 1.18; // try 1.10–1.35
    const lum = 0.2126*r + 0.7152*g + 0.0722*b;
    r = clamp01(lum + (r - lum) * sat);
    g = clamp01(lum + (g - lum) * sat);
    b = clamp01(lum + (b - lum) * sat);

    const k = 0.5 + 0.5 * Math.tanh(m);

    r = Math.pow(0.5 + 0.5 * (r * (0.7 + 0.6 * k)), gamma);
    g = Math.pow(0.5 + 0.5 * (g * (0.7 + 0.6 * (1 - k))), gamma);
    b = Math.pow(0.5 + 0.5 * (b * (0.7 + 0.6 * (0.5 + 0.5 * k))), gamma);

    return [r, g, b, k];
  };
}


function hashGrid32(grid) {
  // FNV-ish hash, stable in JS 32-bit
  let h = 2166136261 >>> 0;
  for (let y = 0; y < grid.length; y++) {
    const row = grid[y];
    for (let x = 0; x < row.length; x++) {
      h ^= (row[x] & 0xff);
      h = Math.imul(h, 16777619) >>> 0;
    }
  }
  h ^= (cols & 0xff); h = Math.imul(h, 16777619) >>> 0;
  h ^= (rows & 0xff); h = Math.imul(h, 16777619) >>> 0;
  h ^= (ruleCount & 0xff); h = Math.imul(h, 16777619) >>> 0;
  return h >>> 0;
}

previewClose.addEventListener("click", closePreview);
previewBackdrop.addEventListener("click", closePreview);
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !previewModal.classList.contains("hidden")) closePreview();
});

previewRegenerateBtn.addEventListener("click", () => {
  // Always generate a new seed for "New variation"
  lastPreviewSeed = (Math.random() * 1e9) >>> 0;
  seedInput.value = lastPreviewSeed;
  resizePreviewCanvas();
  renderAbstractPainting(lastPreviewSeed);
});

previewExportPngBtn.addEventListener("click", () => {
  const url = previewCanvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = `changeable_preview_${Date.now()}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
});

undoBtn.addEventListener("click", undo);
redoBtn.addEventListener("click", redo);

window.addEventListener("keydown", (e) => {
  const isMac = navigator.platform.toUpperCase().includes("MAC");
  const mod = isMac ? e.metaKey : e.ctrlKey;

  if (!mod) return;

  // Ctrl/Cmd+Z = undo
  if (e.key.toLowerCase() === "z" && !e.shiftKey) {
    e.preventDefault();
    undo();
  }

  // Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z = redo
  if (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey)) {
    e.preventDefault();
    redo();
  }
});



function openHelp() {
  helpModal.classList.remove("hidden");
}

function closeHelp() {
  helpModal.classList.add("hidden");
}
function cloneGrid(g) {
  return g.map(row => row.slice());
}

clearBtn.addEventListener("click", () => {
  pushHistory();
  grid = createGrid(rows, cols);
  hoverCell = null;
  draw();
  scheduleSaveState();
});

// --- Events: hover / click / drag paint ---
canvas.addEventListener("pointerdown", (e) => {
  const cell = getCellFromEvent(e);
  if (!cell) return;

  canvas.setPointerCapture(e.pointerId);

  const isRight = e.button === 2;
  const isShift = e.shiftKey;

  const cellRule = grid[cell.y][cell.x] | 0;

  // Shift + left = pick rule
  if (!isRight && isShift) {
    if (cellRule !== 0) {
      activeRule = cellRule;
      renderLegend();
      draw();
      scheduleSaveState();
    }
    return; // do not paint
  }

  pushHistory();
  paintEraseMode = isRight;
  isPainting = true;

  paintCell(cell.x, cell.y, paintEraseMode);
  draw();
  scheduleSaveState();
});

canvas.addEventListener("pointermove", (e) => {
  hoverCell = getCellFromEvent(e);

  // If pointer is captured, we still get events even outside.
  // Only paint if button still held:
  if (isPainting && hoverCell && (e.buttons & 1 || e.buttons & 2)) {
    paintCell(hoverCell.x, hoverCell.y, paintEraseMode);
    scheduleSaveState();
  }

  draw();
});

canvas.addEventListener("pointerup", (e) => {
  isPainting = false;
});

canvas.addEventListener("pointercancel", (e) => {
  isPainting = false;
});

canvas.addEventListener("contextmenu", (e) => e.preventDefault());

window.addEventListener("mouseup", () => {
  isPainting = false;
});


saveBtn.addEventListener("click", () => {
  if (!window.IS_AUTHENTICATED) {
    alert("Please log in to save.");
    return;
  }
  const name = designNameInput ? designNameInput.value.trim() : "";
  if (!name) {
    alert("Please enter a name.");
    return;
  }
  const visibility = document.querySelector("input[name='designVisibility']:checked");
  const isPublic = visibility ? visibility.value === "public" : false;
  saveDesignToDb(name, isPublic);
});

loadBtn.addEventListener("click", () => {
  if (!window.IS_AUTHENTICATED) {
    alert("Please log in to load.");
    return;
  }
  const selected = document.querySelector(".design-card.selected");
  if (!selected || !selected.dataset.id) {
    alert("Select a design to load.");
    return;
  }
  loadDesignFromDb(selected.dataset.id);
  closeLoadModal();
});

mirrorXBtn.addEventListener("click", mirrorX);
mirrorYBtn.addEventListener("click", mirrorY);
rotateBtn.addEventListener("click", rotate90);

if (exportPngBtn) exportPngBtn.addEventListener("click", exportPNG);



helpBtn.addEventListener("click", openHelp);
helpClose.addEventListener("click", closeHelp);
helpBackdrop.addEventListener("click", closeHelp);

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !helpModal.classList.contains("hidden")) {
    closeHelp();
  }
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (saveModal && !saveModal.classList.contains("hidden")) closeSaveModal();
    if (loadModal && !loadModal.classList.contains("hidden")) closeLoadModal();
  }
});

window.addEventListener("resize", () => {
  if (!previewModal.classList.contains("hidden")) {
    resizePreviewCanvas();
    renderAbstractPainting(lastPreviewSeed);
  }
});


canvas.addEventListener("contextmenu", (e) => e.preventDefault());

// Inputs
colsInput.addEventListener("change", applySettings);
rowsInput.addEventListener("change", applySettings);
showGridEl.addEventListener("change", draw);
showGridEl.addEventListener("change", scheduleSaveState);
seedInput.addEventListener("change", scheduleSaveState);
if (randomizeSeedEl) randomizeSeedEl.addEventListener("change", scheduleSaveState);

// Init
grid = createGrid(rows, cols);
renderLegend();
resizeCanvas();
generateBtn.addEventListener("click", generatePreview);
updateHistoryButtons();
ensureDefaultRuleColors();
loadState();
if (openSaveModalBtn) openSaveModalBtn.addEventListener("click", openSaveModal);
if (openLoadModalBtn) openLoadModalBtn.addEventListener("click", openLoadModal);
if (saveClose) saveClose.addEventListener("click", closeSaveModal);
if (loadClose) loadClose.addEventListener("click", closeLoadModal);
if (saveBackdrop) saveBackdrop.addEventListener("click", closeSaveModal);
if (loadBackdrop) loadBackdrop.addEventListener("click", closeLoadModal);
if (publicSearchInput) publicSearchInput.addEventListener("input", refreshPublicGrid);
if (togglePrivateViewBtn) {
  togglePrivateViewBtn.addEventListener("click", () => {
    const showingPublic = publicGallerySection && !publicGallerySection.classList.contains("hidden");
    setLoadView(showingPublic ? "private" : "public");
  });
}

if (designDeleteBtn) {
  designDeleteBtn.addEventListener("click", () => {
    if (!contextDesignId) return;
    deleteDesign(contextDesignId);
    closeDesignContextMenu();
  });
}

document.addEventListener("mousedown", (e) => {
  if (!designContextMenu || designContextMenu.classList.contains("hidden")) return;
  if (designContextMenu.contains(e.target)) return;
  closeDesignContextMenu();
});

window.addEventListener("scroll", closeDesignContextMenu);

