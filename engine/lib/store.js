'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..', '..');
const P = { root: ROOT, masters: path.join(ROOT, 'masters'), archive: path.join(ROOT, 'archive'), template: path.join(ROOT, 'template'),
  config: path.join(ROOT, 'config', 'platform.json'), inbox: path.join(ROOT, 'inbox') };
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
const RESERVED = new Set(['platform', 'api', 'admin', 'photos', 'static', 'fonts', 'engine', 'config', 'template', 'masters', 'archive', 'inbox', 'favicon', 'robots', 'health']);
const FILES = ['master.json', 'services.json', 'schedule.json', 'reviews.json', 'bookings.json', 'auth.json', 'push.json'];

class JsonError extends Error { constructor(file, msg) { super(msg); this.code = 'BROKEN_JSON'; this.file = file; } }

function stripJsonc(t) {
  let o = '', i = 0, s = false;
  while (i < t.length) {
    const c = t[i], n = t[i + 1];
    if (s) { o += c; if (c === '\\') { o += n || ''; i += 2; continue; } if (c === '"') s = false; i++; continue; }
    if (c === '"') { s = true; o += c; i++; continue; }
    if (c === '/' && n === '/') { while (i < t.length && t[i] !== '\n') i++; continue; }
    if (c === '/' && n === '*') { i += 2; while (i < t.length && !(t[i] === '*' && t[i + 1] === '/')) i++; i += 2; continue; }
    o += c; i++;
  }
  return o.replace(/^\uFEFF/, '').replace(/,(\s*[}\]])/g, '$1');
}
const isSlug = s => typeof s === 'string' && SLUG_RE.test(s) && !RESERVED.has(s);
function slugList() { try { return fs.readdirSync(P.masters, { withFileTypes: true }).filter(d => d.isDirectory() && isSlug(d.name)).map(d => d.name); } catch { return []; } }
function masterDir(slug) { if (!isSlug(slug) || !slugList().includes(slug)) return null; return path.join(P.masters, slug); }
function readRaw(file) { try { return fs.readFileSync(file, 'utf8'); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } }
function parseText(file, txt) { try { return JSON.parse(stripJsonc(txt)); } catch (e) { throw new JsonError(path.basename(file), 'Файл «' + path.basename(file) + '» содержит ошибку и не читается (' + e.message.replace(/^.*?: ?/, '').slice(0, 80) + ').'); } }
function readJSON(slug, name, fallback) {
  const dir = masterDir(slug); if (!dir) throw Object.assign(new Error('Мастер не найден'), { status: 404 });
  const f = path.join(dir, name), txt = readRaw(f);
  if (txt === null) return fallback === undefined ? null : JSON.parse(JSON.stringify(fallback));
  return parseText(f, txt);
}
function atomicWrite(file, text) { const tmp = file + '.tmp-' + crypto.randomBytes(4).toString('hex'); fs.writeFileSync(tmp, text); fs.renameSync(tmp, file); }
function backupsOf(dir, name) {
  const bd = path.join(dir, 'backups'); if (!fs.existsSync(bd)) return [];
  return fs.readdirSync(bd).filter(f => f.startsWith(name + '.') && f.endsWith('.bak')).map(f => ({ f, ts: +f.slice(name.length + 1, -4) })).filter(x => x.ts).sort((a, b) => b.ts - a.ts);
}
function writeJSON(slug, name, data, opts = {}) {
  const dir = masterDir(slug); if (!dir) throw Object.assign(new Error('Мастер не найден'), { status: 404 });
  const f = path.join(dir, name), cur = readRaw(f);
  if (cur !== null && !opts.noBackup) {
    const bd = path.join(dir, 'backups'); fs.mkdirSync(bd, { recursive: true });
    let ts = Date.now(); const ex = backupsOf(dir, name); if (ex[0] && ts <= ex[0].ts) ts = ex[0].ts + 1;
    fs.writeFileSync(path.join(bd, `${name}.${ts}.bak`), cur);
    backupsOf(dir, name).slice(30).forEach(b => fs.unlinkSync(path.join(bd, b.f)));
  }
  atomicWrite(f, JSON.stringify(data, null, 2) + '\n');
}
function undoFile(slug, name) {
  const dir = masterDir(slug), list = backupsOf(dir, name);
  if (!list.length) throw Object.assign(new Error('Нет сохранённых копий — отменять нечего'), { status: 400 });
  const prev = fs.readFileSync(path.join(dir, 'backups', list[0].f), 'utf8'); parseText(name, prev);
  const cur = readRaw(path.join(dir, name)), bd = path.join(dir, 'backups');
  let ts = Date.now(); if (ts <= list[0].ts) ts = list[0].ts + 1;
  if (cur !== null) fs.writeFileSync(path.join(bd, `${name}.${ts}.bak`), cur);
  fs.unlinkSync(path.join(bd, list[0].f)); atomicWrite(path.join(dir, name), prev);
}
function restoreBroken(slug, name) {
  const dir = masterDir(slug);
  for (const b of backupsOf(dir, name)) { const t = fs.readFileSync(path.join(dir, 'backups', b.f), 'utf8'); try { JSON.parse(stripJsonc(t)); atomicWrite(path.join(dir, name), t); return true; } catch { } }
  return false;
}
function hasBackup(slug, name) { const d = masterDir(slug); return !!(d && backupsOf(d, name).length); }
const queues = new Map();
function locked(slug, fn) {
  const prev = queues.get(slug) || Promise.resolve();
  const run = prev.catch(() => { }).then(fn); queues.set(slug, run);
  run.finally(() => { if (queues.get(slug) === run) queues.delete(slug); }).catch(() => { });
  return run;
}
function readConfig() {
  const txt = readRaw(P.config); if (txt === null) return null; const c = parseText(P.config, txt);
  return Object.assign({ platformName: 'Beauty Agent', baseUrl: 'http://localhost:3000', allowExternal: false, port: 3000, host: '0.0.0.0' }, c);
}
function writeConfig(c) { fs.mkdirSync(path.dirname(P.config), { recursive: true }); atomicWrite(P.config, JSON.stringify(c, null, 2) + '\n'); }
const rid = (n = 4) => crypto.randomBytes(n).toString('hex');
module.exports = { P, ROOT, FILES, JsonError, isSlug, slugList, masterDir, readJSON, writeJSON, undoFile, restoreBroken, hasBackup, locked, readConfig, writeConfig, stripJsonc, rid, atomicWrite };
