'use strict';
const fs = require('fs'), path = require('path'), store = require('./store'), auth = require('./auth'), parser = require('./parser'), photos = require('./photos'), Theme = require('../public/theme.js'), { translit, DEF_SCHEDULE } = require('./util');
function freeSlug(base) {
  let s = translit(base) || 'master'; if (!store.isSlug(s)) s = 'master-' + s; const have = store.slugList(); let c = s, i = 2;
  while (have.includes(c) || fs.existsSync(path.join(store.P.archive, c)) || !store.isSlug(c)) c = (s + '-' + i++).slice(0, 39); return c;
}
const slugState = (slug) => !slug ? 'empty' : !/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(slug) ? 'invalid' : !store.isSlug(slug) ? 'reserved' : store.slugList().includes(slug) ? 'taken' : 'ok';
let n = 0; const sid = () => 's' + Date.now().toString(36) + (n++).toString(36) + store.rid(1);
function buildServices(cats, base) { return Object.assign({}, base || {}, { categories: cats.map(c => ({ id: 'c' + sid(), name: c.name, services: c.services.map(s => ({ id: sid(), name: s.name, desc: s.desc || '', price: s.price, duration: s.duration, popular: !!s.popular, hidden: false })) })) }); }
function createMaster({ text, slug, photoList, parsed, design }) {
  const p = parsed || parser.parse(text), st = slug ? slugState(slug) : 'ok';
  if (slug && st !== 'ok') throw Object.assign(new Error({ taken: 'Такой адрес уже занят', invalid: 'Адрес: только латинские буквы, цифры и дефис', reserved: 'Этот адрес зарезервирован', empty: 'Укажите адрес' }[st]), { status: 400 });
  if (design && !Theme.DESIGNS[design]) throw Object.assign(new Error('Неизвестный вариант оформления'), { status: 400 });
  const final = slug || freeSlug(p.profile.name), dir = path.join(store.P.masters, final);
  fs.cpSync(store.P.template, dir, { recursive: true });
  const rd = (f, fb) => { try { return JSON.parse(store.stripJsonc(fs.readFileSync(path.join(dir, f), 'utf8'))); } catch { return fb; } };
  const wr = (f, d) => store.atomicWrite(path.join(dir, f), JSON.stringify(d, null, 2) + '\n');
  const m = Object.assign(rd('master.json', {}), p.profile, { createdAt: new Date().toISOString(), setupDone: false, paused: false });
  if (design) m.design = design; else m.design = Theme.design(m.design);
  wr('master.json', m); wr('services.json', buildServices(p.categories, rd('services.json', {})));
  wr('schedule.json', Object.assign(rd('schedule.json', DEF_SCHEDULE()), { week: p.schedule }));
  const token = auth.newInvite(final);
  (photoList || []).forEach(ph => { const buf = photos.fromDataUrl(ph.data); if (buf) { try { photos.save(final, ph.kind, buf); } catch (e) { p.warnings.push({ line: '', text: 'Фото пропущено: ' + e.message, hint: '', level: 'warn' }); } } });
  return { slug: final, inviteToken: token, warnings: p.warnings };
}
function archiveMaster(slug) { const d = store.masterDir(slug); if (!d) throw Object.assign(new Error('Мастер не найден'), { status: 404 }); fs.mkdirSync(store.P.archive, { recursive: true }); fs.renameSync(d, path.join(store.P.archive, slug + '-' + new Date().toISOString().replace(/[:.]/g, '-'))); }
module.exports = { createMaster, freeSlug, slugState, archiveMaster, buildServices };
