// Build a public example from its dedicated draft, never from personal conversation data.
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const home = mkdtempSync(join(tmpdir(), 'personal-skills-demo-'));
try {
  writeFileSync(join(home, 'config.json'), JSON.stringify({ preview: false, open: false, update_check: false }));
  const cli = join(root, 'skills/answer-me-with-html/scripts/am.mjs');
  const result = spawnSync(process.execPath, [cli, 'render', join(root, 'skills/answer-me-with-html/examples/reading.md'), '-o', join(root, 'docs/demo.html'), '--theme', 'paper', '--no-open'], { stdio: 'inherit', env: { ...process.env, AM_HOME: home } });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Demo generation failed: ${result.status}`);
  const output = join(root, 'docs/demo.html');
  writeFileSync(output, readFileSync(output, 'utf8').replace('</head>', '<link rel="icon" href="./favicon.svg" type="image/svg+xml">\n</head>'));
} finally { rmSync(home, { recursive: true, force: true }); }
