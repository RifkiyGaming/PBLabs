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
| **Node.js** | Version 22.18+ (Node.js 24 recommended) |
| **Database** | PostgreSQL 16+ or Docker (Ports `5433` / `5432`) |
| **Assets** | Point Blank assets in `public/assets/` |

## Download & Extract Assets

1. Download **all ZIP parts** from [GitHub Releases](https://github.com/fitri-hy/PBLabs/releases).
2. Place all downloaded parts in the same folder.
3. Open the main `.zip` file using WinRAR or 7-Zip.
4. Select **Extract Here** or **Extract to...**.
5. Move the extracted assets into `public/assets/`.

**Important:** All ZIP parts are required. Do not rename or delete any parts before extraction.

---

## Quick Start

1. **Install dependencies:**
   ```powershell
   npm run install:all

```

2. **Set up environment:**
```bash
cp server/.env.example server/.env.local

```


3. **Run the application:**
```bash
npm start

```


4. **Open in browser:** `http://localhost:8000`

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

---

## Legal Notice & License

> **Note:** This repository contains source code only. All game assets, protocols, and raw data are the full property of **Zepetto** and are **not covered by the MIT License**. This project is strictly for educational/experimental purposes and is **strictly prohibited** for commercial use.
