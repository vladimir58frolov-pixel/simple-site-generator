'use strict';
const { toMin, fromMin, DAYS, DAY_SH, normPhone } = require('./util');
const Theme = require('../public/theme.js');
const KEYS = {
  name: ['имя', 'имя мастера', 'мастер', 'name', 'фио'], specialty: ['специализация', 'профессия', 'должность', 'специальность'],
  address: ['адрес', 'где принимаю', 'место приема', 'место приёма'], phone: ['телефон', 'тел', 'номер', 'phone', 'номер телефона'],
  instagram: ['instagram', 'инстаграм', 'инстаграмм', 'инста', 'ig'], telegram: ['telegram', 'телеграм', 'телеграмм', 'тг', 'tg', 'телега'],
  whatsapp: ['whatsapp', 'вотсап', 'вотсапп', 'ватсап', 'вацап', 'wa', 'whats app'], vk: ['vk', 'вк', 'вконтакте'],
  map: ['карта', 'ссылка на карту', 'map', 'яндекс карты', 'яндекс карта'], theme: ['тема', 'theme', 'цветовая тема', 'стиль'],
  design: ['дизайн', 'оформление', 'макет', 'вариант оформления', 'design', 'layout'], accent: ['акцент', 'accent', 'акцентный цвет', 'цвет'], about: ['о себе', 'описание', 'о мастере', 'обо мне', 'about'],
  timezone: ['часовой пояс', 'timezone', 'пояс'], schedule: ['график', 'график работы', 'расписание', 'режим работы', 'часы работы'],
  services: ['услуги', 'услуги и цены', 'прайс', 'цены', 'прайс-лист', 'прайслист']
};
const LABEL = { name: 'Имя', specialty: 'Специализация', address: 'Адрес', phone: 'Телефон', instagram: 'Instagram', telegram: 'Telegram', whatsapp: 'WhatsApp', vk: 'VK', map: 'Карта', theme: 'Тема', design: 'Дизайн', accent: 'Акцент', about: 'О себе', timezone: 'Часовой пояс' };
const LOOK = {}; Object.keys(KEYS).forEach(f => KEYS[f].forEach(k => LOOK[k] = f));
function lev(a, b) { const m = a.length, n = b.length; let p = Array.from({ length: n + 1 }, (_, j) => j); for (let i = 1; i <= m; i++) { const c = [i]; for (let j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; } return p[n]; }
function resolveKey(k) {
  k = k.toLowerCase().replace(/[.!]+$/, '').replace(/\s+/g, ' ').trim(); if (!k || k.length > 28) return null;
  if (LOOK[k]) return { field: LOOK[k] };
  if (k.length >= 5) { let best = null, bd = 9; for (const w in LOOK) { if (w.length < 5) continue; const d = lev(k, w); const lim = w.length >= 8 ? 2 : 1; if (d <= lim && d < bd) { bd = d; best = w; } } if (best) return { field: LOOK[best], typo: best }; }
  return null;
}
const clean = l => { l = l.replace(/[\u200b-\u200d\ufeff]/g, '').replace(/\u00a0/g, ' ').replace(/\*\*|__|`/g, '').replace(/\t/g, ' \t ').trimEnd(); for (let i = 0; i < 3; i++) l = l.replace(/^[\s•·▪▫●○■□*\-–—>]+(?=\S)/u, '').replace(/^(?:\p{Extended_Pictographic}|\uFE0F|\u200d)+\s*/u, ''); return l.replace(/ \t /g, '\t').trim(); };
function parsePrice(str) {
  let s = String(str == null ? '' : str).toLowerCase().replace(/^\s*(от|до)\s+/, '').replace(/₽|руб[а-яёa-z]*|р\.?|rub/g, '').replace(/[\s\u00a0]/g, ''); if (!s) return null;
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) s = s.replace(/[.,]/g, ''); const m = /^(\d+)(?:[.,]\d+)?$/.exec(s); return m ? +m[1] : null;
}
function parseDuration(str) {
  let s = String(str == null ? '' : str).toLowerCase().replace(',', '.').trim(); if (!s) return null; let m = /^(\d{1,2}):(\d{2})$/.exec(s); if (m) return +m[1] * 60 + +m[2];
  let min = 0, found = false; const h = /(\d+(?:\.\d+)?)\s*(?:час[а-яёa-z]*|ч|h)/.exec(s); if (h) { min += Math.round(parseFloat(h[1]) * 60); found = true; }
  const mm = /(\d+)\s*(?:мин[а-яёa-z]*|min[а-яёa-z]*|м|m)/.exec(s.replace(h ? h[0] : '', '')); if (mm) { min += +mm[1]; found = true; }
  if (!found) { m = /^\d+$/.exec(s); if (m) min = +m[0]; else return null; }
  return min >= 5 && min <= 720 ? min : null;
}
const DAYRE = [['mon', /^(пн|пон[а-яёa-z]*|mon[а-яёa-z]*)$/], ['tue', /^(вт|вто[а-яёa-z]*|tue[а-яёa-z]*)$/], ['wed', /^(ср|сре[а-яёa-z]*|wed[а-яёa-z]*)$/], ['thu', /^(чт|чет[а-яёa-z]*|thu[а-яёa-z]*)$/], ['fri', /^(пт|пят[а-яёa-z]*|fri[а-яёa-z]*)$/], ['sat', /^(сб|суб[а-яёa-z]*|sat[а-яёa-z]*)$/], ['sun', /^(вс|вос[а-яёa-z]*|sun[а-яёa-z]*)$/]];
const dayOf = w => { const x = DAYRE.find(d => d[1].test(w)); return x ? x[0] : null; };
function rangesIn(s) { const out = [], re = /(\d{1,2})(?:[:.](\d{2}))?\s*(?:-|до|по)\s*(\d{1,2})(?:[:.](\d{2}))?/g; let m; while ((m = re.exec(s))) { const a = +m[1] * 60 + +(m[2] || 0), z = +m[3] * 60 + +(m[4] || 0); if (+m[1] <= 24 && +m[3] <= 24 && a < z) out.push({ from: fromMin(a), to: fromMin(Math.min(z, 1440 - 1)) }); else out.push({ bad: m[0] }); } return out; }
function parseSchedLine(raw) {
  let s = raw.toLowerCase().replace(/[–—−]/g, '-').replace(/\s+/g, ' ').trim();
  const off = /(^|\s|-)(выходной|выходные|не работаю|не работает|закрыто|закрыт|отдыхаю)/.test(s) && !/\d{1,2}[:.]\d{2}/.test(s);
  s = s.replace(/ежедневно|каждый день|без выходных|все дни/g, 'пн-вс').replace(/по будням|будние дни|будни/g, 'пн-пт');
  if (/^выходные(?! день)/.test(s) && !off) s = s.replace(/^выходные/, 'сб-вс');
  const idx = s.search(/\d|перерыв|обед|выходн|не работ|закрыт|отдых/); const prefix = idx < 0 ? s : s.slice(0, idx), rest = idx < 0 ? '' : s.slice(idx);
  const days = new Set(); prefix.split(/[,\s/и;]+/).filter(Boolean).forEach(tok => {
    if (tok.includes('-')) { const [a, b] = tok.split('-').map(dayOf); if (a && b) { let i = DAYS.indexOf(a); const j = DAYS.indexOf(b); for (let k = 0; k < 7; k++) { days.add(DAYS[i]); if (i === j) break; i = (i + 1) % 7; } } }
    else { const d = dayOf(tok); if (d) days.add(d); }
  });
  if (!days.size) return null;
  const parts = rest.split(/перерыв[а-яёa-z]*|обед[а-яёa-z]*/), ivs = rangesIn(parts[0]); let brk = []; parts.slice(1).forEach(p => brk = brk.concat(rangesIn(p)));
  const bad = ivs.concat(brk).filter(x => x.bad).map(x => x.bad);
  return { days: [...days], off, intervals: ivs.filter(x => !x.bad), breaks: brk.filter(x => !x.bad), bad };
}
function handle(v, kind) {
  v = String(v || '').trim(); if (!v) return '';
  v = v.replace(/^https?:\/\/(www\.)?/i, '').replace(/^(instagram\.com|t\.me|telegram\.me|vk\.com)\//i, '').replace(/[?#].*$/, '').replace(/\/+$/, '').replace(/^@/, '');
  return v;
}
function parseServiceFields(f, W) {
  f = f.map(x => x.trim()); const name = f[0]; let desc = '', price = null, dur = null, pop = false, rest = f.slice(1);
  const fi = rest.findIndex(x => /^(популярн[а-яёa-z]*|хит|топ|★|⭐|hot|popular|\*)$/i.test(x)); if (fi >= 0) { pop = true; rest.splice(fi, 1); }
  if (rest.length >= 3) { desc = rest[0]; price = parsePrice(rest[1]); dur = parseDuration(rest[2]); if (rest.length > 3) W('Лишние поля в конце строки пропущены', 'Оставьте: название | состав | цена | длительность'); }
  else if (rest.length === 2) { if (rest[0] === '' || parsePrice(rest[0]) !== null) { price = parsePrice(rest[0]); dur = parseDuration(rest[1]); } else { desc = rest[0]; price = parsePrice(rest[1]); } }
  else if (rest.length === 1) { price = parsePrice(rest[0]); if (price === null) desc = rest[0]; }
  return { name, desc, price, dur, pop };
}
function freeService(line) {
  let s = line, dur = null, price = null; const m2 = /(\d{2,6})\s+(\d{2,3})\s*$/.exec(s); if (m2 && !/мин|ч/i.test(s.slice(m2.index)) && +m2[2] <= 480 && +m2[2] % 5 === 0 && +m2[1] >= 50) return { name: s.slice(0, m2.index).replace(/[\s\-–—:,;]+$/, '').trim(), price: +m2[1], dur: +m2[2] };
  const dm = /(\d+\s*ч(?:ас[а-яёa-z]*)?(?:\s*\d+\s*м(?:ин[а-яёa-z]*)?)?|\d+\s*м(?:ин[а-яёa-z]*)?|\d{1,2}:\d{2})\s*$/i.exec(s); if (dm) { dur = parseDuration(dm[1]); s = s.slice(0, dm.index).trim(); }
  const pm = /(\d[\d\s]*)\s*(?:₽|р\.?|руб[а-яёa-z]*)?\s*[,;]?\s*$/i.exec(s); if (pm) { price = parsePrice(pm[1]); s = s.slice(0, pm.index).trim(); }
  s = s.replace(/[\s\-–—:,;]+$/, '').trim(); return price === null && dur === null ? null : { name: s, price, dur };
}
function parse(text, opts = {}) {
  const warnings = [], profile = {}, cats = [], sched = {}, lines = String(text || '').split(/\r?\n/), seen = new Set();
  let state = opts.servicesOnly ? 'services' : 'top', cat = null, lastKey = null, schedSeen = false;
  const W = (line, t, hint, level) => warnings.push({ line: line || '', text: t, hint: hint || '', level: level || 'warn' });
  const addCat = n => { cat = cats.find(c => c.name.toLowerCase() === n.toLowerCase()) || (cats.push({ name: n, services: [] }), cats[cats.length - 1]); };
  const addSvc = (raw, o) => {
    if (!o.name) { W(raw, 'У услуги нет названия — строка пропущена', 'Начинайте строку с названия услуги'); return; }
    if (o.price === null) W(raw, 'Не удалось понять цену услуги «' + o.name + '»', 'Напишите цену цифрами, например 1200 или 1200 ₽. Пока поставлена цена 0 («по запросу»).');
    if (o.dur === null) { W(raw, 'Не удалось понять длительность услуги «' + o.name + '»', 'Напишите так: 30 мин, 1 ч 30 мин, 2 ч. Пока поставлено 60 мин.'); }
    if (!cat) { addCat('Услуги'); W(raw, 'Категория не указана — услуга помещена в «Услуги»', 'Добавьте строку [Маникюр] перед услугами', 'info'); }
    cat.services.push({ name: o.name, desc: o.desc || '', price: o.price === null ? 0 : o.price, duration: o.dur === null ? 60 : o.dur, popular: !!o.pop });
  };
  const doServiceLine = raw => {
    const bm = /^\[(.+?)\]$/.exec(raw) || /^#+\s*(.+)$/.exec(raw); if (bm) { addCat(bm[1].trim()); return; }
    let f = null; if (raw.includes('|')) f = raw.split('|'); else if (raw.includes('\t')) f = raw.split('\t'); else if ((raw.match(/;/g) || []).length >= 2) f = raw.split(';');
    if (f) { const o = parseServiceFields(f, (t, h) => W(raw, t, h)); addSvc(raw, o); return; }
    const noDigits = !/\d/.test(raw);
    if (noDigits && raw.length <= 40) { const n = raw.replace(/[:：\s—–-]+$/, '').replace(/^[—–-]+\s*/, ''); addCat(n); if (!/[:：]$/.test(raw)) W(raw, 'Похоже на название категории — «' + n + '»', 'Лучше писать категории в квадратных скобках: [' + n + ']', 'info'); return; }
    const fs = freeService(raw); if (fs && fs.name) { addSvc(raw, { name: fs.name, desc: '', price: fs.price, dur: fs.dur }); W(raw, 'Строка без разделителей «|» разобрана автоматически: «' + fs.name + '»', 'Надёжнее: название | состав | цена | длительность', 'info'); return; }
    W(raw, 'Не удалось разобрать строку услуги', 'Формат: название | состав | цена | длительность (например: Маникюр | снятие+покрытие | 2000 | 1 ч 30 мин)');
  };
  const doSched = raw => {
    const r = parseSchedLine(raw); if (!r) return false; schedSeen = true;
    if (r.bad.length) W(raw, 'Не удалось понять время «' + r.bad.join(', ') + '»', 'Пишите время так: 10:00-19:00');
    if (!r.off && !r.intervals.length) { W(raw, 'Для «' + r.days.map(d => DAY_SH[d]).join(', ') + '» не указаны часы работы', 'Пример: пн-пт 10:00-19:00 или вс выходной'); return true; }
    r.breaks.forEach(b => { if (!r.intervals.some(i => toMin(b.from) >= toMin(i.from) && toMin(b.to) <= toMin(i.to))) W(raw, 'Перерыв ' + b.from + '–' + b.to + ' выходит за рабочее время', 'Перерыв должен быть внутри рабочего интервала'); });
    r.days.forEach(d => sched[d] = { intervals: r.off ? [] : r.intervals, breaks: r.off ? [] : r.breaks }); return true;
  };
  const setField = (f, v, raw) => {
    if (seen.has(f) && f !== 'about') W(raw, 'Поле «' + LABEL[f] + '» указано дважды — взято последнее значение', '', 'info'); seen.add(f);
    if (!v) { W(raw, 'Поле «' + LABEL[f] + '» пустое', 'Заполните или удалите строку', 'info'); return; }
    if (f === 'about') profile.about = profile.about && lastKey === 'about' ? profile.about + ' ' + v : v; else profile[f] = v;
  };
  lines.forEach(rl => {
    const raw = clean(rl); if (!raw) return;
    if (/^(-{3,}|={3,}|_{3,})$/.test(raw)) return;
    if (state === 'services' && /^\[.+\]$|^#+\s/.test(raw)) { doServiceLine(raw); return; }
    const km = !raw.includes('|') && /^([^:：|\[\]]{2,40}?)\s*(?:[:：]|\s[-–—]\s)\s*(.*)$/.exec(raw); let k = null;
    if (km) k = resolveKey(km[1]);
    if (km && k) {
      if (k.typo) W(raw, '«' + km[1].trim() + '» принято как «' + k.typo + '»', 'Проверьте написание', 'info');
      lastKey = k.field; const v = km[2].trim();
      if (k.field === 'services') { state = 'services'; if (v) doServiceLine(v); return; }
      if (k.field === 'schedule') { state = 'schedule'; if (v && !doSched(v)) W(raw, 'Не удалось понять график', 'Пример: пн-пт 10:00-19:00'); return; }
      state = 'top'; setField(k.field, v, raw); return;
    }
    if (state === 'services') {
      if (!raw.includes('|') && km && !/\d/.test(km[1]) && km[1].length < 25) {
        if (!km[2]) { addCat(km[1].trim()); return; }
        if (!/\d/.test(km[2])) { W(raw, 'Поле «' + km[1].trim() + '» не распознано — пропущено', 'Известные поля: Имя, Специализация, Адрес, Телефон, Instagram, Telegram, WhatsApp, VK, Карта, Тема, Дизайн, О себе'); return; }
      }
      if (!raw.includes('|') && doSchedProbe(raw) && !/\d{3,}/.test(raw.replace(/\d{1,2}[:.]\d{2}/g, ''))) { state = 'schedule'; doSched(raw); return; }
      doServiceLine(raw); return;
    }
    if (state === 'schedule') { if (doSched(raw)) return; W(raw, 'Не удалось понять строку графика', 'Пример: пн-пт 10:00-19:00, перерыв 14:00-15:00'); return; }
    if (doSchedProbe(raw) && !/\d{3,}/.test(raw.replace(/\d{1,2}[:.]\d{2}/g, ''))) { doSched(raw); return; }
    if (km && !k && /^[A-Za-zА-Яа-яЁё ]+$/.test(km[1]) && km[1].length < 25) { W(raw, 'Поле «' + km[1].trim() + '» не распознано — пропущено', 'Известные поля: Имя, Специализация, Адрес, Телефон, Instagram, Telegram, WhatsApp, VK, Карта, Тема, Дизайн, О себе'); lastKey = null; return; }
    if (lastKey === 'about' && !raw.includes('|')) { profile.about += ' ' + raw; return; }
    if (raw.includes('|')) { W(raw, 'Услуга найдена вне раздела «Услуги»', 'Добавьте строку «Услуги:» перед списком', 'info'); state = 'services'; doServiceLine(raw); return; }
    W(raw, 'Не удалось понять строку — пропущена', 'Пишите в виде «Поле: значение»');
  });
  function doSchedProbe(raw) { return !!parseSchedLine(raw); }
  const res = { profile: {}, categories: cats.filter(c => c.services.length), schedule: null, warnings };
  cats.filter(c => !c.services.length).forEach(c => W('[' + c.name + ']', 'В категории «' + c.name + '» нет услуг — она не создана', '', 'info'));
  if (opts.servicesOnly) return res;
  const p = res.profile;
  ['name', 'specialty', 'address', 'about'].forEach(f => { if (profile[f]) p[f] = profile[f].replace(/\s+/g, ' ').trim(); });
  if (!p.name) W('', 'Не найдено имя мастера', 'Добавьте строку «Имя: Арина». Пока поставлено «Мастер»; имя можно изменить в кабинете.'), p.name = 'Мастер';
  if (profile.phone) { const ph = normPhone(profile.phone); p.phone = ph.pretty || profile.phone; if (!ph.ok) W('Телефон: ' + profile.phone, 'Телефон выглядит неполным', 'Нужно минимум 10 цифр, например +7 900 000-00-00'); }
  if (profile.whatsapp) { const ph = normPhone(profile.whatsapp); p.whatsapp = ph.digits; if (!ph.ok) W('WhatsApp: ' + profile.whatsapp, 'Номер WhatsApp выглядит неполным', 'Нужно минимум 10 цифр'); }
  if (profile.instagram) p.instagram = handle(profile.instagram); if (profile.telegram) p.telegram = handle(profile.telegram); if (profile.vk) p.vk = handle(profile.vk);
  if (profile.map) { if (/^https?:\/\//i.test(profile.map)) p.map = profile.map.trim(); else W('Карта: ' + profile.map, 'Ссылка на карту должна начинаться с http', 'Скопируйте ссылку «Поделиться» из Яндекс Карт или Google Карт'); }
  if (profile.timezone) { try { new Intl.DateTimeFormat('en', { timeZone: profile.timezone }); p.timezone = profile.timezone; } catch { W('Часовой пояс: ' + profile.timezone, 'Неизвестный часовой пояс', 'Пример: Europe/Moscow, Asia/Yekaterinburg'); } }
  if (profile.theme) {
    const t = profile.theme.toLowerCase().trim(), hx = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(t);
    const ru = [['rose', /роз|rose|пудр/], ['beige', /беж|beige|песоч/], ['lavender', /лаванд|сирен|фиолет|lavender|violet/], ['sage', /шалф|зел[её]н|sage|green|олив/], ['mocha', /мокк|кофе|корич|mocha|coffee/], ['dark', /т[её]мн|dark|ч[её]рн/]].find(x => x[1].test(t));
    if (hx) { p.theme = 'rose'; p.accent = '#' + hx[1].toLowerCase(); } else if (ru) p.theme = ru[0]; else W('Тема: ' + profile.theme, 'Неизвестная тема — поставлена «rose»', 'Доступны: rose, beige, lavender, sage, mocha, dark или цвет в формате #d94f87');
  }
  if (profile.design) {
    const d = profile.design.toLowerCase().trim();
    const ru = [['classic', /класс|classic|стандарт|обычн/], ['editorial', /витрин|журнал|editorial|премиум|полос/], ['minimal', /минимал|лаконич|minimal|строг|прост/]].find(x => x[1].test(d));
    if (Theme.DESIGNS[d]) p.design = d; else if (ru) p.design = ru[0]; else W('Дизайн: ' + profile.design, 'Неизвестный вариант оформления — поставлен «classic»', 'Доступны: classic, editorial, minimal');
  }
  if (profile.accent) { if (Theme.validHex(profile.accent)) p.accent = '#' + profile.accent.replace('#', '').toLowerCase(); else W('Акцент: ' + profile.accent, 'Цвет должен быть в формате #d94f87', ''); }
  if (schedSeen) { const w = {}, miss = []; DAYS.forEach(d => { if (sched[d]) w[d] = sched[d]; else { w[d] = { intervals: [], breaks: [] }; miss.push(DAY_SH[d]); } }); res.schedule = w; if (miss.length) W('', 'В графике не указано: ' + miss.join(', ') + ' — эти дни выходные', 'Допишите строки, если мастер там работает', 'info'); }
  else { const w = {}; DAYS.forEach((d, i) => w[d] = { intervals: i < 5 ? [{ from: '10:00', to: '19:00' }] : [], breaks: [] }); res.schedule = w; res.scheduleDefault = true; W('', 'График не указан — поставлено: будни 10:00–19:00', 'Добавьте раздел «График:» или поправьте в кабинете', 'info'); }
  if (!res.categories.length) W('', 'Услуги не найдены', 'Добавьте раздел «Услуги:» — мастер сможет заполнить его и в кабинете');
  return res;
}
module.exports = { parse, parsePrice, parseDuration };
