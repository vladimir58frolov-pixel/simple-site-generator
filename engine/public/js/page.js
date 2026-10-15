/* Публичная страница мастера */
(function () {
  const { $, $$, esc, ic, rub, dur, api, toast } = C, slug = C.boot.slug, app = document.getElementById('app'), A = p => `/api/m/${slug}${p}`;
  let M = null; const S = { tab: 'book', sel: new Set(), cat: null };
  (function () { const p = new URLSearchParams(location.search), u = {}; ['utm_source', 'utm_medium', 'utm_content'].forEach(k => { if (p.get(k)) u[k] = p.get(k); }); if (Object.keys(u).length) sessionStorage.setItem('utm', JSON.stringify(u)); })();
  const utm = () => { try { return JSON.parse(sessionStorage.getItem('utm') || '{}'); } catch { return {}; } };
  const route = () => { const r = location.pathname.replace(/\/+$/, '').slice(slug.length + 1); return r === '/services' ? 'services' : r === '/reviews' ? 'reviews' : r.startsWith('/b/') ? 'booking' : 'home'; };
  const go = p => { history.pushState({}, '', p); render(); scrollTo(0, 0); };
  window.addEventListener('popstate', render);
  document.addEventListener('click', e => { const a = e.target.closest('a[data-go]'); if (a) { e.preventDefault(); go(a.getAttribute('href')); } });
  const allSvc = () => M.categories.flatMap(c => c.services);
  const byId = id => allSvc().find(s => s.id === id);
  const totals = ids => { let p = 0, d = 0; ids.forEach(i => { const s = byId(i); if (s) { p += s.price; d += s.duration; } }); return { p, d }; };
  const card = (s, o) => `<button class="svc ${o && o.sel ? 'sel' : ''}" data-id="${s.id}"><div class="t"><b>${esc(s.name)}${s.popular ? '<span class="hot">хит</span>' : ''}</b>${s.desc ? `<small>${esc(s.desc)}</small>` : '<div style="height:8px"></div>'}<div class="chips"><span class="chip price num">${rub(s.price)}</span><span class="chip num">${ic('clock', 's')}${dur(s.duration)}</span></div></div>${o && o.check ? `<div class="chk">${ic('check', 's')}</div>` : ic('chev-r', 'mut')}</button>`;
  function hero() {
    const ph = M.photos, loc = M.map ? `<a href="${esc(M.map)}" target="_blank" rel="noopener">${ic('pin', 's')}${esc(M.address)}</a>` : `<div>${ic('pin', 's')}${esc(M.address)}</div>`;
    return `<div class="cover ${ph.cover ? 'img' : ''}" ${ph.cover ? `style="background-image:url('${esc(ph.cover)}')"` : ''}></div><div class="hero"><div class="ava">${ph.avatar ? `<img src="${esc(ph.avatar)}" alt="${esc(M.name)}">` : `<div>${esc(C.initial(M.name))}</div>`}</div><h1>${esc(M.name)}</h1>${M.specialty ? `<p class="spec">${esc(M.specialty)}</p>` : ''}<div class="meta">${M.address ? loc : ''}${M.rating.count ? `<a class="rate" data-go href="/${slug}/reviews">${ic('star', 's')}${M.rating.avg.toLocaleString('ru-RU')} · ${M.rating.count} ${pl(M.rating.count, 'отзыв', 'отзыва', 'отзывов')}</a>` : `<a data-go href="/${slug}/reviews">У мастера пока нет отзывов</a>`}</div></div>`;
  }
  const pl = (n, a, b, c) => { n = Math.abs(n) % 100; const m = n % 10; return n > 10 && n < 20 ? c : m > 1 && m < 5 ? b : m === 1 ? a : c; };
  function bookTab() {
    const all = allSvc(); if (!all.length) return C.empty('list', 'Услуги пока не добавлены', 'Мастер скоро заполнит прайс.');
    const pop = all.filter(s => s.popular).slice(0, 3), list = pop.length ? pop : all.slice(0, 3);
    return `<div class="sec"><div class="sh"><h2>${pop.length ? 'Популярные услуги' : 'Услуги'}</h2><a data-go href="/${slug}/services">Все</a></div><div class="list">${list.map(s => card(s)).join('')}</div></div>`;
  }
  function infoTab() {
    const out = []; const cl = C.contactLinks(M), dow = (new Date().getDay() + 6) % 7;
    if (M.about) out.push(`<div class="sec"><div class="sh"><h2>О мастере</h2></div><div class="card about">${esc(M.about)}</div></div>`);
    if (cl.length || M.address) out.push(`<div class="sec"><div class="sh"><h2>Контакты</h2></div><div class="rows">${M.address ? `<div class="row">${ic('pin')}<span>${esc(M.address)}</span></div>` : ''}${M.map ? `<a class="row" href="${esc(M.map)}" target="_blank" rel="noopener">${ic('map')}Открыть на карте${ic('chev-r', 'r')}</a>` : ''}${cl.map(c => `<a class="row" href="${esc(c[2])}" target="_blank" rel="noopener">${ic(c[0])}${esc(c[1])}${ic('chev-r', 'r')}</a>`).join('')}</div>${M.instagram ? '<p class="hint">*Instagram принадлежит компании Meta, запрещённой в РФ организации</p>' : ''}</div>`);
    if (M.week.some(d => !d.off)) out.push(`<div class="sec"><div class="sh"><h2>График работы</h2></div><div class="card"><table class="week">${M.week.map((d, i) => `<tr class="${d.off ? 'off' : ''} ${i === dow ? 'today' : ''}"><td>${d.label}</td><td>${esc(d.text)}</td></tr>`).join('')}</table></div></div>`);
    [['works', 'Работы'], ['studio', 'Кабинет']].forEach(([k, t]) => { const l = M.photos[k]; if (l.length) out.push(`<div class="sec"><div class="sh"><h2>${t}</h2></div><div class="gal" data-k="${k}">${l.map((p, i) => `<button data-i="${i}" aria-label="Открыть фото ${i + 1}"><img loading="lazy" decoding="async" src="${esc(p.url)}" alt=""></button>`).join('')}</div></div>`); });
    return out.length ? out.join('<div class="blk"></div>') : C.empty('info', 'Информация скоро появится', 'Мастер пока не заполнил профиль.');
  }
  function viewer(list, i) {
    const v = document.createElement('div'); v.className = 'viewer'; v.innerHTML = `<div class="vt"><span class="num"></span><button class="icon-btn" aria-label="Закрыть">${ic('x')}</button></div><div class="vs">${list.map(p => `<div><img src="${esc(p.url)}" alt=""></div>`).join('')}</div>`;
    document.body.appendChild(v); const vs = $('.vs', v), n = $('.num', v), set = () => n.textContent = (Math.round(vs.scrollLeft / vs.clientWidth) + 1) + ' / ' + list.length; vs.scrollLeft = i * vs.clientWidth; set(); vs.addEventListener('scroll', set);
    const close = () => { v.remove(); document.removeEventListener('keydown', key); }, key = e => { if (e.key === 'Escape') close(); else if (e.key === 'ArrowRight') vs.scrollBy(vs.clientWidth, 0); else if (e.key === 'ArrowLeft') vs.scrollBy(-vs.clientWidth, 0); };
    $('button', v).onclick = close; document.addEventListener('keydown', key);
  }
  function home() {
    app.innerHTML = `<div class="wrap fade">${hero()}${M.paused ? `<div class="notice">${ic('pause')}<span>Запись временно недоступна. Свяжитесь с мастером напрямую.</span></div>` : ''}<div class="seg" data-i="${S.tab === 'info' ? 1 : 0}"><button data-t="book" class="${S.tab === 'book' ? 'on' : ''}">Запись</button><button data-t="info" class="${S.tab === 'info' ? 'on' : ''}">Инфо</button></div><div id="tabc">${S.tab === 'book' ? bookTab() : infoTab()}</div></div>${!M.paused && allSvc().length ? `<div class="cta"><button class="btn block" id="go">Записаться</button></div>` : ''}`;
  }
  function services(still) {
    if (!S.cat || !M.categories.find(c => c.id === S.cat)) S.cat = M.categories[0] && M.categories[0].id;
    const cat = M.categories.find(c => c.id === S.cat), t = totals([...S.sel]);
    app.innerHTML = `<div class="wrap ${still ? '' : 'fade'}"><div class="top"><a class="icon-btn" data-go href="/${slug}" aria-label="Назад">${ic('chev-l')}</a><h2>Услуги</h2></div>${M.categories.length ? `<div class="sec"><div class="pills">${M.categories.map(c => `<button class="pill ${c.id === S.cat ? 'on' : ''}" data-cat="${c.id}">${esc(c.name)}</button>`).join('')}</div><div class="list">${cat.services.map(s => card(s, { check: 1, sel: S.sel.has(s.id) })).join('')}</div></div>` : C.empty('list', 'Услуги пока не добавлены', 'Мастер скоро заполнит прайс.')}</div>${S.sel.size && !M.paused ? `<div class="cta"><div class="bar"><div class="sum"><b class="num">${rub(t.p)}</b><span class="num">${dur(t.d)} · ${S.sel.size} ${pl(S.sel.size, 'услуга', 'услуги', 'услуг')}</span></div><button class="btn" id="go2">Записаться</button></div></div>` : ''}`;
  }
  async function reviews() {
    app.innerHTML = `<div class="wrap"><div class="top"><a class="icon-btn" data-go href="/${slug}" aria-label="Назад">${ic('chev-l')}</a><h2>Отзывы</h2></div><div class="sec"><div class="sk sk-card"></div></div></div>`;
    const d = await api('GET', A('/reviews')).catch(e => { C.err(e); return { items: [], rating: { count: 0, avg: 0 } }; });
    app.innerHTML = `<div class="wrap fade"><div class="top"><a class="icon-btn" data-go href="/${slug}" aria-label="Назад">${ic('chev-l')}</a><h2>Отзывы</h2></div>${d.items.length ? `<div class="bigrate"><div class="n num">${d.rating.avg.toLocaleString('ru-RU')}</div><div>${C.stars(d.rating.avg)}<div class="mut" style="font-weight:600;margin-top:4px">${d.rating.count} ${pl(d.rating.count, 'отзыв', 'отзыва', 'отзывов')}</div></div></div><div class="sec list">${d.items.map(r => `<div class="rv"><div class="h"><b>${esc(r.name)}</b><span class="d">${esc(r.date.split('-').reverse().join('.'))}</span></div>${C.stars(r.rating)}${r.text ? `<p style="margin:8px 0 0">${esc(r.text)}</p>` : ''}${r.reply ? `<div class="reply"><b>Ответ мастера</b>${esc(r.reply)}</div>` : ''}</div>`).join('')}</div>` : C.empty('star', 'У мастера пока нет отзывов', 'Станьте первым — оставить отзыв можно после визита по ссылке из записи.')}</div>`;
  }
  /* ---- запись ---- */
  function strip(days, today, horizon, sel) {
    const set = new Set(days); let o = '';
    for (let i = 0; i <= horizon; i++) { const d = C.addDays(today, i), dt = C.pd(d); o += `<button class="dt ${d === sel ? 'on' : ''}" data-d="${d}" ${set.has(d) ? '' : 'disabled'} aria-label="${C.fmtDate(d, 1)}"><small>${C.WD[dt.getUTCDay()]}</small><b class="num">${dt.getUTCDate()}</b><small>${C.MG[dt.getUTCMonth()].slice(0, 3)}</small></button>`; }
    return `<div class="dates" role="listbox">${o}</div>`;
  }
  const consentText = `<p>Нажимая «Записаться», вы соглашаетесь на обработку своих персональных данных (имя, номер телефона и, если вы его указали, логин в Telegram) мастером и платформой записи исключительно для оформления и сопровождения вашей записи: подтверждения времени, связи с вами по вопросам визита и уведомления мастера.</p><p>Данные хранятся только у выбранного мастера, не передаются третьим лицам и не используются для рекламы. Вы можете в любой момент попросить мастера удалить ваши данные, связавшись с ним по контактам на странице.</p>`;
  function openBooking(preset, startStep) {
    const st = { step: startStep || 1, sel: new Set(preset || []), date: null, time: null, days: null, cat: M.categories[0] && M.categories[0].id, slots: null, form: { name: '', phone: '', telegram: '', comment: '', consent: false } };
    const sh = C.sheet({ title: 'Запись', full: true, steps: 4 }); let busy = false;
    const ids = () => [...st.sel], tot = () => totals(ids());
    const bar = (label, dis, back) => { const t = tot(); return `<div class="bar">${back ? `<button class="icon-btn" data-back aria-label="Назад">${ic('chev-l')}</button>` : ''}<div class="sum"><b class="num">${rub(t.p)}</b><span class="num">${dur(t.d)}</span></div><button class="btn" data-next ${dis ? 'disabled' : ''}>${label}</button></div>`; };
    async function draw() {
      sh.step(Math.min(st.step, 4));
      if (st.step === 1) {
        const cat = M.categories.find(c => c.id === st.cat) || M.categories[0];
        sh.setTitle('Выберите услуги'); sh.set(`<div class="pills">${M.categories.map(c => `<button class="pill ${c.id === cat.id ? 'on' : ''}" data-cat="${c.id}">${esc(c.name)}</button>`).join('')}</div><div class="list">${cat.services.map(s => card(s, { check: 1, sel: st.sel.has(s.id) })).join('')}</div>`); sh.footer(bar('Далее', !st.sel.size));
      } else if (st.step === 2) {
        sh.setTitle('Выберите дату'); sh.set('<div class="sk sk-card" style="margin:0"></div>'); sh.footer(bar('Далее', true, 1));
        try { if (!st.days) st.days = await api('GET', A('/days?services=' + ids().join(','))); } catch (e) { C.err(e); st.step = 1; return draw(); }
        if (st.step !== 2) return;
        sh.set(st.days.days.length ? `<p class="hint" style="margin:0 0 6px">Свободные дни выделены. Серые — недоступны.</p>${strip(st.days.days, st.days.today, st.days.horizon, st.date)}` : C.empty('calendar', 'Свободных дат пока нет', 'Загляните позже или свяжитесь с мастером.'));
        const s = $('.dt.on', sh.body); if (s) s.scrollIntoView({ inline: 'center', block: 'nearest' }); else { const f = $('.dt:not([disabled])', sh.body); if (f) f.scrollIntoView({ inline: 'start', block: 'nearest' }); }
        sh.footer(bar('Далее', !st.date, 1));
      } else if (st.step === 3) {
        sh.setTitle('Выберите время'); sh.set(`<div class="mlabel">${C.fmtDate(st.date, 1)}</div><div class="times">${'<div class="sk" style="height:46px"></div>'.repeat(8)}</div>`); sh.footer(bar('Далее', true, 1));
        try { st.slots = (await api('GET', A(`/slots?date=${st.date}&services=${ids().join(',')}`))).slots; } catch (e) { C.err(e); st.slots = []; }
        if (st.step !== 3) return; if (st.time && !st.slots.includes(st.time)) st.time = null;
        sh.set(`<div class="mlabel">${C.fmtDate(st.date, 1)}</div>${st.slots.length ? `<div class="times">${st.slots.map(t => `<button class="tm num ${t === st.time ? 'on' : ''}" data-t="${t}">${t}</button>`).join('')}</div>` : C.empty('clock', 'На этот день времени нет', 'Выберите другую дату.')}`); sh.footer(bar('Далее', !st.time, 1));
      } else if (st.step === 4) {
        const f = st.form; sh.setTitle('Ваши данные');
        sh.set(`<div class="sum">${ids().map(i => { const s = byId(i); return `<div class="r"><span>${esc(s.name)}</span><span class="num">${rub(s.price)}</span></div>`; }).join('')}<div class="r"><span>Когда</span><span>${C.fmtDate(st.date)}, ${st.time}</span></div></div>
        <label class="fld"><span>Имя</span><input class="in" id="f-name" autocomplete="name" maxlength="60" placeholder="Как вас зовут" value="${esc(f.name)}"></label>
        <label class="fld"><span>Телефон</span><input class="in" id="f-phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7 900 000-00-00" value="${esc(f.phone)}"></label>
        <label class="fld"><span>Telegram (необязательно)</span><input class="in" id="f-tg" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="60" placeholder="@username" value="${esc(f.telegram)}"><span class="hint">Мастер увидит только ваш логин и сможет написать вам в Telegram.</span></label>
        <label class="fld"><span>Комментарий (необязательно)</span><textarea class="in" id="f-com" maxlength="500" placeholder="Пожелания, форма, цвет…">${esc(f.comment)}</textarea></label>
        <label class="check"><input type="checkbox" id="f-ok" ${f.consent ? 'checked' : ''}><span class="bx">${ic('check', 's')}</span><span>Согласен(на) на <a href="#" data-consent>обработку персональных данных</a></span></label><div class="err-t hide" id="f-err"></div>`);
        C.phoneInput($('#f-phone', sh.body)); sh.footer(bar('Записаться', false, 1));
      } else if (st.step === 5) {
        const b = st.result.booking; sh.setTitle('Готово'); sh.step(4);
        sh.set(`<div class="done"><svg class="ok" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30"/><path d="M19 33l9 9 17-19"/></svg><h3>Вы записаны!</h3><p class="mut" style="margin:0 0 18px">Мастер ${esc(M.name)} ждёт вас</p></div><div class="sum">${b.services.map(s => `<div class="r"><span>${esc(s.name)}</span><span class="num">${rub(s.price)}</span></div>`).join('')}<div class="r"><span>Когда</span><span>${C.fmtDate(b.date)}, ${b.time}</span></div><div class="r"><span>Длительность</span><span>${dur(b.duration)}</span></div><div class="r"><span>Итого</span><span class="num"><b>${rub(b.total)}</b></span></div>${M.address ? `<div class="r"><span>Адрес</span><span>${esc(M.address)}</span></div>` : ''}</div>
        <a class="btn soft block" href="${A('/booking/' + st.result.token + '/ics')}" download>${ic('calendar')}Добавить в календарь</a><button class="btn ghost block" style="margin-top:10px" data-copy>${ic('link')}Скопировать ссылку для изменения записи</button><p class="hint" style="text-align:center">По этой ссылке можно перенести или отменить запись. Сохраните её.</p>`);
        sh.footer(`<button class="btn block" data-x>Готово</button>`);
      }
    }
    sh.el.addEventListener('click', async e => {
      const t = e.target; let x;
      if (x = t.closest('.svc')) { const id = x.dataset.id; st.sel.has(id) ? st.sel.delete(id) : st.sel.add(id); st.days = null; st.date = null; st.time = null; const sc = sh.body.scrollTop; draw(); sh.body.scrollTop = sc; }
      else if (x = t.closest('[data-cat]')) { st.cat = x.dataset.cat; draw(); }
      else if (x = t.closest('.dt')) { st.date = x.dataset.d; st.time = null; st.step = 3; draw(); }
      else if (x = t.closest('.tm')) { st.time = x.dataset.t; $$('.tm', sh.body).forEach(b => b.classList.toggle('on', b === x)); sh.footer(bar('Далее', false, 1)); }
      else if (t.closest('[data-consent]')) { e.preventDefault(); C.sheet({ title: 'Согласие на обработку данных', center: true, body: consentText }); }
      else if (t.closest('[data-copy]')) C.copy(st.result.manageUrl);
      else if (t.closest('[data-back]')) { st.step = Math.max(1, st.step - 1); draw(); }
      else if (t.closest('[data-next]')) {
        if (st.step < 4) { st.step++; draw(); return; }
        const f = st.form; f.name = $('#f-name', sh.body).value.trim(); f.phone = $('#f-phone', sh.body).value.trim(); f.telegram = $('#f-tg', sh.body).value.trim(); f.comment = $('#f-com', sh.body).value.trim(); f.consent = $('#f-ok', sh.body).checked;
        const er = $('#f-err', sh.body), fail = (m, id) => { er.textContent = m; er.classList.remove('hide'); if (id) { const el = $(id, sh.body); el.classList.add('err'); el.focus(); } };
        $$('.in', sh.body).forEach(i => i.classList.remove('err')); er.classList.add('hide');
        if (f.name.length < 2) return fail('Введите имя', '#f-name'); if (f.phone.replace(/\D/g, '').length < 11) return fail('Введите телефон полностью', '#f-phone'); if (!f.consent) return fail('Нужно согласие на обработку персональных данных');
        if (busy) return; busy = true; const btn = t.closest('[data-next]'); btn.disabled = true; btn.textContent = 'Записываем…';
        try { st.result = await api('POST', A('/book'), { services: ids(), date: st.date, time: st.time, name: f.name, phone: f.phone, telegram: f.telegram, comment: f.comment, consent: true, utm: utm() }); st.step = 5; localStorage.setItem('last-booking-' + slug, st.result.manageUrl); draw(); }
        catch (e) { busy = false; btn.disabled = false; btn.textContent = 'Записаться'; if (e.status === 409) { C.err(e); st.time = null; st.days = null; st.step = 3; draw(); } else fail(e.message); }
      }
    });
    draw();
  }
  /* ---- управление записью ---- */
  async function booking() {
    const token = location.pathname.split('/b/')[1].replace(/\/+$/, '');
    app.innerHTML = `<div class="wrap"><div class="top"><a class="icon-btn" data-go href="/${slug}">${ic('chev-l')}</a><h2>Ваша запись</h2></div><div class="sec"><div class="sk sk-card"></div></div></div>`;
    let b; try { b = await api('GET', A('/booking/' + token)); } catch (e) { app.innerHTML = `<div class="wrap">${C.empty('alert', 'Запись не найдена', 'Возможно, ссылка устарела. Свяжитесь с мастером.', `<div style="margin-top:18px"><a class="btn" data-go href="/${slug}">На страницу мастера</a></div>`)}</div>`; return; }
    const lab = { booked: ['Запись подтверждена', 'ac'], canceled: ['Запись отменена', 'bad'], came: ['Визит состоялся', 'ok'], noshow: ['Вы не пришли', 'warn'] }[b.status] || ['', ''];
    app.innerHTML = `<div class="wrap fade"><div class="top"><a class="icon-btn" data-go href="/${slug}" aria-label="К мастеру">${ic('chev-l')}</a><h2>Ваша запись</h2></div><div class="sec"><div class="card" style="margin-bottom:14px"><span class="badge ${lab[1]}">${lab[0]}</span><h3 style="margin:10px 0 2px;font-size:22px">${C.fmtDate(b.date, 1)}, ${b.time}</h3><div class="mut" style="font-weight:600">${esc(b.master.name)}${b.master.address ? ' · ' + esc(b.master.address) : ''}</div></div><div class="sum">${b.services.map(s => `<div class="r"><span>${esc(s.name)}</span><span class="num">${rub(s.price)}</span></div>`).join('')}<div class="r"><span>Длительность</span><span>${dur(b.duration)}</span></div><div class="r"><span>Итого</span><span class="num"><b>${rub(b.total)}</b></span></div></div>
    ${b.status !== 'canceled' ? `<a class="btn soft block" href="${A('/booking/' + token + '/ics')}" download>${ic('calendar')}Добавить в календарь</a>` : ''}
    ${b.canChange ? `<button class="btn ghost block" style="margin-top:10px" id="mv">${ic('repeat')}Перенести запись</button><button class="btn block" style="margin-top:10px;background:none;color:#d64545;box-shadow:inset 0 0 0 1.5px #f0c4c4" id="cx">Отменить запись</button>` : ''}
    ${b.canReview ? `<div class="card" style="margin-top:18px"><h3 style="font-size:20px;margin-bottom:10px">Оставьте отзыв</h3><div id="stars" style="display:flex;gap:6px;margin-bottom:10px">${[1, 2, 3, 4, 5].map(i => `<button data-s="${i}" aria-label="${i}" class="icon-btn flat" style="color:var(--line)">${C.ic('star', 'l')}</button>`).join('')}</div><textarea class="in" id="rv-t" placeholder="Что понравилось?" maxlength="600"></textarea><button class="btn block" style="margin-top:12px" id="rv-go" disabled>Отправить</button></div>` : ''}
    ${b.reviewed ? `<p class="hint" style="text-align:center;margin-top:16px">Спасибо за отзыв!</p>` : ''}</div></div>`;
    const cx = $('#cx'); if (cx) cx.onclick = async () => { if (await C.confirm('Отменить запись?', C.fmtDate(b.date) + ', ' + b.time, { ok: 'Отменить запись', cancel: 'Не отменять', danger: true })) { try { await api('POST', A(`/booking/${token}/cancel`)); toast('Запись отменена'); booking(); } catch (e) { C.err(e); } } };
    const mv = $('#mv'); if (mv) mv.onclick = () => reschedule(token, b);
    let rate = 0; $$('#stars button').forEach(bt => bt.onclick = () => { rate = +bt.dataset.s; $$('#stars button').forEach(x => x.style.color = +x.dataset.s <= rate ? 'var(--act)' : 'var(--line)'); $('#rv-go').disabled = false; });
    const rg = $('#rv-go'); if (rg) rg.onclick = async () => { try { await api('POST', A(`/booking/${token}/review`), { rating: rate, text: $('#rv-t').value }); toast('Спасибо за отзыв!'); booking(); } catch (e) { C.err(e); } };
  }
  async function reschedule(token, b) {
    const sh = C.sheet({ title: 'Перенос записи', full: true }); let date = null, time = null;
    sh.set('<div class="sk sk-card" style="margin:0"></div>'); let d; try { d = await api('GET', A('/days?token=' + token)); } catch (e) { C.err(e); sh.close(); return; }
    const draw = (slots) => { sh.set(`${strip(d.days, d.today, d.horizon, date)}${date ? `<div class="mlabel">${C.fmtDate(date, 1)}</div>${slots ? (slots.length ? `<div class="times">${slots.map(t => `<button class="tm num ${t === time ? 'on' : ''}" data-t="${t}">${t}</button>`).join('')}</div>` : C.empty('clock', 'Времени нет', 'Выберите другую дату.')) : '<div class="sk sk-card" style="margin:0;height:60px"></div>'}` : '<p class="hint">Выберите новую дату.</p>'}`); sh.footer(`<button class="btn block" data-go ${time ? '' : 'disabled'}>Перенести на ${date ? C.fmtDate(date) + ', ' + (time || '…') : '…'}</button>`); };
    draw(null); let cur = null;
    sh.el.addEventListener('click', async e => { let x;
      if (x = e.target.closest('.dt')) { date = x.dataset.d; time = null; draw(null); try { cur = (await api('GET', A(`/slots?date=${date}&token=${token}`))).slots; } catch (er) { C.err(er); cur = []; } draw(cur); }
      else if (x = e.target.closest('.tm')) { time = x.dataset.t; draw(cur); }
      else if (e.target.closest('[data-go]') && time) { try { await api('POST', A(`/booking/${token}/move`), { date, time }); sh.close(); toast('Запись перенесена'); booking(); } catch (er) { C.err(er); } } });
  }
  /* ---- события ---- */
  document.addEventListener('click', e => {
    const t = e.target; let x;
    if (!M) return;
    if (x = t.closest('.seg [data-t]')) { S.tab = x.dataset.t; const sg = $('.seg'); sg.dataset.i = S.tab === 'info' ? 1 : 0; $$('.seg button').forEach(b => b.classList.toggle('on', b === x)); $('#tabc').innerHTML = S.tab === 'book' ? bookTab() : infoTab(); }
    else if (t.closest('#go')) openBooking([], 1);
    else if (t.closest('#go2')) openBooking([...S.sel], 2);
    else if (x = t.closest('#tabc .svc')) openBooking([x.dataset.id], 2);
    else if (x = t.closest('.wrap .svc')) { const id = x.dataset.id; S.sel.has(id) ? S.sel.delete(id) : S.sel.add(id); const y = scrollY; services(true); scrollTo(0, y); }
    else if (x = t.closest('.wrap [data-cat]')) { S.cat = x.dataset.cat; services(true); }
    else if (x = t.closest('.gal button')) viewer(M.photos[x.parentNode.dataset.k], +x.dataset.i);
  });
  function render() {
    if (!M) return; const r = route();
    if (r === 'home') home(); else if (r === 'services') services(); else if (r === 'reviews') reviews(); else booking();
  }
  (async function init() {
    try { M = await api('GET', A('')); } catch (e) { app.innerHTML = `<div class="stub"><div class="stub-ring"></div><h1>Страница недоступна</h1><p>${esc(e.message)}</p></div>`; return; }
    C.applyTheme(M.theme, M.accent); render();
  })();
})();
