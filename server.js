require("dotenv").config();

const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();

const PORT = Number(process.env.PORT || 3000);
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const ROOT = __dirname;
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, "data"));
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(ROOT, "uploads"));

const DEFAULT_SISTER_CONTENT = {
  intro: "You light up my world with your smile and love. Having you in my life is a true blessing.",
  letter: "My Dearest Sister,\n\nYou light up my world with your smile and love. Having you in my life is a true blessing.\n\nThis Raksha Bandhan, I promise no distance or challenge will ever break our bond. Thank you for filling our days with laughter, courage and so much love.\n\nWith endless love and warm wishes,\nYour Loving Brother ❤️",
  finalMessage: "Thank you for being the most amazing sister in the world! May our bond continue to grow stronger with each passing year. No matter where life takes us, you will always have my love, support and one very annoying brother. ❤️"
};

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, "rakhi.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

if (IS_PRODUCTION) {
  app.set("trust proxy", 1);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS sisters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    intro TEXT NOT NULL DEFAULT '',
    letter TEXT NOT NULL DEFAULT '',
    final_message TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sister_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    caption TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sister_id) REFERENCES sisters(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS music (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sister_id INTEGER NOT NULL UNIQUE,
    filename TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sister_id) REFERENCES sisters(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS admin (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    username TEXT NOT NULL,
    password_hash TEXT NOT NULL
  );
`);

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function uniqueSlug(name, ignoreId = null) {
  const base = slugify(name) || "sister";
  let slug = base;
  let n = 2;

  while (true) {
    const row = ignoreId
      ? db.prepare("SELECT id FROM sisters WHERE slug = ? AND id != ?").get(slug, ignoreId)
      : db.prepare("SELECT id FROM sisters WHERE slug = ?").get(slug);

    if (!row) return slug;
    slug = `${base}-${n++}`;
  }
}

function ensureAdmin() {
  const existing = db.prepare("SELECT id FROM admin WHERE id = 1").get();
  if (!existing) {
    const username = process.env.ADMIN_USERNAME || "vamsi";
    const password = process.env.ADMIN_PASSWORD || "Chinnu@8125";
    const hash = bcrypt.hashSync(password, 12);
    db.prepare(
      "INSERT INTO admin (id, username, password_hash) VALUES (1, ?, ?)"
    ).run(username, hash);

    console.log(`Admin created: ${username}`);
    if (!process.env.ADMIN_PASSWORD) {
      console.log("WARNING: set ADMIN_PASSWORD in .env before using this publicly.");
    }
  }
}

ensureAdmin();

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "CHANGE_ME_IN_ENV",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: IS_PRODUCTION,
      maxAge: 1000 * 60 * 60 * 8
    }
  })
);

app.use("/uploads", express.static(UPLOAD_DIR));
app.use(express.static(path.join(ROOT, "public")));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

function requireAdmin(req, res, next) {
  if (!req.session.admin) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeBase = path
      .basename(file.originalname, ext)
      .replace(/[^a-z0-9_-]/gi, "-")
      .slice(0, 50);

    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${safeBase}${ext}`);
  }
});

const imageUpload = multer({
  storage,
  limits: { files: 50, fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, PNG, WEBP and GIF images are allowed."));
    }
  }
});

const musicUpload = multer({
  storage,
  limits: { files: 1, fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^audio\/(mpeg|mp3|wav|ogg|mp4|aac|x-m4a)$/i.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only common audio files are allowed."));
    }
  }
});

function publicSister(row) {
  const photos = db
    .prepare("SELECT id, filename, caption FROM photos WHERE sister_id = ? ORDER BY id ASC")
    .all(row.id)
    .map((p) => ({
      id: p.id,
      url: `/uploads/${encodeURIComponent(p.filename)}`,
      caption: p.caption
    }));

  const music = db
    .prepare("SELECT filename FROM music WHERE sister_id = ?")
    .get(row.id);

  return {
    id: row.id,
    name: row.name,
    intro: row.intro,
    letter: row.letter,
    finalMessage: row.final_message,
    photos,
    musicUrl: music ? `/uploads/${encodeURIComponent(music.filename)}` : null
  };
}

function adminSister(row) {
  const data = publicSister(row);
  return {
    ...data,
    slug: row.slug,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/* ---------- Auth ---------- */

app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body || {};
  const admin = db.prepare("SELECT * FROM admin WHERE id = 1").get();

  if (
    !admin ||
    String(username || "").trim().toLowerCase() !== admin.username.toLowerCase() ||
    !bcrypt.compareSync(String(password || ""), admin.password_hash)
  ) {
    return res.status(401).json({ error: "Invalid username or password." });
  }

  req.session.admin = { id: admin.id, username: admin.username };
  res.json({ ok: true, username: admin.username });
});

app.post("/api/admin/logout", requireAdmin, (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/admin/me", (req, res) => {
  res.json({
    loggedIn: Boolean(req.session.admin),
    username: req.session.admin?.username || null
  });
});

/* ---------- Public ---------- */

app.get("/api/public/sisters", (req, res) => {
  const rows = db
    .prepare("SELECT id, name FROM sisters ORDER BY name COLLATE NOCASE ASC")
    .all();

  res.json(rows);
});

app.get("/api/public/sisters/:name", (req, res) => {
  const name = String(req.params.name || "").trim().toLowerCase();

  const rows = db
    .prepare("SELECT * FROM sisters WHERE lower(name) = ?")
    .all(name);

  if (rows.length === 0) {
    return res.status(404).json({ error: "Sister not found." });
  }

  if (rows.length > 1) {
    return res.status(409).json({
      error: "More than one sister has this name. Please use a unique name."
    });
  }

  res.json(publicSister(rows[0]));
});

/* ---------- Admin CRUD ---------- */

app.get("/api/admin/sisters", requireAdmin, (_req, res) => {
  const rows = db.prepare("SELECT * FROM sisters ORDER BY id DESC").all();
  res.json(rows.map(adminSister));
});

app.post("/api/admin/sisters", requireAdmin, (req, res) => {
  const {
    name = "",
    intro = DEFAULT_SISTER_CONTENT.intro,
    letter = DEFAULT_SISTER_CONTENT.letter,
    finalMessage = DEFAULT_SISTER_CONTENT.finalMessage
  } = req.body || {};

  const cleanName = String(name).trim();

  if (!cleanName) {
    return res.status(400).json({ error: "Name is required." });
  }

  const duplicate = db
    .prepare("SELECT id FROM sisters WHERE lower(name) = lower(?)")
    .get(cleanName);

  if (duplicate) {
    return res.status(409).json({ error: "A sister with this name already exists." });
  }

  const slug = uniqueSlug(cleanName);

  const info = db
    .prepare(`
      INSERT INTO sisters (name, slug, intro, letter, final_message)
      VALUES (?, ?, ?, ?, ?)
    `)
    .run(
      cleanName,
      slug,
      String(intro).trim() || DEFAULT_SISTER_CONTENT.intro,
      String(letter).trim() || DEFAULT_SISTER_CONTENT.letter,
      String(finalMessage).trim() || DEFAULT_SISTER_CONTENT.finalMessage
    );

  const row = db.prepare("SELECT * FROM sisters WHERE id = ?").get(info.lastInsertRowid);
  res.json(adminSister(row));
});

app.put("/api/admin/sisters/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare("SELECT * FROM sisters WHERE id = ?").get(id);

  if (!existing) {
    return res.status(404).json({ error: "Sister not found." });
  }

  const {
    name = existing.name,
    intro = existing.intro,
    letter = existing.letter,
    finalMessage = existing.final_message
  } = req.body || {};

  const cleanName = String(name).trim();

  if (!cleanName) {
    return res.status(400).json({ error: "Name is required." });
  }

  const duplicate = db
    .prepare("SELECT id FROM sisters WHERE lower(name) = lower(?) AND id != ?")
    .get(cleanName, id);

  if (duplicate) {
    return res.status(409).json({ error: "Another sister already uses this name." });
  }

  const newSlug =
    cleanName.toLowerCase() === existing.name.toLowerCase()
      ? existing.slug
      : uniqueSlug(cleanName, id);

  db.prepare(`
    UPDATE sisters
    SET name = ?, slug = ?, intro = ?, letter = ?, final_message = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    cleanName,
    newSlug,
    String(intro),
    String(letter),
    String(finalMessage),
    id
  );

  const row = db.prepare("SELECT * FROM sisters WHERE id = ?").get(id);
  res.json(adminSister(row));
});

app.delete("/api/admin/sisters/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const sister = db.prepare("SELECT * FROM sisters WHERE id = ?").get(id);

  if (!sister) {
    return res.status(404).json({ error: "Sister not found." });
  }

  const filesToDelete = [
    ...db.prepare("SELECT filename FROM photos WHERE sister_id = ?").all(id).map(x => x.filename),
    ...db.prepare("SELECT filename FROM music WHERE sister_id = ?").all(id).map(x => x.filename)
  ];

  db.prepare("DELETE FROM sisters WHERE id = ?").run(id);

  for (const filename of filesToDelete) {
    safeDelete(filename);
  }

  res.json({ ok: true });
});

/* ---------- Photos ---------- */

app.post(
  "/api/admin/sisters/:id/photos",
  requireAdmin,
  imageUpload.array("photos", 50),
  (req, res) => {
    const id = Number(req.params.id);
    const sister = db.prepare("SELECT id FROM sisters WHERE id = ?").get(id);

    if (!sister) {
      for (const f of req.files || []) safeDelete(f.filename);
      return res.status(404).json({ error: "Sister not found." });
    }

    const captions = Array.isArray(req.body.captions)
      ? req.body.captions
      : req.body.captions
        ? [req.body.captions]
        : [];

    const insert = db.prepare(
      "INSERT INTO photos (sister_id, filename, caption) VALUES (?, ?, ?)"
    );

    const transaction = db.transaction((files) => {
      files.forEach((file, index) => {
        insert.run(id, file.filename, String(captions[index] || ""));
      });
    });

    transaction(req.files || []);

    const row = db.prepare("SELECT * FROM sisters WHERE id = ?").get(id);
    res.json(adminSister(row));
  }
);

app.put("/api/admin/photos/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const photo = db.prepare("SELECT id FROM photos WHERE id = ?").get(id);

  if (!photo) {
    return res.status(404).json({ error: "Photo not found." });
  }

  db.prepare("UPDATE photos SET caption = ? WHERE id = ?")
    .run(String(req.body?.caption || ""), id);

  res.json({ ok: true });
});

app.delete("/api/admin/photos/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const photo = db.prepare("SELECT * FROM photos WHERE id = ?").get(id);

  if (!photo) {
    return res.status(404).json({ error: "Photo not found." });
  }

  db.prepare("DELETE FROM photos WHERE id = ?").run(id);
  safeDelete(photo.filename);

  res.json({ ok: true });
});

/* ---------- Music ---------- */

app.post(
  "/api/admin/sisters/:id/music",
  requireAdmin,
  musicUpload.single("music"),
  (req, res) => {
    const id = Number(req.params.id);
    const sister = db.prepare("SELECT id FROM sisters WHERE id = ?").get(id);

    if (!req.file) {
      return res.status(400).json({ error: "No music file was uploaded." });
    }

    if (!sister) {
      if (req.file) safeDelete(req.file.filename);
      return res.status(404).json({ error: "Sister not found." });
    }

    const old = db.prepare("SELECT filename FROM music WHERE sister_id = ?").get(id);

    if (old) {
      safeDelete(old.filename);
      db.prepare("UPDATE music SET filename = ?, created_at = CURRENT_TIMESTAMP WHERE sister_id = ?")
        .run(req.file.filename, id);
    } else {
      db.prepare("INSERT INTO music (sister_id, filename) VALUES (?, ?)")
        .run(id, req.file.filename);
    }

    const row = db.prepare("SELECT * FROM sisters WHERE id = ?").get(id);
    res.json(adminSister(row));
  }
);

app.delete("/api/admin/sisters/:id/music", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const old = db.prepare("SELECT filename FROM music WHERE sister_id = ?").get(id);

  if (old) {
    safeDelete(old.filename);
    db.prepare("DELETE FROM music WHERE sister_id = ?").run(id);
  }

  res.json({ ok: true });
});

function safeDelete(filename) {
  if (!filename) return;
  const target = path.join(UPLOAD_DIR, path.basename(filename));
  if (fs.existsSync(target)) {
    try {
      fs.unlinkSync(target);
    } catch (_) {}
  }
}

/* ---------- Error handling ---------- */

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(400).json({ error: err.message || "Request failed." });
});

app.use((req, res, next) => {
  if (req.path.startsWith("/api/") || req.path.startsWith("/uploads/")) {
    return next();
  }
  res.sendFile(path.join(ROOT, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Raksha Bandhan website running at http://localhost:${PORT}`);
  console.log(`Admin dashboard: http://localhost:${PORT}/admin.html`);
});
