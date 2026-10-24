import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir, hostname } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ensurePreview } from './preview.mjs';

const scripts = dirname(fileURLToPath(import.meta.url));
const previewModule = pathToFileURL(join(scripts, 'preview.mjs')).href;
const root = mkdtempSync(join(tmpdir(), 'am-preview-tests-'));
const homes = [];
const listeners = [];
const json = file => JSON.parse(readFileSync(file, 'utf8'));

function home(config = {}) {
  const result = mkdtempSync(join(root, 'home-'));
  mkdirSync(join(result, 'pages'));
  writeFileSync(join(result, 'pages', 'fixture.html'), 'preview fixture');
  writeFileSync(join(result, 'config.json'), JSON.stringify({ update_check: false, ...config }));
  homes.push(result);
  return result;
}

function command(args, { env = {}, input = '' } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { windowsHide: true, env: { ...process.env, ...env }, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', text => { stdout += text; });
    child.stderr.on('data', text => { stderr += text; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve({ stdout, stderr, pid: child.pid }) : reject(new Error(`Exit ${code}: ${stderr}\n${stdout}`)));
    child.stdin.end(input);
  });
}

function cli(directory, args, input = '') {
  return command([join(scripts, 'am.mjs'), ...args], { input, env: { AM_HOME: directory, AM_NO_OPEN: '1' } });
}

async function worker(directory, port) {
  const code = `import { ensurePreview } from ${JSON.stringify(previewModule)}; console.log(await ensurePreview(${JSON.stringify(directory)},${port},${JSON.stringify(join(directory, 'pages', 'fixture.html'))}));`;
  const { stdout } = await command(['--input-type=module', '-e', code]);
  return stdout.trim();
}

async function occupiedPort(port = 0) {
  const server = createServer((req, res) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ service: 'unrelated-test-service' })); });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  listeners.push(server);
  return server.address().port;
}

async function freePort() {
  const port = await occupiedPort();
  const server = listeners.pop();
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function health(port) {
  const response = await fetch(`http://127.0.0.1:${port}/__am_health`, { signal: AbortSignal.timeout(1000) });
  return response.json();
}

async function stopOwnedPreview(directory) {
  const file = join(directory, 'preview-state.json');
  if (!existsSync(file)) return;
  const state = json(file);
  if (state.home !== directory || !Number.isInteger(state.pid) || state.pid === process.pid) return;
  let current;
  try { current = await health(state.port); } catch { return; }
  if (current.home !== directory || current.pid !== state.pid) return;
  process.kill(state.pid);
  for (let i = 0; i < 50; i++) {
    try { await health(state.port); }
    catch { return; }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('Test preview did not stop');
}

afterEach(async () => {
  for (const directory of homes.splice(0)) await stopOwnedPreview(directory);
  for (const server of listeners.splice(0)) {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

after(() => {
  const rel = relative(resolve(tmpdir()), resolve(root));
  if (rel.startsWith('..') || isAbsolute(rel) || !basename(root).startsWith('am-preview-tests-')) throw new Error('Unsafe temporary cleanup path');
  rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

test('new configurations render diagrams on paper and honor explicit themes', { timeout: 20000 }, async () => {
  const directory = home({ preview: false, style: 'off' });
  assert.equal((await cli(directory, ['config', 'get', 'theme'])).stdout.trim(), 'paper');
  const draft = '---\ntitle: Theme test\n---\n## Diagram\nA simple relationship. Both nodes are visible.\n\n```flow\nA -> B: next\n```\n';
  const page = join(directory, 'pages', 'theme.html');
  await cli(directory, ['render', '-', '--no-open', '--out', page], draft);
  const html = readFileSync(page, 'utf8');
  assert.match(html, /data-theme="paper"/);
  assert.ok(html.includes('am-fold'));
  await cli(directory, ['render', '-', '--no-open', '--theme', 'blueprint', '--out', page], draft);
  assert.match(readFileSync(page, 'utf8'), /data-theme="blueprint"/);
});

test('concurrent sessions choose one free port and leave its original owner intact', { timeout: 20000 }, async () => {
  const preferred = await occupiedPort();
  const directory = home({ port: preferred, theme: 'paper', sentinel: 'preserve' });
  const urls = await Promise.all(Array.from({ length: 4 }, () => worker(directory, preferred)));
  assert.equal(new Set(urls).size, 1);
  const selected = Number(new URL(urls[0]).port);
  assert.notEqual(selected, preferred);
  assert.equal(json(join(directory, 'config.json')).port, selected);
  const state = json(join(directory, 'preview-state.json'));
  assert.equal(state.port, selected);
  assert.equal(state.pid, (await health(selected)).pid);
  assert.equal(await (await fetch(urls[0])).text(), 'preview fixture');
  assert.equal((await health(preferred)).service, 'unrelated-test-service');
});

test('stale session snapshots reuse the saved port without losing concurrent settings', { timeout: 20000 }, async () => {
  const preferred = await occupiedPort();
  const directory = home({ port: preferred, sentinel: 'preserve' });
  const first = await worker(directory, preferred);
  const results = await Promise.all([
    worker(directory, preferred),
    cli(directory, ['config', 'set', 'theme', 'paper']),
    cli(directory, ['config', 'set', 'open', 'off'])
  ]);
  assert.equal(results[0], first);
  const config = json(join(directory, 'config.json'));
  assert.equal(config.port, Number(new URL(first).port));
  assert.equal(config.theme, 'paper');
  assert.equal(config.open, false);
  assert.equal(config.sentinel, 'preserve');
});

test('separate homes use separate ports and do not expose each other pages', { timeout: 20000 }, async () => {
  const firstHome = home();
  const first = await worker(firstHome, await freePort());
  const firstPort = Number(new URL(first).port);
  writeFileSync(join(firstHome, 'pages', 'private.html'), 'first home only');
  const secondHome = home({ port: firstPort });
  const second = await worker(secondHome, firstPort);
  assert.notEqual(new URL(second).port, new URL(first).port);
  assert.equal((await health(firstPort)).home, firstHome);
  assert.equal((await health(Number(new URL(second).port))).home, secondHome);
  assert.equal((await fetch(new URL('/pages/private.html', second))).status, 404);
  assert.equal(await (await fetch(new URL('/pages/private.html', first))).text(), 'first home only');
  assert.equal(await worker(firstHome, firstPort), first);
});

test('a stopped preview can recover when another service takes its saved port', { timeout: 20000 }, async () => {
  const directory = home();
  const first = await worker(directory, await freePort());
  const oldPort = Number(new URL(first).port);
  const oldPid = json(join(directory, 'preview-state.json')).pid;
  await stopOwnedPreview(directory);
  await occupiedPort(oldPort);
  const second = await worker(directory, oldPort);
  assert.notEqual(Number(new URL(second).port), oldPort);
  assert.notEqual(json(join(directory, 'preview-state.json')).pid, oldPid);
  assert.equal(json(join(directory, 'config.json')).port, Number(new URL(second).port));
});

test('a lock left by an exited session does not block later sessions', { timeout: 20000 }, async () => {
  const directory = home();
  const ended = await command(['-e', '']);
  const lock = join(directory, 'preview.lock');
  writeFileSync(lock, JSON.stringify({ pid: ended.pid, platform: process.platform, host: hostname(), token: 'interrupted-session' }));
  utimesSync(lock, new Date(0), new Date(0));
  const url = await worker(directory, await freePort());
  assert.equal((await fetch(url)).status, 200);
  assert.equal(existsSync(lock), false);
});

test('files outside the served home do not start a preview', async () => {
  const directory = home();
  assert.equal(await ensurePreview(directory, await freePort(), join(root, 'outside.html')), null);
  assert.equal(existsSync(join(directory, 'preview-state.json')), false);
});
