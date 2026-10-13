'use strict';
const express = require('express'), fs = require('fs'), path = require('path'), crypto = require('crypto'), archiver = require('archiver'), QRCode = require('qrcode');
const store = require('./lib/store'), auth = require('./lib/auth'), parser = require('./lib/parser'), slots = require('./lib/slots'), photos = require('./lib/photos'), notify = require('./lib/notify'), create = require('./lib/create'), U = require('./lib/util'), Theme = require('./public/theme.js');
const PUB = path.join(__dirname, 'public');
const app = express(); app.disable('x-powered-by');
const bad = (msg, status = 400) => Object.assign(new Error(msg), { status });
const wrap = fn => (req, res, next) => Promise.resolve().then(() => fn(req, res, next)).catch(next);
const cfg = () => store.readConfig() || (() => { throw bad('Платформа не настроена. Запустите start.ps1', 500); })();
const ip = req => req.socket.remoteAddress || 'x';
const isLocal = req => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
const base = req => { const c = store.readConfig() || {}; const o = req.protocol + '://' + req.get('host'); return (c.baseUrl && c.baseUrl !== 'http://localhost:3000' ? c.baseUrl : o).replace(/\/+$/, ''); };
app.use((req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'SAMEORIGIN', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'" });
  next();
});
app.use('/_fonts', express.static(path.join(PUB, 'fonts'), { maxAge: '30d', immutable: true }));
app.use('/_static', express.static(PUB, { maxAge: '5m' }));
const json = express.json({ limit: '200kb' });

/* ---------- HTML ---------- */
function shell(o) {
  const boot = JSON.stringify(o.boot || {}).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover"><title>${U.esc(o.title)}</title>${o.desc ? `<meta name="description" content="${U.esc(o.desc)}">` : ''}${o.robots ? '<meta name="robots" content="noindex,nofollow">' : ''}${o.og || ''}<meta name="theme-color" content="${o.color || '#fbf3f2'}"><link rel="icon" href="/_static/favicon.svg"><link rel="stylesheet" href="/_static/app.css"><style id="theme">${o.themeCss || Theme.css('rose')}</style></head><body><div id="app">${o.body || ''}</div><script type="application/json" id="boot">${boot}</script><script src="/_static/theme.js"></script>${(o.scripts || []).map(s => `<script src="/_static/js/${s}.js"></script>`).join('')}</body></html>`;
}
const noPage = (res, code, title, text) => res.status(code).type('html').send(shell({ title, robots: 1, body: `<div class="stub"><div class="stub-ring"></div><h1>${U.esc(title)}</h1><p>${U.esc(text)}</p></div>` }));
app.get('/', (req, res) => noPage(res, 200, (store.readConfig() || {}).platformName || 'Beauty Agent', 'Онлайн-запись к мастерам. Откройте ссылку, которую вам прислал мастер.'));
app.get('/health', (req, res) => res.json({ ok: true }));

/* ---------- Photos ---------- */
app.get('/photos/:slug/*', (req, res) => {
  const dir = store.masterDir(req.params.slug); if (!dir) return res.status(404).end();
  const parts = req.params[0].split('/'), ok = n => /^[a-z0-9][a-z0-9._-]*$/i.test(n) && photos.EXT_OK.test(n);
  let rel; if (parts.length === 1 && /^(avatar|cover)\./.test(parts[0]) && ok(parts[0])) rel = parts[0]; else if (parts.length === 2 && ['works', 'studio'].includes(parts[0]) && ok(parts[1])) rel = parts.join('/'); else return res.status(404).end();
  const root = path.join(dir, 'photos'), f = path.join(root, rel); if (!f.startsWith(root + path.sep) || !fs.existsSync(f)) return res.status(404).end();
  if (/\.svg$/i.test(f)) res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
  res.sendFile(f, { maxAge: '1h' });
});

/* ---------- Helpers: masters ---------- */
const readM = slug => store.readJSON(slug, 'master.json', {});
const readSvc = slug => store.readJSON(slug, 'services.json', { categories: [] });
const readSch = slug => store.readJSON(slug, 'schedule.json', U.DEF_SCHEDULE());
const readBk = slug => store.readJSON(slug, 'bookings.json', { items: [] });
const readRev = slug => store.readJSON(slug, 'reviews.json', { items: [] });
const saveBk = (slug, d) => { d.items.sort((a, b) => (a.date + U.p2(a.start / 60 | 0) + U.p2(a.start % 60)).localeCompare(b.date + U.p2(b.start / 60 | 0) + U.p2(b.start % 60))); store.writeJSON(slug, 'bookings.json', d); };
function schedText(sch) {
  return U.DAYS.map(d => { const x = sch.week[d] || {}; const iv = (x.intervals || []).map(i => `${i.from}–${i.to}`).join(', '); const br = (x.breaks || []).map(b => `${b.from}–${b.to}`).join(', ');
    return { id: d, label: U.DAY_RU[d], short: U.DAY_SH[d], off: !iv, text: iv ? iv + (br ? ` (перерыв ${br})` : '') : 'выходной' }; });
}
function ratingOf(items) { const v = items.filter(r => !r.hidden); return { count: v.length, avg: v.length ? Math.round(v.reduce((a, r) => a + r.rating, 0) / v.length * 10) / 10 : 0 }; }
function pubMaster(slug, req) {
  const m = readM(slug), svc = readSvc(slug), sch = readSch(slug), revs = readRev(slug).items, c = cfg();
  return { slug, platformName: c.platformName, name: m.name || 'Мастер', specialty: m.specialty || '', address: m.address || '', about: m.about || '', phone: m.phone || '', instagram: m.instagram || '', telegram: m.telegram || '', whatsapp: m.whatsapp || '', vk: m.vk || '', map: m.map || '',
    theme: m.theme || 'rose', accent: m.accent || '', design: Theme.design(m.design), paused: !!m.paused, photos: photos.urls(slug), rating: ratingOf(revs), week: schedText(sch), horizonDays: sch.horizonDays,
    categories: (svc.categories || []).map(c => ({ id: c.id, name: c.name, services: (c.services || []).filter(s => !s.hidden).map(s => ({ id: s.id, name: s.name, desc: s.desc || '', price: s.price, duration: s.duration, popular: !!s.popular })) })).filter(c => c.services.length) };
}
function servicesByIds(slug, ids, allowHidden) {
  const map = {}; (readSvc(slug).categories || []).forEach(c => (c.services || []).forEach(s => { if (allowHidden || !s.hidden) map[s.id] = s; }));
  if (!Array.isArray(ids) || !ids.length || ids.length > 10) throw bad('Выберите хотя бы одну услугу');
  return [...new Set(ids)].map(id => { const s = map[id]; if (!s) throw bad('Одной из выбранных услуг больше нет. Обновите страницу.', 409); return { id: s.id, name: s.name, price: s.price, duration: s.duration }; });
}
const sumOf = list => ({ total: list.reduce((a, s) => a + s.price, 0), duration: list.reduce((a, s) => a + s.duration, 0) });
function cleanClient(name, phone) {
  name = String(name || '').replace(/\s+/g, ' ').trim(); if (name.length < 2 || name.length > 60) throw bad('Введите имя (от 2 до 60 символов)');
  const p = U.normPhone(phone); if (!p.ok) throw bad('Введите телефон полностью, например +7 900 000-00-00'); return { name, phone: p.pretty };
}
const utmOf = u => { u = u || {}; const o = {}; ['utm_source', 'utm_medium', 'utm_content'].forEach(k => { if (u[k]) o[k] = String(u[k]).slice(0, 80); }); return o; };
const bView = (slug, m, b) => { const now = slots.nowLocal(m.timezone), past = b.date < now.date || (b.date === now.date && b.start < now.minutes); return { id: b.id, status: b.status, date: b.date, time: U.fromMin(b.start), duration: b.duration, total: b.total, services: b.services, client: { name: b.client.name }, master: { slug, name: m.name, address: m.address, phone: m.phone }, canChange: b.status === 'booked' && !past, canReview: b.status === 'came' && !b.reviewId, reviewed: !!b.reviewId, theme: m.theme, accent: m.accent }; };
const findByToken = (slug, token) => { const d = readBk(slug), b = d.items.find(x => x.token === token); if (!b) throw bad('Запись не найдена. Возможно, ссылка устарела.', 404); return { d, b }; };
function checkMaster(req) { const slug = req.params.slug; if (!store.masterDir(slug)) throw bad('Мастер не найден', 404); return slug; }

/* ---------- Public API ---------- */
const PA = express.Router({ mergeParams: true }); app.use('/api/m/:slug', PA); PA.use(json);
PA.use((req, res, next) => { if (!auth.limiter('pub:' + ip(req), 400, 600000)) return next(bad('Слишком много запросов. Подождите немного.', 429)); checkMaster(req); next(); });
PA.get('/', (req, res) => res.json(pubMaster(req.params.slug, req)));
const durOf = (slug, req) => { if (req.query.token) { const { b } = findByToken(slug, String(req.query.token)); return { duration: b.duration, exclude: b.id }; } return { duration: sumOf(servicesByIds(slug, String(req.query.services || '').split(',').filter(Boolean))).duration, exclude: null }; };
PA.get('/days', (req, res) => {
  const slug = req.params.slug, m = readM(slug), sch = readSch(slug), { duration, exclude } = durOf(slug, req), now = slots.nowLocal(m.timezone);
  const items = readBk(slug).items.filter(x => x.id !== exclude);
  res.json({ days: slots.availableDays(m, sch, items, duration, req.query.from, (+sch.horizonDays || 60) + 1), today: now.date, horizon: +sch.horizonDays || 60 });
});
PA.get('/slots', (req, res) => {
  const slug = req.params.slug, m = readM(slug), { duration, exclude } = durOf(slug, req);
  res.json({ slots: slots.getSlots(m, readSch(slug), readBk(slug).items, String(req.query.date), duration, exclude) });
});
PA.post('/book', wrap(async (req, res) => {
  const slug = req.params.slug, b = req.body || {};
  if (!auth.limiter('book:' + ip(req), 8, 600000)) throw bad('Слишком много попыток записи. Попробуйте позже.', 429);
  const out = await store.locked(slug, () => {
    const m = readM(slug); if (m.paused) throw bad('Запись у мастера временно недоступна', 403);
    if (b.consent !== true) throw bad('Нужно согласие на обработку персональных данных');
    const client = cleanClient(b.name, b.phone), list = servicesByIds(slug, b.services), { total, duration } = sumOf(list), comment = String(b.comment || '').trim().slice(0, 500);
    const d = readBk(slug), free = slots.getSlots(m, readSch(slug), d.items, String(b.date), duration);
    if (!free.includes(String(b.time))) throw bad('Это время уже занято или недоступно. Выберите другое.', 409);
    const bk = { id: 'b' + store.rid(4), token: crypto.randomBytes(18).toString('base64url'), status: 'booked', date: b.date, start: U.toMin(b.time), duration, services: list, total, client, comment, utm: utmOf(b.utm), createdAt: new Date().toISOString(), source: 'online' };
    d.items.push(bk); saveBk(slug, d); return { bk, m };
  });
  notify.send(out.m, notify.bookingText('new', out.bk));
  res.json({ ok: true, token: out.bk.token, booking: bView(slug, out.m, out.bk), manageUrl: `${base(req)}/${slug}/b/${out.bk.token}` });
}));
PA.get('/booking/:token', (req, res) => { const slug = req.params.slug; const { b } = findByToken(slug, req.params.token); res.json(bView(slug, readM(slug), b)); });
PA.get('/booking/:token/ics', (req, res) => { const slug = req.params.slug, { b } = findByToken(slug, req.params.token); res.type('text/calendar; charset=utf-8').set('Content-Disposition', 'attachment; filename="zapis.ics"').send(notify.ics(readM(slug), b)); });
PA.post('/booking/:token/cancel', wrap(async (req, res) => {
  const slug = req.params.slug, r = await store.locked(slug, () => { const { d, b } = findByToken(slug, req.params.token), m = readM(slug); if (!bView(slug, m, b).canChange) throw bad('Эту запись уже нельзя изменить'); b.status = 'canceled'; b.canceledBy = 'client'; saveBk(slug, d); return { b, m }; });
  notify.send(r.m, notify.bookingText('cancel', r.b)); res.json(bView(slug, r.m, r.b));
}));
PA.post('/booking/:token/move', wrap(async (req, res) => {
  const slug = req.params.slug, r = await store.locked(slug, () => {
    const { d, b } = findByToken(slug, req.params.token), m = readM(slug); if (!bView(slug, m, b).canChange) throw bad('Эту запись уже нельзя изменить');
    const free = slots.getSlots(m, readSch(slug), d.items, String(req.body.date), b.duration, b.id); if (!free.includes(String(req.body.time))) throw bad('Это время недоступно. Выберите другое.', 409);
    b.date = req.body.date; b.start = U.toMin(req.body.time); saveBk(slug, d); return { b, m };
  });
  notify.send(r.m, notify.bookingText('move', r.b)); res.json(bView(slug, r.m, r.b));
}));
PA.post('/booking/:token/review', wrap(async (req, res) => {
  const slug = req.params.slug, rating = Math.round(+req.body.rating), text = String(req.body.text || '').trim().slice(0, 600); if (!(rating >= 1 && rating <= 5)) throw bad('Поставьте оценку от 1 до 5');
  const r = await store.locked(slug, () => { const { d, b } = findByToken(slug, req.params.token), m = readM(slug); if (!bView(slug, m, b).canReview) throw bad('Отзыв можно оставить только после визита, один раз');
    const rv = readRev(slug), id = 'r' + store.rid(3); rv.items.unshift({ id, name: b.client.name.split(' ')[0], rating, text, date: new Date().toISOString().slice(0, 10), reply: '', replyDate: '', hidden: false, bookingId: b.id }); store.writeJSON(slug, 'reviews.json', rv); b.reviewId = id; saveBk(slug, d); return { b, m }; });
  notify.send(r.m, `⭐ Новый отзыв (${rating}/5) от ${r.b.client.name}${text ? ':\n' + text : ''}`); res.json(bView(slug, r.m, r.b));
}));
PA.get('/reviews', (req, res) => res.json({ items: readRev(req.params.slug).items.filter(r => !r.hidden).map(r => ({ name: r.name, rating: r.rating, text: r.text, date: r.date, reply: r.reply, replyDate: r.replyDate })), rating: ratingOf(readRev(req.params.slug).items) }));
PA.get('/qr.svg', wrap(async (req, res) => { const svg = await QRCode.toString(`${base(req)}/${req.params.slug}`, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }); res.type('image/svg+xml').send(svg); }));

/* ---------- Master pages ---------- */
function masterShell(slug, req, kind) {
  const m = readM(slug), c = cfg(), pm = pubMaster(slug, req), url = `${base(req)}/${slug}`, img = pm.photos.avatar ? base(req) + pm.photos.avatar : '';
  const title = kind === 'reviews' ? `Отзывы — ${m.name}` : kind === 'services' ? `Услуги и цены — ${m.name}` : `${m.name}${m.specialty ? ' — ' + m.specialty : ''} · онлайн-запись`;
  const desc = (m.about || `Онлайн-запись к мастеру ${m.name}. Выберите услугу, дату и время.`).slice(0, 180);
  const og = `<meta property="og:type" content="website"><meta property="og:title" content="${U.esc(title)}"><meta property="og:description" content="${U.esc(desc)}"><meta property="og:url" content="${U.esc(url)}"><meta property="og:site_name" content="${U.esc(c.platformName)}">${img ? `<meta property="og:image" content="${U.esc(img)}"><meta name="twitter:card" content="summary">` : ''}`;
  const pal = Theme.palette(m.theme, m.accent);
  return shell({ title, desc, og, themeCss: Theme.css(m.theme, m.accent), color: pal.bg, scripts: ['common', 'page'], boot: { slug, kind, platformName: c.platformName, design: pm.design }, body: '<div class="skeleton-page"><div class="sk sk-cover"></div><div class="sk sk-ava"></div><div class="sk sk-line"></div><div class="sk sk-line s"></div><div class="sk sk-card"></div><div class="sk sk-card"></div></div>' });
}
const pageRoute = kind => wrap((req, res) => { const slug = req.params.slug; if (!store.masterDir(slug)) return noPage(res, 404, 'Страница не найдена', 'Проверьте ссылку или уточните её у мастера.'); try { res.type('html').send(masterShell(slug, req, kind)); } catch (e) { if (e.code === 'BROKEN_JSON') return noPage(res, 503, 'Страница временно недоступна', 'Мастер скоро всё исправит. Попробуйте зайти позже.'); throw e; } });
app.get('/:slug/admin', wrap((req, res, next) => adminPage(req, res, next)));
app.get('/:slug/admin/*', wrap((req, res, next) => adminPage(req, res, next)));
function adminPage(req, res) {
  const slug = req.params.slug; if (!store.masterDir(slug)) return noPage(res, 404, 'Страница не найдена', 'Проверьте ссылку.');
  let m = {}; try { m = readM(slug); } catch { }
  res.set('Cache-Control', 'no-store').type('html').send(shell({ title: 'Кабинет — ' + (m.name || 'мастер'), robots: 1, themeCss: Theme.css(m.theme, m.accent), color: Theme.palette(m.theme, m.accent).bg, scripts: ['common', 'admin'], boot: { slug, platformName: (store.readConfig() || {}).platformName || '' }, body: '<div class="skeleton-page"><div class="sk sk-line"></div><div class="sk sk-card"></div></div>' }));
}
app.get('/:slug/services', pageRoute('services')); app.get('/:slug/reviews', pageRoute('reviews')); app.get('/:slug/b/:token', pageRoute('booking')); app.get('/:slug', (req, res, next) => store.isSlug(req.params.slug) || req.params.slug === 'platform' ? (req.params.slug === 'platform' ? next('route') : pageRoute('home')(req, res, next)) : noPage(res, 404, 'Страница не найдена', 'Проверьте ссылку.'));

/* ---------- Admin API ---------- */
const AA = express.Router({ mergeParams: true }); app.use('/api/a/:slug', AA); AA.use(json);
AA.use((req, res, next) => { if (!auth.limiter('adm:' + ip(req), 600, 600000)) return next(bad('Слишком много запросов', 429)); checkMaster(req); next(); });
AA.get('/invite', (req, res) => { const st = auth.inviteState(req.params.slug, String(req.query.token || '')); res.json({ state: st, name: st === 'ok' ? readM(req.params.slug).name : '' }); });
AA.post('/invite/accept', wrap(async (req, res) => {
  const slug = req.params.slug, err = auth.checkPassword(req.body.password);
  if (!auth.limiter('inv:' + ip(req), 10, 600000)) throw bad('Слишком много попыток', 429);
  await store.locked(slug, () => { if (auth.inviteState(slug, String(req.body.token || '')) !== 'ok') throw bad('Ссылка недействительна или уже использована. Попросите новую.', 410); if (err) throw bad(err); const a = store.readJSON(slug, 'auth.json', {}); a.passwordHash = auth.hashPassword(req.body.password); a.invite = null; store.writeJSON(slug, 'auth.json', a, { noBackup: true }); });
  const s = auth.createSession(slug); auth.setCookie(res, req, 'ma_' + slug, s.id, 30 * 86400); res.json({ ok: true, csrf: s.csrf });
}));
AA.post('/login', wrap(async (req, res) => {
  const slug = req.params.slug, key = 'login:' + slug + ':' + ip(req), wait = auth.failState(key); if (wait) throw bad(`Слишком много попыток. Подождите ${wait} мин. и попробуйте снова.`, 429);
  const a = store.readJSON(slug, 'auth.json', {}); if (!a.passwordHash) throw bad('Кабинет ещё не активирован. Откройте ссылку-приглашение, которую прислал администратор.', 403);
  if (!auth.verifyPassword(String(req.body.password || ''), a.passwordHash)) { auth.addFail(key); throw bad('Неверный пароль', 401); }
  auth.clearFail(key); const s = auth.createSession(slug); auth.setCookie(res, req, 'ma_' + slug, s.id, 30 * 86400); res.json({ ok: true, csrf: s.csrf });
}));
AA.use((req, res, next) => { const s = auth.getSession(req, req.params.slug); if (!s) return next(Object.assign(bad('Нужно войти в кабинет', 401), { code: 'AUTH' })); if (req.method !== 'GET' && req.get('x-csrf') !== s.csrf) return next(bad('Сессия устарела. Обновите страницу.', 403)); req.sess = s; next(); });
AA.post('/logout', (req, res) => { auth.destroySession(req, req.params.slug); auth.setCookie(res, req, 'ma_' + req.params.slug, '', 0); res.json({ ok: true }); });
const adminProfile = m => { const o = Object.assign({}, m); delete o.telegramToken; delete o._подсказка; o.telegramTokenSet = !!m.telegramToken; o.telegramTokenMask = m.telegramToken ? m.telegramToken.slice(0, 4) + '…' + m.telegramToken.slice(-4) : ''; return o; };
AA.get('/me', (req, res) => { const slug = req.params.slug; res.json({ csrf: req.sess.csrf, profile: adminProfile(readM(slug)), pageUrl: `${base(req)}/${slug}`, platformName: cfg().platformName, presets: Object.fromEntries(Object.entries(Theme.PRESETS).map(([k, v]) => [k, { name: v.name, accent: v.accent }])), designs: Theme.DESIGNS }); });
const str = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
AA.put('/profile', wrap(async (req, res) => {
  const slug = req.params.slug, b = req.body || {};
  const r = await store.locked(slug, () => {
    const m = readM(slug), o = {};
    if ('name' in b) { o.name = str(b.name, 60); if (o.name.length < 2) throw bad('Введите имя (минимум 2 символа)'); }
    ['specialty', 'address'].forEach(k => { if (k in b) o[k] = str(b[k], 120); }); if ('about' in b) o.about = String(b.about || '').replace(/[\u0000-\u0008]/g, '').trim().slice(0, 1200);
    if ('phone' in b) { const v = str(b.phone, 30); if (v) { const p = U.normPhone(v); if (!p.ok) throw bad('Телефон выглядит неполным'); o.phone = p.pretty; } else o.phone = ''; }
    if ('whatsapp' in b) { const v = str(b.whatsapp, 30); if (v) { const p = U.normPhone(v); if (!p.ok) throw bad('Номер WhatsApp выглядит неполным'); o.whatsapp = p.digits; } else o.whatsapp = ''; }
    ['instagram', 'telegram', 'vk'].forEach(k => { if (k in b) { const v = str(b[k], 60).replace(/^https?:\/\/(www\.)?(instagram\.com|t\.me|vk\.com)\//i, '').replace(/[?#].*$/, '').replace(/^@/, '').replace(/\/+$/, ''); if (v && !/^[A-Za-z0-9._-]+$/.test(v)) throw bad('Имя в соцсети «' + k + '»: только латиница, цифры, точка, дефис, подчёркивание'); o[k] = v; } });
    if ('map' in b) { const v = str(b.map, 500); if (v && !/^https?:\/\/[^\s]+$/i.test(v)) throw bad('Ссылка на карту должна начинаться с http'); o.map = v; }
    if ('theme' in b) { if (!Theme.PRESETS[b.theme]) throw bad('Неизвестная тема'); o.theme = b.theme; }
    if ('design' in b) { if (!Theme.DESIGNS[b.design]) throw bad('Неизвестный вариант оформления'); o.design = b.design; }
    if ('accent' in b) { const v = str(b.accent, 9); if (v && !Theme.validHex(v)) throw bad('Цвет должен быть вида #d94f87'); o.accent = v ? '#' + v.replace('#', '').toLowerCase() : ''; }
    if ('timezone' in b) { try { new Intl.DateTimeFormat('en', { timeZone: b.timezone }); } catch { throw bad('Неизвестный часовой пояс'); } o.timezone = b.timezone; }
    if ('telegramToken' in b && b.telegramToken !== null) { const v = str(b.telegramToken, 80); if (v && !/^\d{5,}:[A-Za-z0-9_-]{20,}$/.test(v)) throw bad('Токен бота выглядит неверно. Он имеет вид 123456789:AAH...'); o.telegramToken = v; }
    if ('telegramChatId' in b) { const v = str(b.telegramChatId, 20); if (v && !/^-?\d+$/.test(v)) throw bad('Chat id — это число'); o.telegramChatId = v; }
    if ('setupDone' in b) o.setupDone = !!b.setupDone;
    const next = Object.assign({}, m, o); store.writeJSON(slug, 'master.json', next); return next;
  });
  res.json({ profile: adminProfile(r) });
}));
AA.post('/password', wrap(async (req, res) => {
  const slug = req.params.slug, e = auth.checkPassword(req.body.next); const key = 'pw:' + slug + ':' + ip(req);
  if (auth.failState(key)) throw bad('Слишком много попыток. Подождите несколько минут.', 429);
  await store.locked(slug, () => { const a = store.readJSON(slug, 'auth.json', {}); if (!auth.verifyPassword(String(req.body.current || ''), a.passwordHash)) { auth.addFail(key); throw bad('Текущий пароль неверный'); } if (e) throw bad(e); a.passwordHash = auth.hashPassword(req.body.next); store.writeJSON(slug, 'auth.json', a, { noBackup: true }); }); res.json({ ok: true });
}));
let idn = 0; const nid = p => p + Date.now().toString(36) + (idn++).toString(36) + store.rid(1);
function cleanServices(body, existing) {
  if (!body || !Array.isArray(body.categories)) throw bad('Некорректный список услуг'); if (body.categories.length > 20) throw bad('Слишком много категорий (максимум 20)');
  let total = 0; const names = new Set(), ids = new Set();
  const cats = body.categories.map(c => {
    const name = str(c.name, 40); if (!name) throw bad('У категории должно быть название'); if (names.has(name.toLowerCase())) throw bad('Категория «' + name + '» повторяется'); names.add(name.toLowerCase());
    const id = c.id && !ids.has(c.id) ? str(c.id, 40) : nid('c'); ids.add(id);
    return { id, name, services: (c.services || []).map(s => {
      const nm = str(s.name, 90); if (!nm) throw bad('У услуги в категории «' + name + '» нет названия'); const price = Math.round(+s.price), dur = Math.round(+s.duration);
      if (!(price >= 0 && price <= 1000000)) throw bad('Цена услуги «' + nm + '» указана неверно'); if (!(dur >= 5 && dur <= 720)) throw bad('Длительность услуги «' + nm + '» должна быть от 5 минут до 12 часов');
      const sid = s.id && !ids.has(s.id) ? str(s.id, 40) : nid('s'); ids.add(sid); total++;
      return { id: sid, name: nm, desc: str(s.desc, 300), price, duration: dur, popular: !!s.popular, hidden: !!s.hidden }; }) };
  });
  if (total > 200) throw bad('Слишком много услуг (максимум 200)'); return Object.assign({}, existing, { categories: cats });
}
AA.get('/services', (req, res) => res.json({ categories: readSvc(req.params.slug).categories || [] }));
AA.put('/services', wrap(async (req, res) => { const slug = req.params.slug; const d = await store.locked(slug, () => { const ex = (() => { try { return readSvc(slug); } catch { return {}; } })(); const n = cleanServices(req.body, ex); store.writeJSON(slug, 'services.json', n); return n; }); res.json({ categories: d.categories }); }));
AA.post('/services/parse', (req, res) => { const p = parser.parse(String(req.body.text || '').slice(0, 30000), { servicesOnly: true }); res.json({ categories: p.categories, warnings: p.warnings }); });
AA.get('/schedule', (req, res) => { const slug = req.params.slug, s = readSch(slug); res.json({ schedule: s, today: slots.nowLocal(readM(slug).timezone).date }); });
AA.put('/schedule', wrap(async (req, res) => {
  const slug = req.params.slug, b = req.body || {}; const r = await store.locked(slug, () => {
    const ex = readSch(slug), s = Object.assign({}, ex, { slotStep: +b.slotStep, minNoticeHours: +b.minNoticeHours, horizonDays: +b.horizonDays, week: b.week, special: b.special || {} });
    U.DAYS.forEach(d => { const w = (b.week || {})[d] || {}; s.week[d] = { intervals: (w.intervals || []).map(i => ({ from: str(i.from, 5), to: str(i.to, 5) })), breaks: (w.breaks || []).map(i => ({ from: str(i.from, 5), to: str(i.to, 5) })) }; });
    Object.keys(s.special).forEach(k => { const w = s.special[k] || {}; s.special[k] = w.off ? { off: true } : { intervals: (w.intervals || []).map(i => ({ from: str(i.from, 5), to: str(i.to, 5) })), breaks: (w.breaks || []).map(i => ({ from: str(i.from, 5), to: str(i.to, 5) })) }; });
    const e = slots.validateSchedule(s); if (e) throw bad(e); store.writeJSON(slug, 'schedule.json', s);
    return { schedule: s, conflicts: slots.findConflicts(readM(slug), s, readBk(slug).items) };
  }); res.json(r);
}));
AA.get('/slots', (req, res) => { const slug = req.params.slug, d = readBk(slug); const dur = +req.query.duration || 60; res.json({ slots: slots.getSlots(readM(slug), readSch(slug), d.items, String(req.query.date), dur, req.query.exclude) }); });
AA.get('/bookings', (req, res) => { const slug = req.params.slug, m = readM(slug), now = slots.nowLocal(m.timezone); res.json({ today: now.date, nowMin: now.minutes, items: readBk(slug).items.slice(-1500) }); });
AA.post('/bookings', wrap(async (req, res) => {
  const slug = req.params.slug, b = req.body || {}; const bk = await store.locked(slug, () => {
    const m = readM(slug), client = { name: str(b.name, 60), phone: str(b.phone, 30) }; if (client.name.length < 2) throw bad('Введите имя клиента');
    if (client.phone) { const p = U.normPhone(client.phone); if (!p.ok) throw bad('Телефон выглядит неполным'); client.phone = p.pretty; }
    let list; if (Array.isArray(b.services) && b.services.length) list = servicesByIds(slug, b.services, true); else { const price = Math.round(+b.price || 0), dur = Math.round(+b.duration || 0); if (!(dur >= 5 && dur <= 720)) throw bad('Выберите услугу или укажите длительность'); list = [{ id: 'custom', name: str(b.title, 90) || 'Запись', price, duration: dur }]; }
    if (!slots.parseDate(b.date) || !/^\d{1,2}:\d{2}$/.test(b.time || '')) throw bad('Укажите дату и время');
    const { total, duration } = sumOf(list), start = U.toMin(b.time), d = readBk(slug), over = d.items.filter(x => x.date === b.date && x.status !== 'canceled' && slots.clash(start, start + duration, x.start, x.start + x.duration));
    if (over.length && !b.force) throw Object.assign(bad('Это время пересекается с другой записью: ' + over.map(o => `${U.fromMin(o.start)} ${o.client.name}`).join(', '), 409), { code: 'OVERLAP' });
    const bk = { id: 'b' + store.rid(4), token: crypto.randomBytes(18).toString('base64url'), status: 'booked', date: b.date, start, duration, services: list, total, client, comment: str(b.comment, 500), utm: {}, createdAt: new Date().toISOString(), source: 'manual' };
    d.items.push(bk); saveBk(slug, d); return bk;
  }); res.json({ booking: bk });
}));
AA.patch('/bookings/:id', wrap(async (req, res) => {
  const slug = req.params.slug, b = req.body || {}; const out = await store.locked(slug, () => {
    const d = readBk(slug), x = d.items.find(i => i.id === req.params.id); if (!x) throw bad('Запись не найдена', 404);
    if (b.status) { if (!['booked', 'canceled', 'came', 'noshow'].includes(b.status)) throw bad('Неизвестный статус'); x.status = b.status; if (b.status === 'canceled') x.canceledBy = 'master'; }
    if (b.date || b.time) { const date = b.date || x.date, start = b.time ? U.toMin(b.time) : x.start; if (!slots.parseDate(date) || isNaN(start)) throw bad('Укажите дату и время');
      const over = d.items.filter(o => o.id !== x.id && o.date === date && o.status !== 'canceled' && slots.clash(start, start + x.duration, o.start, o.start + o.duration)); if (over.length && !b.force) throw Object.assign(bad('Это время пересекается с другой записью: ' + over.map(o => `${U.fromMin(o.start)} ${o.client.name}`).join(', '), 409), { code: 'OVERLAP' });
      x.date = date; x.start = start; if (x.status === 'canceled') x.status = 'booked'; }
    saveBk(slug, d); return x;
  }); res.json({ booking: out });
}));
AA.get('/reviews', (req, res) => res.json({ items: readRev(req.params.slug).items }));
AA.put('/reviews/:id', wrap(async (req, res) => { const slug = req.params.slug; const r = await store.locked(slug, () => { const d = readRev(slug), x = d.items.find(i => i.id === req.params.id); if (!x) throw bad('Отзыв не найден', 404); if ('reply' in req.body) { x.reply = str(req.body.reply, 600); x.replyDate = x.reply ? new Date().toISOString().slice(0, 10) : ''; } if ('hidden' in req.body) x.hidden = !!req.body.hidden; store.writeJSON(slug, 'reviews.json', d); return x; }); res.json({ item: r }); }));
AA.get('/photos', (req, res) => res.json(photos.urls(req.params.slug)));
AA.post('/photos/:kind', express.raw({ type: () => true, limit: '9mb' }), wrap(async (req, res) => { const slug = req.params.slug; await store.locked(slug, () => photos.save(slug, req.params.kind, Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0))); res.json(photos.urls(slug)); }));
AA.put('/photos-order', wrap(async (req, res) => { const slug = req.params.slug; await store.locked(slug, () => photos.reorder(slug, req.body.kind, req.body.order)); res.json(photos.urls(slug)); }));
AA.delete('/photos/:kind/:file?', wrap(async (req, res) => { const slug = req.params.slug; await store.locked(slug, () => photos.remove(slug, req.params.kind, req.params.file)); res.json(photos.urls(slug)); }));
AA.post('/telegram/detect', wrap(async (req, res) => { const m = readM(req.params.slug), token = str(req.body.token, 80) || m.telegramToken; if (!token) throw bad('Сначала вставьте токен бота'); let id; try { id = await notify.detectChat(token); } catch (e) { throw bad('Telegram не принял токен: ' + e.message); } if (!id) throw bad('Откройте своего бота в Telegram и нажмите «Запустить» (/start), затем повторите.'); res.json({ chatId: id }); }));
AA.post('/telegram/test', wrap(async (req, res) => { const m = readM(req.params.slug); if (!m.telegramToken || !m.telegramChatId) throw bad('Сначала сохраните токен и chat id'); const ok = await notify.send(m, `Тест: уведомления подключены. Сюда будут приходить новые записи ${m.name ? 'мастера ' + m.name : ''}.`); if (!ok) throw bad('Не удалось отправить. Проверьте токен и что вы нажали «Запустить» у бота.'); res.json({ ok: true }); }));
const UNDOABLE = ['services.json', 'schedule.json', 'master.json', 'reviews.json'];
AA.post('/undo', wrap(async (req, res) => { const f = req.body.file; if (!UNDOABLE.includes(f)) throw bad('Нельзя отменить этот файл'); await store.locked(req.params.slug, () => store.undoFile(req.params.slug, f)); res.json({ ok: true }); }));
AA.post('/restore', wrap(async (req, res) => { const f = req.body.file; if (!store.FILES.includes(f) || f === 'auth.json') throw bad('Нельзя восстановить этот файл'); const ok = await store.locked(req.params.slug, () => store.restoreBroken(req.params.slug, f)); if (!ok) throw bad('Подходящей копии не нашлось. Обратитесь к администратору.'); res.json({ ok: true }); }));

/* ---------- Platform ---------- */
const PL = express.Router(); app.use('/api/p', PL); PL.use(express.json({ limit: '60mb' }));
function plGuard(req, res, next) { if (!isLocal(req) && !cfg().allowExternal) return next(bad('Панель доступна только с компьютера, на котором запущена платформа.', 403)); next(); }
PL.use(plGuard);
PL.post('/login', wrap(async (req, res) => {
  const key = 'pl:' + ip(req), wait = auth.failState(key); if (wait) throw bad(`Слишком много попыток. Подождите ${wait} мин.`, 429);
  if (!auth.verifyPassword(String(req.body.password || ''), cfg().passwordHash)) { auth.addFail(key); throw bad('Неверный пароль платформы', 401); }
  auth.clearFail(key); const s = auth.pCreate(); auth.setCookie(res, req, 'pf', s.id, 86400); res.json({ ok: true, csrf: s.csrf });
}));
PL.use((req, res, next) => { const s = auth.pGet(req); if (!s) return next(Object.assign(bad('Нужно войти', 401), { code: 'AUTH' })); if (req.method !== 'GET' && req.get('x-csrf') !== s.csrf) return next(bad('Сессия устарела. Обновите страницу.', 403)); req.sess = s; next(); });
PL.get('/me', (req, res) => { const c = cfg(); res.json({ csrf: req.sess.csrf, platformName: c.platformName, baseUrl: base(req), allowExternal: !!c.allowExternal, demoPassword: require('./lib/demo').DEMO_PASSWORD, example: require('./lib/demo').A, designs: Theme.DESIGNS }); });
PL.post('/logout', (req, res) => { auth.pDestroy(req); auth.setCookie(res, req, 'pf', '', 0); res.json({ ok: true }); });
PL.put('/settings', wrap(async (req, res) => { const c = store.readConfig(), b = req.body || {}; if ('baseUrl' in b) { const v = str(b.baseUrl, 200).replace(/\/+$/, ''); if (v && !/^https?:\/\/[^\s]+$/i.test(v)) throw bad('Адрес сайта должен начинаться с http:// или https://'); c.baseUrl = v || 'http://localhost:3000'; } if ('platformName' in b) c.platformName = str(b.platformName, 40) || 'Beauty Agent'; store.writeConfig(c); res.json({ ok: true }); }));
const split = text => String(text || '').split(/^[ \t]*-{3,}[ \t]*$/m).map(s => s.trim()).filter(Boolean);
PL.get('/slug-check', (req, res) => res.json({ state: create.slugState(String(req.query.slug || '')) }));
PL.post('/parse', (req, res) => {
  const blocks = split(String(req.body.text || '').slice(0, 200000)); if (!blocks.length) throw bad('Вставьте текст анкеты');
  res.json({ items: blocks.map((t, i) => { const p = parser.parse(t); const sug = create.freeSlug(p.profile.name); return { profile: p.profile, categories: p.categories, schedule: p.schedule, warnings: p.warnings, slug: sug, scheduleDefault: !!p.scheduleDefault }; }) });
});
const msgFor = (name, url, inv) => `Здравствуйте, ${name}!\n\nВаша страница онлайн-записи готова:\n${url}\n\nЛичный кабинет (ссылка одноразовая, действует 7 дней — откройте её и придумайте пароль):\n${inv}\n\nЧто сделать в кабинете, лучше с телефона:\n1. Проверьте профиль и добавьте фото.\n2. Проверьте услуги, цены и длительность.\n3. Проверьте график работы.\n4. Подключите уведомления в Telegram — новые записи будут приходить вам в чат.\n\nПотом заходите в кабинет по ссылке: ${url}/admin`;
const created = (req, r) => { const b = base(req), m = readM(r.slug), url = `${b}/${r.slug}`, inv = `${b}/${r.slug}/admin/invite/${r.inviteToken}`; return { slug: r.slug, name: m.name, url, inviteUrl: inv, message: msgFor(m.name, url, inv), warnings: r.warnings }; };
PL.post('/create', wrap(async (req, res) => {
  const blocks = split(req.body.text); if (!blocks.length) throw bad('Вставьте текст анкеты'); const out = [];
  for (let i = 0; i < blocks.length; i++) out.push(created(req, create.createMaster({ text: blocks[i], slug: blocks.length === 1 && req.body.slug ? String(req.body.slug) : undefined, photoList: blocks.length === 1 ? req.body.photos : [], design: Array.isArray(req.body.designs) ? String(req.body.designs[i] || '') : (blocks.length === 1 ? String(req.body.design || '') : '') })));
  res.json({ created: out });
}));
function listMasters(req) {
  return store.slugList().map(slug => { let m = {}, a = {}, n = 0, broken = null; try { m = readM(slug); a = store.readJSON(slug, 'auth.json', {}); n = readBk(slug).items.length; } catch (e) { broken = e.file || 'файл'; }
    const inv = a.passwordHash ? 'accepted' : (a.invite && a.invite.expires > Date.now() ? 'pending' : 'expired'); return { slug, name: m.name || slug, url: `${base(req)}/${slug}`, createdAt: m.createdAt || '', bookings: n, invite: inv, paused: !!m.paused, broken }; }).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}
PL.get('/masters', (req, res) => res.json({ items: listMasters(req) }));
const mdir = req => { const slug = req.params.slug; if (!store.masterDir(slug)) throw bad('Мастер не найден', 404); return slug; };
PL.post('/masters/:slug/invite', wrap(async (req, res) => { const slug = mdir(req); const t = await store.locked(slug, () => { const a = store.readJSON(slug, 'auth.json', {}); a.passwordHash = ''; a.sessions = []; store.writeJSON(slug, 'auth.json', a, { noBackup: true }); return auth.newInvite(slug); }); res.json(created(req, { slug, inviteToken: t, warnings: [] })); }));
PL.post('/masters/:slug/pause', wrap(async (req, res) => { const slug = mdir(req); await store.locked(slug, () => { const m = readM(slug); m.paused = !!req.body.paused; store.writeJSON(slug, 'master.json', m); }); res.json({ ok: true }); }));
PL.post('/masters/:slug/archive', wrap(async (req, res) => { const slug = mdir(req); await store.locked(slug, () => create.archiveMaster(slug)); res.json({ ok: true }); }));
PL.post('/masters/:slug/rename', wrap(async (req, res) => { const slug = mdir(req), n = String(req.body.slug || ''), st = create.slugState(n); if (st !== 'ok') throw bad({ taken: 'Такой адрес уже занят', invalid: 'Адрес: только латинские буквы, цифры и дефис', reserved: 'Этот адрес зарезервирован', empty: 'Укажите адрес' }[st]); await store.locked(slug, () => fs.renameSync(path.join(store.P.masters, slug), path.join(store.P.masters, n))); res.json({ ok: true, slug: n }); }));
PL.get('/masters/:slug/backup.zip', wrap((req, res) => { const slug = mdir(req), dir = store.masterDir(slug); res.set({ 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${slug}-${new Date().toISOString().slice(0, 10)}.zip"` }); const z = archiver('zip', { zlib: { level: 6 } }); z.on('error', e => res.destroy(e)); z.pipe(res); z.directory(dir, slug); z.finalize(); }));
app.get('/platform', (req, res) => { if (!isLocal(req) && !(store.readConfig() || {}).allowExternal) return noPage(res, 403, 'Панель недоступна', 'Панель платформы открывается только на компьютере, где она запущена.'); res.set('Cache-Control', 'no-store').type('html').send(shell({ title: ((store.readConfig() || {}).platformName || 'Платформа') + ' — панель', robots: 1, scripts: ['common', 'platform'], boot: {} })); });

/* ---------- Errors ---------- */
app.use((req, res) => req.path.startsWith('/api/') ? res.status(404).json({ error: 'Не найдено' }) : noPage(res, 404, 'Страница не найдена', 'Проверьте ссылку или уточните её у мастера.'));
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err); const api = req.path.startsWith('/api/');
  if (err && err.code === 'BROKEN_JSON') { const mm = /^\/api\/(?:a|m)\/([^/]+)/.exec(req.originalUrl || ''), slug = mm && mm[1]; return res.status(422).json({ error: err.message, code: 'BROKEN_JSON', file: err.file, canRestore: slug ? store.hasBackup(slug, err.file) : false }); }
  if (err && err.type === 'entity.too.large') err = bad('Слишком большой запрос', 413); if (err && err.type === 'entity.parse.failed') err = bad('Некорректные данные');
  const status = err.status || 500; if (status >= 500) console.error(err);
  const msg = status >= 500 ? 'Что-то пошло не так. Попробуйте ещё раз.' : err.message;
  if (api) return res.status(status).json({ error: msg, code: err.code }); noPage(res, status, 'Ошибка', msg);
});
if (require.main === module) {
  const c = store.readConfig(); if (!c) { console.error('Платформа не настроена. Запустите start.ps1'); process.exit(1); }
  const port = +process.env.PORT || c.port || 3000;
  app.listen(port, c.host || '0.0.0.0', () => { console.log(`Платформа запущена: http://localhost:${port}/platform`); });
}
module.exports = app;
