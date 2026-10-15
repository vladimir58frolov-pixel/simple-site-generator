'use strict';
const fs = require('fs'), path = require('path'), store = require('./store'), auth = require('./auth'), create = require('./create');
const DEMO_PASSWORD = 'demo12345';
const A = `Имя: Арина
Специализация: Мастер маникюра
Адрес: Пр. Победы 124Б, ТРЦ Квадрат
Телефон: +7 900 000-00-00
Instagram: @arina_nails
Telegram: @arina
Тема: rose
О себе: Работаю с 2018 года. Стерильные инструменты, качественные материалы, аккуратная работа.
График:
пн-пт 10:00-19:00, перерыв 14:00-15:00
сб 10:00-16:00
вс выходной
Услуги:
[Маникюр]
COMPLEX 1. мне красить не надо | снятие (при наличии покрытия) + гигиенический маникюр | 1200 | 30 мин
COMPLEX 2. однотон | снятие/маникюр/моделирование/укрепление/ремонт+цвет | 2000 | 1 ч 30 мин | популярная
COMPLEX 3. хочу френч | снятие/маникюр/моделирование/укрепление/френч | 2500 | 2 ч
COMPLEX 4. нужно все восстановить | снятие/маникюр/моделирование/укрепление/достраивание углов/выравнивание | 2500 | 2 ч
ремонт срочно | | 800 | 20 мин
[Наращивание]
COMPLEX S-L | снятие/маникюр/наращивание длины s-l | 3000 | 2 ч | популярная
коррекция наращивания | снятие/маникюр/моделирование | 2500 | 1 ч 30 мин | популярная`;
const B = `Имя: Марина Лисова
Специализация: Nail-мастер и педикюр
Адрес: ул. Садовая, 15, студия «Лотос»
Телефон: 8 912 345-67-89
Instagram: @marina.lotos
Telegram: @marina_lotos
Тема: lavender
О себе: Маникюр, педикюр и дизайн. Уютная студия, чай и хорошая музыка. Принимаю по записи.
График:
вт-сб 11:00-20:00, перерыв 15:00-15:30
пн, вс выходной
Услуги:
[Маникюр]
Классический маникюр | обработка кутикулы, форма | 1100 | 45 мин
Маникюр + гель-лак | снятие, маникюр, покрытие в один цвет | 2200 | 1 ч 30 мин | популярная
Дизайн (за ноготь) | втирка, фольга, рисунок | 150 | 10 мин
[Педикюр]
Педикюр классический | обработка стоп и пальцев | 2000 | 1 ч 15 мин
Педикюр + покрытие | с гель-лаком | 2800 | 1 ч 45 мин | популярная
Smart-педикюр | аппаратная обработка, увлажнение | 3000 | 1 ч 30 мин | популярная`;
const PAL = [['#f8c8dc', '#e0458b'], ['#d9c8f8', '#7c5cd1'], ['#c8f0e0', '#4aa37c'], ['#fde2c8', '#e08a45'], ['#c8dcf8', '#4573e0'], ['#f8e0f0', '#b04590']];
function svg(i) { const [a, b] = PAL[i % PAL.length]; const nails = [0, 1, 2, 3, 4].map(k => `<rect x="${70 + k * 62}" y="${120 + Math.abs(2 - k) * 22}" width="46" height="${120 - Math.abs(2 - k) * 14}" rx="22" fill="${i % 2 ? b : '#fff'}" opacity=".92"/><rect x="${78 + k * 62}" y="${128 + Math.abs(2 - k) * 22}" width="12" height="40" rx="6" fill="#fff" opacity=".35"/>`).join(''); return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="400" height="400" fill="url(#g)"/><circle cx="330" cy="70" r="50" fill="#fff" opacity=".18"/>${nails}</svg>`; }
function ensure() {
  const out = [];
  if (!store.slugList().includes('demo')) {
    const r = create.createMaster({ text: A, slug: 'demo' }); finish(r.slug); const m = store.readJSON('demo', 'master.json'); m.setupDone = true; store.writeJSON('demo', 'master.json', m); out.push('demo');
  }
  if (!store.slugList().includes('demo-lavender')) {
    const r = create.createMaster({ text: B, slug: 'demo-lavender' }); finish(r.slug);
    const m = store.readJSON(r.slug, 'master.json'); m.setupDone = true; store.writeJSON(r.slug, 'master.json', m);
    const d = path.join(store.masterDir(r.slug), 'photos', 'works'); fs.mkdirSync(d, { recursive: true }); const names = [];
    for (let i = 0; i < 6; i++) { const f = `work-${i + 1}.svg`; fs.writeFileSync(path.join(d, f), svg(i)); names.push(f); }
    m.photos = { works: names, studio: [] }; store.writeJSON(r.slug, 'master.json', m);
    const day = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
    store.writeJSON(r.slug, 'reviews.json', { _подсказка: 'Отзывы. rating 1–5, hidden: true — скрыть, reply — ответ мастера.', items: [
      { id: 'r1', name: 'Анастасия', rating: 5, text: 'Очень аккуратный маникюр, держится уже третью неделю. В студии уютно и чисто!', date: day(12), reply: 'Спасибо, Анастасия! Буду рада видеть вас снова 💜', replyDate: day(11), hidden: false },
      { id: 'r2', name: 'Ольга', rating: 5, text: 'Педикюр — лучший в городе. Мастер внимательная, всё объясняет.', date: day(30), reply: '', replyDate: '', hidden: false },
      { id: 'r3', name: 'Екатерина', rating: 4, text: 'Дизайн получился красивым, немного пришлось подождать в начале.', date: day(45), reply: 'Екатерина, спасибо! Учту замечание про ожидание.', replyDate: day(44), hidden: false }] });
    out.push('demo-lavender');
  }
  return out;
}
function finish(slug) { const a = store.readJSON(slug, 'auth.json', {}); a.passwordHash = auth.hashPassword(DEMO_PASSWORD); a.invite = null; store.writeJSON(slug, 'auth.json', a, { noBackup: true }); }
module.exports = { ensure, DEMO_PASSWORD, A };
