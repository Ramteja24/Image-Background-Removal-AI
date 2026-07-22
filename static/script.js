// ---------- theme ----------

const themeToggle = document.getElementById("themeToggle");
const sunIcon = document.getElementById("sunIcon");
const moonIcon = document.getElementById("moonIcon");
const root = document.documentElement;

function applyTheme(theme) {
  root.setAttribute("data-theme", theme);
  sunIcon.hidden = theme === "dark";
  moonIcon.hidden = theme !== "dark";
  localStorage.setItem("pixelpeel-theme", theme);
}

const savedTheme = localStorage.getItem("pixelpeel-theme");
const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
applyTheme(savedTheme || (systemDark ? "dark" : "light"));

themeToggle.addEventListener("click", () => {
  const current = root.getAttribute("data-theme");
  applyTheme(current === "dark" ? "light" : "dark");
});

// ---------- elements ----------

const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");

const modalBackdrop = document.getElementById("modalBackdrop");
const modalClose = document.getElementById("modalClose");
const stageImg = document.getElementById("stageImg");
const resultCanvas = document.getElementById("resultCanvas");
const overlay = document.getElementById("overlay");
const overlayText = document.getElementById("overlayText");

const modeBg = document.getElementById("modeBg");
const modeFg = document.getElementById("modeFg");

const bgPanel = document.getElementById("bgPanel");
const bgOptions = document.getElementById("bgOptions");
const sceneOptions = document.getElementById("sceneOptions");
const customColor = document.getElementById("customColor");
const downloadBtn = document.getElementById("downloadBtn");
const newImageBtn = document.getElementById("newImageBtn");

const toast = document.getElementById("toast");

// Each scene paints a full backdrop: a vertical mood gradient plus one or two
// soft glows/stars so it reads as a place, not just a flat color swap.
const SCENES = {
  sunset(context, w, h) {
    verticalGradient(context, w, h, ["#fbbf24", "#fb7185", "#7c3aed"]);
    glow(context, w * 0.5, h * 0.72, w * 0.55, "rgba(255,214,153,0.55)");
  },
  ocean(context, w, h) {
    verticalGradient(context, w, h, ["#7dd3fc", "#0ea5e9", "#0f766e"]);
    glow(context, w * 0.78, h * 0.18, w * 0.4, "rgba(255,255,255,0.35)");
  },
  dusk(context, w, h) {
    verticalGradient(context, w, h, ["#818cf8", "#6366f1", "#312e81"]);
    stars(context, w, h, 28);
    glow(context, w * 0.22, h * 0.2, w * 0.3, "rgba(224,231,255,0.4)");
  },
  studio(context, w, h) {
    const g = context.createRadialGradient(w / 2, h * 0.42, h * 0.05, w / 2, h * 0.5, Math.max(w, h) * 0.75);
    g.addColorStop(0, "#f8fafc");
    g.addColorStop(1, "#c7cfdb");
    context.fillStyle = g;
    context.fillRect(0, 0, w, h);
  },
  night(context, w, h) {
    verticalGradient(context, w, h, ["#334155", "#1e293b", "#020617"]);
    stars(context, w, h, 45);
    glow(context, w * 0.82, h * 0.16, w * 0.22, "rgba(241,245,249,0.55)");
  },
  beach(context, w, h) {
    verticalGradient(context, w, h, ["#7dd3fc", "#bae6fd", "#fde68a"]);
    glow(context, w * 0.25, h * 0.2, w * 0.35, "rgba(255,255,255,0.5)");
  },
};

function verticalGradient(context, w, h, stops) {
  const gradient = context.createLinearGradient(0, 0, 0, h);
  const step = 1 / (stops.length - 1);
  stops.forEach((color, i) => gradient.addColorStop(i * step, color));
  context.fillStyle = gradient;
  context.fillRect(0, 0, w, h);
}

function glow(context, cx, cy, radius, color) {
  const gradient = context.createRadialGradient(cx, cy, 0, cx, cy, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
}

function stars(context, w, h, count) {
  context.fillStyle = "rgba(255,255,255,0.85)";
  for (let i = 0; i < count; i++) {
    // Deterministic scatter so the scene looks the same on every render.
    const x = (w * ((i * 53) % 97)) / 97;
    const y = (h * ((i * 31) % 89)) / 89 * 0.7;
    const r = ((i % 3) + 1) * 0.6;
    context.beginPath();
    context.arc(x, y, r, 0, Math.PI * 2);
    context.fill();
  }
}

let originalImg = null; // HTMLImageElement of the uploaded photo
let cutoutImg = null; // HTMLImageElement of the transparent subject cutout (from backend)
let currentMode = "bg"; // "bg" = keep subject, "fg" = keep background
let currentBackground = { type: "transparent", value: null };
let toastTimer = null;
let ctx = null;

// ---------- toast ----------

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  requestAnimationFrame(() => toast.classList.add("show"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => { toast.hidden = true; }, 250);
  }, 4000);
}

// ---------- upload ----------

dropzone.addEventListener("click", () => fileInput.click());

dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropzone.classList.add("dragover");
});

dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));

dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("dragover");
  if (e.dataTransfer.files.length) {
    handleFile(e.dataTransfer.files[0]);
  }
});

fileInput.addEventListener("change", () => {
  if (fileInput.files.length) {
    handleFile(fileInput.files[0]);
  }
});

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function handleFile(file) {
  if (!file.type.startsWith("image/")) {
    showToast("Please select an image file.");
    return;
  }

  resetModalState();
  selectedFile = file;

  const objectUrl = URL.createObjectURL(file);
  originalImg = await loadImage(objectUrl);
  stageImg.src = objectUrl;

  openModal();
}

let selectedFile = null;

// ---------- modal ----------

function openModal() {
  modalBackdrop.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeModal() {
  modalBackdrop.hidden = true;
  document.body.style.overflow = "";
  fileInput.value = "";
}

function resetModalState() {
  originalImg = null;
  cutoutImg = null;
  currentMode = "bg";
  currentBackground = { type: "transparent", value: null };

  modeBg.classList.add("selected");
  modeFg.classList.remove("selected");

  allSwatches().forEach((s) => s.classList.remove("active"));
  bgOptions.querySelector('.swatch[data-type="transparent"]').classList.add("active");

  stageImg.hidden = false;
  resultCanvas.hidden = true;
  bgPanel.hidden = true;
  overlay.classList.remove("active");
}

modalClose.addEventListener("click", closeModal);
newImageBtn.addEventListener("click", closeModal);

modalBackdrop.addEventListener("click", (e) => {
  if (e.target === modalBackdrop) closeModal();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modalBackdrop.hidden) closeModal();
});

// ---------- mode buttons (also act as the process trigger) ----------

async function handleModeClick(mode) {
  currentMode = mode;
  modeBg.classList.toggle("selected", mode === "bg");
  modeFg.classList.toggle("selected", mode === "fg");

  if (!cutoutImg) {
    await processImage();
  } else {
    render();
  }
}

modeBg.addEventListener("click", () => handleModeClick("bg"));
modeFg.addEventListener("click", () => handleModeClick("fg"));

async function processImage() {
  overlayText.textContent = currentMode === "bg" ? "Removing background…" : "Removing foreground…";
  overlay.classList.add("active");

  const formData = new FormData();
  formData.append("image", selectedFile);

  try {
    const response = await fetch("/api/cutout", { method: "POST", body: formData });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `Request failed with status ${response.status}`);
    }

    const blob = await response.blob();
    const cutoutUrl = URL.createObjectURL(blob);
    cutoutImg = await loadImage(cutoutUrl);

    stageImg.hidden = true;
    resultCanvas.hidden = false;
    bgPanel.hidden = false;
    render();
  } catch (err) {
    showToast(err.message || "Something went wrong.");
  } finally {
    overlay.classList.remove("active");
  }
}

// ---------- background swatches ----------

function allSwatches() {
  return [...bgOptions.querySelectorAll(".swatch"), ...sceneOptions.querySelectorAll(".swatch")];
}

allSwatches().forEach((swatch) => {
  if (swatch.classList.contains("custom-swatch")) return;
  swatch.addEventListener("click", () => {
    allSwatches().forEach((s) => s.classList.remove("active"));
    swatch.classList.add("active");
    currentBackground = { type: swatch.dataset.type, value: swatch.dataset.value || null };
    if (cutoutImg) render();
  });
});

customColor.addEventListener("input", () => {
  allSwatches().forEach((s) => s.classList.remove("active"));
  customColor.closest(".swatch").classList.add("active");
  currentBackground = { type: "color", value: customColor.value };
  if (cutoutImg) render();
});

// ---------- rendering ----------

function render() {
  if (!originalImg || !cutoutImg) return;

  const w = originalImg.naturalWidth;
  const h = originalImg.naturalHeight;
  resultCanvas.width = w;
  resultCanvas.height = h;
  ctx = resultCanvas.getContext("2d");
  ctx.clearRect(0, 0, w, h);

  if (currentMode === "bg") {
    paintBackground(ctx, w, h);
    ctx.drawImage(cutoutImg, 0, 0, w, h);
  } else {
    // Keep the background, erase the subject silhouette, then fill the hole.
    ctx.drawImage(originalImg, 0, 0, w, h);
    ctx.globalCompositeOperation = "destination-out";
    ctx.drawImage(cutoutImg, 0, 0, w, h);
    ctx.globalCompositeOperation = "destination-over";
    paintBackground(ctx, w, h);
    ctx.globalCompositeOperation = "source-over";
  }
}

function paintBackground(context, w, h) {
  if (currentBackground.type === "transparent") return;

  if (currentBackground.type === "color") {
    context.fillStyle = currentBackground.value;
    context.fillRect(0, 0, w, h);
    return;
  }

  if (currentBackground.type === "scene") {
    SCENES[currentBackground.value](context, w, h);
  }
}

// ---------- download ----------

downloadBtn.addEventListener("click", (e) => {
  e.preventDefault();
  const filename = currentMode === "bg" ? "background-removed.png" : "foreground-removed.png";
  resultCanvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }, "image/png");
});
