# MaglassPro Backend API 🚀

Node.js + Express + MongoDB backend kwa MaglassPro portfolio.

---

## 📁 Structure

```
maglasspro-backend/
├── server.js              ← Entry point
├── .env.example           ← Template ya environment variables
├── middleware/
│   └── auth.js            ← JWT token verification
├── routes/
│   ├── auth.js            ← Login, change password/username
│   ├── projects.js        ← CRUD projects + Cloudinary upload
│   ├── testimonials.js    ← CRUD testimonials
│   └── contact.js         ← Send email via Gmail SMTP
└── models/
    ├── Admin.js            ← Admin schema
    ├── Project.js          ← Project schema
    └── Testimonial.js      ← Testimonial schema
```

---

## ⚙️ Setup — Hatua kwa Hatua

### 1. Install Node.js
Nenda [nodejs.org](https://nodejs.org) → Download **LTS version** → Install

### 2. Tengeneza folder na weka files
```bash
mkdir maglasspro-backend
cd maglasspro-backend
# Weka files zote ndani hapa
```

### 3. Install packages
```bash
npm install
```

### 4. Tengeneza MongoDB Atlas Database (Free)
1. Nenda [mongodb.com/atlas](https://mongodb.com/atlas) → Sign up free
2. Create **Free Cluster** (M0 — $0/month)
3. **Database Access** → Add user → username + password (kumbuka!)
4. **Network Access** → Add IP Address → **Allow from anywhere** (0.0.0.0/0)
5. **Connect** → Drivers → Copy connection string
6. Badilisha `<password>` na password yako

### 5. Tengeneza .env file
```bash
cp .env.example .env
```
Kisha hariri `.env` na maelezo yako yote.

### 6. Weka Gmail App Password
1. Nenda [myaccount.google.com](https://myaccount.google.com)
2. Security → **2-Step Verification** → Washa
3. Security → **App passwords** → Generate
4. Chagua "Mail" → Copy password ya herufi 16
5. Weka kwenye `.env` → `EMAIL_APP_PASSWORD`

### 7. Weka Cloudinary Keys
1. Nenda [cloudinary.com](https://cloudinary.com) → Dashboard
2. Copy: **Cloud Name**, **API Key**, **API Secret**
3. Weka kwenye `.env`

### 8. Run server
```bash
# Development (auto-restart)
npm run dev

# Production
npm start
```

Server itaanza kwenye: `http://localhost:5000`

---

## 🌐 API Endpoints

### Auth
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/login` | Admin login | ❌ |
| GET | `/api/auth/verify` | Verify token | ✅ |
| PUT | `/api/auth/change-password` | Change password | ✅ |
| PUT | `/api/auth/change-username` | Change username | ✅ |

### Projects
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/projects` | Get all projects | ❌ |
| GET | `/api/projects/:id` | Get single project | ❌ |
| POST | `/api/projects` | Create project | ✅ |
| PUT | `/api/projects/:id` | Update project | ✅ |
| DELETE | `/api/projects/:id` | Delete project | ✅ |

### Testimonials
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/testimonials` | Get visible testimonials | ❌ |
| GET | `/api/testimonials/all` | Get all testimonials | ✅ |
| POST | `/api/testimonials` | Create testimonial | ✅ |
| PUT | `/api/testimonials/:id` | Update testimonial | ✅ |
| DELETE | `/api/testimonials/:id` | Delete testimonial | ✅ |

### Contact
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/contact` | Send contact email | ❌ |

---

## 🚀 Deployment — Render.com (Free)

1. Push code kwenye **GitHub** (private repo)
2. Nenda [render.com](https://render.com) → Sign up
3. **New** → **Web Service** → Connect GitHub repo
4. Settings:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment:** Node
5. **Environment Variables** → Ongeza zote kutoka `.env`
6. Deploy → Utapata URL kama: `https://maglasspro-api.onrender.com`
7. Weka URL hiyo kwenye frontend kama `API_BASE_URL`

---

## 🔒 Security Features

- ✅ JWT authentication (7 days expiry)
- ✅ bcrypt password hashing (12 rounds)
- ✅ Rate limiting (login: 10/15min, global: 100/15min, contact: 5/hour)
- ✅ Helmet.js security headers
- ✅ Input validation (express-validator)
- ✅ CORS whitelist
- ✅ Timing attack prevention on login
- ✅ File type validation on uploads

---

## 📧 Email Features

- ✅ Beautiful HTML email kwenda kwa wewe (Moudrick) na kila inquiry
- ✅ Auto-reply kwenda kwa mteja — professional na branded
- ✅ Reply-to header — ukiclick Reply, inaenda kwa mteja moja kwa moja

---

*MaglassPro Backend — Built with ❤️ kwa Moudrick Shaweji*
