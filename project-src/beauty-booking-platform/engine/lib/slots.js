'use strict';
const { p2, toMin, fromMin, DAYS } = require('./util');
function nowLocal(tz) {
  let f; try { f = new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'Europe/Moscow', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch { f = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); }
  const o = {}; f.formatToParts(new Date()).forEach(p => o[p.type] = p.value);
  const minutes = +o.hour * 60 + +o.minute, date = `${o.year}-${o.month}-${o.day}`;
  return { date, minutes, abs: Date.UTC(+o.year, +o.month - 1, +o.day) / 60000 + minutes };
}
const parseDate = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); if (!m) return null; const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])); return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? d : null; };
const dayId = s => DAYS[(parseDate(s).getUTCDay() + 6) % 7];
const addDays = (s, n) => { const d = parseDate(s); d.setUTCDate(d.getUTCDate() + n); return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`; };
const absOf = (date, min) => parseDate(date).getTime() / 60000 + min;
function daySched(sch, date) { const sp = sch.special && sch.special[date]; if (sp) return { intervals: sp.off ? [] : (sp.intervals || []), breaks: sp.off ? [] : (sp.breaks || []) }; return (sch.week && sch.week[dayId(date)]) || { intervals: [], breaks: [] }; }
const active = b => b.status !== 'canceled';
const clash = (s, e, a, b) => s < b && a < e;
function getSlots(master, sch, bookings, date, duration, excludeId) {
  if (!parseDate(date) || !(duration > 0)) return [];
  const now = nowLocal(master.timezone), horizon = +sch.horizonDays || 60;
  if (date < now.date || date > addDays(now.date, horizon)) return [];
  const step = Math.max(5, +sch.slotStep || 30), notice = (+sch.minNoticeHours || 0) * 60, day = daySched(sch, date), out = [];
  const taken = bookings.filter(b => b.date === date && active(b) && b.id !== excludeId);
  const brks = (day.breaks || []).map(b => [toMin(b.from), toMin(b.to)]).filter(b => b[0] < b[1]);
  for (const iv of day.intervals || []) {
    const a = toMin(iv.from), z = toMin(iv.to); if (!(a < z)) continue;
    for (let s = a; s + duration <= z; s += step) {
      if (absOf(date, s) < now.abs + notice) continue;
      if (brks.some(b => clash(s, s + duration, b[0], b[1]))) continue;
      if (taken.some(b => clash(s, s + duration, b.start, b.start + b.duration))) continue;
      if (!out.includes(fromMin(s))) out.push(fromMin(s));
    }
  }
  return out.sort();
}
function availableDays(master, sch, bookings, duration, from, count) {
  const now = nowLocal(master.timezone), horizon = +sch.horizonDays || 60, res = [];
  let d = from && from > now.date ? from : now.date;
  for (let i = 0; i < count; i++, d = addDays(d, 1)) { if (d > addDays(now.date, horizon)) break; if (getSlots(master, sch, bookings, d, duration).length) res.push(d); }
  return res;
}
function findConflicts(master, sch, bookings) {
  const now = nowLocal(master.timezone), out = [];
  for (const b of bookings) {
    if (!active(b) || b.date < now.date) continue;
    const day = daySched(sch, b.date), e = b.start + b.duration;
    const inside = (day.intervals || []).some(iv => b.start >= toMin(iv.from) && e <= toMin(iv.to));
    const inBreak = (day.breaks || []).some(br => clash(b.start, e, toMin(br.from), toMin(br.to)));
    if (!inside || inBreak) out.push({ id: b.id, date: b.date, time: fromMin(b.start), name: b.client && b.client.name });
  }
  return out.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}
function validateSchedule(s) {
  if (!s || typeof s !== 'object') return 'Некорректный график';
  const chk = d => { for (const iv of d.intervals || []) { if (!(toMin(iv.from) < toMin(iv.to))) return 'Конец рабочего времени должен быть позже начала'; } for (const b of d.breaks || []) if (!(toMin(b.from) < toMin(b.to))) return 'Конец перерыва должен быть позже начала'; return null; };
  for (const d of DAYS) { const e = chk(s.week[d] || {}); if (e) return e; }
  for (const k of Object.keys(s.special || {})) { if (!parseDate(k)) return 'Некорректная особая дата'; const e = chk(s.special[k]); if (e) return e; }
  if (![5, 10, 15, 20, 30, 45, 60, 90, 120].includes(+s.slotStep)) return 'Недопустимый шаг слотов';
  if (!(+s.horizonDays >= 1 && +s.horizonDays <= 365)) return 'Недопустимый горизонт записи';
  if (!(+s.minNoticeHours >= 0 && +s.minNoticeHours <= 720)) return 'Недопустимый минимальный срок';
  return null;
}
function tzOffsetMs(tz, utcMs) { const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }); const o = {}; f.formatToParts(new Date(utcMs)).forEach(p => o[p.type] = p.value); return Date.UTC(+o.year, +o.month - 1, +o.day, +o.hour, +o.minute, +o.second) - utcMs; }
function localToUtc(date, minutes, tz) { const guess = absOf(date, minutes) * 60000; let t = guess - tzOffsetMs(tz || 'Europe/Moscow', guess); t = guess - tzOffsetMs(tz || 'Europe/Moscow', t); return new Date(t); }
module.exports = { nowLocal, parseDate, dayId, addDays, daySched, getSlots, availableDays, findConflicts, validateSchedule, localToUtc, active, clash };
