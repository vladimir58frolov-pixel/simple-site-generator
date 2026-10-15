/* Приёмочные проверки: запускайте при работающем сервере: BASE=http://localhost:3000 PL_PASS=... node tests/acceptance.js */
const fs = require('fs'), path = require('path');
const BASE = process.env.BASE || 'http://localhost:3000', PASS = process.env.PL_PASS || 'test-pass-123', ROOT = path.resolve(__dirname, '..');
let ok = 0, fail = 0; const out = [];
const t = (name, cond, extra) => { if (cond) ok++; else { fail++; } out.push((cond ? 'OK   ' : 'FAIL ') + name + (cond ? '' : '  <- ' + (extra === undefined ? '' : JSON.stringify(extra)))); };
class Jar { constructor() { this.c = {}; this.csrf = ''; } async req(m, u, b, o = {}) { const h = { cookie: Object.entries(this.c).map(([k, v]) => k + '=' + v).join('; '), 'x-csrf': this.csrf }; let body; if (b !== undefined && !o.raw) { body = JSON.stringify(b); h['content-type'] = 'application/json'; } else if (o.raw) { body = b; h['content-type'] = 'image/jpeg'; } const r = await fetch((o.base || BASE) + u, { method: m, headers: h, body, redirect: 'manual' }); (r.headers.getSetCookie ? r.headers.getSetCookie() : []).forEach(s => { const [kv] = s.split(';'), i = kv.indexOf('='); const v = kv.slice(i + 1); if (/Max-Age=0/i.test(s)) delete this.c[kv.slice(0, i)]; else this.c[kv.slice(0, i)] = v; }); const text = await r.text(); let j = null; try { j = JSON.parse(text); } catch { } return { s: r.status, j, text, h: r.headers }; } }
const rd = (slug, f) => JSON.parse(require(ROOT + '/engine/lib/store').stripJsonc(fs.readFileSync(`${ROOT}/masters/${slug}/${f}`, 'utf8')));
const wr = (slug, f, d) => fs.writeFileSync(`${ROOT}/masters/${slug}/${f}`, JSON.stringify(d, null, 2));
const day = (n) => { const d = new Date(Date.now() + n * 864e5); return d.toISOString().slice(0, 10); };
const nextWeekday = (from = 2) => { let n = from; for (;;) { const d = new Date(Date.now() + n * 864e5), w = d.getUTCDay(); if (w >= 1 && w <= 5) return d.toISOString().slice(0, 10); n++; } };
const DIRTY = fs.readFileSync(process.env.DIRTY || '/tmp/dirty.txt', 'utf8');
(async () => {
  const P = new Jar(), anon = new Jar();
  /* --- панель платформы --- */
  t('Корень / — заглушка без списка мастеров', (await anon.req('GET', '/')).text.indexOf('demo') < 0);
  t('Панель без входа → 401', (await anon.req('GET', '/api/p/masters')).s === 401);
  t('Неверный пароль платформы → 401', (await P.req('POST', '/api/p/login', { password: 'wrong' })).s === 401);
  let r = await P.req('POST', '/api/p/login', { password: PASS }); P.csrf = r.j.csrf; t('Вход в панель', r.s === 200 && !!r.j.csrf);
  t('Мутация без CSRF отклоняется', (await anon.req('POST', '/api/p/login', { password: PASS })).s === 200 && (await new Jar().req('POST', '/api/p/masters/demo/pause', { paused: false })).s === 401);
  const P2 = new Jar(); P2.c = { ...P.c }; r = await P2.req('POST', '/api/p/masters/demo/pause', { paused: false }); t('POST с cookie, но без CSRF-заголовка → 403', r.s === 403);
  /* --- разбор анкеты --- */
  r = await P.req('POST', '/api/p/parse', { text: DIRTY }); const it = r.j.items[0];
  t('Парсер: имя/телефон/instagram из грязного текста', it.profile.name === 'Арина' && it.profile.phone === '+7 904 264-65-37' && it.profile.instagram === 'arina_nails', it.profile);
  t('Парсер: опечатки в ключах приняты', it.warnings.some(w => /Спецыализация/.test(w.text)) && it.profile.specialty === 'мастер маникюра');
  t('Парсер: услуги и длительности («1ч30м», «2 часа», «30»)', JSON.stringify(it.categories.flatMap(c => c.services).map(s => s.duration)) === JSON.stringify([30, 90, 20, 120, 60, 120, 60]), it.categories);
  t('Парсер: сомнительные строки дают предупреждения', it.warnings.filter(w => w.level === 'warn').length >= 3);
  t('Парсер: график с обедом', it.schedule.mon.breaks[0].from === '14:00' && it.schedule.sun.intervals.length === 0);
  const empty = (await P.req('POST', '/api/p/parse', { text: 'Имя: Тест' })).j.items[0]; t('Анкета с пропусками: график по умолчанию, пустые услуги', empty.scheduleDefault && empty.categories.length === 0 && empty.profile.name === 'Тест');
  t('slug: транслитерация', it.slug === 'arina', it.slug);
  t('slug-check: свободен/занят/некорректный/зарезервирован', (await P.req('GET', '/api/p/slug-check?slug=arina')).j.state === 'ok' && (await P.req('GET', '/api/p/slug-check?slug=demo')).j.state === 'taken' && (await P.req('GET', '/api/p/slug-check?slug=A_b')).j.state === 'invalid' && (await P.req('GET', '/api/p/slug-check?slug=platform')).j.state === 'reserved');
  /* --- создание --- */
  r = await P.req('POST', '/api/p/create', { text: DIRTY, slug: 'arina' }); t('Создание мастера из грязной анкеты', r.s === 200 && r.j.created[0].slug === 'arina', r.text.slice(0, 200));
  const inv = r.j.created[0].inviteUrl, token = inv.split('/invite/')[1]; t('Сообщение содержит ссылки', r.j.created[0].message.includes(inv) && r.j.created[0].message.includes('/arina'));
  t('Создано: все файлы мастера', ['master.json', 'services.json', 'schedule.json', 'reviews.json', 'bookings.json', 'auth.json', 'backups', 'photos'].every(f => fs.existsSync(`${ROOT}/masters/arina/${f}`)));
  t('Повторный slug отклонён', (await P.req('POST', '/api/p/create', { text: DIRTY, slug: 'arina' })).s === 400);
  r = await P.req('POST', '/api/p/create', { text: 'Имя: Анна Первая\nУслуги:\n[М]\nУ | | 1000 | 30\n---\nИмя: Анна Первая\nУслуги:\n[М]\nУ | | 1500 | 45' }); t('Пакетное создание двух мастеров (одинаковые имена → разные slug)', r.s === 200 && r.j.created.length === 2 && r.j.created[0].slug !== r.j.created[1].slug, r.j.created && r.j.created.map(c => c.slug));
  const batch = r.j.created.map(c => c.slug);
  /* --- приглашение --- */
  const A = new Jar(); const st = await A.req('GET', `/api/a/arina/invite?token=${token}`); t('Приглашение: экран «Добро пожаловать»', st.j.state === 'ok' && st.j.name === 'Арина');
  t('Приглашение с неверным токеном', (await A.req('GET', '/api/a/arina/invite?token=xxx')).j.state === 'bad');
  t('Слабый пароль отклонён', (await A.req('POST', '/api/a/arina/invite/accept', { token, password: '123' })).s === 400);
  r = await A.req('POST', '/api/a/arina/invite/accept', { token, password: 'Arina-Pass-2026' }); A.csrf = r.j.csrf; t('Принятие приглашения → вход', r.s === 200 && !!A.c.ma_arina);
  t('Повторное открытие ссылки не работает', (await new Jar().req('POST', '/api/a/arina/invite/accept', { token, password: 'Another-Pass-1' })).s === 410 && (await A.req('GET', `/api/a/arina/invite?token=${token}`)).j.state === 'bad');
  t('Пароль хранится хэшем scrypt', /^scrypt\$/.test(rd('arina', 'auth.json').passwordHash) && !JSON.stringify(rd('arina', 'auth.json')).includes('Arina-Pass'));
  const B = (await P.req('POST', '/api/p/masters/' + batch[0] + '/invite')).j; const exp = rd(batch[0], 'auth.json'); exp.invite.expires = Date.now() - 1000; wr(batch[0], 'auth.json', exp);
  t('Срок действия приглашения', (await anon.req('GET', `/api/a/${batch[0]}/invite?token=${B.inviteUrl.split('/invite/')[1]}`)).j.state === 'expired');
  /* --- сброс доступа --- */
  r = await P.req('POST', '/api/p/masters/arina/invite'); const tok2 = r.j.inviteUrl.split('/invite/')[1];
  t('Сброс доступа: старая сессия и пароль не работают', (await A.req('GET', '/api/a/arina/me')).s === 401 && (await new Jar().req('POST', '/api/a/arina/login', { password: 'Arina-Pass-2026' })).s === 403);
  A.c = {}; r = await A.req('POST', '/api/a/arina/invite/accept', { token: tok2, password: 'Arina-New-Pass-7' }); A.csrf = r.j.csrf; t('Новая ссылка работает', r.s === 200);
  /* --- блокировка попыток --- */
  const L = new Jar(); let last; for (let i = 0; i < 6; i++) last = await L.req('POST', '/api/a/arina/login', { password: 'bad' + i }); t('Блокировка после 5 неверных паролей', last.s === 429, last.s);
  t('Правильный пароль во время блокировки тоже отклонён', (await L.req('POST', '/api/a/arina/login', { password: 'Arina-New-Pass-7' })).s === 429);
  /* --- кабинет: профиль, услуги, график --- */
  r = await A.req('GET', '/api/a/arina/me'); t('Кабинет: токен Telegram не отдаётся', r.j.profile.telegramToken === undefined);
  t('Профиль: валидация телефона', (await A.req('PUT', '/api/a/arina/profile', { phone: '123' })).s === 400);
  r = await A.req('PUT', '/api/a/arina/profile', { about: 'Новое описание', accent: '#336699', theme: 'sage' }); t('Профиль сохранён', r.j.profile.about === 'Новое описание' && rd('arina', 'master.json').accent === '#336699');
  t('Подсказка _подсказка сохраняется в master.json', !!rd('arina', 'master.json')._подсказка);
  t('Бэкап создаётся перед изменением', fs.readdirSync(`${ROOT}/masters/arina/backups`).some(f => f.startsWith('master.json.')));
  t('Токен бота: неверный формат отклонён', (await A.req('PUT', '/api/a/arina/profile', { telegramToken: 'abc' })).s === 400);
  let svc = (await A.req('GET', '/api/a/arina/services')).j.categories; const cat0 = svc[0];
  cat0.services.push({ name: 'Новая услуга', desc: 'д', price: 700, duration: 45, popular: true }); r = await A.req('PUT', '/api/a/arina/services', { categories: svc }); t('Услуги: добавление', r.s === 200 && r.j.categories[0].services.some(s => s.name === 'Новая услуга' && s.id));
  svc = r.j.categories; t('Услуги: валидация цены и длительности', (await A.req('PUT', '/api/a/arina/services', { categories: [{ name: 'X', services: [{ name: 'a', price: -5, duration: 30 }] }] })).s === 400 && (await A.req('PUT', '/api/a/arina/services', { categories: [{ name: 'X', services: [{ name: 'a', price: 5, duration: 1 }] }] })).s === 400);
  const hid = svc[0].services[0]; hid.hidden = true; svc[1].services.reverse(); r = await A.req('PUT', '/api/a/arina/services', { categories: svc });
  const pub = (await anon.req('GET', '/api/m/arina')).j; t('Скрытая услуга не видна клиентам; порядок сохранён', !pub.categories.flatMap(c => c.services).some(s => s.id === hid.id) && pub.categories.length === 2);
  const imp = (await A.req('POST', '/api/a/arina/services/parse', { text: '[Брови]\nКоррекция | форма | 900 | 30 мин\nОкрашивание 1200 40' })).j; t('Импорт списком: предпросмотр', imp.categories[0].services.length === 2 && imp.categories[0].services[1].price === 1200);
  svc = (await A.req('GET', '/api/a/arina/services')).j.categories; const undoBefore = svc.length; svc.push({ name: 'Временная', services: [] }); await A.req('PUT', '/api/a/arina/services', { categories: svc }); await A.req('POST', '/api/a/arina/undo', { file: 'services.json' });
  t('«Отменить последнее изменение»', (await A.req('GET', '/api/a/arina/services')).j.categories.length === undoBefore);
  /* --- слоты и записи --- */
  const wd = nextWeekday(2), sv = (await A.req('GET', '/api/a/arina/services')).j.categories[0].services.filter(s => !s.hidden), s1 = sv.find(s => s.duration === 90) || sv[0];
  let slots = (await anon.req('GET', `/api/m/arina/slots?date=${wd}&services=${s1.id}`)).j.slots; t('Слоты считаются на сервере (будни 10–19, обед 14–15)', slots.length > 0 && slots[0] === '10:00' && !slots.includes('14:00') && !slots.includes('13:30') && slots.every(x => x >= '10:00'), slots);
  const sat = (() => { for (let n = 2; ; n++) { const d = new Date(Date.now() + n * 864e5); if (d.getUTCDay() === 0) return d.toISOString().slice(0, 10); } })();
  t('Воскресенье — слотов нет (выходной)', (await anon.req('GET', `/api/m/arina/slots?date=${sat}&services=${s1.id}`)).j.slots.length === 0);
  const book = (time, name = 'Клиент', extra = {}) => anon.req('POST', '/api/m/arina/book', { services: [s1.id], date: wd, time, name, phone: '+7 900 111-22-33', comment: 'тест', consent: true, utm: { utm_source: 'ig', utm_medium: 'social', utm_content: 'link_in_bio' }, ...extra });
  t('Запись без согласия отклоняется', (await book('10:00', 'К', { consent: false })).s === 400); t('Плохое имя/телефон отклоняются', (await book('10:00', 'К')).s === 400 && (await book('10:00', 'Клиент', { phone: '12' })).s === 400);
  const res = await Promise.all([book('11:00', 'Гонка1'), book('11:00', 'Гонка2'), book('11:30', 'Гонка3')]); const okN = res.filter(x => x.s === 200).length;
  t('Двойная запись исключена (параллельные запросы)', okN === 1 && res.filter(x => x.s === 409).length === 2, res.map(x => x.s));
  const b1 = res.find(x => x.s === 200).j; slots = (await anon.req('GET', `/api/m/arina/slots?date=${wd}&services=${s1.id}`)).j.slots; t('Занятое время и пересечения скрыты', !slots.includes('11:00') && !slots.includes('11:30') && !slots.includes('10:30'), slots);
  const bks = (await A.req('GET', '/api/a/arina/bookings')).j.items; t('UTM-метки сохранены с записью', bks[0].utm.utm_source === 'ig' && bks[0].utm.utm_content === 'link_in_bio');
  t('Страница управления записью (токен)', (await anon.req('GET', `/api/m/arina/booking/${b1.token}`)).j.canChange === true && (await anon.req('GET', `/api/m/arina/booking/${b1.token}/ics`)).text.includes('BEGIN:VEVENT') && (await anon.req('GET', '/api/m/arina/booking/zzz')).s === 404);
  r = await anon.req('POST', `/api/m/arina/booking/${b1.token}/move`, { date: wd, time: '16:00' }); t('Перенос клиентом', r.s === 200 && r.j.time === '16:00'); t('Перенос на занятое/нерабочее время отклонён', (await anon.req('POST', `/api/m/arina/booking/${b1.token}/move`, { date: wd, time: '14:00' })).s === 409);
  r = await anon.req('POST', `/api/m/arina/booking/${b1.token}/cancel`); t('Отмена клиентом освобождает слот', r.j.status === 'canceled' && (await anon.req('GET', `/api/m/arina/slots?date=${wd}&services=${s1.id}`)).j.slots.includes('11:00'));
  const b2 = (await book('12:00', 'Вторая')).j; const id2 = (await A.req('GET', '/api/a/arina/bookings')).j.items.find(x => x.token === b2.token).id;
  t('Отзыв до визита нельзя', (await anon.req('POST', `/api/m/arina/booking/${b2.token}/review`, { rating: 5, text: 'x' })).s === 400);
  await A.req('PATCH', '/api/a/arina/bookings/' + id2, { status: 'came' }); r = await anon.req('POST', `/api/m/arina/booking/${b2.token}/review`, { rating: 5, text: 'Супер' }); t('Отзыв после «пришёл»', r.s === 200 && (await anon.req('GET', '/api/m/arina/reviews')).j.items.length === 1 && (await anon.req('GET', '/api/m/arina')).j.rating.avg === 5);
  const rid = (await A.req('GET', '/api/a/arina/reviews')).j.items[0].id; await A.req('PUT', '/api/a/arina/reviews/' + rid, { reply: 'Спасибо!' }); t('Ответ на отзыв виден клиентам', (await anon.req('GET', '/api/m/arina/reviews')).j.items[0].reply === 'Спасибо!');
  await A.req('PUT', '/api/a/arina/reviews/' + rid, { hidden: true }); t('Скрытый отзыв не виден', (await anon.req('GET', '/api/m/arina/reviews')).j.items.length === 0);
  r = await A.req('POST', '/api/a/arina/bookings', { name: 'Ручная', phone: '', services: [s1.id], date: wd, time: '12:30' }); t('Ручная запись: пересечение → 409 OVERLAP, force проходит', r.s === 409 && r.j.code === 'OVERLAP' && (await A.req('POST', '/api/a/arina/bookings', { name: 'Ручная', services: [s1.id], date: wd, time: '12:30', force: true })).s === 200);
  /* --- пересчёт слотов и конфликт графика --- */
  let sch = (await A.req('GET', '/api/a/arina/schedule')).j.schedule; sch.week[Object.keys(sch.week)[0]].intervals = [{ from: '10:00', to: '19:00' }]; const dow = new Date(wd + 'T00:00:00Z').getUTCDay(), key = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][dow];
  sch.week[key] = { intervals: [{ from: '13:00', to: '18:00' }], breaks: [] }; r = await A.req('PUT', '/api/a/arina/schedule', sch);
  t('Конфликт графика с записями: список, без автоотмены', r.j.conflicts.length >= 1 && (await A.req('GET', '/api/a/arina/bookings')).j.items.filter(x => x.status === 'booked' && x.date === wd).length >= 1, r.j.conflicts);
  slots = (await anon.req('GET', `/api/m/arina/slots?date=${wd}&services=${s1.id}`)).j.slots; t('Слоты пересчитаны сразу после смены графика', slots.length > 0 && slots[0] >= '13:00', slots);
  sch.special[wd] = { off: true }; await A.req('PUT', '/api/a/arina/schedule', sch); t('Особая дата (отпуск) закрывает день', (await anon.req('GET', `/api/m/arina/slots?date=${wd}&services=${s1.id}`)).j.slots.length === 0);
  t('Валидация графика (конец раньше начала)', (await A.req('PUT', '/api/a/arina/schedule', { ...sch, week: { ...sch.week, mon: { intervals: [{ from: '19:00', to: '10:00' }], breaks: [] } } })).s === 400);
  t('Правка файла вручную видна без перезапуска', (() => { const s = rd('arina', 'schedule.json'); s.horizonDays = 14; wr('arina', 'schedule.json', s); return true; })() && (await anon.req('GET', '/api/m/arina')).j.horizonDays === 14);
  /* --- фото --- */
  const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)]); r = await A.req('POST', '/api/a/arina/photos/works', jpg, { raw: true }); t('Загрузка фото в кабинете', r.s === 200 && r.j.works.length === 1);
  t('Не-изображение отклоняется', (await A.req('POST', '/api/a/arina/photos/works', Buffer.from('<script>alert(1)</script>-----------'), { raw: true })).s === 400);
  t('Отдача фото мастера', (await anon.req('GET', r.j.works[0].url)).s === 200);
  /* --- изоляция --- */
  const demoJar = new Jar(); r = await demoJar.req('POST', '/api/a/demo/login', { password: 'demo12345' }); demoJar.csrf = r.j.csrf; t('Демо-мастер входит со своим паролем', r.s === 200);
  const X = new Jar(); X.c = { ma_arina: A.c.ma_arina }; X.csrf = A.csrf;
  t('Сессия мастера A не открывает кабинет мастера B', (await X.req('GET', '/api/a/demo/me')).s === 401 && (await X.req('PUT', '/api/a/demo/profile', { name: 'Взлом' })).s === 401 && (await X.req('GET', '/api/a/demo-lavender/bookings')).s === 401);
  X.c = { ma_demo: demoJar.c.ma_demo }; t('Сессия demo не работает в кабинете arina (cookie привязан к slug)', (await X.req('GET', '/api/a/arina/me')).s === 401);
  t('Пароль одного мастера не подходит другому', (await new Jar().req('POST', '/api/a/demo-lavender/login', { password: 'Arina-New-Pass-7' })).s === 401);
  t('Path traversal в фото', (await anon.req('GET', '/photos/arina/..%2f..%2farina/auth.json')).s === 404 && (await anon.req('GET', '/photos/demo/works/..%2f..%2fmaster.json')).s === 404 && (await anon.req('GET', '/photos/arina/auth.json')).s === 404);
  t('Path traversal в slug', (await anon.req('GET', '/api/m/..%2f..%2fconfig')).s === 404 && (await anon.req('GET', '/..%2fconfig%2fplatform.json')).s === 404);
  t('Публичный API не раскрывает auth/токены/телефоны клиентов', !JSON.stringify((await anon.req('GET', '/api/m/arina')).j).match(/passwordHash|telegramToken|bookings/));
  /* --- приостановка / архив --- */
  await P.req('POST', '/api/p/masters/arina/pause', { paused: true }); t('Приостановка: страница показывает флаг, запись → 403', (await anon.req('GET', '/api/m/arina')).j.paused === true && (await book('17:00', 'Клиент2')).s === 403);
  await P.req('POST', '/api/p/masters/arina/pause', { paused: false });
  t('Список мастеров не раскрывает записи, только число', (() => { return true; })() && !JSON.stringify((await P.req('GET', '/api/p/masters')).j).includes('Гонка'));
  const zip = await fetch(BASE + '/api/p/masters/arina/backup.zip', { headers: { cookie: Object.entries(P.c).map(([k, v]) => k + '=' + v).join('; ') } }); const zb = Buffer.from(await zip.arrayBuffer()); t('Резервная копия: zip', zip.status === 200 && zb.slice(0, 2).toString() === 'PK' && zb.length > 500);
  /* --- сломанный JSON --- */
  const bad = fs.readFileSync(`${ROOT}/masters/arina/services.json`, 'utf8'); fs.writeFileSync(`${ROOT}/masters/arina/services.json`, bad.slice(0, 40));
  r = await A.req('GET', '/api/a/arina/services'); t('Сломанный JSON: понятная ошибка по файлу + можно восстановить', r.s === 422 && r.j.file === 'services.json' && r.j.canRestore === true && /services\.json/.test(r.j.error), r.j);
  t('Публичная страница сломанного мастера не падает и не светит детали', (await anon.req('GET', '/arina')).s === 503 && !(await anon.req('GET', '/arina')).text.includes('services.json'));
  t('Остальные мастера работают', (await anon.req('GET', '/demo')).s === 200 && (await anon.req('GET', '/api/m/demo')).s === 200);
  r = await A.req('POST', '/api/a/arina/restore', { file: 'services.json' }); t('Восстановление из копии', r.s === 200 && (await A.req('GET', '/api/a/arina/services')).s === 200);
  /* --- архив и 404 --- */
  r = await P.req('POST', '/api/p/masters/' + batch[0] + '/archive'); t('Архивирование', r.s === 200 && (await anon.req('GET', '/' + batch[0])).s === 404 && fs.readdirSync(ROOT + '/archive').some(f => f.startsWith(batch[0])));
  r = await P.req('POST', '/api/p/masters/' + batch[1] + '/rename', { slug: 'anna-renamed' }); t('Смена адреса разработчиком', r.s === 200 && (await anon.req('GET', '/anna-renamed')).s === 200 && (await anon.req('GET', '/' + batch[1])).s === 404);
  t('404 для несуществующего мастера и пути', (await anon.req('GET', '/net-takogo')).s === 404 && (await anon.req('GET', '/api/m/net-takogo')).s === 404);
  t('Кабинет: страница без индексации', /noindex/.test((await anon.req('GET', '/arina/admin')).text));
  t('OG-теги на странице мастера', /og:title/.test((await anon.req('GET', '/demo')).text) && /<title>Арина/.test((await anon.req('GET', '/demo')).text));
  /* --- доступ извне --- */
  const ext = process.env.EXT_BASE; if (ext) { const e1 = await anon.req('GET', '/platform', undefined, { base: ext }), e2 = await anon.req('POST', '/api/p/login', { password: PASS }, { base: ext }); t('Панель платформы недоступна не с localhost', e1.s === 403 && e2.s === 403, [e1.s, e2.s]); const e3 = await anon.req('GET', '/demo', undefined, { base: ext }); t('Страницы мастеров доступны извне', e3.s === 200); }
  console.log(out.join('\n')); console.log(`\nИтого: ${ok} успешно, ${fail} с ошибкой`); process.exit(fail ? 1 : 0);
})().catch(e => { console.log(out.join('\n')); console.error('СБОЙ ТЕСТА', e); process.exit(2); });
