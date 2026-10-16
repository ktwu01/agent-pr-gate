#!/usr/bin/env node
import { readFile, writeFile, lstat, realpath } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const agentNames = ['claude', 'codex', 'pi'];
const rule = await readFile(new URL('../templates/gate.md', import.meta.url), 'utf8');
const markerStart = '<!-- agent-pr-gate:start -->';
const markerEnd = '<!-- agent-pr-gate:end -->';

function options(args) {
  let target;
  let agents = agentNames;
  const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === '--help' && args.length === 1) return { help: true };
    if (!['--target', '--agents'].includes(flag) || seen.has(flag)) throw new Error(`Unknown or repeated option: ${flag}`);
    seen.add(flag);
    const value = args[++i];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
    if (flag === '--target') target = resolve(value);
    else {
      agents = value.split(',');
      if (agents.some(agent => !agentNames.includes(agent)) || new Set(agents).size !== agents.length) {
        throw new Error('--agents must be a comma-separated selection of claude,codex,pi without duplicates');
      }
    }
  }
  if (!target) throw new Error('--target PATH is required');
  return { target, agents };
}

async function existing(path) {
  try {
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Expected a regular file: ${path}`);
    return await readFile(path, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function appendRule(text) {
  const block = `${markerStart}\n${rule}${markerEnd}`;
  if (text === null) return block + '\n';
  const starts = text.split(markerStart).length - 1;
  const ends = text.split(markerEnd).length - 1;
  if (starts || ends) {
    if (starts !== 1 || ends !== 1 || !text.includes(block)) {
      throw new Error('Existing agent-pr-gate document block differs; review it before installing');
    }
    return text;
  }
  return text + (text.endsWith('\n\n') ? '' : text.endsWith('\n') ? '\n' : '\n\n') + block + '\n';
}

async function install(target, agents) {
  const info = await lstat(target);
  if (!info.isDirectory()) throw new Error('--target must be an existing directory');
  target = await realpath(target);
  const plan = new Map();
  async function merged(relative) {
    const path = join(target, relative);
    const previous = await existing(path);
    const content = appendRule(previous);
    if (relative === 'AGENTS.md' && agents.includes('codex') && Buffer.byteLength(content, 'utf8') > 32 * 1024) {
      throw new Error('AGENTS.md exceeds the default Codex 32 KiB instruction limit; shorten it before installing');
    }
    if (content !== previous) plan.set(path, content);
  }
  await merged('CONTRIBUTING.md');
  if (agents.includes('claude')) await merged('CLAUDE.md');
  if (agents.includes('codex') || agents.includes('pi')) {
    if (agents.includes('codex') && await existing(join(target, 'AGENTS.override.md')) !== null) {
      throw new Error('AGENTS.override.md takes precedence in Codex; reconcile it before installing');
    }
    await merged('AGENTS.md');
  }
  for (const [path, content] of plan) {
    await writeFile(path, content, 'utf8');
  }
  return [...plan.keys()];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const parsed = options(process.argv.slice(2));
    if (parsed.help) console.log('Usage: node scripts/install.mjs --target PATH [--agents claude,codex,pi]\nRequires Node.js 20 or newer. Installs only into the target repository.');
    else {
      const changed = await install(parsed.target, parsed.agents);
      console.log(changed.length ? `Installed agent-pr-gate for ${parsed.agents.join(', ')}. Updated ${changed.length} files.` : 'Agent PR gate is already installed. No files changed.');
    }
  } catch (error) {
    console.error(`agent-pr-gate: ${error.message}`);
    process.exitCode = 1;
  }
}
