import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createReadStream, openSync, closeSync, readdirSync, statSync, realpathSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { resolve, relative, sep, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { readSharedConfig, updateSharedConfig, withPreviewLock, readPreviewState, writePreviewState } from './settings.mjs';

const identity = 'answer-me-with-html-preview-v1';
const script = fileURLToPath(import.meta.url);
const inside = (root, file) => { const rel = relative(root, file); return rel !== '..' && !rel.startsWith(`..${sep}`) && !rel.startsWith(sep); };
const decode = text => text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (match, entity) => {
  if (entity[0] === '#') { const n = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1)); return n <= 0x10ffff ? String.fromCodePoint(n) : match; }
  return ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"})[entity.toLowerCase()] || match;
});
function documentInfo(file) {
  const html = readFileSync(file, 'utf8');
  const source = /<textarea\b[^>]*\bid="am-source"[^>]*>([\s\S]*?)<\/textarea>/i.exec(html)?.[1];
  const title = decode(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] || file.split(sep).at(-1).replace(/\.html$/, '')).trim();
  const text = source ? decode(source).replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '').replace(/^#{1,6}\s+/gm, '').replace(/```[^\n]*\n/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') : decode(html.replace(/<(script|style|textarea)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<[^>]+>/g, ' '));
  return { title, text: text.replace(/\s+/g, ' ').trim() };
}
function readMeta(file) {
  try { return JSON.parse(readFileSync(`${file}.meta.json`, 'utf8')); } catch { return {}; }
}
export function sessionTurns(sessionId, env = process.env) {
  if (!/^[a-zA-Z0-9_-]+$/.test(sessionId || '')) return [];
  const base = join(env.CODEX_HOME || join(homedir(), '.codex'), 'sessions');
  function find(dir, depth = 0) {
    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isFile() && entry.name.endsWith(`-${sessionId}.jsonl`)) return join(dir, entry.name);
        if (entry.isDirectory() && depth < 3) { const found = find(join(dir, entry.name), depth + 1); if (found) return found; }
      }
    } catch {}
  }
  const file = find(base);
  if (!file) return [];
  const turns = [];
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    let record; try { record = JSON.parse(line); } catch { continue; }
    const payload = record.payload || {};
    if (record.type === 'turn_context' && payload.turn_id) {
      if (!turns.some(t => t.turnId === payload.turn_id)) turns.push({ turnId: payload.turn_id, turnNumber: turns.length + 1, time: Date.parse(record.timestamp), messages: [] });
    }
    if (record.type === 'response_item' && payload.role === 'user' && turns.length) {
      const text = (payload.content || []).map(c => c.text || '').join(' ').trim();
      if (text && !text.startsWith('<environment_context>')) {
        const current = turns.at(-1);
        if (!current.turnTitle) { current.turnTitle = text.replace(/\s+/g, ' ').slice(0, 100); current.turnText = text.slice(0, 20000); }
        current.messages.push({ role: 'user', text });
      }
    }
    if (record.type === 'response_item' && payload.role === 'assistant' && payload.type === 'message' && (payload.phase === 'final_answer' || payload.channel === 'final') && turns.length) {
      const text = (payload.content || []).map(c => c.text || '').join('\n').trim();
      if (text) turns.at(-1).messages.push({ role: 'assistant', text });
    }
  }
  return turns;
}
export function listPages(home) {
  return ['pages', 'videos'].flatMap(dir => {
    try { return readdirSync(join(home, dir)).filter(n => n.endsWith('.html')).flatMap(name => {
      const file = join(home, dir, name);
      try {
        if (!inside(realpathSync(join(home, dir)), realpathSync(file))) return [];
        const meta = readMeta(file);
        const info = documentInfo(file);
        return [{ name, path: `${dir}/${encodeURIComponent(name)}`, kind: dir, time: statSync(file).mtimeMs,
          title: info.title, text: info.text, sessionId: meta.sessionId || 'unassigned',
          sessionTitle: meta.sessionTitle || '历史页面（未记录会话）',
          turnId: meta.turnId || 'unassigned', turnTitle: meta.turnTitle || '未记录轮次',
          turnNumber: meta.turnNumber || null, turnText: meta.turnText || '' }];
      } catch { return []; }
    }); } catch { return []; }
  }).sort((a,b) => b.time - a.time);
}
export function registerPage(home, file, env = process.env) {
  home = resolve(home); file = resolve(file);
  if (!inside(home, file) || !/^(pages|videos)[/\\]/.test(relative(home, file))) return;
  const old = readMeta(file);
  // A later patch keeps the page in its original conversation.
  if (old.sessionId) return;
  const sessionId = env.AM_SESSION_ID || env.CODEX_THREAD_ID || env.CODEX_SESSION_ID || env.CLAUDE_SESSION_ID;
  if (!sessionId) return;
  const existing = listPages(home).find(p => p.sessionId === sessionId);
  const explicitTurnId = env.AM_TURN_ID || env.CODEX_TURN_ID;
  const turns = sessionTurns(sessionId, env);
  const turn = explicitTurnId ? (turns.find(t => t.turnId === explicitTurnId) || { turnId: explicitTurnId }) : turns.at(-1);
  const meta = { ...(turn ? { turnId: turn.turnId, turnNumber: turn.turnNumber, turnTitle: env.AM_TURN_TITLE || turn.turnTitle || documentInfo(file).title, turnText: turn.turnText || env.AM_TURN_TITLE || '' } : {}),
    sessionId, sessionTitle: env.AM_SESSION_TITLE || existing?.sessionTitle || documentInfo(file).title,
    createdAt: new Date().toISOString() };
  const target = `${file}.meta.json`; const temp = `${target}.${process.pid}.tmp`;
  writeFileSync(temp, JSON.stringify(meta, null, 2) + '\n'); renameSync(temp, target);
}
export function listConversations(home) {
  const pages = listPages(home);
  const sessions = new Map();
  for (const page of pages) {
    if (!sessions.has(page.sessionId)) sessions.set(page.sessionId, { sessionId: page.sessionId, title: page.sessionTitle, turns: [], pages: [] });
    sessions.get(page.sessionId).pages.push(page);
  }
  for (const session of sessions.values()) {
    if (session.sessionId === 'unassigned') continue;
    const turns = sessionTurns(session.sessionId);
    for (const page of session.pages) {
      if (!turns.some(t => t.turnId === page.turnId)) turns.push({ turnId: page.turnId, turnTitle: page.turnTitle, turnNumber: page.turnNumber, time: page.time,
        messages: page.turnText ? [{ role: 'user', text: page.turnText }] : [] });
    }
    session.turns = turns.map(turn => ({ ...turn, pages: session.pages.filter(p => p.turnId === turn.turnId).map(p => ({ title: p.title, path: p.path })) })).sort((a,b) => b.time-a.time);
    session.pages = [];
  }
  return [...sessions.values()];
}
export function conversationPage(home, { sessionId = '', offset = 0, query = '' } = {}) {
  const q = query.trim().toLocaleLowerCase();
  const terms = q.split(/\s+/).filter(Boolean);
  const number = /^(?:turn\s*|第\s*)(\d+)(?:\s*轮)?$/i.exec(q);
  return listConversations(home).filter(s => !sessionId || s.sessionId === sessionId).flatMap(session => {
    const turns = session.turns.filter(turn => {
      if (number) return turn.turnNumber === Number(number[1]);
      const text = [session.title, session.sessionId, turn.turnTitle, turn.turnId,
        ...(turn.messages || []).map(m => m.text), ...turn.pages.map(p => p.title)].join(' ').toLocaleLowerCase();
      return terms.every(term => text.includes(term));
    });
    const pages = session.pages.filter(p => terms.every(term => [session.title, session.sessionId, p.title, p.text].join(' ').toLocaleLowerCase().includes(term)));
    if (!turns.length && !pages.length) return [];
    return [{ ...session, turns: turns.slice(offset, offset + 50), pages,
      totalTurns: turns.length, offset, hasMore: offset + 50 < turns.length }];
  });
}
function createPreviewServer(home) {
  home = resolve(home);
  const server = createServer((req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    const send = (status, body, type = 'text/plain; charset=utf-8') => {
      res.writeHead(status, { 'Content-Type': type }); res.end(req.method === 'HEAD' ? undefined : body);
    };
    let path;
    try { path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch { send(400, 'Bad request'); return; }
    if (path === '/__am_health') { send(200, JSON.stringify({ service: identity, home, port: server.address()?.port, pid: process.pid }), 'application/json'); return; }
    if (path === '/latest') {
      const latest = listPages(home)[0];
      if (!latest) { send(404, 'No pages yet'); return; }
      res.writeHead(302, { Location: `/${latest.path}` }); res.end(); return;
    }
    if (path === '/api/conversations') {
      const params = new URL(req.url, 'http://localhost').searchParams;
      const rawOffset = params.get('offset') || '0';
      if (!/^\d+$/.test(rawOffset) || !Number.isSafeInteger(Number(rawOffset))) { send(400, 'Invalid offset'); return; }
      send(200, JSON.stringify(conversationPage(home, { sessionId: params.get('session') || '', offset: Number(rawOffset), query: params.get('q') || '' })), 'application/json; charset=utf-8'); return;
    }
    if (path === '/api/pages') { send(200, JSON.stringify(listPages(home)), 'application/json; charset=utf-8'); return; }
    if (path === '/') {
      send(200, readFileSync(new URL('./catalog.html', import.meta.url), 'utf8'), 'text/html; charset=utf-8'); return;
    }
    const match = /^\/(pages|videos)\/(.+)$/.exec(path);
    if (!match) { send(404, 'Not found'); return; }
    try {
      const root = realpathSync(join(home, match[1]));
      const file = realpathSync(resolve(root, match[2]));
      if (!inside(root, file) || !statSync(file).isFile()) { send(404, 'Not found'); return; }
      const types = { '.html': 'text/html; charset=utf-8', '.mp4': 'video/mp4', '.wav': 'audio/wav', '.png':'image/png', '.svg':'image/svg+xml' };
      res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
      if (req.method === 'HEAD') res.end();
      else createReadStream(file).on('error', () => res.destroy()).pipe(res);
    } catch { send(404, 'Not found'); }
  });
  return server;
}

export function serve(home, port) {
  const server = createPreviewServer(home);
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  server.listen(port, '127.0.0.1');
  return server;
}

const validPort = value => Number.isInteger(value) && value >= 1 && value <= 65535;
const nextPort = port => port >= 65535 || port < 1024 ? 1024 : port + 1;

async function probe(home, port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/__am_health`, { signal: AbortSignal.timeout(500), redirect: 'error' });
    if (!response.ok) return null;
    const state = await response.json();
    return state.service === identity && state.home === home ? state : null;
  } catch { return null; }
}

function rememberPreview(home, port, details = {}) {
  updateSharedConfig(home, current => ({ ...current, port }));
  writePreviewState(home, { service: identity, home, port, pid: details.pid ?? null,
    instanceId: details.instanceId ?? null, updatedAt: new Date().toISOString() });
}

async function listenPreview(home, port) {
  const server = createPreviewServer(home);
  await new Promise((resolve, reject) => {
    const fail = error => reject(error);
    server.once('error', fail);
    server.listen(port, '127.0.0.1', () => { server.off('error', fail); resolve(); });
  });
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  return server;
}

async function serveManaged(home, preferred, instanceId) {
  home = resolve(home);
  let port = preferred;
  let server;
  // Binding, rather than a separate availability check, resolves competing services safely.
  for (let attempt = 0; attempt < 32; attempt++, port = nextPort(port)) {
    try { server = await listenPreview(home, port); break; }
    catch (error) { if (!['EADDRINUSE', 'EACCES'].includes(error.code)) throw error; }
  }
  if (!server) server = await listenPreview(home, 0);
  try { rememberPreview(home, server.address().port, { pid: process.pid, instanceId }); }
  catch (error) { server.close(); throw error; }
  return server;
}

export async function ensurePreview(home, port, file) {
  home = resolve(home);
  const rel = relative(home, resolve(file));
  if (!/^(pages|videos)[/\\]/.test(rel) || !inside(home, resolve(file))) return null;
  if (!validPort(port)) throw new Error('Preview port must be an integer from 1 to 65535');
  const selected = await withPreviewLock(home, async () => {
    // Reload inside the lock: another session may have already chosen a replacement.
    const configured = readSharedConfig(home).port;
    const preferred = validPort(configured) ? configured : port;
    const ready = await probe(home, preferred);
    if (ready) { rememberPreview(home, preferred, ready); return preferred; }

    const instanceId = randomUUID();
    const fd = openSync(join(home, 'preview.log'), 'a', 0o600);
    let child;
    try {
      child = spawn(process.execPath, [script, '--serve', home, String(preferred), instanceId],
        { detached: true, windowsHide: true, stdio: ['ignore', fd, fd] });
    } finally { closeSync(fd); }
    let spawnError;
    let exitCode;
    child.on('error', error => { spawnError = error; });
    child.on('exit', code => { exitCode = code; });
    child.unref();
    for (let attempt = 0; attempt < 100; attempt++) {
      if (spawnError) throw spawnError;
      if (exitCode !== undefined) throw new Error(`Preview process exited (${exitCode}); see ${join(home, 'preview.log')}`);
      const state = readPreviewState(home);
      if (state.instanceId === instanceId && validPort(state.port) && await probe(home, state.port)) return state.port;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Preview server did not start; see ${join(home, 'preview.log')}`);
  });
  return `http://localhost:${selected}/${rel.split(sep).map(encodeURIComponent).join('/')}`;
}
if (process.argv[1] && resolve(process.argv[1]) === script && process.argv[2] === '--serve') {
  const port = Number(process.argv[4]);
  if (!Number.isInteger(port) || port < 1 || port > 65535 || !process.argv[3]) throw new Error('Usage: preview.mjs --serve HOME PORT');
  await serveManaged(process.argv[3], port, process.argv[5] || randomUUID());
}
