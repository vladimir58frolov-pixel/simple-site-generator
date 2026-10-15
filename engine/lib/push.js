'use strict';
/* Web Push для мастеров: уведомления на телефон/компьютер даже при закрытом кабинете */
const webpush = require('web-push'), store = require('./store');
// Разрешены только адреса настоящих push-сервисов браузеров (защита от отправки запросов на произвольные адреса)
const HOST_OK = /(^|\.)(googleapis\.com|push\.services\.mozilla\.com|mozaws\.net|push\.apple\.com|notify\.windows\.com)$/i;
const b64u = /^[A-Za-z0-9_-]+={0,2}$/;
function vapid() {
  const c = store.readConfig(); if (!c) throw new Error('Платформа не настроена');
  if (!c.vapid || !c.vapid.publicKey || !c.vapid.privateKey) { const k = webpush.generateVAPIDKeys(); c.vapid = { publicKey: k.publicKey, privateKey: k.privateKey, subject: 'mailto:admin@example.com' }; store.writeConfig(c); }
  return c.vapid;
}
function endpointOk(u) { try { const x = new URL(u); if (process.env.PUSH_ALLOW_ANY === '1') return x.protocol === 'https:'; return x.protocol === 'https:' && HOST_OK.test(x.hostname) && u.length < 1000; } catch { return false; } }
function readSubs(slug) { try { return store.readJSON(slug, 'push.json', { subscriptions: [] }); } catch { return { subscriptions: [] }; } }
function validSub(s) { return s && typeof s.endpoint === 'string' && endpointOk(s.endpoint) && s.keys && typeof s.keys.p256dh === 'string' && typeof s.keys.auth === 'string' && b64u.test(s.keys.p256dh) && b64u.test(s.keys.auth) && s.keys.p256dh.length < 200 && s.keys.auth.length < 50; }
function add(slug, s) {
  if (!validSub(s)) throw Object.assign(new Error('Это устройство не поддерживается для уведомлений'), { status: 400 });
  const d = readSubs(slug); d.subscriptions = (d.subscriptions || []).filter(x => x.endpoint !== s.endpoint);
  d.subscriptions.push({ endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth }, created: new Date().toISOString() }); d.subscriptions = d.subscriptions.slice(-5);
  store.writeJSON(slug, 'push.json', Object.assign({ _подсказка: 'Устройства мастера для push-уведомлений. Не редактируйте вручную.' }, d), { noBackup: true });
}
function remove(slug, endpoint) { const d = readSubs(slug); const n = (d.subscriptions || []).length; d.subscriptions = (d.subscriptions || []).filter(x => x.endpoint !== endpoint); if (d.subscriptions.length !== n) store.writeJSON(slug, 'push.json', d, { noBackup: true }); }
async function send(slug, payload) {
  const d = readSubs(slug), subs = d.subscriptions || []; if (!subs.length) return { sent: 0, failed: 0 };
  const v = vapid(); let sent = 0, failed = 0;
  await Promise.all(subs.map(async s => {
    try { await webpush.sendNotification(s, JSON.stringify(payload), { vapidDetails: { subject: v.subject, publicKey: v.publicKey, privateKey: v.privateKey }, TTL: 86400, urgency: 'high', timeout: 8000 }); sent++; }
    catch (e) { failed++; if (e && (e.statusCode === 404 || e.statusCode === 410)) { try { remove(slug, s.endpoint); } catch { } } else console.warn('Push:', e && (e.statusCode || e.message)); }
  }));
  return { sent, failed };
}
module.exports = { vapid, add, remove, send, readSubs, endpointOk };
