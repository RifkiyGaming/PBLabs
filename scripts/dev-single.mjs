// Supervises dev stack:
// - npm start (menjalankan keduanya: frontend & backend)
// - npm start -- --frontend (menjalankan frontend saja)
// - npm start -- --backend (menjalankan backend saja)
// Gunakan flag `--docker` untuk mengaktifkan Docker postgres.
import { execFileSync, spawn } from 'node:child_process';
import { watch } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  belongsToRepo, color, cwdOf, ensurePortFree, killTree, pidOnPort, prefixedPipe,
} from './lib/procs.mjs';

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptsDir, '..');
const repoKey = root.replace(/\\/g, '/').toLowerCase();
const dbDir = resolve(root, 'db');
const serverDir = resolve(root, 'server');

const POSTGRES_PORT = 5433;

const ALL_SERVICES = [
  {
    name: 'server', ports: [8090, 39290, 39291, 39292, 39293], cwd: serverDir,
    cmd: process.execPath, args: ['src/main.ts'], restart: true,
    watchDirs: [resolve(serverDir, 'src'), resolve(serverDir, 'runtime/Config')],
  },
  {
    name: 'vite', ports: [8000], cwd: root,
    cmd: process.execPath, args: [resolve(root, 'node_modules/vite/bin/vite.js')],
    restart: false,
  },
];

function pgReady() {
  try {
    execFileSync('docker', ['compose', '-p', 'pbwebport', '-f', 'docker-compose.yml', 'exec', '-T', 'postgres', 'pg_isready', '-h', '127.0.0.1', '-U', process.env.PB_DB_USER || 'postgres', '-d', process.env.PB_DB_NAME || 'pb'], { cwd: dbDir, stdio: 'ignore' });
    return true;
  } catch { return false; }
}

async function waitPgReady(timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  while (!pgReady()) {
    if (Date.now() > deadline) throw new Error(`postgres not ready after ${timeoutMs / 1000}s`);
    await new Promise((r) => setTimeout(r, 1000));
  }
}

async function startPostgres() {
  console.log(color('sup', '[sup] starting postgres (docker compose -p pbwebport up -d postgres)...'));
  try {
    execFileSync('docker', ['compose', '-p', 'pbwebport', '-f', 'docker-compose.yml', 'up', '-d', 'postgres'], {
      cwd: dbDir, stdio: 'inherit',
    });
  } catch (e) {
    console.error(color('sup', `[sup] docker compose failed: ${e.message}`));
    process.exit(1);
  }
  await waitPgReady();
  console.log(color('sup', '[sup] postgres up'));
}

function startService(svc) {
  const child = spawn(svc.cmd, svc.args, { cwd: svc.cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  prefixedPipe(child.stdout, svc.name, process.stdout);
  prefixedPipe(child.stderr, svc.name, process.stderr);
  return child;
}

async function main() {
  const isFrontend = process.argv.includes('--frontend');
  const isBackend = process.argv.includes('--backend');
  const useDocker = process.argv.includes('--docker');
  const noWatch = process.argv.includes('--no-watch');

  // Tentukan servis apa saja yang akan dijalankan
  let servicesToRun = [];
  if (!isFrontend && !isBackend) {
    // Jika tidak ada argumen, jalankan keduanya (default)
    servicesToRun = ALL_SERVICES;
  } else if (isFrontend) {
    servicesToRun = ALL_SERVICES.filter((s) => s.name === 'vite');
  } else if (isBackend) {
    servicesToRun = ALL_SERVICES.filter((s) => s.name === 'server');
  }

  if (noWatch) process.env.PB_VITE_HMR = '0';
  process.env.PB_DEV_OPS ??= '1';

  // Jalankan Postgres jika backend ikut dijalankan dan opsi --docker aktif
  const needsPostgres = servicesToRun.some((s) => s.name === 'server');
  if (useDocker && needsPostgres) {
    await startPostgres();
  } else if (needsPostgres) {
    console.log(color('sup', `[sup] skipping docker, assuming local postgres is running on port ${POSTGRES_PORT}...`));
  }

  for (const svc of servicesToRun) {
    for (const port of svc.ports) {
      await ensurePortFree(svc.name, port, repoKey);
    }
  }

  console.log(color('sup', '[sup] starting dev services...'));
  if (servicesToRun.some((s) => s.name === 'vite')) {
    console.log(color('sup', '[sup]   game: http://localhost:8000/'));
  }
  if (servicesToRun.some((s) => s.name === 'server')) {
    console.log(color('sup', '[sup]   web:  ws://localhost:8090/  (/tcp /signal, http /api)'));
    console.log(color('sup', '[sup]   auth ws: :39290    game ws: :39291-39293    postgres: :5433'));
  }
  if (noWatch) console.log(color('sup', '[sup] --no-watch: editing src/ will NOT reload anything.'));

  let shuttingDown = false;
  const procs = new Map();
  const state = new Map();

  function launch(svc, attempt = 0) {
    if (shuttingDown) return;
    const child = startService(svc);
    procs.set(svc.name, child);
    state.set(svc.name, { intentionalRestart: false });

    child.on('exit', (code, signal) => {
      if (shuttingDown) return;
      const st = state.get(svc.name);
      if (st.intentionalRestart) {
        console.log(color('sup', `[sup] ${svc.name} restarting (src change)`));
        launch(svc, 0);
        return;
      }
      console.log(color('sup', `[sup] ${svc.name} exited (code=${code} signal=${signal})`));
      if (!svc.restart) return;
      const delay = Math.min(3000, 300 * 2 ** Math.min(attempt, 4));
      setTimeout(() => launch(svc, attempt + 1), delay);
    });
  }

  for (const svc of servicesToRun) {
    launch(svc);
    if (noWatch) continue;
    for (const dir of svc.watchDirs ?? []) {
      let timer = null;
      watch(dir, { recursive: true }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          const child = procs.get(svc.name);
          const st = state.get(svc.name);
          if (!child || !st || child.exitCode !== null) return;
          st.intentionalRestart = true;
          killTree(child.pid);
        }, 200);
      });
    }
  }

  function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(color('sup', '\n[sup] shutting down...'));
    for (const child of procs.values()) if (child.pid) killTree(child.pid);
    process.exit(0);
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main();