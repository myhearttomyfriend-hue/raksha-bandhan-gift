# Raksha Bandhan Gift Website

A beautiful personalized Raksha Bandhan website with:

- Public sister name login
- One public URL/QR for all sisters
- Vamsi admin login
- Add unlimited sisters
- Personalized intro, letter and final message
- Multiple photos per sister
- One background music file per sister
- Photo captions
- Animated envelope, Rakhi reveal, falling petals/hearts and particles
- Responsive mobile design

## 1. Requirements

Install Node.js 20+.

## 2. Install

```bash
npm install
```

## 3. Configure admin

Copy `.env.example` to `.env`.

Set your password:

```env
ADMIN_USERNAME=vamsi
ADMIN_PASSWORD=your-real-password
SESSION_SECRET=use-a-long-random-secret
```

The admin username is `vamsi`.

## 4. Run

```bash
npm start
```

Open:

- Public: http://localhost:3000
- Admin: http://localhost:3000/admin.html

## 5. Add sisters

Login as Vamsi and click **Add Sister**.

For each sister you can add:

- Name
- Personal introduction
- Letter
- Final message
- Unlimited photos
- Captions
- Background music

## 6. QR code

After deploying the site, make one QR code pointing to your public homepage.

Example:

```text
https://your-domain.com/
```

All sisters use the same QR. They enter their name and see their own content.

## Important deployment note

This starter stores SQLite data and uploaded files locally. It is excellent for local use and for hosts with persistent disk.

If you deploy to a serverless host with temporary storage, the database/uploads can disappear after restart. For a permanent public deployment, move SQLite/uploads to a persistent disk or an object-storage/database service.

## Security

Do not commit `.env`.

The admin password is hashed in the SQLite database on first startup. The public sister login is intentionally simple because the name is the gift key, not a security credential. Do not put sensitive/private information in the sister letters or photos.
