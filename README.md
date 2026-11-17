# PBLabs

An unofficial open-source web port of **Point Blank** (desktop-to-web porting experiment).

- **Client:** TypeScript, Vite, three.js, Rapier
- **Server:** TypeScript (Original Point Blank protocol & PostgreSQL)
- **Matchmaking:** Peer-to-peer via WebRTC
- **Features:** Login, lobby, room, items, & progression


---

## Prerequisites

| Component | Description |
| :--- | :--- |
| **Node.js** | Version 22.18+ (Node 24 recommended) |
| **Database** | PostgreSQL 16+ or Docker (Port `5433` / `5432`) |
| **Assets** | [Download](https://github.com/fitri-hy/PBLabs/releases) automatically via `npm run download -- --assets --<tag>` or place assets manually in the `public/assets/` folder |

---

## Quick Start

1. **Install dependencies:**

```
npm run install:all
```

2. **Download assets (e.g., Tag 0.0.2):**

```
npm run download -- --assets --0.0.2
```


3. **Set up environment:**

```
cp server/.env.example server/.env.local
```


4. **Run the application:**
```
npm start
```


5. **Open in browser:** `http://localhost:8000`

---

## Main Commands

| Command | Description |
| --- | --- |
| `npm start` | Run server & Vite (both) locally |
| `npm start -- --docker` | Run both with Docker DB |
| `npm start -- --frontend` | Run frontend only (Port 8000) |
| `npm start -- --backend` | Run backend only (Port 8090) |
| `npm start -- --backend --docker` | Run backend only with Docker DB |
| `npm run dev:all` | Alternative command to run server & Vite |
| `npm run typecheck` | Run TypeScript type check |
| `npm run build` | Build production version |
| `npm run status` | Check port & service status |
| `npm run download -- --assets --0.0.1` | Automatically download and extract release assets to `public/` |

---

## Legal Notice & License

> **Note:** This repository contains source code only. All game assets, protocols, and raw data are the full property of **Zepetto** and are **not covered by the MIT License**. This project is strictly for educational/experimental purposes and is **strictly prohibited** for commercial use.
