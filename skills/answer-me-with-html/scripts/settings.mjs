import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { hostname } from 'node:os';
import { randomUUID } from 'node:crypto';

const host = hostname();
const pause = new Int32Array(new SharedArrayBuffer(4));
const lockTimeout = 15000;

function readObject(file) {
  try {
    const value = JSON.parse(readFileSync(file, 'utf8'));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) return {};
    throw error;
  }
}

function processAlive(pid) {
  if (!Number.isInteger(pid) || pid < 1) return false;
  try { process.kill(pid, 0); return true; }
  catch (error) { return error.code !== 'ESRCH'; }
}

function discardAbandonedLock(file) {
  try {
    const owner = readObject(file);
    const age = Date.now() - statSync(file).mtimeMs;
    const sameHost = owner.host === host && owner.platform === process.platform;
    const abandoned = sameHost && Number.isInteger(owner.pid) ? !processAlive(owner.pid) : age > 60000;
    if (abandoned && age > 250) unlinkSync(file);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

function acquire(file) {
  const token = randomUUID();
  let fd;
  try { fd = openSync(file, 'wx', 0o600); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    discardAbandonedLock(file);
    return null;
  }
  try { writeFileSync(fd, JSON.stringify({ token, pid: process.pid, host, platform: process.platform })); }
  catch (error) { closeSync(fd); unlinkSync(file); throw error; }
  closeSync(fd);
  return () => {
    if (readObject(file).token === token) {
      try { unlinkSync(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  };
}

function writeObjectAtomic(file, value) {
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  let fd;
  try {
    fd = openSync(temporary, 'wx', 0o600);
    writeFileSync(fd, JSON.stringify(value, null, 2) + '\n');
    fsyncSync(fd);
    closeSync(fd); fd = undefined;
    renameSync(temporary, file);
  } finally {
    if (fd !== undefined) closeSync(fd);
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}

export function readSharedConfig(home) {
  return readObject(join(home, 'config.json'));
}

export function updateSharedConfig(home, update) {
  const file = join(home, 'config.json');
  mkdirSync(dirname(file), { recursive: true });
  const deadline = Date.now() + lockTimeout;
  let release;
  while (!(release = acquire(`${file}.lock`))) {
    if (Date.now() > deadline) throw new Error(`Shared settings are busy: ${file}`);
    Atomics.wait(pause, 0, 0, 25);
  }
  try {
    const current = readObject(file);
    const next = update({ ...current });
    if (JSON.stringify(current) !== JSON.stringify(next) || !existsSync(file)) writeObjectAtomic(file, next);
    return next;
  } finally { release(); }
}

export async function withPreviewLock(home, action) {
  mkdirSync(home, { recursive: true });
  const file = join(home, 'preview.lock');
  const deadline = Date.now() + lockTimeout;
  let release;
  while (!(release = acquire(file))) {
    if (Date.now() > deadline) throw new Error(`Another session is still starting the preview: ${home}`);
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  try { return await action(); }
  finally { release(); }
}

export function readPreviewState(home) {
  return readObject(join(home, 'preview-state.json'));
}

export function writePreviewState(home, state) {
  writeObjectAtomic(join(home, 'preview-state.json'), state);
}
