# Cyber Run

Cyber Run is a fast-paced, single-player cybersecurity survival platformer for desktop and mobile browsers. Gameplay runs locally in Phaser; the API is reserved for health checks, score submission, and leaderboards.

## Phase 1 status

The initial project structure is ready with:

- Vite + TypeScript + Phaser client
- Fastify + TypeScript server
- `/api/health` endpoint
- Minimal Boot, Preload, and Menu Phaser scenes
- Environment-variable templates and separate client/server commands

## Requirements

- Node.js 20 or newer
- npm 10 or newer

## Install

From the repository root:

```bash
cd client
npm install
cd ../server
npm install
```

## Run in development

Open two terminals from the repository root.

Terminal 1:

```bash
cd server
npm run dev
```

Terminal 2:

```bash
cd client
npm run dev
```

The game is available at `http://localhost:5173`. Verify the API at `http://localhost:3000/api/health`.

## Build

```bash
cd client
npm run build

cd ../server
npm run build
```

## Environment variables

Copy `.env.example` to `.env` when local overrides are needed. The server reads `PORT` and `CORS_ORIGIN`; the client reads `VITE_API_URL`. Never commit credentials or production `.env` files.

## Architecture

```text
Browser (Phaser + TypeScript)
        │ HTTPS REST
Fastify API (TypeScript)
        │
MongoDB Atlas (future score/leaderboard storage)
```

The first playable phases will add movement, the continuous world, threats, checkpoints, scoring, and the final boss. The backend will remain lightweight and will not receive frame-by-frame gameplay data.

