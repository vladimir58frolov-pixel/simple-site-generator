'use strict';
const { localToUtc } = require('./slots'), { fromMin, fmtDur, esc } = require('./util');
async function tg(token, method, body) { const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}), signal: AbortSignal.timeout(8000) }); const j = await r.json().catch(() => ({})); if (!j.ok) throw new Error(j.description || 'Ошибка Telegram'); return j.result; }
async function send(master, text) { if (!master.telegramToken || !master.telegramChatId) return false; try { await tg(master.telegramToken, 'sendMessage', { chat_id: master.telegramChatId, text, disable_web_page_preview: true }); return true; } catch (e) { console.warn('Telegram:', e.message); return false; } }
async function detectChat(token) { const ups = await tg(token, 'getUpdates', { limit: 20 }); for (let i = ups.length - 1; i >= 0; i--) { const m = ups[i].message || ups[i].my_chat_member; if (m && m.chat && m.chat.type === 'private') return String(m.chat.id); } return null; }
const ruDate = d => { const [y, m, dd] = d.split('-'); return `${dd}.${m}.${y}`; };
function bookingText(kind, b) {
  const head = { new: '🆕 Новая запись', cancel: '❌ Клиент отменил запись', move: '🔁 Клиент перенёс запись', review: '⭐ Новый отзыв' }[kind];
  return `${head}\n${ruDate(b.date)} в ${fromMin(b.start)} (${fmtDur(b.duration)})\n${b.client.name}, ${b.client.phone}\n${b.services.map(s => s.name).join(', ')}\nСумма: ${b.total} ₽${b.comment ? '\nКомментарий: ' + b.comment : ''}`;
}
function ics(master, b) {
  const st = localToUtc(b.date, b.start, master.timezone), en = new Date(st.getTime() + b.duration * 60000), f = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const t = s => String(s).replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Beauty Booking//RU', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT', `UID:${b.id}@booking`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(st)}`, `DTEND:${f(en)}`,
    `SUMMARY:${t('Запись: ' + b.services.map(s => s.name).join(', '))}`, `LOCATION:${t(master.address || '')}`, `DESCRIPTION:${t('Мастер: ' + master.name + (master.phone ? '\nТелефон: ' + master.phone : '') + '\nСумма: ' + b.total + ' ₽')}`,
    'BEGIN:VALARM', 'TRIGGER:-PT3H', 'ACTION:DISPLAY', 'DESCRIPTION:Напоминание о записи', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
}
module.exports = { send, tg, detectChat, bookingText, ics };
