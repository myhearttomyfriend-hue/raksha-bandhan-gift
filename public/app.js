const $ = (s) => document.querySelector(s);

let currentSister = null;
let photos = [];
let currentPhoto = 0;
let selectedDesign = "green round heart bright";
const rakhiSettings = { color: "green", shape: "round", pattern: "heart", style: "bright" };

async function getJSON(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[c]));
}

function renderLetter(text) {
  const blocks = String(text || "")
    .split(/\n\s*\n/)
    .map(x => x.trim())
    .filter(Boolean);

  return blocks.length
    ? blocks.map(p => `<p>${escapeHTML(p).replace(/\n/g, "<br>")}</p>`).join("")
    : "<p>There is a special message waiting for you. ❤️</p>";
}

async function unlock() {
  const name = $("#sisterName").value.trim();
  const error = $("#gateError");
  error.textContent = "";

  if (!name) {
    error.textContent = "Please enter your name ❤️";
    return;
  }

  try {
    const sister = await getJSON(`/api/public/sisters/${encodeURIComponent(name)}`);
    currentSister = sister;
    photos = sister.photos || [];

    $("#heroName").textContent = sister.name;
    $("#letterName").textContent = sister.name;
    $("#introText").textContent = sister.intro || "";
    $("#letterText").innerHTML = renderLetter(sister.letter);
    $("#gallerySubtitle").textContent = sister.name + "'s special memories, collected with love. ❤️";
    $("#finalMessage").textContent = sister.finalMessage || "";

    renderGallery();

    if (sister.musicUrl) {
      const music = $("#music");
      music.src = sister.musicUrl;
      music.volume = 0.28;
      music.play().catch(() => {});
    }

    $("#gate").classList.add("hidden");
    $("#designGate").classList.remove("hidden");
  } catch (err) {
    error.textContent = err.message;
  }
}

function showGift() {
  $("#experience").className = `hidden ${selectedDesign}`;
  $("#designGate").classList.add("hidden");
  $("#experience").classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
  startFalling();
}

function renderGallery() {
  const gallery = $("#gallery");
  gallery.innerHTML = "";

  if (!photos.length) {
    gallery.innerHTML = `
      <div style="grid-column:1/-1;padding:45px;color:#8b716a">
        Your memories will appear here soon. ❤️
      </div>`;
    return;
  }

  photos.forEach((photo, index) => {
    const item = document.createElement("div");
    item.className = "gallery-item";
    item.style.animationDelay = `${Math.min(index * 0.06, 0.5)}s`;
    item.innerHTML = `
      <img src="${photo.url}" alt="${escapeHTML(photo.caption || "Memory")}" loading="lazy">
      <div class="caption">${escapeHTML(photo.caption || "A beautiful memory ❤️")}</div>
    `;
    item.addEventListener("click", () => openLightbox(index));
    gallery.appendChild(item);
  });
}

function openLightbox(index) {
  currentPhoto = index;
  updateLightbox();
  $("#lightbox").classList.remove("hidden");
}

function updateLightbox() {
  const photo = photos[currentPhoto];
  if (!photo) return;
  $("#lightboxImg").src = photo.url;
  $("#lightboxImg").alt = photo.caption || "Memory";
  $("#lightboxCaption").textContent = photo.caption || "";
}

function closeLightbox() {
  $("#lightbox").classList.add("hidden");
}

function movePhoto(dir) {
  if (!photos.length) return;
  currentPhoto = (currentPhoto + dir + photos.length) % photos.length;
  updateLightbox();
}

function startFalling() {
  if (window.__fallingStarted) return;
  window.__fallingStarted = true;

  const symbols = ["❤️", "🌸", "✨", "🌺", "🪷", "💗", "✦"];
  const layer = $("#falling-layer");

  setInterval(() => {
    const el = document.createElement("div");
    el.className = "fall";
    el.textContent = symbols[Math.floor(Math.random() * symbols.length)];
    el.style.left = `${Math.random() * 100}%`;
    el.style.fontSize = `${10 + Math.random() * 16}px`;
    el.style.animationDuration = `${7 + Math.random() * 8}s`;
    el.style.setProperty("--drift", `${-80 + Math.random() * 160}px`);
    el.style.setProperty("--rot", `${-360 + Math.random() * 720}deg`);
    layer.appendChild(el);
    setTimeout(() => el.remove(), 16000);
  }, 750);
}

function openEnvelope() {
  const env = $("#envelope");
  if (env.classList.contains("open")) return;

  env.classList.add("open");

  setTimeout(() => {
    $("#letterPanel").classList.remove("hidden");
    $("#letterPanel").scrollIntoView({ behavior: "smooth", block: "center" });
  }, 750);
}

function resetExperience() {
  $("#letterPanel").classList.add("hidden");
  $("#envelope").classList.remove("open");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

$("#unlockBtn").addEventListener("click", unlock);
$("#sisterName").addEventListener("keydown", (e) => {
  if (e.key === "Enter") unlock();
});

document.querySelectorAll("[data-tab]").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll("[data-tab]").forEach((item) => item.classList.toggle("active", item === tab));
    document.querySelectorAll("[data-panel]").forEach((panel) => panel.classList.toggle("hidden", panel.dataset.panel !== tab.dataset.tab));
  });
});
document.querySelectorAll("[data-setting]").forEach((option) => {
  option.addEventListener("click", () => {
    const setting = option.dataset.setting;
    rakhiSettings[setting] = option.dataset.value;
    document.querySelectorAll(`[data-setting="${setting}"]`).forEach((item) => item.classList.toggle("selected", item === option));
    selectedDesign = Object.values(rakhiSettings).join(" ");
    $("#designerPreview").className = `designer-preview ${selectedDesign}`;
    $(".designer-pattern").textContent = { heart: "♥", dots: "•••", star: "✦" }[rakhiSettings.pattern];
  });
});
$("#showGiftBtn").addEventListener("click", showGift);
$("#downloadRakhi").addEventListener("click", () => {
  const colors = {
    green: ["#3f8d72", "#e66f7f"], saffron: ["#efa83e", "#b63b50"],
    blue: ["#376fa8", "#edc75f"], rose: ["#dc7182", "#d8a54b"]
  }[rakhiSettings.color];
  const shape = rakhiSettings.shape === "square" ? "rx=\"22\"" : rakhiSettings.shape === "diamond" ? "transform=\"rotate(45 300 130)\" rx=\"18\"" : "";
  const symbol = rakhiSettings.pattern === "star" ? "✦" : rakhiSettings.pattern === "dots" ? "•••" : "♥";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="260" viewBox="0 0 600 260"><rect width="600" height="260" rx="24" fill="#fff7ee"/><path d="M20 130h560" stroke="${colors[0]}" stroke-width="14" stroke-dasharray="18 10"/><rect x="216" y="46" width="168" height="168" ${shape} fill="${colors[0]}" stroke="${colors[1]}" stroke-width="18"/><text x="300" y="147" text-anchor="middle" font-size="42" fill="#f5cf77">${symbol}</text></svg>`;
  const link = document.createElement("a");
  link.href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  link.download = "my-rakhi.svg";
  link.click();
});

$("#envelope").addEventListener("click", openEnvelope);
$("#envelope").addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") openEnvelope();
});

document.querySelectorAll("[data-answer]").forEach(btn => {
  btn.addEventListener("click", () => {
    const answer = btn.dataset.answer;
    $("#funResult").textContent =
      answer === "me"
        ? "Correct! Finally, someone understands the truth. 😂❤️"
        : "Nice try! But I am still your favourite annoying brother. 😎❤️";
  });
});

$("#closeLightbox").addEventListener("click", closeLightbox);
$("#prevPhoto").addEventListener("click", () => movePhoto(-1));
$("#nextPhoto").addEventListener("click", () => movePhoto(1));
$("#lightbox").addEventListener("click", (e) => {
  if (e.target === $("#lightbox")) closeLightbox();
});

document.addEventListener("keydown", (e) => {
  if ($("#lightbox").classList.contains("hidden")) return;
  if (e.key === "Escape") closeLightbox();
  if (e.key === "ArrowLeft") movePhoto(-1);
  if (e.key === "ArrowRight") movePhoto(1);
});

$("#replayBtn").addEventListener("click", resetExperience);
