'use strict';
const fs = require('fs'), path = require('path'), store = require('./store');
const EXT_OK = /\.(jpe?g|png|webp|svg)$/i, MAX = 8 * 1024 * 1024;
function sniff(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return 'webp';
  return null;
}
const kinds = ['avatar', 'cover', 'works', 'studio'];
function dir(slug, sub) { const d = store.masterDir(slug); if (!d) throw Object.assign(new Error('Мастер не найден'), { status: 404 }); const x = path.join(d, 'photos', sub || ''); fs.mkdirSync(x, { recursive: true }); return x; }
function single(slug, kind) { const d = dir(slug); const f = fs.readdirSync(d).find(n => n.startsWith(kind + '.') && EXT_OK.test(n)); return f ? { file: f, v: Math.floor(fs.statSync(path.join(d, f)).mtimeMs) } : null; }
function list(slug, kind) {
  const d = dir(slug, kind), m = store.readJSON(slug, 'master.json', {}), order = ((m.photos || {})[kind] || []).filter(f => fs.existsSync(path.join(d, f)));
  const rest = fs.readdirSync(d).filter(f => EXT_OK.test(f) && !order.includes(f)).sort();
  return order.concat(rest).map(f => ({ file: f, v: Math.floor(fs.statSync(path.join(d, f)).mtimeMs) }));
}
function urls(slug) {
  const u = (k, f) => `/photos/${slug}/${k ? k + '/' : ''}${f.file}?v=${f.v}`, a = single(slug, 'avatar'), c = single(slug, 'cover');
  return { avatar: a ? u('', a) : null, cover: c ? u('', c) : null, works: list(slug, 'works').map(f => ({ file: f.file, url: u('works', f) })), studio: list(slug, 'studio').map(f => ({ file: f.file, url: u('studio', f) })) };
}
function save(slug, kind, buf) {
  if (!kinds.includes(kind)) throw Object.assign(new Error('Неизвестный тип фото'), { status: 400 });
  if (buf.length > MAX) throw Object.assign(new Error('Файл слишком большой (максимум 8 МБ)'), { status: 413 });
  const ext = sniff(buf); if (!ext) throw Object.assign(new Error('Принимаются только фото JPG, PNG или WebP'), { status: 400 });
  if (kind === 'avatar' || kind === 'cover') { const d = dir(slug); fs.readdirSync(d).filter(n => n.startsWith(kind + '.')).forEach(n => fs.unlinkSync(path.join(d, n))); fs.writeFileSync(path.join(d, kind + '.' + ext), buf); return kind + '.' + ext; }
  const d = dir(slug, kind), name = Date.now().toString(36) + store.rid(2) + '.' + ext; fs.writeFileSync(path.join(d, name), buf);
  const m = store.readJSON(slug, 'master.json', {}); m.photos = m.photos || {}; m.photos[kind] = list(slug, kind).map(f => f.file).filter(f => f !== name).concat(name).filter((x, i, a) => a.indexOf(x) === i); store.writeJSON(slug, 'master.json', m); return name;
}
function remove(slug, kind, file) {
  if (!kinds.includes(kind)) throw Object.assign(new Error('Неизвестный тип фото'), { status: 400 });
  if (kind === 'avatar' || kind === 'cover') { const d = dir(slug); fs.readdirSync(d).filter(n => n.startsWith(kind + '.')).forEach(n => fs.unlinkSync(path.join(d, n))); return; }
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(file || '')) throw Object.assign(new Error('Некорректное имя файла'), { status: 400 });
  const p = path.join(dir(slug, kind), file); if (fs.existsSync(p)) fs.unlinkSync(p);
  const m = store.readJSON(slug, 'master.json', {}); if (m.photos && m.photos[kind]) { m.photos[kind] = m.photos[kind].filter(f => f !== file); store.writeJSON(slug, 'master.json', m); }
}
function reorder(slug, kind, order) {
  if (!['works', 'studio'].includes(kind) || !Array.isArray(order)) throw Object.assign(new Error('Некорректный порядок'), { status: 400 });
  const have = list(slug, kind).map(f => f.file), next = order.filter(f => have.includes(f)).concat(have.filter(f => !order.includes(f)));
  const m = store.readJSON(slug, 'master.json', {}); m.photos = m.photos || {}; m.photos[kind] = next; store.writeJSON(slug, 'master.json', m);
}
function fromDataUrl(s) { const m = /^data:image\/(?:jpeg|png|webp);base64,(.+)$/.exec(s || ''); return m ? Buffer.from(m[1], 'base64') : null; }
module.exports = { save, remove, reorder, urls, list, single, fromDataUrl, sniff, EXT_OK, kinds };
