let sisters = [];
let selectedSister = null;

function defaultSisterContent(name) {
  const sisterName = String(name || "my dear sister").trim() || "my dear sister";

  return {
    intro: `${sisterName}, you bring a special kind of happiness into every day. Having you as my sister is one of life's greatest blessings.`,
    letter: `My Dearest ${sisterName},\n\nYour kindness, laughter and beautiful heart make our bond truly special. I am grateful for every memory we share and every moment that reminds me how lucky I am to have you as my sister.\n\nThis Raksha Bandhan, I promise to always stand beside you, cheer for your dreams and keep our bond strong through every chapter of life.\n\nWith endless love and warm wishes,\nYour Loving Brother ❤️`,
    finalMessage: `${sisterName}, thank you for being such a wonderful sister. Wherever life takes us, you will always have my love, support and one very annoying brother. ❤️`
  };
}

const $ = (s) => document.querySelector(s);

async function api(url, options = {}) {
  let res;
  try {
    res = await fetch(url, options);
  } catch (err) {
    throw new Error(
      "Could not reach the server. Check that the Railway service is running and try again."
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed.");
  return data;
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[c]));
}

async function checkAuth() {
  const me = await api("/api/admin/me");
  if (me.loggedIn) {
    showDashboard();
  }
}

function showDashboard() {
  $("#loginView").classList.add("hidden");
  $("#dashboard").classList.remove("hidden");
  loadSisters();
}

async function loadSisters() {
  try {
    sisters = await api("/api/admin/sisters");
    renderSisters();
  } catch (err) {
    alert(err.message);
  }
}

function renderSisters() {
  const list = $("#sisterList");
  list.innerHTML = "";

  let totalPhotos = 0;
  let totalMusic = 0;

  sisters.forEach(s => {
    totalPhotos += s.photos.length;
    if (s.musicUrl) totalMusic++;

    const card = document.createElement("article");
    card.className = "sister-card";

    const initial = (s.name[0] || "S").toUpperCase();

    card.innerHTML = `
      <div class="sister-head">
        <div class="avatar">${escapeHTML(initial)}</div>
        <div>
          <h3>${escapeHTML(s.name)}</h3>
          <div class="meta">${s.photos.length} photo${s.photos.length === 1 ? "" : "s"} · ${s.musicUrl ? "music added" : "no music"}</div>
        </div>
      </div>

      <div class="card-actions">
        <button data-action="edit">Edit</button>
        <button data-action="photos">Photos & Music</button>
        <button data-action="delete" class="delete">Delete</button>
        <button data-action="preview">Preview ↗</button>
      </div>
    `;

    card.querySelector('[data-action="edit"]').onclick = () => openEdit(s);
    card.querySelector('[data-action="photos"]').onclick = () => openPhotos(s);
    card.querySelector('[data-action="delete"]').onclick = () => deleteSister(s);
    card.querySelector('[data-action="preview"]').onclick = () => {
      window.open(`/?sister=${encodeURIComponent(s.name)}`, "_blank");
    };

    list.appendChild(card);
  });

  if (!sisters.length) {
    list.innerHTML = `<div class="empty">No sisters added yet. Click <b>+ Add Sister</b> to create your first personalized gift. ❤️</div>`;
  }

  $("#sisterCount").textContent = sisters.length;
  $("#photoCount").textContent = totalPhotos;
  $("#musicCount").textContent = totalMusic;
}

function openModal() {
  $("#modal").classList.remove("hidden");
}

function closeModal() {
  $("#modal").classList.add("hidden");
  $("#formError").textContent = "";
}

function openAdd() {
  $("#modalTitle").textContent = "Add Sister";
  $("#sisterId").value = "";
  $("#formName").value = "";
  const defaults = defaultSisterContent("");
  $("#formIntro").value = defaults.intro;
  $("#formLetter").value = defaults.letter;
  $("#formFinal").value = defaults.finalMessage;
  openModal();
}

function openEdit(s) {
  $("#modalTitle").textContent = `Edit ${s.name}`;
  $("#sisterId").value = s.id;
  $("#formName").value = s.name;
  $("#formIntro").value = s.intro || "";
  $("#formLetter").value = s.letter || "";
  $("#formFinal").value = s.finalMessage || "";
  openModal();
}

async function saveSister(e) {
  e.preventDefault();
  $("#formError").textContent = "";

  const id = $("#sisterId").value;

  const payload = {
    name: $("#formName").value.trim(),
    intro: $("#formIntro").value,
    letter: $("#formLetter").value,
    finalMessage: $("#formFinal").value
  };

  try {
    const url = id ? `/api/admin/sisters/${id}` : "/api/admin/sisters";
    const method = id ? "PUT" : "POST";

    await api(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    closeModal();
    await loadSisters();
  } catch (err) {
    $("#formError").textContent = err.message;
  }
}

async function deleteSister(s) {
  const ok = confirm(`Delete ${s.name} and all of their photos/music? This cannot be undone.`);
  if (!ok) return;

  try {
    await api(`/api/admin/sisters/${s.id}`, { method: "DELETE" });
    await loadSisters();
  } catch (err) {
    alert(err.message);
  }
}

function openPhotos(s) {
  selectedSister = s;
  $("#photoTitle").textContent = `${s.name}'s Gallery`;
  $("#photoFiles").value = "";
  $("#musicFile").value = "";
  renderPhotoManager();
  $("#photoModal").classList.remove("hidden");
}

function closePhotos() {
  $("#photoModal").classList.add("hidden");
  selectedSister = null;
}

function renderPhotoManager() {
  const s = selectedSister;
  if (!s) return;

  $("#musicStatus").textContent = s.musicUrl
    ? "Music is uploaded for this sister."
    : "No music uploaded.";

  const grid = $("#photoGrid");
  grid.innerHTML = "";

  if (!s.photos.length) {
    grid.innerHTML = `<div class="empty">No photos yet. Select some photos above. 📸</div>`;
    return;
  }

  s.photos.forEach(photo => {
    const item = document.createElement("div");
    item.className = "photo-admin";

    item.innerHTML = `
      <img src="${photo.url}" alt="">
      <div class="photo-admin-body">
        <textarea rows="2" placeholder="Caption...">${escapeHTML(photo.caption || "")}</textarea>
        <button data-save>Save Caption</button>
        <button data-delete>Delete Photo</button>
      </div>
    `;

    item.querySelector("[data-save]").onclick = async () => {
      try {
        const caption = item.querySelector("textarea").value;
        await api(`/api/admin/photos/${photo.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ caption })
        });
        await refreshSelected();
      } catch (err) {
        alert(err.message);
      }
    };

    item.querySelector("[data-delete]").onclick = async () => {
      if (!confirm("Delete this photo?")) return;
      try {
        await api(`/api/admin/photos/${photo.id}`, { method: "DELETE" });
        await refreshSelected();
        await loadSisters();
      } catch (err) {
        alert(err.message);
      }
    };

    grid.appendChild(item);
  });
}

async function refreshSelected() {
  const all = await api("/api/admin/sisters");
  sisters = all;
  selectedSister = sisters.find(x => x.id === selectedSister.id);
  renderPhotoManager();
}

function createCaptionInputs() {
  const files = [...$("#photoFiles").files];
  const box = $("#captionInputs");
  box.innerHTML = "";

  files.forEach((file, index) => {
    const input = document.createElement("input");
    input.className = "caption-input";
    input.dataset.caption = index;
    input.placeholder = `Caption for ${file.name}`;
    box.appendChild(input);
  });
}

async function uploadPhotos(e) {
  e.preventDefault();

  const files = [...$("#photoFiles").files];
  if (!files.length) {
    alert("Select at least one photo.");
    return;
  }

  const oversized = files.find(file => file.size > 8 * 1024 * 1024);
  if (oversized) {
    alert(`${oversized.name} is larger than 8 MB. Please resize it and try again.`);
    return;
  }

  const form = new FormData();
  files.forEach(file => form.append("photos", file));

  [...document.querySelectorAll("[data-caption]")].forEach(input => {
    form.append("captions", input.value);
  });

  try {
    const updated = await api(`/api/admin/sisters/${selectedSister.id}/photos`, {
      method: "POST",
      body: form
    });

    selectedSister = updated;
    $("#photoFiles").value = "";
    $("#captionInputs").innerHTML = "";
    renderPhotoManager();
    await loadSisters();
  } catch (err) {
    alert(err.message);
  }
}

async function uploadMusic() {
  const file = $("#musicFile").files[0];
  if (!file) {
    alert("Select an audio file first.");
    return;
  }

  const form = new FormData();
  form.append("music", file);

  try {
    const updated = await api(`/api/admin/sisters/${selectedSister.id}/music`, {
      method: "POST",
      body: form
    });

    selectedSister = updated;
    $("#musicFile").value = "";
    renderPhotoManager();
    await loadSisters();
  } catch (err) {
    alert(err.message);
  }
}

async function deleteMusic() {
  if (!selectedSister?.musicUrl) return;
  if (!confirm("Remove this sister's background music?")) return;

  try {
    await api(`/api/admin/sisters/${selectedSister.id}/music`, {
      method: "DELETE"
    });

    await refreshSelected();
    await loadSisters();
  } catch (err) {
    alert(err.message);
  }
}

async function login(e) {
  e.preventDefault();
  $("#loginError").textContent = "";

  try {
    await api("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: $("#username").value,
        password: $("#password").value
      })
    });

    showDashboard();
  } catch (err) {
    $("#loginError").textContent = err.message;
  }
}

async function logout() {
  await api("/api/admin/logout", { method: "POST" });
  location.reload();
}

$("#loginForm").addEventListener("submit", login);
$("#logoutBtn").addEventListener("click", logout);
$("#addBtn").addEventListener("click", openAdd);
$("#closeModal").addEventListener("click", closeModal);
$("#closePhotoModal").addEventListener("click", closePhotos);
$("#sisterForm").addEventListener("submit", saveSister);
$("#formName").addEventListener("input", (e) => {
  if (!$("#sisterId").value) {
    const defaults = defaultSisterContent(e.target.value);
    $("#formIntro").value = defaults.intro;
    $("#formLetter").value = defaults.letter;
    $("#formFinal").value = defaults.finalMessage;
  }
});
$("#photoForm").addEventListener("submit", uploadPhotos);
$("#photoFiles").addEventListener("change", createCaptionInputs);
$("#uploadMusicBtn").addEventListener("click", uploadMusic);
$("#deleteMusicBtn").addEventListener("click", deleteMusic);

checkAuth();
