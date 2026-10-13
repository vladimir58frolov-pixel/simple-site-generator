/* Общие утилиты интерфейса (страница мастера, кабинет, панель платформы) */
(function () {
  const C = window.C = {};
  try { C.boot = JSON.parse(document.getElementById('boot').textContent || '{}'); } catch { C.boot = {}; }
  C.$ = (s, r) => (r || document).querySelector(s); C.$$ = (s, r) => [...(r || document).querySelectorAll(s)];
  C.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  C.ic = (n, c) => `<svg class="i ${c || ''}" aria-hidden="true"><use href="/_static/icons.svg#${n}"/></svg>`;
  C.rub = n => n ? Number(n).toLocaleString('ru-RU') + '\u00a0₽' : 'по запросу';
  C.dur = m => { m = +m || 0; const h = Math.floor(m / 60), r = m % 60; return (h ? h + '\u00a0ч' : '') + (h && r ? ' ' : '') + (r || !h ? r + '\u00a0мин' : ''); };
  const MG = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'], WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'], WDF = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
  C.MG = MG; C.WD = WD; C.MN = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  C.pd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  C.ymd = d => d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
  C.addDays = (s, n) => { const d = C.pd(s); d.setUTCDate(d.getUTCDate() + n); return C.ymd(d); };
  C.fmtDate = (s, full) => { const d = C.pd(s); return d.getUTCDate() + ' ' + MG[d.getUTCMonth()] + ', ' + (full ? WDF : WD)[d.getUTCDay()]; };
  C.stars = (n, max) => { let o = ''; for (let i = 1; i <= (max || 5); i++) o += `<svg class="i ${i <= Math.round(n) ? '' : 'o'}"><use href="/_static/icons.svg#star"/></svg>`; return `<span class="stars" role="img" aria-label="${n} из 5">${o}</span>`; };
  C.debounce = (f, t) => { let h; return (...a) => { clearTimeout(h); h = setTimeout(() => f(...a), t); }; };
  C.csrf = '';
  C.hooks = {};
  C.api = async function (method, url, body, opt) {
    const h = { 'x-csrf': C.csrf }; let b;
    if (opt && opt.raw) { b = body; h['Content-Type'] = opt.type || 'application/octet-stream'; } else if (body !== undefined) { b = JSON.stringify(body); h['Content-Type'] = 'application/json'; }
    let r; try { r = await fetch(url, { method, headers: h, body: b, credentials: 'same-origin' }); } catch { throw Object.assign(new Error('Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.'), { status: 0 }); }
    let d = {}; try { d = await r.json(); } catch { }
    if (!r.ok) { const e = Object.assign(new Error(d.error || 'Ошибка ' + r.status), { status: r.status, code: d.code, data: d }); if (d.code === 'BROKEN_JSON' && C.hooks.broken) C.hooks.broken(d); if (d.code === 'AUTH' && C.hooks.auth) C.hooks.auth(); throw e; }
    return d;
  };
  C.toast = (msg, err) => { C.$$('.toast').forEach(t => t.remove()); const t = document.createElement('div'); t.className = 'toast' + (err ? ' err' : ''); t.setAttribute('role', 'status'); t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), err ? 5000 : 2800); };
  C.err = e => C.toast(e && e.message || 'Ошибка', true);
  C.copy = async text => { try { await navigator.clipboard.writeText(text); } catch { const t = document.createElement('textarea'); t.value = text; t.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch { } t.remove(); } C.toast('Скопировано'); };
  C.shareLinks = (text, url) => `<a class="btn wa block" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(text)}">${C.ic('wa')}WhatsApp</a><a class="btn tg block" style="margin-top:10px" target="_blank" rel="noopener" href="https://t.me/share/url?url=${encodeURIComponent(url || ' ')}&text=${encodeURIComponent(text)}">${C.ic('tg')}Telegram</a>`;
  C.share = (text, url) => { if (navigator.share) { navigator.share({ text, url }).catch(() => { }); return; } const s = C.sheet({ title: 'Поделиться', center: true, body: C.shareLinks(text, url) }); };
  let lock = 0; const lockScroll = on => { lock += on ? 1 : -1; document.body.style.overflow = lock > 0 ? 'hidden' : ''; };
  C.sheet = function (o) {
    const ov = document.createElement('div'); ov.className = 'ov' + (o.center ? ' center' : '');
    ov.innerHTML = `<div class="sheet ${o.full ? 'full' : ''}" role="dialog" aria-modal="true" ${o.title ? 'aria-label="' + C.esc(o.title) + '"' : ''}><div class="grab" aria-hidden="true"></div>${o.title ? `<div class="st"><h3>${o.title}</h3><button class="icon-btn flat" data-x aria-label="Закрыть">${C.ic('x')}</button></div>` : ''}${o.steps ? '<div class="steps"></div>' : ''}<div class="sb"></div><div class="sf hide"></div></div>`;
    const sh = C.$('.sheet', ov), api = { el: ov, sheet: sh, body: C.$('.sb', ov), foot: C.$('.sf', ov), closed: false };
    api.set = h => { api.body.innerHTML = h; api.body.scrollTop = 0; }; api.footer = h => { api.foot.innerHTML = h || ''; api.foot.classList.toggle('hide', !h); };
    api.setTitle = t => { const e = C.$('.st h3', ov); if (e) e.innerHTML = t; };
    api.step = n => { const s = C.$('.steps', ov); if (s) s.innerHTML = Array.from({ length: o.steps }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join(''); };
    api.close = () => { if (api.closed) return; api.closed = true; document.removeEventListener('keydown', esc); sh.style.transition = 'transform .25s'; sh.style.transform = 'translateY(105%)'; ov.style.transition = 'opacity .25s'; ov.style.opacity = 0; setTimeout(() => { ov.remove(); lockScroll(false); }, 240); if (o.onClose) o.onClose(); };
    const esc = e => { if (e.key === 'Escape') api.close(); }; document.addEventListener('keydown', esc);
    ov.addEventListener('mousedown', e => { if (e.target === ov) api.close(); }); ov.addEventListener('click', e => { if (e.target.closest('[data-x]')) api.close(); });
    let sy = null; const drag = C.$$('.grab,.st', ov);
    drag.forEach(el => el.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; sy = e.clientY; el.setPointerCapture(e.pointerId); sh.style.transition = 'none'; }));
    drag.forEach(el => { el.addEventListener('pointermove', e => { if (sy === null) return; sh.style.transform = `translateY(${Math.max(0, e.clientY - sy)}px)`; }); const up = e => { if (sy === null) return; const dy = e.clientY - sy; sy = null; if (dy > 100) api.close(); else { sh.style.transition = 'transform .25s'; sh.style.transform = ''; } }; el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); });
    document.body.appendChild(ov); lockScroll(true); if (o.body) api.set(o.body); if (o.footer) api.footer(o.footer); if (o.steps) api.step(o.step || 1); return api;
  };
  C.confirm = (title, text, opt) => new Promise(res => {
    opt = opt || {}; let done = false; const s = C.sheet({ center: true, body: `<div class="dlg"><h3>${C.esc(title)}</h3><p>${C.esc(text || '')}</p><div class="b"><button class="btn ghost" data-n>${opt.cancel || 'Отмена'}</button><button class="btn ${opt.danger ? 'danger' : ''}" data-y>${C.esc(opt.ok || 'Да')}</button></div></div>`, onClose: () => { if (!done) { done = true; res(false); } } });
    s.el.addEventListener('click', e => { if (e.target.closest('[data-y]')) { done = true; res(true); s.close(); } else if (e.target.closest('[data-n]')) s.close(); });
  });
  C.sortable = function (box, o) {
    box.addEventListener('pointerdown', e => {
      const h = e.target.closest(o.handle); if (!h || !box.contains(h)) return; const it = h.closest(o.item); if (!it) return; e.preventDefault();
      let startY = e.clientY; it.classList.add('drag'); const T0 = it.getBoundingClientRect().top;
      const mv = ev => {
        it.style.transform = `translateY(${ev.clientY - startY}px)`; const r = it.getBoundingClientRect(), mid = r.top + r.height / 2, sib = C.$$(o.item, box).filter(x => x.parentNode === it.parentNode), i = sib.indexOf(it);
        const nx = sib[i + 1], pv = sib[i - 1]; let moved = false;
        if (nx && mid > nx.getBoundingClientRect().top + nx.offsetHeight / 2) { nx.after(it); moved = true; } else if (pv && mid < pv.getBoundingClientRect().top + pv.offsetHeight / 2) { pv.before(it); moved = true; }
        if (moved) { it.style.transform = 'none'; const L1 = it.getBoundingClientRect().top; startY = ev.clientY - (r.top - L1); it.style.transform = `translateY(${ev.clientY - startY}px)`; }
      };
      const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); it.classList.remove('drag'); it.style.transform = ''; o.onDone(C.$$(o.item, box).filter(x => x.parentNode === it.parentNode).map(x => x.dataset.id), it); };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    });
  };
  C.img = async function (file, o) {
    o = o || {}; if (!/^image\//.test(file.type || '') && !/\.(jpe?g|png|webp|heic)$/i.test(file.name || '')) throw new Error('Выберите файл-изображение (JPG, PNG или WebP)');
    let bmp; try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { throw new Error('Не удалось открыть это изображение. Подойдут JPG, PNG или WebP.'); }
    let sx = 0, sy = 0, sw = bmp.width, sh = bmp.height, cw, ch;
    if (o.w && o.h) { const ar = o.w / o.h; if (sw / sh > ar) { const nw = sh * ar; sx = (sw - nw) / 2; sw = nw; } else { const nh = sw / ar; sy = (sh - nh) / 2; sh = nh; } cw = Math.min(o.w, Math.round(sw)); ch = Math.round(cw / ar); }
    else { const k = Math.min(1, (o.max || 1600) / Math.max(sw, sh)); cw = Math.round(sw * k); ch = Math.round(sh * k); }
    const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch; const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, cw, ch); x.imageSmoothingQuality = 'high'; x.drawImage(bmp, sx, sy, sw, sh, 0, 0, cw, ch);
    return new Promise((res, rej) => cv.toBlob(b => b ? res(b) : rej(new Error('Не удалось сжать фото')), 'image/jpeg', o.q || .86));
  };
  C.blobToDataUrl = b => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });
  C.empty = (icon, title, text, extra) => `<div class="empty"><div class="eb">${C.ic(icon)}</div><b>${C.esc(title)}</b>${C.esc(text || '')}${extra || ''}</div>`;
  C.applyTheme = (theme, accent) => { const s = C.$('#theme'); if (s && window.Theme) s.textContent = Theme.css(theme, accent); };
  C.applyDesign = design => { document.documentElement.dataset.design = window.Theme ? Theme.design(design) : 'classic'; };
  C.qs = k => new URLSearchParams(location.search).get(k);
})();
(function () {
  C.fmtPhone = v => { let d = String(v || '').replace(/\D/g, ''); if (!d) return ''; if (d[0] === '8') d = '7' + d.slice(1); else if (d[0] !== '7') d = '7' + d; d = d.slice(0, 11); let o = '+7'; if (d.length > 1) o += ' ' + d.slice(1, 4); if (d.length > 4) o += ' ' + d.slice(4, 7); if (d.length > 7) o += '-' + d.slice(7, 9); if (d.length > 9) o += '-' + d.slice(9, 11); return o; };
  C.phoneInput = el => { el.addEventListener('input', () => { if (el.value.replace(/\D/g, '').length || el.value === '+') el.value = C.fmtPhone(el.value); }); el.addEventListener('focus', () => { if (!el.value) el.value = '+7 '; }); el.addEventListener('blur', () => { if (el.value.replace(/\D/g, '').length <= 1) el.value = ''; }); };
  C.initial = n => (String(n || '?').trim()[0] || '?').toUpperCase();
  C.contactLinks = m => [m.phone && ['phone', m.phone, 'tel:+' + m.phone.replace(/\D/g, '')], m.whatsapp && ['wa', 'WhatsApp', 'https://wa.me/' + m.whatsapp], m.telegram && ['tg', 'Telegram', 'https://t.me/' + m.telegram], m.instagram && ['ig', 'Instagram*', 'https://instagram.com/' + m.instagram], m.vk && ['vk', 'VK', 'https://vk.com/' + m.vk]].filter(Boolean);
})();
