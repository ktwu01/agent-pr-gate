import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, readdir, readlink, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const installer = fileURLToPath(new URL('../scripts/install.mjs', import.meta.url));
const rule = await readFile(new URL('../templates/gate.md', import.meta.url), 'utf8');
const markerStart = '<!-- agent-pr-gate:start -->';
const markerEnd = '<!-- agent-pr-gate:end -->';
const block = `${markerStart}\n${rule}${markerEnd}\n`;

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'agent-pr-gate path with spaces '));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
function run(root, agents = null) {
  const args = [installer, '--target', root];
  if (agents !== null) args.push('--agents', agents);
  return spawnSync(process.execPath, args, { encoding: 'utf8' });
}
async function snapshot(root) {
  const result = {};
  async function visit(directory, prefix = '') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const relative = prefix + entry.name;
      if (entry.isDirectory()) await visit(join(directory, entry.name), relative + '/');
      else if (entry.isSymbolicLink()) result[relative] = { symlink: await readlink(join(directory, entry.name)) };
      else result[relative] = await readFile(join(directory, entry.name), 'utf8');
    }
  }
  await visit(root);
  return result;
}

test('default and selected agents install only their native instruction files in paths with spaces', async t => {
  for (const agents of [null, 'claude', 'codex', 'pi', 'claude,codex', 'claude,pi', 'codex,pi', 'pi,codex,claude']) {
    const root = await fixture(t);
    const result = run(root, agents);
    assert.equal(result.status, 0, result.stderr);
    const selected = agents === null ? ['claude', 'codex', 'pi'] : agents.split(',');
    const expected = { 'CONTRIBUTING.md': block };
    if (selected.includes('claude')) expected['CLAUDE.md'] = block;
    if (selected.includes('codex') || selected.includes('pi')) expected['AGENTS.md'] = block;
    assert.deepEqual(await snapshot(root), expected);
    assert.match(result.stdout, new RegExp(`Updated ${Object.keys(expected).length} files`));
    const repeat = run(root, agents);
    assert.equal(repeat.status, 0, repeat.stderr);
    assert.match(repeat.stdout, /No files changed/);
    assert.deepEqual(await snapshot(root), expected);
  }
});

test('installation preserves existing documents and all Claude configuration byte for byte', async t => {
  const root = await fixture(t);
  await mkdir(join(root, '.claude/hooks'), { recursive: true });
  const untouched = {
    'README.md': 'Human documentation\n',
    '.claude/settings.json': '{ "permissions": { "allow": ["Read"] }, "hooks": { "SessionStart": [{ "hooks": [{ "type": "command", "command": "printf existing" }] }] } }\n',
    '.claude/settings.local.json': '{ "disableAllHooks": true }\n',
    '.claude/hooks/existing.cjs': 'Human hook\n',
    '.claude/CLAUDE.md': 'Nested human instructions\n',
  };
  for (const [relative, content] of Object.entries(untouched)) await writeFile(join(root, relative), content);
  const docs = {
    'CONTRIBUTING.md': 'Existing contribution policy\n',
    'CLAUDE.md': 'Existing Claude policy',
    'AGENTS.md': 'Existing agent policy\n\n',
  };
  for (const [relative, content] of Object.entries(docs)) await writeFile(join(root, relative), content);
  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
  const expected = {
    ...untouched,
    'CONTRIBUTING.md': docs['CONTRIBUTING.md'] + '\n' + block,
    'CLAUDE.md': docs['CLAUDE.md'] + '\n\n' + block,
    'AGENTS.md': docs['AGENTS.md'] + block,
  };
  assert.deepEqual(await snapshot(root), expected);
  assert.equal(run(root).status, 0);
  assert.deepEqual(await snapshot(root), expected);
});

test('malformed or disabled Claude settings are ignored and preserved', async t => {
  for (const contents of ['{broken', '[]', '{"hooks":false}', '{"hooks":{"SessionStart":{}}}', '{"disableAllHooks":true}']) {
    const root = await fixture(t);
    await mkdir(join(root, '.claude'));
    await writeFile(join(root, '.claude/settings.json'), contents);
    const result = run(root, 'claude');
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(await snapshot(root), {
      '.claude/settings.json': contents,
      'CONTRIBUTING.md': block,
      'CLAUDE.md': block,
    });
  }
});

test('symlinked Claude configuration is left untouched', async t => {
  const root = await fixture(t);
  const outside = await fixture(t);
  await writeFile(join(outside, 'settings.json'), '{broken');
  const before = await snapshot(outside);
  await symlink(outside, join(root, '.claude'));
  const result = run(root, 'claude');
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(await snapshot(outside), before);
  assert.deepEqual(await snapshot(root), {
    '.claude': { symlink: outside },
    'CONTRIBUTING.md': block,
    'CLAUDE.md': block,
  });
});

test('default selection converges after an earlier selected-agent install', async t => {
  for (const agents of ['claude', 'codex', 'pi']) {
    const root = await fixture(t);
    assert.equal(run(root, agents).status, 0);
    assert.equal(run(root).status, 0);
    const expected = { 'CONTRIBUTING.md': block, 'CLAUDE.md': block, 'AGENTS.md': block };
    assert.deepEqual(await snapshot(root), expected);
    assert.equal(run(root).status, 0);
    assert.deepEqual(await snapshot(root), expected);
  }
});

test('invalid agent selection and nonexistent target do not create files', async t => {
  const root = await fixture(t);
  for (const agents of ['unknown', 'claude,claude', '', 'claude,', 'codex, pi']) {
    const result = run(root, agents);
    assert.equal(result.status, 1);
    assert.deepEqual(await readdir(root), []);
  }
  assert.equal(run(join(root, 'missing')).status, 1);
  assert.deepEqual(await readdir(root), []);
});

test('modified, incomplete, reversed, and duplicate managed blocks fail before any writes', async t => {
  const collisions = [
    `${markerStart}\nHuman edit\n${markerEnd}`,
    markerStart,
    markerEnd,
    `${markerEnd}\n${markerStart}`,
    block + block,
    block + markerStart,
    markerEnd + block,
  ];
  for (const relative of ['CONTRIBUTING.md', 'CLAUDE.md', 'AGENTS.md']) {
    for (const content of collisions) {
      const root = await fixture(t);
      await writeFile(join(root, relative), content);
      const before = await snapshot(root);
      const result = run(root);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /document block differs/);
      assert.deepEqual(await snapshot(root), before);
    }
  }
});

test('symlinked instruction paths, including dangling links, fail before any writes', async t => {
  for (const relative of ['CONTRIBUTING.md', 'CLAUDE.md', 'AGENTS.md', 'AGENTS.override.md']) {
    for (const dangling of [false, true]) {
      const root = await fixture(t);
      const outside = await fixture(t);
      const destination = join(outside, 'instructions.md');
      if (!dangling) await writeFile(destination, 'Outside instructions\n');
      await symlink(destination, join(root, relative));
      const before = await snapshot(root);
      const outsideBefore = await snapshot(outside);
      const result = run(root);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /Expected a regular file/);
      assert.deepEqual(await snapshot(root), before);
      assert.deepEqual(await snapshot(outside), outsideBefore);
    }
  }
});

test('directories at instruction paths fail before any writes', async t => {
  for (const relative of ['CONTRIBUTING.md', 'CLAUDE.md', 'AGENTS.md']) {
    const root = await fixture(t);
    await mkdir(join(root, relative));
    const result = run(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Expected a regular file/);
    assert.deepEqual(await readdir(root), [relative]);
    assert.deepEqual(await readdir(join(root, relative)), []);
  }
});

test('Codex override fails before writing, while Claude and Pi leave it untouched', async t => {
  for (const agents of [null, 'codex', 'claude', 'pi']) {
    const root = await fixture(t);
    await writeFile(join(root, 'AGENTS.override.md'), 'Overrides instructions\n');
    const before = await snapshot(root);
    const result = run(root, agents);
    if (agents === null || agents === 'codex') {
      assert.equal(result.status, 1);
      assert.match(result.stderr, /takes precedence/);
      assert.deepEqual(await snapshot(root), before);
    } else {
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(await snapshot(root), {
        ...before,
        'CONTRIBUTING.md': block,
        [agents === 'claude' ? 'CLAUDE.md' : 'AGENTS.md']: block,
      });
    }
  }
});

test('Codex size guard counts the appended gate and UTF-8 bytes, with 32 KiB allowed', async t => {
  const capacity = 32 * 1024 - Buffer.byteLength('\n\n' + block, 'utf8');
  for (const [content, success] of [
    ['a'.repeat(capacity), true],
    ['a'.repeat(capacity + 1), false],
    ['界'.repeat(Math.floor(capacity / 3) + 1), false],
  ]) {
    const root = await fixture(t);
    await writeFile(join(root, 'AGENTS.md'), content);
    const before = await snapshot(root);
    const result = run(root);
    if (success) {
      assert.equal(result.status, 0, result.stderr);
      const files = await snapshot(root);
      assert.equal(Buffer.byteLength(files['AGENTS.md'], 'utf8'), 32 * 1024);
      assert.equal(run(root).status, 0);
      assert.deepEqual(await snapshot(root), files);
    } else {
      assert.equal(result.status, 1);
      assert.match(result.stderr, /32 KiB instruction limit/);
      assert.deepEqual(await snapshot(root), before);
    }
  }
});

test('Pi accepts a larger AGENTS document and later Codex selection fails without changes', async t => {
  const root = await fixture(t);
  const content = 'a'.repeat(32 * 1024);
  await writeFile(join(root, 'AGENTS.md'), content);
  const result = run(root, 'pi');
  assert.equal(result.status, 0, result.stderr);
  const expected = { 'CONTRIBUTING.md': block, 'AGENTS.md': content + '\n\n' + block };
  assert.deepEqual(await snapshot(root), expected);
  const codex = run(root);
  assert.equal(codex.status, 1);
  assert.match(codex.stderr, /32 KiB instruction limit/);
  assert.deepEqual(await snapshot(root), expected);
});
