'use strict';
const MAP = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };
const translit = s => String(s || '').toLowerCase().replace(/[а-яё]/g, c => MAP[c]).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30).replace(/-+$/, '');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const p2 = n => String(n).padStart(2, '0');
const toMin = t => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : NaN; };
const fromMin = m => p2(Math.floor(m / 60)) + ':' + p2(m % 60);
const fmtDur = m => { m = +m || 0; const h = Math.floor(m / 60), r = m % 60; return (h ? h + ' ч' : '') + (h && r ? ' ' : '') + (r || !h ? r + ' мин' : ''); };
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_RU = { mon: 'Понедельник', tue: 'Вторник', wed: 'Среда', thu: 'Четверг', fri: 'Пятница', sat: 'Суббота', sun: 'Воскресенье' };
const DAY_SH = { mon: 'пн', tue: 'вт', wed: 'ср', thu: 'чт', fri: 'пт', sat: 'сб', sun: 'вс' };
function normPhone(raw) {
  const d = String(raw || '').replace(/\D/g, ''); let n = d;
  if (n.length === 11 && (n[0] === '8' || n[0] === '7')) n = '7' + n.slice(1); else if (n.length === 10) n = '7' + n;
  if (n.length === 11 && n[0] === '7') return { ok: true, digits: n, pretty: `+7 ${n.slice(1, 4)} ${n.slice(4, 7)}-${n.slice(7, 9)}-${n.slice(9)}` };
  return { ok: d.length >= 10 && d.length <= 15, digits: d, pretty: d ? '+' + d : '' };
}
const DEF_SCHEDULE = () => { const w = {}; DAYS.forEach((d, i) => w[d] = i < 5 ? { intervals: [{ from: '10:00', to: '19:00' }], breaks: [] } : { intervals: [], breaks: [] }); return { slotStep: 30, minNoticeHours: 2, horizonDays: 60, week: w, special: {} }; };
module.exports = { translit, esc, p2, toMin, fromMin, fmtDur, DAYS, DAY_RU, DAY_SH, normPhone, DEF_SCHEDULE };
