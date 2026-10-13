/* Личный кабинет мастера */
(function () {
  const { $, $$, esc, ic, rub, dur, toast } = C, slug = C.boot.slug, app = document.getElementById('app');
  const A = p => `/api/a/${slug}${p}`, ap = (m, p, b, o) => C.api(m, A(p), b, o);
  const S = { me: null, wiz: 0 };
  const view = () => $('#view');
  const avaIn = (u, n) => u ? `<img src="${esc(u)}" alt="">` : `<div>${esc(C.initial(n))}</div>`;
  const ID = s => document.getElementById(s);
  const fld = (label, inner, hint) => `<label class="fld"><span>${label}</span>${inner}${hint ? `<div class="hint">${hint}</div>` : ''}</label>`;
  const strength = pw => { let s = 0; if (pw.length >= 8) s++; if (pw.length >= 11) s++; if (/[a-zа-я]/.test(pw) && /[A-ZА-Я]/.test(pw)) s++; if (/\d/.test(pw) && /[^\dA-Za-zА-Яа-я]/.test(pw) || (/\d/.test(pw) && pw.length >= 10)) s++; return Math.min(4, s); };
  const strHtml = pw => { const s = pw ? strength(pw) : 0, col = ['#d64545', '#e8a317', '#7cb342', '#2e9d5b'][Math.max(0, s - 1)], txt = !pw ? '' : ['Слабый', 'Простоват', 'Хороший', 'Отличный'][Math.max(0, s - 1)]; return `<div class="pw"><i style="width:${s * 25}%;background:${col}"></i></div><div class="hint">${pw ? 'Надёжность: ' + txt : 'Не короче 8 символов. Лучше длиннее: слова, цифры, знаки.'}</div>`; };
  const pwField = (id, label) => `<label class="fld"><span>${label}</span><div style="position:relative"><input class="in" id="${id}" type="password" autocomplete="${id === 'pw-cur' ? 'current-password' : 'new-password'}" style="padding-right:52px"><button type="button" class="icon-btn flat" data-eye="${id}" style="position:absolute;right:2px;top:3px" aria-label="Показать пароль">${ic('eye')}</button></div></label>`;
  document.addEventListener('click', e => { const b = e.target.closest('[data-eye]'); if (b) { const i = ID(b.dataset.eye); i.type = i.type === 'password' ? 'text' : 'password'; } });
  C.hooks.auth = () => { if (!S.loginShown) login(); };
  C.hooks.broken = d => brokenDialog(d);
  function brokenDialog(d) {
    const s = C.sheet({ center: true, title: 'Файл повреждён', body: `<p style="margin:0 0 14px">${esc(d.error)}</p><p class="hint" style="margin:0 0 16px">${d.canRestore ? 'Можно вернуть последнюю рабочую копию этого файла. Свежие изменения в нём могут потеряться.' : 'Рабочей копии нет. Обратитесь к администратору платформы.'}</p>${d.canRestore ? '<button class="btn block" data-r>Восстановить из копии</button>' : ''}` });
    s.el.addEventListener('click', async e => { if (e.target.closest('[data-r]')) { try { await ap('POST', '/restore', { file: d.file }); toast('Файл восстановлен'); s.close(); location.reload(); } catch (er) { C.err(er); } } });
  }
  /* ---------- вход / приглашение ---------- */
  function login(msg) {
    S.loginShown = true;
    app.innerHTML = `<div class="login fade"><div class="logo">${ic('lock')}</div><h1>Кабинет мастера</h1><p class="mut" style="margin:0 0 24px">Войдите, чтобы управлять записями, услугами и графиком.</p>${pwField('pw-cur', 'Пароль')}<div class="err-t ${msg ? '' : 'hide'}" id="lerr">${esc(msg || '')}</div><button class="btn block" id="lgo" style="margin-top:8px">Войти</button><p class="hint" style="text-align:center;margin-top:20px">Забыли пароль? Напишите администратору — он пришлёт новую ссылку для входа.</p></div>`;
    const go = async () => { const b = ID('lgo'); b.disabled = true; try { const r = await ap('POST', '/login', { password: ID('pw-cur').value }); C.csrf = r.csrf; S.loginShown = false; init(); } catch (e) { b.disabled = false; const el = ID('lerr'); el.textContent = e.message; el.classList.remove('hide'); } };
    ID('lgo').onclick = go; ID('pw-cur').addEventListener('keydown', e => { if (e.key === 'Enter') go(); }); ID('pw-cur').focus();
  }
  async function invite(token) {
    let d; try { d = await ap('GET', '/invite?token=' + encodeURIComponent(token)); } catch (e) { d = { state: 'bad' }; }
    if (d.state !== 'ok') { app.innerHTML = `<div class="login fade"><div class="logo">${ic('alert')}</div><h1>${d.state === 'expired' ? 'Ссылка устарела' : 'Ссылка не работает'}</h1><p class="mut">${d.state === 'expired' ? 'Срок действия ссылки (7 дней) истёк.' : 'Эта ссылка уже использована или неверна.'} Попросите администратора прислать новую. Если вы уже создали пароль, <a href="/${slug}/admin">войдите здесь</a>.</p></div>`; return; }
    app.innerHTML = `<div class="login fade"><div class="logo">${ic('sparkle')}</div><h1>Добро пожаловать, ${esc(d.name)}!</h1><p class="mut" style="margin:0 0 24px">Придумайте пароль для входа в личный кабинет. Ссылка сработает один раз.</p>${pwField('pw1', 'Новый пароль')}<div id="pws">${strHtml('')}</div>${pwField('pw2', 'Повторите пароль')}<div class="err-t hide" id="lerr"></div><button class="btn block" id="lgo" style="margin-top:8px">Создать пароль и войти</button></div>`;
    ID('pw1').addEventListener('input', () => ID('pws').innerHTML = strHtml(ID('pw1').value));
    ID('lgo').onclick = async () => { const er = ID('lerr'); er.classList.add('hide'); const a = ID('pw1').value; if (a !== ID('pw2').value) { er.textContent = 'Пароли не совпадают'; er.classList.remove('hide'); return; } const b = ID('lgo'); b.disabled = true; try { const r = await ap('POST', '/invite/accept', { token, password: a }); C.csrf = r.csrf; history.replaceState({}, '', `/${slug}/admin`); init(); } catch (e) { b.disabled = false; er.textContent = e.message; er.classList.remove('hide'); } };
  }
  /* ---------- каркас ---------- */
  const TABS = [['bookings', 'Записи', 'calendar'], ['services', 'Услуги', 'tag'], ['schedule', 'График', 'clock'], ['profile', 'Профиль', 'user'], ['more', 'Ещё', 'more']];
  const MORE = ['reviews', 'photos', 'page', 'more'];
  async function init() {
    const im = /\/admin\/invite\/([^/?#]+)/.exec(location.pathname); if (im) return invite(im[1]);
    try { S.me = await ap('GET', '/me'); C.csrf = S.me.csrf; } catch (e) { if (e.status === 401) { login(); return; } if (e.code === 'BROKEN_JSON') { app.innerHTML = '<div class="login"><h1>Кабинет</h1></div>'; return; } app.innerHTML = `<div class="login"><h1>Ошибка</h1><p class="mut">${esc(e.message)}</p></div>`; return; }
    C.applyTheme(S.me.profile.theme, S.me.profile.accent);
    if (!S.me.profile.setupDone && !S.wizDone) { S.wiz = 1; return wizard(); }
    shell(); route();
  }
  function shell() {
    app.innerHTML = `<div class="wrap adm"><div id="wizbar"></div><div id="view"></div></div><nav class="tabbar" aria-label="Разделы">${TABS.map(t => `<a href="#/${t[0]}" data-tab="${t[0]}">${ic(t[2])}<span>${t[1]}</span></a>`).join('')}</nav>`;
  }
  window.addEventListener('hashchange', () => { if (S.me && ID('view')) route(); });
  const VIEWS = {};
  async function route() {
    const r = (location.hash.replace(/^#\//, '') || 'bookings').split('?')[0]; const v = VIEWS[r] ? r : 'bookings'; S.cur = v;
    $$('.tabbar a').forEach(a => a.classList.toggle('on', a.dataset.tab === v || (a.dataset.tab === 'more' && MORE.includes(v))));
    const wb = ID('wizbar'); if (wb) wb.innerHTML = S.wiz ? `<div class="notice" style="margin-top:16px;justify-content:space-between;align-items:center"><span>Настройка · шаг ${S.wiz} из 4</span><button class="btn xs" id="wiz-back">Продолжить</button></div>` : '';
    if (S.wiz && ID('wiz-back')) ID('wiz-back').onclick = () => wizard();
    view().innerHTML = '<div class="sec" style="padding-top:24px"><div class="sk sk-card"></div><div class="sk sk-card" style="margin-top:12px"></div></div>'; scrollTo(0, 0);
    try { await VIEWS[v](); } catch (e) { if (e.status !== 401 && e.code !== 'BROKEN_JSON') view().innerHTML = C.empty('alert', 'Не удалось загрузить', e.message, '<div style="margin-top:16px"><button class="btn" onclick="location.reload()">Обновить</button></div>'); }
  }
  const head = (title, right) => `<div class="top"><h2>${title}</h2>${right || ''}</div>`;
  const undoBtn = file => `<button class="icon-btn" data-undo="${file}" aria-label="Отменить последнее изменение" title="Отменить последнее изменение">${ic('undo')}</button>`;
  document.addEventListener('click', async e => { const b = e.target.closest('[data-undo]'); if (!b) return; if (!await C.confirm('Отменить последнее изменение?', 'Вернём прошлую версию. Нажмите ещё раз, чтобы вернуть обратно.', { ok: 'Отменить изменение' })) return; try { await ap('POST', '/undo', { file: b.dataset.undo }); toast('Готово — последнее изменение отменено'); if (b.dataset.undo === 'master.json') S.me = await ap('GET', '/me'); route(); } catch (er) { C.err(er); } });
  /* Время всегда в 24-часовом формате ЧЧ:ММ, независимо от региона браузера */
  document.addEventListener('input', e => { const t = e.target; if (!t.classList || !t.classList.contains('tmask')) return; const d = t.value.replace(/\D/g, '').slice(0, 4); t.value = d.length > 2 ? d.slice(0, 2) + ':' + d.slice(2) : d; });
  document.addEventListener('focusin', e => { if (e.target.classList && e.target.classList.contains('tmask')) e.target.dataset.prev = e.target.value; });
  document.addEventListener('change', e => { const t = e.target; if (!t.classList || !t.classList.contains('tmask') || !t.value) return; const d = t.value.replace(/\D/g, ''); let h, m; if (d.length <= 2) { h = +d; m = 0; } else if (d.length === 3) { h = +d[0]; m = +d.slice(1); } else { h = +d.slice(0, 2); m = +d.slice(2); }
    if (isNaN(h) || h > 23 || m > 59) { t.value = t.dataset.prev || ''; e.stopImmediatePropagation(); toast('Время вводится как 09:30', true); return; } t.value = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'); }, true);
  const phoneDigits = p => String(p || '').replace(/\D/g, '');
  const ST = { booked: ['Ожидает', 'ac'], came: ['Пришёл', 'ok'], noshow: ['Не пришёл', 'warn'], canceled: ['Отменена', 'bad'] };
  const hm = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  const tmin = t => { const [h, m] = String(t || '').split(':').map(Number); return isNaN(h) || isNaN(m) ? NaN : h * 60 + m; };
  /* ---------- Записи ---------- */
  const BK = { scope: 'up', status: 'all', date: '' };
  VIEWS.bookings = async function () {
    const d = await ap('GET', '/bookings'); BK.d = d; drawBookings();
  };
  function drawBookings() {
    const d = BK.d, today = d.today; let items = d.items.slice();
    const isUp = b => b.date > today || (b.date === today && b.start + b.duration > d.nowMin);
    if (BK.scope === 'up') items = items.filter(isUp); else if (BK.scope === 'past') items = items.filter(b => !isUp(b));
    if (BK.status !== 'all') items = items.filter(b => b.status === BK.status);
    if (BK.date) items = items.filter(b => b.date === BK.date);
    const key = b => b.date + String(b.start).padStart(4, '0'); items.sort((a, b) => BK.scope === 'past' ? key(b).localeCompare(key(a)) : key(a).localeCompare(key(b)));
    const lab = s => s === today ? 'Сегодня' : s === C.addDays(today, 1) ? 'Завтра' : s === C.addDays(today, -1) ? 'Вчера' : '';
    let h = '', last = '';
    items.forEach(b => { if (b.date !== last) { last = b.date; const l = lab(b.date); h += `<div class="day-h">${l ? l + ' · ' : ''}${C.fmtDate(b.date, !l)}</div>`; } h += bkCard(b); });
    const upN = d.items.filter(b => isUp(b) && b.status === 'booked').length;
    view().innerHTML = `${head('Записи', `<span class="badge ac">${upN} впереди</span>`)}<div class="seg3">${[['up', 'Ближайшие'], ['past', 'Прошедшие'], ['all', 'Все']].map(x => `<button data-sc="${x[0]}" class="${BK.scope === x[0] ? 'on' : ''}">${x[1]}</button>`).join('')}</div>
    <div class="filters">${[['all', 'Все'], ['booked', 'Ожидают'], ['came', 'Пришли'], ['noshow', 'Не пришли'], ['canceled', 'Отменены']].map(x => `<button class="pill ${BK.status === x[0] ? 'on' : ''}" data-st="${x[0]}">${x[1]}</button>`).join('')}<label class="pill ${BK.date ? 'on' : ''}" style="display:flex;gap:6px;align-items:center">${ic('calendar', 's')}<input type="date" id="bk-date" value="${BK.date}" style="border:0;background:none;font:inherit;color:inherit;width:${BK.date ? '130px' : '24px'};padding:0;overflow:hidden" aria-label="Фильтр по дате">${BK.date ? `<button data-cleardate aria-label="Сбросить дату">${ic('x', 's')}</button>` : ''}</label></div>
    ${h || C.empty('calendar', BK.scope === 'up' ? 'Ближайших записей нет' : 'Записей не найдено', BK.date || BK.status !== 'all' ? 'Попробуйте сбросить фильтры.' : 'Когда клиенты запишутся, они появятся здесь.')}
    <button class="fab" id="bk-add" aria-label="Добавить запись">${ic('plus', 'l')}</button>`;
  }
  function bkCard(b) {
    const st = ST[b.status] || ST.booked, dg = phoneDigits(b.client.phone), utm = b.utm && (b.utm.utm_source || b.utm.utm_medium) ? [b.utm.utm_source, b.utm.utm_medium, b.utm.utm_content].filter(Boolean).join(' / ') : '';
    const acts = b.status === 'booked' ? `<button class="btn xs" data-ba="came" data-id="${b.id}">${ic('check', 's')}Пришёл</button><button class="btn xs ghost" data-ba="noshow" data-id="${b.id}">Не пришёл</button><button class="btn xs ghost" data-ba="move" data-id="${b.id}">${ic('repeat', 's')}Перенести</button><button class="btn xs ghost" data-ba="cancel" data-id="${b.id}">Отменить</button>` : `<button class="btn xs ghost" data-ba="booked" data-id="${b.id}">${b.status === 'canceled' ? 'Восстановить' : 'Вернуть в «ожидает»'}</button>`;
    return `<div class="bk ${b.status === 'canceled' ? 'cx' : ''}"><div class="tm2 num">${hm(b.start)}<small>${hm(b.start + b.duration)}</small></div><div><div class="nm">${esc(b.client.name)}<span class="badge ${st[1]}">${st[0]}</span>${b.source === 'manual' ? '<span class="badge">вручную</span>' : ''}</div><div class="sv">${b.services.map(s => esc(s.name)).join(', ')} · <b class="num">${rub(b.total)}</b></div>
    ${b.client.phone ? `<div class="chips"><a class="chip" href="tel:+${dg}">${ic('phone', 's')}${esc(b.client.phone)}</a><a class="chip" target="_blank" rel="noopener" href="https://wa.me/${dg}">${ic('wa', 's')}Написать</a></div>` : ''}${b.comment ? `<div class="cm">${esc(b.comment)}</div>` : ''}${utm ? `<div class="hint">Источник: ${esc(utm)}</div>` : ''}<div class="acts">${acts}</div></div></div>`;
  }
  document.addEventListener('click', async e => {
    if (S.cur !== 'bookings' || !BK.d) return; const t = e.target; let x;
    if (x = t.closest('[data-sc]')) { BK.scope = x.dataset.sc; drawBookings(); }
    else if (x = t.closest('[data-st]')) { BK.status = x.dataset.st; drawBookings(); }
    else if (t.closest('[data-cleardate]')) { e.preventDefault(); BK.date = ''; drawBookings(); }
    else if (t.closest('#bk-add')) addBooking();
    else if (x = t.closest('[data-ba]')) {
      const id = x.dataset.id, b = BK.d.items.find(i => i.id === id), a = x.dataset.ba;
      if (a === 'move') return moveBooking(b);
      if (a === 'cancel' && !await C.confirm('Отменить запись?', `${b.client.name}, ${C.fmtDate(b.date)}, ${hm(b.start)}`, { ok: 'Отменить запись', cancel: 'Не отменять', danger: true })) return;
      try { await ap('PATCH', '/bookings/' + id, { status: a === 'cancel' ? 'canceled' : a }); toast(a === 'cancel' ? 'Запись отменена' : 'Готово'); VIEWS.bookings(); } catch (er) { C.err(er); }
    }
  });
  document.addEventListener('change', e => { if (e.target.id === 'bk-date') { BK.date = e.target.value; drawBookings(); } });
  async function slotChips(box, date, duration, exclude, onPick) {
    box.innerHTML = '<span class="hint">Загружаем свободное время…</span>'; try { const r = await ap('GET', `/slots?date=${date}&duration=${duration}${exclude ? '&exclude=' + exclude : ''}`); box.innerHTML = r.slots.length ? `<div class="hint" style="margin-bottom:6px">Свободно по графику:</div><div class="chips">${r.slots.map(s => `<button type="button" class="chip" data-sl="${s}">${s}</button>`).join('')}</div>` : '<span class="hint">По графику на этот день свободного времени нет — можно выбрать время вручную.</span>'; box.onclick = ev => { const c = ev.target.closest('[data-sl]'); if (c) onPick(c.dataset.sl); }; } catch (er) { box.innerHTML = ''; }
  }
  async function moveBooking(b) {
    const s = C.sheet({ title: 'Перенос записи', center: true, body: `<p class="mut" style="margin:0 0 12px">${esc(b.client.name)} · ${dur(b.duration)}</p><div class="row2">${fld('Дата', `<input class="in" type="date" id="mv-d" value="${b.date}">`)}${fld('Время', `<input class="in tmask" inputmode="numeric" maxlength="5" autocomplete="off" placeholder="ЧЧ:ММ" id="mv-t" value="${hm(b.start)}">`)}</div><div id="mv-s"></div>`, footer: '<button class="btn block" id="mv-go">Перенести</button>' });
    const refresh = () => slotChips(ID('mv-s'), ID('mv-d').value, b.duration, b.id, t => { ID('mv-t').value = t; }); ID('mv-d').onchange = refresh; refresh();
    ID('mv-go').onclick = async () => { const body = { date: ID('mv-d').value, time: ID('mv-t').value }; try { await ap('PATCH', '/bookings/' + b.id, body); } catch (e) { if (e.code === 'OVERLAP') { if (!await C.confirm('Время занято', e.message, { ok: 'Всё равно перенести' })) return; await ap('PATCH', '/bookings/' + b.id, { ...body, force: true }); } else return C.err(e); } s.close(); toast('Запись перенесена'); VIEWS.bookings(); };
  }
  async function addBooking() {
    const svc = (await ap('GET', '/services')).categories, flat = svc.flatMap(c => c.services), today = BK.d.today;
    const s = C.sheet({ title: 'Новая запись', full: true, body: `${fld('Имя клиента', '<input class="in" id="ab-n" maxlength="60" autocomplete="off">')}${fld('Телефон', '<input class="in" id="ab-p" type="tel" placeholder="+7 900 000-00-00">')}<div class="mlabel">Услуги</div><div class="list" id="ab-s" style="margin-bottom:12px">${flat.length ? svc.map(c => c.services.map(v => `<label class="check card" style="padding:12px 14px"><input type="checkbox" value="${v.id}" data-d="${v.duration}"><span class="bx">${ic('check', 's')}</span><span style="flex:1;color:var(--tx)"><b>${esc(v.name)}</b><br><span class="mut num">${rub(v.price)} · ${dur(v.duration)}</span></span></label>`).join('')).join('') : '<div class="hint">Услуг пока нет — укажите длительность ниже.</div>'}</div><div id="ab-c" class="${flat.length ? 'hide' : ''}"><div class="row2">${fld('Название', '<input class="in" id="ab-ct" placeholder="Запись">')}${fld('Цена, ₽', '<input class="in" id="ab-cp" type="number" min="0" inputmode="numeric">')}</div>${fld('Длительность, мин', '<input class="in" id="ab-cd" type="number" min="5" max="720" value="60">')}</div>${flat.length ? '<button class="btn soft xs" type="button" id="ab-tog" style="margin-bottom:14px">Другая услуга (вручную)</button>' : ''}<div class="row2">${fld('Дата', `<input class="in" type="date" id="ab-d" value="${today}">`)}${fld('Время', '<input class="in tmask" inputmode="numeric" maxlength="5" autocomplete="off" placeholder="ЧЧ:ММ" id="ab-t">')}</div><div id="ab-sl"></div>${fld('Комментарий', '<textarea class="in" id="ab-m" maxlength="500"></textarea>')}`, footer: '<button class="btn block" id="ab-go">Добавить запись</button>' });
    C.phoneInput(ID('ab-p'));
    const durNow = () => { const ch = $$('#ab-s input:checked').map(i => +i.dataset.d); return ch.length ? ch.reduce((a, b) => a + b, 0) : (+ID('ab-cd').value || 60); }, refresh = () => slotChips(ID('ab-sl'), ID('ab-d').value, durNow(), null, t => { ID('ab-t').value = t; });
    ID('ab-s').onchange = refresh; ID('ab-d').onchange = refresh; ID('ab-cd').oninput = C.debounce(refresh, 400); refresh();
    const tg = ID('ab-tog'); if (tg) tg.onclick = () => { ID('ab-c').classList.toggle('hide'); };
    ID('ab-go').onclick = async () => {
      const ids = $$('#ab-s input:checked').map(i => i.value), body = { name: ID('ab-n').value, phone: ID('ab-p').value.length > 4 ? ID('ab-p').value : '', date: ID('ab-d').value, time: ID('ab-t').value, comment: ID('ab-m').value };
      if (ids.length) body.services = ids; else { body.title = ID('ab-ct').value; body.price = ID('ab-cp').value; body.duration = ID('ab-cd').value; }
      if (!body.time) return C.toast('Выберите время', true);
      try { await ap('POST', '/bookings', body); } catch (e) { if (e.code === 'OVERLAP') { if (!await C.confirm('Время занято', e.message, { ok: 'Всё равно добавить' })) return; try { await ap('POST', '/bookings', { ...body, force: true }); } catch (er) { return C.err(er); } } else return C.err(e); }
      s.close(); toast('Запись добавлена'); VIEWS.bookings();
    };
  }
  /* ---------- Услуги ---------- */
  const SV = { cats: [] };
  const DURS = [10, 15, 20, 25, 30, 40, 45, 50, 60, 75, 90, 105, 120, 135, 150, 165, 180, 210, 240, 270, 300, 360, 420, 480];
  let nidc = 0; const tmpId = () => 'new' + Date.now().toString(36) + (nidc++);
  VIEWS.services = async function () { SV.cats = (await ap('GET', '/services')).categories; drawServices(); };
  async function saveServices(msg) { try { const r = await ap('PUT', '/services', { categories: SV.cats }); SV.cats = r.categories; if (msg) toast(msg); return true; } catch (e) { C.err(e); VIEWS.services(); return false; } }
  const svcPreview = s => `<button class="svc" type="button" style="pointer-events:none"><div class="t"><b>${esc(s.name || 'Название услуги')}${s.popular ? '<span class="hot">хит</span>' : ''}</b>${s.desc ? `<small>${esc(s.desc)}</small>` : '<div style="height:8px"></div>'}<div class="chips"><span class="chip price num">${rub(s.price)}</span><span class="chip num">${ic('clock', 's')}${dur(s.duration)}</span></div></div>${ic('chev-r', 'mut')}</button>`;
  function drawServices() {
    const n = SV.cats.reduce((a, c) => a + c.services.length, 0);
    view().innerHTML = `${head('Услуги', `${undoBtn('services.json')}<button class="icon-btn" id="sv-imp" aria-label="Импорт списком" title="Импорт списком">${ic('list')}</button>`)}<div class="sec">${n ? `<p class="hint" style="margin:0 0 6px">Перетаскивайте за ${ic('grip', 's')} — порядок сохранится. Глаз скрывает услугу от клиентов, звезда — «популярная».</p>` : ''}<div id="cats">${SV.cats.map(catHtml).join('')}</div>${SV.cats.length ? '' : C.empty('tag', 'Пока нет услуг', 'Добавьте первую категорию или вставьте список услуг целиком.')}<div style="display:flex;gap:10px;margin-top:18px;flex-wrap:wrap"><button class="btn soft" id="sv-addcat">${ic('plus')}Категория</button><button class="btn ghost" id="sv-imp2">${ic('list')}Импорт списком</button></div></div>`;
    C.sortable(ID('cats'), { item: '.cat', handle: '.cgrip', onDone: ids => { SV.cats = ids.map(id => SV.cats.find(c => c.id === id)); saveServices(); } });
    $$('.sl', view()).forEach(box => C.sortable(box, { item: '.ed', handle: '.grip', onDone: ids => { const c = SV.cats.find(c => c.id === box.dataset.cat); c.services = ids.map(id => c.services.find(s => s.id === id)); saveServices(); } }));
  }
  function catHtml(c) {
    return `<div class="cat" data-id="${c.id}"><div class="cat-h"><span class="grip cgrip" aria-label="Переместить категорию">${ic('grip')}</span><h3>${esc(c.name)}</h3><button class="icon-btn flat" data-ce="${c.id}" aria-label="Переименовать">${ic('edit')}</button><button class="icon-btn flat" data-cd="${c.id}" aria-label="Удалить категорию">${ic('trash')}</button></div><div class="sl" data-cat="${c.id}">${c.services.map(s => `<div class="ed ${s.hidden ? 'hid' : ''}" data-id="${s.id}"><span class="grip" aria-label="Переместить">${ic('grip')}</span><div class="t"><b>${esc(s.name)}</b><small class="num">${rub(s.price)} · ${dur(s.duration)}${s.hidden ? ' · скрыта' : ''}</small></div><button class="icon-btn flat" data-sh="${s.id}" aria-label="${s.hidden ? 'Показать' : 'Скрыть'}">${ic(s.hidden ? 'eye-off' : 'eye')}</button><button class="icon-btn flat" data-sp="${s.id}" aria-label="Популярная" style="color:${s.popular ? 'var(--act)' : 'var(--mut)'}">${ic('star')}</button><button class="icon-btn flat" data-se="${s.id}" aria-label="Изменить">${ic('edit')}</button></div>`).join('')}</div><button class="btn soft sm" data-sa="${c.id}">${ic('plus', 's')}Услуга</button></div>`;
  }
  const findSvc = id => { for (const c of SV.cats) { const s = c.services.find(x => x.id === id); if (s) return { c, s }; } return {}; };
  function editSvc(id, catId) {
    const ex = id ? findSvc(id).s : null, cur = ex ? findSvc(id).c.id : catId, s = ex ? { ...ex } : { name: '', desc: '', price: 0, duration: 60, popular: false, hidden: false };
    const durs = DURS.includes(s.duration) ? DURS : DURS.concat([s.duration]).sort((a, b) => a - b);
    const sh = C.sheet({ title: ex ? 'Услуга' : 'Новая услуга', full: true, body: `${fld('Название', `<input class="in" id="sv-n" maxlength="90" value="${esc(s.name)}" placeholder="Например: COMPLEX 2. однотон">`)}${fld('Состав', `<textarea class="in" id="sv-d" maxlength="300" placeholder="Что входит: снятие / маникюр / покрытие…">${esc(s.desc)}</textarea>`)}<div class="row2">${fld('Цена, ₽', `<input class="in num" id="sv-p" type="number" min="0" max="1000000" inputmode="numeric" value="${s.price}">`)}${fld('Длительность', `<select class="in" id="sv-t">${durs.map(d => `<option value="${d}" ${d === s.duration ? 'selected' : ''}>${dur(d)}</option>`).join('')}</select>`)}</div>${fld('Категория', `<select class="in" id="sv-c">${SV.cats.map(c => `<option value="${c.id}" ${c.id === cur ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>`)}<label class="row" style="padding:10px 0"><span style="flex:1">Популярная (показывать на главной)</span><span class="sw"><input type="checkbox" id="sv-pop" ${s.popular ? 'checked' : ''}><i></i></span></label><label class="row" style="padding:10px 0"><span style="flex:1">Скрыть от клиентов</span><span class="sw"><input type="checkbox" id="sv-hid" ${s.hidden ? 'checked' : ''}><i></i></span></label><div class="mlabel" style="margin-top:12px">Так увидит клиент</div><div id="sv-pv"></div>`, footer: `<div style="display:flex;gap:10px">${ex ? `<button class="btn ghost" id="sv-del" aria-label="Удалить">${ic('trash')}</button>` : ''}<button class="btn" style="flex:1" id="sv-save">Сохранить</button></div>` });
    const read = () => ({ ...s, name: ID('sv-n').value.trim(), desc: ID('sv-d').value.trim(), price: Math.max(0, Math.round(+ID('sv-p').value || 0)), duration: +ID('sv-t').value, popular: ID('sv-pop').checked, hidden: ID('sv-hid').checked });
    const pv = () => ID('sv-pv').innerHTML = svcPreview(read()); pv(); sh.body.addEventListener('input', pv); sh.body.addEventListener('change', pv);
    ID('sv-save').onclick = async () => { const n = read(); if (!n.name) return C.toast('Введите название услуги', true); if (n.price < 0) return C.toast('Цена не может быть отрицательной', true);
      if (ex) { const f = findSvc(id); Object.assign(f.s, n); const to = ID('sv-c').value; if (to !== f.c.id) { f.c.services = f.c.services.filter(x => x.id !== id); SV.cats.find(c => c.id === to).services.push(f.s); } }
      else SV.cats.find(c => c.id === ID('sv-c').value).services.push({ ...n, id: tmpId() });
      if (await saveServices('Сохранено')) { sh.close(); drawServices(); } };
    const dl = ID('sv-del'); if (dl) dl.onclick = async () => { if (!await C.confirm('Удалить услугу?', ex.name, { ok: 'Удалить', danger: true })) return; const f = findSvc(id); f.c.services = f.c.services.filter(x => x.id !== id); if (await saveServices('Услуга удалена')) { sh.close(); drawServices(); } };
  }
  async function nameCat(c) {
    const sh = C.sheet({ title: c ? 'Переименовать категорию' : 'Новая категория', center: true, body: fld('Название', `<input class="in" id="cn" maxlength="40" value="${esc(c ? c.name : '')}" placeholder="Например: Маникюр">`), footer: '<button class="btn block" id="cn-go">Сохранить</button>' });
    ID('cn').focus(); const go = async () => { const v = ID('cn').value.trim(); if (!v) return C.toast('Введите название', true); if (c) c.name = v; else SV.cats.push({ id: tmpId(), name: v, services: [] }); if (await saveServices()) { sh.close(); drawServices(); } };
    ID('cn-go').onclick = go; ID('cn').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  }
  function importSvc() {
    const ph = '[Маникюр]\nСнятие + маникюр | снятие/гигиенический маникюр | 1200 | 30 мин\nОднотон | снятие/маникюр/покрытие | 2000 | 1 ч 30 мин | популярная\n[Наращивание]\nКоррекция | снятие/моделирование | 2500 | 1 ч 30 мин';
    const sh = C.sheet({ title: 'Импорт списком', full: true, body: `<p class="hint" style="margin:0 0 10px">Вставьте услуги. Категория — в квадратных скобках. Услуга: <b>название | состав | цена | длительность | популярная</b>.</p><textarea class="in" id="im-t" style="min-height:180px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:14px" placeholder="${esc(ph)}"></textarea><button class="btn soft sm" id="im-ex" style="margin-top:8px">Вставить пример</button><div id="im-r"></div>` });
    ID('im-ex').onclick = () => { ID('im-t').value = ph; };
    const chk = async () => { const t = ID('im-t').value.trim(); if (!t) return C.toast('Вставьте список услуг', true);
      let r; try { r = await ap('POST', '/services/parse', { text: t }); } catch (e) { return C.err(e); }
      ID('im-r').innerHTML = `<div class="blk"></div>${r.warnings.length ? `<div class="warn-l" style="margin-bottom:12px">${r.warnings.map(w => `<div class="wl ${w.level === 'info' ? 'info' : ''}"><code>${esc(w.line)}</code><b>${esc(w.text)}</b>${esc(w.hint)}</div>`).join('')}</div>` : ''}${r.categories.length ? `${r.categories.map(c => `<div class="mlabel">${esc(c.name)}</div><div class="rows" style="margin-bottom:10px">${c.services.map(s => `<div class="row" style="align-items:flex-start;flex-direction:column;gap:2px"><span>${esc(s.name)}${s.popular ? '<span class="hot">хит</span>' : ''}</span><span class="mut num" style="font-size:13px;font-weight:600">${rub(s.price)} · ${dur(s.duration)}${s.desc ? ' · ' + esc(s.desc) : ''}</span></div>`).join('')}</div>`).join('')}<label class="check" style="margin:12px 0"><input type="radio" name="im-m" value="add" checked><span class="bx" style="border-radius:50%">${ic('check', 's')}</span><span>Добавить к текущим услугам</span></label><label class="check" style="margin-bottom:14px"><input type="radio" name="im-m" value="rep"><span class="bx" style="border-radius:50%">${ic('check', 's')}</span><span>Заменить все текущие услуги</span></label><button class="btn block" id="im-ok">Применить</button>` : '<div class="err-t">Услуги не распознаны — поправьте текст.</div>'}`;
      const ok = ID('im-ok'); if (ok) ok.onclick = async () => { const rep = $('[name=im-m]:checked').value === 'rep'; if (rep && !await C.confirm('Заменить все услуги?', 'Текущий список будет заменён. Это можно отменить кнопкой «Отменить изменение».', { ok: 'Заменить', danger: true })) return;
        const cats = rep ? [] : SV.cats; r.categories.forEach(c => { let x = cats.find(k => k.name.toLowerCase() === c.name.toLowerCase()); if (!x) cats.push(x = { id: tmpId(), name: c.name, services: [] }); c.services.forEach(s => x.services.push({ id: tmpId(), name: s.name, desc: s.desc, price: s.price, duration: s.duration, popular: s.popular, hidden: false })); });
        SV.cats = cats; if (await saveServices('Импортировано: ' + r.categories.reduce((a, c) => a + c.services.length, 0))) { sh.close(); drawServices(); } };
    };
    sh.foot.classList.remove('hide'); sh.footer('<button class="btn block" id="im-go">Проверить</button>'); ID('im-go').onclick = chk;
  }
  document.addEventListener('click', async e => {
    if (S.cur !== 'services') return; const t = e.target; let x;
    if (t.closest('#sv-imp') || t.closest('#sv-imp2')) importSvc();
    else if (t.closest('#sv-addcat')) nameCat();
    else if (x = t.closest('[data-ce]')) nameCat(SV.cats.find(c => c.id === x.dataset.ce));
    else if (x = t.closest('[data-cd]')) { const c = SV.cats.find(c => c.id === x.dataset.cd); if (!await C.confirm('Удалить категорию?', c.services.length ? `Вместе с ней удалятся услуги: ${c.services.length}.` : c.name, { ok: 'Удалить', danger: true })) return; SV.cats = SV.cats.filter(k => k !== c); if (await saveServices('Категория удалена')) drawServices(); }
    else if (x = t.closest('[data-sa]')) editSvc(null, x.dataset.sa);
    else if (x = t.closest('[data-se]')) editSvc(x.dataset.se);
    else if (x = t.closest('[data-sh]')) { const s = findSvc(x.dataset.sh).s; s.hidden = !s.hidden; if (await saveServices()) drawServices(); }
    else if (x = t.closest('[data-sp]')) { const s = findSvc(x.dataset.sp).s; s.popular = !s.popular; if (await saveServices()) drawServices(); }
  });
  /* ---------- График ---------- */
  const SC = { s: null, dirty: false, my: null, ym: null };
  const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], DN = { mon: 'Понедельник', tue: 'Вторник', wed: 'Среда', thu: 'Четверг', fri: 'Пятница', sat: 'Суббота', sun: 'Воскресенье' };
  VIEWS.schedule = async function () { const r = await ap('GET', '/schedule'); SC.s = r.schedule; SC.today = r.today; SC.dirty = false; const d = C.pd(r.today); SC.y = d.getUTCFullYear(); SC.m = d.getUTCMonth(); drawSchedule(); };
  const timeIn = (v, a) => `<input class="in tmask" inputmode="numeric" maxlength="5" autocomplete="off" placeholder="ЧЧ:ММ" value="${v}" ${a}>`;
  const dayEd = (id, d) => { const on = d.intervals.length > 0; return `<div class="day" data-day="${id}"><div class="h"><b>${DN[id] || ''}</b><label class="sw"><input type="checkbox" data-on ${on ? 'checked' : ''} aria-label="Рабочий день"><i></i></label></div>${on ? `${d.intervals.map((iv, i) => `<div class="iv">${timeIn(iv.from, `data-iv="${i}" data-k="from"`)}<span>–</span>${timeIn(iv.to, `data-iv="${i}" data-k="to"`)}${d.intervals.length > 1 ? `<button class="icon-btn flat" data-rm-iv="${i}" aria-label="Убрать интервал">${ic('x')}</button>` : ''}</div>`).join('')}${d.breaks.map((iv, i) => `<div class="brk">Перерыв</div><div class="iv">${timeIn(iv.from, `data-br="${i}" data-k="from"`)}<span>–</span>${timeIn(iv.to, `data-br="${i}" data-k="to"`)}<button class="icon-btn flat" data-rm-br="${i}" aria-label="Убрать перерыв">${ic('x')}</button></div>`).join('')}<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><button class="btn soft xs" data-add-iv>${ic('plus', 's')}Интервал</button><button class="btn soft xs" data-add-br>${ic('plus', 's')}Перерыв</button>${id !== 'sun' && id !== 'sat' || true ? `<button class="btn ghost xs" data-copy-wd>Копировать на все будни</button>` : ''}</div>` : '<div class="hint" style="margin-top:6px">Выходной</div>'}</div>`; };
  function drawSchedule() {
    const s = SC.s, sp = Object.keys(s.special || {}).sort(), y = SC.y, m = SC.m, first = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7, dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    let cells = '<span></span>'.repeat(first); for (let d = 1; d <= dim; d++) { const k = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, x = s.special[k]; cells += `<button data-sd="${k}" class="${x ? 'sp' + (x.off ? ' off' : '') : ''} ${k === SC.today ? 'td' : ''} num" ${k < SC.today ? 'disabled' : ''}>${d}</button>`; }
    const opt = (arr, v, f) => arr.map(a => `<option value="${a}" ${+a === +v ? 'selected' : ''}>${f(a)}</option>`).join('');
    view().innerHTML = `${head('График', undoBtn('schedule.json'))}<div class="sec"><div class="card" style="margin-bottom:14px"><div class="row2">${fld('Шаг слотов', `<select class="in" id="sc-step">${opt([10, 15, 20, 30, 45, 60, 90, 120], s.slotStep, a => a + ' мин')}</select>`)}${fld('Закрывать запись за', `<select class="in" id="sc-min">${opt([0, 1, 2, 3, 6, 12, 24, 48], s.minNoticeHours, a => a ? a + ' ч до визита' : 'не закрывать')}</select>`)}</div>${fld('Горизонт записи', `<select class="in" id="sc-hor">${opt([14, 30, 60, 90, 180, 365], s.horizonDays, a => 'на ' + a + ' дн. вперёд')}</select>`)}</div>
    ${DAYS.map(d => dayEd(d, s.week[d])).join('')}<div class="sh" style="margin-top:26px"><h2>Особые даты</h2></div><p class="hint" style="margin:-6px 0 10px">Отпуск, короткий день, праздник: нажмите на дату.</p><div class="cal"><div class="mh"><button class="icon-btn flat" data-cm="-1" aria-label="Предыдущий месяц">${ic('chev-l')}</button>${C.MN[m]} ${y}<button class="icon-btn flat" data-cm="1" aria-label="Следующий месяц">${ic('chev-r')}</button></div><div class="g">${['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(x => `<span>${x}</span>`).join('')}${cells}</div></div>
    ${sp.length ? `<div class="rows" style="margin-top:12px">${sp.map(k => { const x = s.special[k]; return `<div class="row"><span>${C.fmtDate(k)}</span><span class="r">${x.off ? 'выходной' : x.intervals.map(i => i.from + '–' + i.to).join(', ')}</span><button class="icon-btn flat" data-sd-rm="${k}" aria-label="Сбросить">${ic('x')}</button></div>`; }).join('')}</div>` : ''}</div>
    <div class="cta ${SC.dirty ? '' : 'hide'}" id="sc-cta"><button class="btn block" id="sc-save">Сохранить график</button></div>`;
  }
  const dirty = () => { SC.dirty = true; ID('sc-cta') && ID('sc-cta').classList.remove('hide'); };
  document.addEventListener('change', e => {
    if (S.cur !== 'schedule' || !SC.s) return; const t = e.target, dayEl = t.closest('[data-day]'), s = SC.s;
    if (t.id === 'sc-step') { s.slotStep = +t.value; dirty(); } else if (t.id === 'sc-min') { s.minNoticeHours = +t.value; dirty(); } else if (t.id === 'sc-hor') { s.horizonDays = +t.value; dirty(); }
    else if (dayEl) { const d = s.week[dayEl.dataset.day];
      if (t.matches('[data-on]')) { d.intervals = t.checked ? [{ from: '10:00', to: '19:00' }] : []; if (!t.checked) d.breaks = []; dirty(); drawSchedule(); }
      else if (t.matches('[data-iv]')) { d.intervals[+t.dataset.iv][t.dataset.k] = t.value; dirty(); } else if (t.matches('[data-br]')) { d.breaks[+t.dataset.br][t.dataset.k] = t.value; dirty(); } }
  });
  document.addEventListener('click', async e => {
    if (S.cur !== 'schedule' || !SC.s) return; const t = e.target, dayEl = t.closest('[data-day]'), s = SC.s; let x;
    if (dayEl) { const d = s.week[dayEl.dataset.day];
      if (t.closest('[data-add-iv]')) { const l = d.intervals[d.intervals.length - 1]; d.intervals.push({ from: l ? l.to : '10:00', to: '20:00' }); dirty(); drawSchedule(); }
      else if (t.closest('[data-add-br]')) { d.breaks.push({ from: '14:00', to: '15:00' }); dirty(); drawSchedule(); }
      else if (x = t.closest('[data-rm-iv]')) { d.intervals.splice(+x.dataset.rmIv, 1); dirty(); drawSchedule(); }
      else if (x = t.closest('[data-rm-br]')) { d.breaks.splice(+x.dataset.rmBr, 1); dirty(); drawSchedule(); }
      else if (t.closest('[data-copy-wd]')) { ['mon', 'tue', 'wed', 'thu', 'fri'].forEach(k => s.week[k] = JSON.parse(JSON.stringify(d))); dirty(); drawSchedule(); toast('Скопировано на пн–пт'); } return; }
    if (x = t.closest('[data-cm]')) { SC.m += +x.dataset.cm; if (SC.m > 11) { SC.m = 0; SC.y++; } if (SC.m < 0) { SC.m = 11; SC.y--; } drawSchedule(); }
    else if (x = t.closest('[data-sd-rm]')) { delete s.special[x.dataset.sdRm]; dirty(); drawSchedule(); }
    else if (x = t.closest('[data-sd]')) specialDay(x.dataset.sd);
    else if (t.closest('#sc-save')) { const b = ID('sc-save'); b.disabled = true; try { const r = await ap('PUT', '/schedule', s); SC.s = r.schedule; SC.dirty = false; toast('График сохранён — свободные слоты пересчитаны'); drawSchedule(); if (r.conflicts.length) conflicts(r.conflicts); } catch (er) { b.disabled = false; C.err(er); } }
  });
  function specialDay(k) {
    const cur = SC.s.special[k], mode = cur ? (cur.off ? 'off' : 'short') : 'norm', st = { iv: cur && cur.intervals ? JSON.parse(JSON.stringify(cur.intervals)) : [{ from: '10:00', to: '15:00' }], br: cur && cur.breaks ? JSON.parse(JSON.stringify(cur.breaks)) : [] };
    const sh = C.sheet({ title: C.fmtDate(k, 1), center: true, body: `<div class="seg3" id="sd-m">${[['off', 'Выходной'], ['short', 'Свои часы']].concat(cur ? [['norm', 'Как обычно']] : []).map(x => `<button data-m="${x[0]}" class="${x[0] === mode ? 'on' : ''}">${x[1]}</button>`).join('')}</div><div id="sd-b"></div>`, footer: '<button class="btn block" id="sd-ok">Готово</button>' });
    let m = mode === 'norm' && !cur ? 'off' : mode; const draw = () => { $$('#sd-m button').forEach(b => b.classList.toggle('on', b.dataset.m === m)); ID('sd-b').innerHTML = m === 'short' ? `${st.iv.map((iv, i) => `<div class="iv" style="display:flex;gap:8px;margin-bottom:8px">${timeIn(iv.from, `data-i="${i}" data-k="from"`)}<span style="align-self:center">–</span>${timeIn(iv.to, `data-i="${i}" data-k="to"`)}</div>`).join('')}${st.br.map((iv, i) => `<div class="brk" style="margin-top:8px">Перерыв</div><div style="display:flex;gap:8px;margin-bottom:8px">${timeIn(iv.from, `data-b="${i}" data-k="from"`)}<span style="align-self:center">–</span>${timeIn(iv.to, `data-b="${i}" data-k="to"`)}</div>`).join('')}<button class="btn soft xs" id="sd-br">${ic('plus', 's')}Перерыв</button>` : m === 'off' ? '<p class="hint">В этот день записаться нельзя.</p>' : '<p class="hint">Дата вернётся к обычному графику недели.</p>'; };
    draw(); sh.body.addEventListener('change', e => { const t = e.target; if (t.dataset.i != null) st.iv[+t.dataset.i][t.dataset.k] = t.value; else if (t.dataset.b != null) st.br[+t.dataset.b][t.dataset.k] = t.value; });
    sh.el.addEventListener('click', e => { const b = e.target.closest('#sd-m [data-m]'); if (b) { m = b.dataset.m; draw(); } if (e.target.closest('#sd-br')) { st.br.push({ from: '12:00', to: '13:00' }); draw(); } });
    ID('sd-ok').onclick = () => { if (m === 'off') SC.s.special[k] = { off: true }; else if (m === 'short') SC.s.special[k] = { intervals: st.iv, breaks: st.br }; else delete SC.s.special[k]; dirty(); sh.close(); drawSchedule(); };
  }
  function conflicts(list) { C.sheet({ title: 'Есть конфликты с записями', center: true, body: `<div class="warn-b">${ic('alert', 's')} Эти записи теперь вне рабочего времени. Они <b>не отменены</b> — свяжитесь с клиентами или перенесите вручную.</div><div class="rows">${list.map(c => `<div class="row"><span>${esc(c.name || 'Клиент')}</span><span class="r num">${C.fmtDate(c.date)} · ${c.time}</span></div>`).join('')}</div>`, footer: '<a class="btn block" href="#/bookings" data-x>К записям</a>' }); }
  /* ---------- Отзывы ---------- */
  VIEWS.reviews = async function () {
    const items = (await ap('GET', '/reviews')).items; S.rv = items;
    view().innerHTML = `${head('Отзывы')}<div class="sec list">${items.map(r => `<div class="rv" style="${r.hidden ? 'opacity:.6' : ''}"><div class="h"><b>${esc(r.name)}</b><span class="d">${esc(r.date.split('-').reverse().join('.'))}</span></div>${C.stars(r.rating)} ${r.hidden ? '<span class="badge warn">скрыт</span>' : ''}${r.text ? `<p style="margin:8px 0 0">${esc(r.text)}</p>` : ''}${r.reply ? `<div class="reply"><b>Ваш ответ</b>${esc(r.reply)}</div>` : ''}<div style="display:flex;gap:8px;margin-top:12px"><button class="btn soft xs" data-rr="${r.id}">${ic('edit', 's')}${r.reply ? 'Изменить ответ' : 'Ответить'}</button><button class="btn ghost xs" data-rh="${r.id}">${ic(r.hidden ? 'eye' : 'eye-off', 's')}${r.hidden ? 'Показать' : 'Скрыть'}</button></div></div>`).join('')}</div>${items.length ? '' : C.empty('star', 'Отзывов пока нет', 'Клиент сможет оставить отзыв после визита по ссылке из своей записи — когда вы отметите «Пришёл».')}`;
  };
  document.addEventListener('click', async e => {
    if (S.cur !== 'reviews') return; let x;
    if (x = e.target.closest('[data-rh]')) { const r = S.rv.find(i => i.id === x.dataset.rh); try { await ap('PUT', '/reviews/' + r.id, { hidden: !r.hidden }); toast(r.hidden ? 'Отзыв показан' : 'Отзыв скрыт'); VIEWS.reviews(); } catch (er) { C.err(er); } }
    else if (x = e.target.closest('[data-rr]')) { const r = S.rv.find(i => i.id === x.dataset.rr); const sh = C.sheet({ title: 'Ответ на отзыв', center: true, body: `<p class="mut" style="margin:0 0 10px">${esc(r.name)}: ${esc(r.text || '(без текста)')}</p><textarea class="in" id="rr-t" maxlength="600" placeholder="Поблагодарите клиента…">${esc(r.reply)}</textarea>`, footer: '<button class="btn block" id="rr-go">Сохранить ответ</button>' }); ID('rr-go').onclick = async () => { try { await ap('PUT', '/reviews/' + r.id, { reply: ID('rr-t').value }); sh.close(); toast('Ответ сохранён'); VIEWS.reviews(); } catch (er) { C.err(er); } }; }
  });
  /* ---------- Профиль ---------- */
  const TZ = [['Europe/Kaliningrad', 'Калининград (МСК−1)'], ['Europe/Moscow', 'Москва (МСК)'], ['Europe/Samara', 'Самара (МСК+1)'], ['Asia/Yekaterinburg', 'Екатеринбург (МСК+2)'], ['Asia/Omsk', 'Омск (МСК+3)'], ['Asia/Krasnoyarsk', 'Красноярск (МСК+4)'], ['Asia/Irkutsk', 'Иркутск (МСК+5)'], ['Asia/Yakutsk', 'Якутск (МСК+6)'], ['Asia/Vladivostok', 'Владивосток (МСК+7)'], ['Asia/Magadan', 'Магадан (МСК+8)'], ['Asia/Kamchatka', 'Камчатка (МСК+9)'], ['Europe/Minsk', 'Минск'], ['Asia/Almaty', 'Алматы'], ['Asia/Tashkent', 'Ташкент'], ['Europe/Kyiv', 'Киев']];
  const tgHelp = () => C.sheet({ title: 'Как подключить Telegram', full: true, body: `<ol style="padding-left:20px;line-height:1.7;margin:0"><li>Откройте Telegram и найдите бота <b>@BotFather</b>.</li><li>Отправьте ему команду <b>/newbot</b> и придумайте название. Имя бота должно заканчиваться на <b>bot</b>.</li><li>BotFather пришлёт <b>токен</b> — длинную строку вида <span class="num">123456789:AAH…</span>. Скопируйте её и вставьте в поле «Токен бота».</li><li>Найдите своего нового бота в Telegram и нажмите <b>«Запустить»</b> (/start).</li><li>Вернитесь сюда и нажмите <b>«Найти chat id»</b>, затем <b>«Сохранить»</b> и <b>«Отправить тест»</b>.</li></ol><p class="hint">После этого каждая новая запись, отмена и перенос будут приходить вам в чат с ботом.</p>` });
  function tgBlock(p) { return `<div class="card" id="tg-card" style="margin-bottom:14px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><b>Уведомления в Telegram</b><button class="btn soft xs" data-tg-help>${ic('info', 's')}Как подключить</button></div>${fld('Токен бота', `<input class="in" id="tg-token" autocomplete="off" placeholder="${p.telegramTokenSet ? 'Сохранён: ' + esc(p.telegramTokenMask) + ' — введите, чтобы заменить' : '123456789:AAH…'}">`)}${fld('Chat id', `<input class="in" id="tg-chat" inputmode="numeric" value="${esc(p.telegramChatId || '')}" placeholder="Нажмите «Найти chat id»">`)}<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn soft sm" data-tg="detect">Найти chat id</button><button class="btn soft sm" data-tg="save">Сохранить</button><button class="btn ghost sm" data-tg="test">${ic('send', 's')}Отправить тест</button></div></div>`; }
  async function tgAction(kind) {
    try {
      const tok = ID('tg-token').value.trim();
      if (kind === 'detect') { const r = await ap('POST', '/telegram/detect', { token: tok }); ID('tg-chat').value = r.chatId; toast('Chat id найден — нажмите «Сохранить»'); return; }
      const body = { telegramChatId: ID('tg-chat').value.trim() }; if (tok) body.telegramToken = tok; const r = await ap('PUT', '/profile', body); S.me.profile = r.profile; ID('tg-token').value = ''; ID('tg-token').placeholder = 'Сохранён: ' + r.profile.telegramTokenMask;
      if (kind === 'save') toast('Telegram сохранён'); else { await ap('POST', '/telegram/test'); toast('Тест отправлен — проверьте Telegram'); }
    } catch (e) { C.err(e); }
  }
  document.addEventListener('click', e => { const h = e.target.closest('[data-tg-help]'); if (h) return tgHelp(); const b = e.target.closest('[data-tg]'); if (b) tgAction(b.dataset.tg); });
  const PR = { dirty: false };
  VIEWS.profile = async function () {
    S.me = await ap('GET', '/me'); const p = S.me.profile, pr = S.me.presets; PR.theme = p.theme; PR.design = p.design || 'classic'; PR.accent = p.accent || ''; PR.dirty = false;
    const inp = (id, label, v, extra) => fld(label, `<input class="in" id="${id}" value="${esc(v || '')}" ${extra || ''}>`);
    view().innerHTML = `${head('Профиль', undoBtn('master.json'))}<div class="sec"><div class="card" style="margin-bottom:14px"><b style="display:block;margin-bottom:12px">Основное</b>${inp('p-name', 'Имя', p.name, 'maxlength="60"')}${inp('p-spec', 'Специализация', p.specialty, 'maxlength="120" placeholder="Мастер маникюра"')}${fld('О себе', `<textarea class="in" id="p-about" maxlength="1200" style="min-height:110px">${esc(p.about)}</textarea>`)}${inp('p-addr', 'Адрес', p.address, 'maxlength="120"')}${inp('p-map', 'Ссылка на карту', p.map, 'type="url" placeholder="https://yandex.ru/maps/…"')}${fld('Часовой пояс', `<select class="in" id="p-tz">${(TZ.some(z => z[0] === p.timezone) ? TZ : TZ.concat([[p.timezone, p.timezone]])).map(z => `<option value="${z[0]}" ${z[0] === p.timezone ? 'selected' : ''}>${z[1]}</option>`).join('')}</select>`)}</div>
    <div class="card" style="margin-bottom:14px"><b style="display:block;margin-bottom:12px">Контакты</b>${inp('p-phone', 'Телефон', p.phone, 'type="tel" placeholder="+7 900 000-00-00"')}${inp('p-wa', 'WhatsApp (номер)', p.whatsapp ? C.fmtPhone(p.whatsapp) : '', 'type="tel"')}${inp('p-tg', 'Telegram', p.telegram, 'placeholder="логин без @" autocapitalize="off"')}${inp('p-ig', 'Instagram*', p.instagram, 'placeholder="логин без @" autocapitalize="off"')}${inp('p-vk', 'VK', p.vk, 'placeholder="id или адрес страницы" autocapitalize="off"')}<div class="hint">*Instagram принадлежит компании Meta, запрещённой в РФ организации</div></div>
    <div class="card" style="margin-bottom:14px"><b style="display:block;margin-bottom:12px">Внешний вид страницы</b><div class="themes" id="themes">${Object.entries(pr).map(([k, v]) => `<button class="th ${k === p.theme ? 'on' : ''}" data-th="${k}"><i style="background:${v.accent}"></i>${v.name}</button>`).join('')}</div><div class="mlabel" style="margin:16px 0 8px">Вариант оформления</div><div class="designs" id="designs">${Object.entries(S.me.designs || {}).map(([k, v]) => `<button class="th dsg ${k === PR.design ? 'on' : ''}" data-dsg="${k}"><b>${esc(v.name)}</b><small>${esc(v.desc)}</small></button>`).join('')}</div><div style="display:flex;gap:10px;align-items:center;margin-top:14px"><input type="color" id="p-acc" value="${p.accent || pr[p.theme].accent}" style="width:52px;height:44px;border:0;background:none;padding:0" aria-label="Свой цвет"><div style="flex:1"><b style="font-size:14px">Свой акцентный цвет</b><div class="hint" style="margin:0">Остальные оттенки подберутся сами</div></div><button class="btn ghost xs" id="p-acc-r">Сбросить</button></div></div>
    ${tgBlock(p)}<div class="card" style="margin-bottom:14px"><b style="display:block;margin-bottom:12px">Смена пароля</b>${pwField('pw-cur', 'Текущий пароль')}${pwField('pw1', 'Новый пароль')}<div id="pws">${strHtml('')}</div><button class="btn soft sm" id="pw-go" style="margin-top:10px">Сменить пароль</button></div><p class="hint" style="text-align:center">Адрес страницы меняет только администратор платформы.</p></div><div class="cta hide" id="pr-cta"><button class="btn block" id="pr-save">Сохранить профиль</button></div>`;
    C.phoneInput(ID('p-phone')); C.phoneInput(ID('p-wa'));
    ID('pw1').addEventListener('input', () => ID('pws').innerHTML = strHtml(ID('pw1').value));
    view().addEventListener('input', ev => { if (ev.target.closest('#tg-card') || ev.target.closest('[id^=pw]') || ev.target.id === 'pw-cur') return; PR.dirty = true; ID('pr-cta') && ID('pr-cta').classList.remove('hide'); });
  };
  document.addEventListener('click', async e => {
    if (S.cur !== 'profile') return; const t = e.target; let x;
    if (x = t.closest('[data-th]')) { PR.theme = x.dataset.th; PR.accent = ''; ID('p-acc').value = S.me.presets[PR.theme].accent; $$('#themes .th').forEach(b => b.classList.toggle('on', b === x)); C.applyTheme(PR.theme, ''); PR.dirty = true; ID('pr-cta').classList.remove('hide'); }
    else if (x = t.closest('[data-dsg]')) { PR.design = x.dataset.dsg; $$('#designs .dsg').forEach(b => b.classList.toggle('on', b === x)); PR.dirty = true; ID('pr-cta').classList.remove('hide'); }
    else if (t.closest('#p-acc-r')) { PR.accent = ''; ID('p-acc').value = S.me.presets[PR.theme].accent; C.applyTheme(PR.theme, ''); PR.dirty = true; ID('pr-cta').classList.remove('hide'); }
    else if (t.closest('#pr-save')) {
      const b = ID('pr-save'); b.disabled = true;
      try { const r = await ap('PUT', '/profile', { name: ID('p-name').value, specialty: ID('p-spec').value, about: ID('p-about').value, address: ID('p-addr').value, map: ID('p-map').value, timezone: ID('p-tz').value, phone: ID('p-phone').value.replace(/\D/g, '').length > 1 ? ID('p-phone').value : '', whatsapp: ID('p-wa').value.replace(/\D/g, '').length > 1 ? ID('p-wa').value : '', telegram: ID('p-tg').value, instagram: ID('p-ig').value, vk: ID('p-vk').value, theme: PR.theme, design: PR.design, accent: PR.accent });
        S.me.profile = r.profile; PR.dirty = false; ID('pr-cta').classList.add('hide'); toast('Профиль сохранён'); C.applyTheme(r.profile.theme, r.profile.accent); } catch (er) { C.err(er); } b.disabled = false;
    }
    else if (t.closest('#pw-go')) { try { await ap('POST', '/password', { current: ID('pw-cur').value, next: ID('pw1').value }); ID('pw-cur').value = ID('pw1').value = ''; ID('pws').innerHTML = strHtml(''); toast('Пароль изменён'); } catch (er) { C.err(er); } }
  });
  document.addEventListener('input', e => { if (S.cur === 'profile' && e.target.id === 'p-acc') { PR.accent = e.target.value; C.applyTheme(PR.theme, PR.accent); PR.dirty = true; ID('pr-cta').classList.remove('hide'); } });
  /* ---------- Ещё ---------- */
  VIEWS.more = async function () {
    view().innerHTML = `${head('Ещё')}<div class="sec"><div class="rows"><a class="row" href="#/reviews">${ic('star')}Отзывы${ic('chev-r', 'r')}</a><a class="row" href="#/photos">${ic('camera')}Фото${ic('chev-r', 'r')}</a><a class="row" href="#/page">${ic('share')}Моя страница${ic('chev-r', 'r')}</a><a class="row" href="${S.me.pageUrl}" target="_blank" rel="noopener">${ic('link')}Открыть страницу как клиент${ic('chev-r', 'r')}</a></div><div class="rows" style="margin-top:14px"><button class="row" id="logout" style="color:#d64545">${ic('logout')}Выйти</button></div></div>`;
    ID('logout').onclick = async () => { try { await ap('POST', '/logout'); } catch { } location.reload(); };
  };
  /* ---------- Фото ---------- */
  const PH = {};
  VIEWS.photos = async function () { PH.d = await ap('GET', '/photos'); drawPhotos(); };
  const phGrid = (k, list) => `<div class="ph">${list.map((p, i) => `<div class="it"><img loading="lazy" src="${esc(p.url)}" alt=""><div class="ct"><span>${i > 0 ? `<button data-pm="${k}|${i}|-1" aria-label="Левее">${ic('arrow-l')}</button>` : ''}</span><span style="display:flex;gap:4px">${i < list.length - 1 ? `<button data-pm="${k}|${i}|1" aria-label="Правее">${ic('arrow-r')}</button>` : ''}<button data-pd="${k}|${p.file}" aria-label="Удалить">${ic('trash')}</button></span></div></div>`).join('')}<button class="add-ph" data-up="${k}">${ic('plus', 'l')}Добавить</button></div>`;
  function drawPhotos() {
    const d = PH.d;
    view().innerHTML = `${head('Фото')}<div class="sec"><p class="hint" style="margin:0 0 12px">Фото сжимаются автоматически. Принимаются JPG, PNG, WebP.</p>
    <div class="card" style="margin-bottom:14px"><b>Аватар</b><div style="display:flex;gap:14px;align-items:center;margin-top:12px"><div class="ava" style="width:84px;height:84px;flex:none">${avaIn(d.avatar, S.me.profile.name)}</div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn soft sm" data-up="avatar">${ic('camera', 's')}${d.avatar ? 'Заменить' : 'Загрузить'}</button>${d.avatar ? '<button class="btn ghost sm" data-pd="avatar|">Удалить</button>' : ''}</div></div></div>
    <div class="card" style="margin-bottom:14px"><b>Обложка</b><div style="margin-top:12px;height:110px;border-radius:var(--r1);background:${d.cover ? `url('${esc(d.cover)}') center/cover` : 'var(--g)'}"></div><div style="display:flex;gap:8px;margin-top:12px"><button class="btn soft sm" data-up="cover">${ic('camera', 's')}${d.cover ? 'Заменить' : 'Загрузить'}</button>${d.cover ? '<button class="btn ghost sm" data-pd="cover|">Удалить</button>' : ''}</div></div>
    <div class="card" style="margin-bottom:14px"><b style="display:block;margin-bottom:12px">Работы</b>${phGrid('works', d.works)}</div><div class="card" style="margin-bottom:14px"><b style="display:block;margin-bottom:12px">Кабинет</b>${phGrid('studio', d.studio)}</div><input type="file" id="ph-file" accept="image/jpeg,image/png,image/webp,image/heic" class="hide" multiple></div>`;
  }
  async function uploadPhotos(kind, files, after) {
    const fi = [...files]; if (!fi.length) return; let n = 0; toast('Загружаем…');
    for (const f of fi) { try { const blob = await C.img(f, kind === 'avatar' ? { w: 600, h: 600 } : kind === 'cover' ? { w: 1400, h: 560 } : { max: 1600 }); PH.d = await ap('POST', '/photos/' + kind, blob, { raw: true, type: 'image/jpeg' }); n++; } catch (e) { C.err(e); } }
    if (n) toast(n > 1 ? 'Загружено: ' + n : 'Фото загружено'); if (after) after();
  }
  function pickFile(kind, after) { let i = ID('ph-file'); if (!i) { i = document.createElement('input'); i.type = 'file'; i.id = 'ph-file'; i.accept = 'image/jpeg,image/png,image/webp,image/heic'; i.className = 'hide'; document.body.appendChild(i); } i.multiple = kind === 'works' || kind === 'studio'; i.value = ''; i.onchange = () => uploadPhotos(kind, i.files, after); i.click(); }
  document.addEventListener('click', async e => {
    if (S.cur !== 'photos') return; let x;
    if (x = e.target.closest('[data-up]')) pickFile(x.dataset.up, drawPhotos);
    else if (x = e.target.closest('[data-pd]')) { const [k, f] = x.dataset.pd.split('|'); if (!await C.confirm('Удалить фото?', '', { ok: 'Удалить', danger: true })) return; try { PH.d = await ap('DELETE', '/photos/' + k + (f ? '/' + f : '')); drawPhotos(); } catch (er) { C.err(er); } }
    else if (x = e.target.closest('[data-pm]')) { const [k, i, dl] = x.dataset.pm.split('|'), l = PH.d[k].map(p => p.file), a = +i, b = a + +dl; [l[a], l[b]] = [l[b], l[a]]; try { PH.d = await ap('PUT', '/photos-order', { kind: k, order: l }); drawPhotos(); } catch (er) { C.err(er); } }
  });
  /* ---------- Моя страница ---------- */
  VIEWS.page = async function () {
    const [me, sv, sc, ph] = await Promise.all([ap('GET', '/me'), ap('GET', '/services'), ap('GET', '/schedule'), ap('GET', '/photos')]); S.me = me; const p = me.profile, svc = sv.categories.flatMap(c => c.services).filter(s => !s.hidden);
    const items = [['Аватар', !!ph.avatar], ['Обложка', !!ph.cover], ['Описание (от 60 символов)', (p.about || '').length >= 60], ['Адрес и ссылка на карту', !!p.address && !!p.map], ['Телефон', !!p.phone], ['Соцсети или мессенджеры', !!(p.telegram || p.instagram || p.vk || p.whatsapp)], ['Не меньше 3 услуг', svc.length >= 3], ['Популярные услуги отмечены', svc.some(s => s.popular)], ['График заполнен', Object.values(sc.schedule.week).some(d => d.intervals.length)], ['3 и больше фото работ', ph.works.length >= 3], ['Фото кабинета', ph.studio.length > 0], ['Telegram-уведомления', !!(p.telegramTokenSet && p.telegramChatId)]];
    const done = items.filter(i => i[1]).length, pct = Math.round(done / items.length * 100);
    view().innerHTML = `${head('Моя страница')}<div class="sec"><div class="card" style="margin-bottom:14px"><div class="lnk"><span>${esc(me.pageUrl)}</span><button class="icon-btn flat" id="pg-copy" aria-label="Скопировать">${ic('copy')}</button></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn soft sm" id="pg-share">${ic('share', 's')}Поделиться</button><a class="btn ghost sm" href="${esc(me.pageUrl)}" target="_blank" rel="noopener">${ic('link', 's')}Открыть</a></div></div>
    <div class="card" style="margin-bottom:14px;text-align:center"><div class="qr"><img src="/api/m/${slug}/qr.svg" alt="QR-код страницы"></div><p class="hint">Распечатайте или вставьте в Instagram — клиент наведёт камеру и попадёт на запись.</p><div style="display:flex;gap:8px;justify-content:center"><a class="btn soft sm" href="/api/m/${slug}/qr.svg" download="qr-${slug}.svg">${ic('download', 's')}Скачать QR</a><button class="btn ghost sm" id="pg-print">Печать</button></div></div>
    <div class="card" style="margin-bottom:14px"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px"><b>Заполненность страницы</b><b class="num" style="color:var(--act);font-size:20px">${pct}%</b></div><div class="prog"><i style="width:${pct}%"></i></div><p class="hint">${pct >= 100 ? 'Отлично! Страница заполнена полностью.' : 'Чем полнее страница, тем охотнее клиенты записываются. Допишите пункты ниже.'}</p>${items.map(i => `<div class="ck ${i[1] ? 'ok' : ''}"><span class="d">${ic('check', 's')}</span><span>${i[0]}</span></div>`).join('')}</div>
    <div class="mlabel">Предпросмотр</div><div class="phone-fr"><iframe src="/${slug}" title="Предпросмотр страницы" loading="lazy"></iframe></div></div>`;
    ID('pg-copy').onclick = () => C.copy(me.pageUrl); ID('pg-share').onclick = () => C.share('Запись ко мне онлайн: ' + me.pageUrl, me.pageUrl);
    ID('pg-print').onclick = () => { const w = window.open('/api/m/' + slug + '/qr.svg', '_blank'); if (w) w.addEventListener('load', () => w.print()); };
  };
  /* ---------- Мастер настройки ---------- */
  async function wizard() {
    const n = S.wiz || 1, p = S.me.profile; S.wiz = n; const bar = `<div class="steps-w">${[1, 2, 3, 4].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</div>`;
    const frame = (title, lead, body, next) => { app.innerHTML = `<div class="wrap fade" style="padding:28px 20px 130px"><div class="mut" style="font-weight:700;font-size:13px;letter-spacing:.06em;text-transform:uppercase;margin-bottom:10px">Настройка · шаг ${n} из 4</div>${bar}<h1 style="font-size:30px;margin-bottom:8px">${title}</h1><p class="mut" style="margin:0 0 20px">${lead}</p>${body}</div><div class="cta"><div style="display:flex;gap:10px"><button class="btn ghost" id="w-skip">Пропустить</button><button class="btn" style="flex:1" id="w-next">${next || 'Далее'}</button></div></div>`; };
    const step = to => { S.wiz = to; wizard(); };
    if (n === 1) {
      const av = (await ap('GET', '/photos')).avatar; frame('Проверим профиль', 'Так вас увидят клиенты. Всё можно поменять позже.', `<div style="display:flex;gap:14px;align-items:center;margin-bottom:16px"><div class="ava" style="width:84px;height:84px;flex:none">${avaIn(av, p.name)}</div><button class="btn soft sm" id="w-av">${ic('camera', 's')}${av ? 'Заменить фото' : 'Добавить фото'}</button></div>${fld('Имя', `<input class="in" id="w-n" value="${esc(p.name)}" maxlength="60">`)}${fld('Специализация', `<input class="in" id="w-s" value="${esc(p.specialty)}" maxlength="120">`)}${fld('Адрес', `<input class="in" id="w-a" value="${esc(p.address)}" maxlength="120">`)}${fld('Телефон', `<input class="in" id="w-p" type="tel" value="${esc(p.phone)}">`)}`);
      C.phoneInput(ID('w-p')); ID('w-av').onclick = () => pickFile('avatar', () => wizard());
      ID('w-next').onclick = async () => { try { const r = await ap('PUT', '/profile', { name: ID('w-n').value, specialty: ID('w-s').value, address: ID('w-a').value, phone: ID('w-p').value.replace(/\D/g, '').length > 1 ? ID('w-p').value : '' }); S.me.profile = r.profile; step(2); } catch (e) { C.err(e); } };
    } else if (n === 2) {
      const cats = (await ap('GET', '/services')).categories, total = cats.reduce((a, c) => a + c.services.length, 0);
      frame('Проверим услуги', 'Цены и длительность влияют на свободное время в записи — проверьте, что всё верно.', `<div class="card" style="margin-bottom:14px"><b>${total ? 'Услуг: ' + total : 'Услуг пока нет'}</b>${cats.slice(0, 3).map(c => `<div class="mlabel" style="margin-top:12px">${esc(c.name)}</div>${c.services.slice(0, 4).map(s => `<div class="ck" style="padding:8px 0"><span style="flex:1;color:var(--tx)">${esc(s.name)}</span><span class="num mut">${rub(s.price)} · ${dur(s.duration)}</span></div>`).join('')}`).join('')}</div><button class="btn soft block" id="w-edit">Править услуги</button>`);
      ID('w-edit').onclick = () => { shell(); location.hash = '#/services'; route(); };
    } else if (n === 3) {
      const sc = (await ap('GET', '/schedule')).schedule;
      frame('Проверим график', 'По нему считается свободное время для записи.', `<div class="card" style="margin-bottom:14px"><table class="week" style="width:100%">${DAYS.map(d => { const w = sc.week[d], t = w.intervals.map(i => i.from + '–' + i.to).join(', '); return `<tr class="${t ? '' : 'off'}"><td>${DN[d]}</td><td>${t ? esc(t) + (w.breaks.length ? ' (перерыв ' + w.breaks.map(i => i.from + '–' + i.to).join(', ') + ')' : '') : 'выходной'}</td></tr>`; }).join('')}</table></div><button class="btn soft block" id="w-edit">Править график</button>`);
      ID('w-edit').onclick = () => { shell(); location.hash = '#/schedule'; route(); };
    } else if (n === 4) {
      frame('Уведомления в Telegram', 'Новые записи будут приходить вам в чат. Можно пропустить и подключить позже в профиле.', `<ol style="padding-left:20px;line-height:1.7;margin:0 0 16px"><li>В Telegram найдите <b>@BotFather</b> и отправьте <b>/newbot</b>.</li><li>Скопируйте токен, который он пришлёт, и вставьте ниже.</li><li>Откройте своего бота и нажмите «Запустить».</li></ol>${tgBlock(p)}`, 'Завершить');
      $('#tg-card .btn.soft.xs').classList.add('hide');
    } else {
      const url = S.me.pageUrl; app.innerHTML = `<div class="wrap fade" style="padding:36px 20px 130px;text-align:center"><div class="done"><svg class="ok" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30"/><path d="M19 33l9 9 17-19"/></svg><h1 style="font-size:30px;margin-bottom:6px">Ваша страница готова</h1><p class="mut" style="margin:0 0 18px">Отправьте ссылку клиентам и вставьте её в шапку профиля.</p></div><div class="card"><div class="lnk"><span>${esc(url)}</span><button class="icon-btn flat" id="f-copy" aria-label="Скопировать">${ic('copy')}</button></div><div class="qr" style="margin-top:12px"><img src="/api/m/${slug}/qr.svg" alt="QR-код"></div><div style="display:flex;gap:8px;justify-content:center;margin-top:14px"><button class="btn soft sm" id="f-share">${ic('share', 's')}Поделиться</button><a class="btn ghost sm" href="/api/m/${slug}/qr.svg" download="qr-${slug}.svg">${ic('download', 's')}QR</a></div></div></div><div class="cta"><button class="btn block" id="f-go">Перейти в кабинет</button></div>`;
      ID('f-copy').onclick = () => C.copy(url); ID('f-share').onclick = () => C.share('Запись ко мне онлайн: ' + url, url);
      ID('f-go').onclick = async () => { try { await ap('PUT', '/profile', { setupDone: true }); S.me.profile.setupDone = true; S.wiz = 0; S.wizDone = true; shell(); location.hash = '#/bookings'; route(); } catch (e) { C.err(e); } }; return;
    }
    ID('w-skip').onclick = () => step(n + 1);
    if (n === 4) ID('w-next').onclick = async () => { const tok = ID('tg-token').value.trim(), chat = ID('tg-chat').value.trim(); if (tok || chat) { try { const body = { telegramChatId: chat }; if (tok) body.telegramToken = tok; S.me.profile = (await ap('PUT', '/profile', body)).profile; } catch (e) { return C.err(e); } } step(5); };
    else if (n > 1) ID('w-next').onclick = () => step(n + 1);
  }
  init();
})();
