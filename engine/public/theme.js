/* Темы: вычисляет все цвета из пресета и акцента, контраст по WCAG AA. Работает и на сервере, и в браузере. */
(function (root) {
  const PRESETS = {
    rose: { name: 'Роза', accent: '#c8467a', bg: '#fbf3f2', tx: '#2b1a24', mut: '#85707c', line: '#f0e2e2' },
    beige: { name: 'Беж', accent: '#a67c52', bg: '#f9f5ee', tx: '#2d2519', mut: '#82776a', line: '#ece3d4' },
    lavender: { name: 'Лаванда', accent: '#7c5cd1', bg: '#f5f2fb', tx: '#231c33', mut: '#776f92', line: '#e7e1f3' },
    sage: { name: 'Шалфей', accent: '#5f8f73', bg: '#f1f6f2', tx: '#1d2a22', mut: '#6b8073', line: '#dfe9e2' },
    mocha: { name: 'Мокко', accent: '#8a5a44', bg: '#f6efea', tx: '#2c1f19', mut: '#82695e', line: '#eadfd7' },
    dark: { name: 'Тёмная', accent: '#ff8fb1', dark: true }
  };
  const hex2 = h => { h = String(h || '').trim().replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return /^[0-9a-f]{6}$/i.test(h) ? [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)) : null; };
  const toHex = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => { const x = hex2(a), y = hex2(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };
  const lum = h => { const c = hex2(h).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
  const contrast = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05); };
  const validHex = h => !!hex2(h);
  function fill(acc) { let f = acc, i = 0; for (; i < 12; i++) { if (Math.max(contrast(f, '#ffffff'), contrast(f, '#1a1220')) >= 4.5) break; f = mix(f, '#000000', .1); } const ink = contrast(f, '#ffffff') >= contrast(f, '#1a1220') ? '#ffffff' : '#1a1220'; return { f, ink }; }
  function asText(acc, bg, dark) { let t = acc, i = 0; while (contrast(t, bg) < 4.5 && i++ < 14) t = mix(t, dark ? '#ffffff' : '#000000', .1); return t; }
  function palette(theme, accent) {
    const p = PRESETS[theme] || PRESETS.rose, acc = validHex(accent) ? toHex(hex2(accent)) : p.accent;
    let bg, card, tx, mut, line, dark = !!p.dark;
    if (dark) { bg = mix(acc, '#0e0c12', .93); card = mix(acc, '#1c1822', .93); tx = '#f6eef2'; mut = '#a898a2'; line = mix(acc, '#2a2432', .9); }
    else { bg = p.bg; card = '#ffffff'; tx = p.tx; mut = p.mut; line = p.line; if (validHex(accent) && accent !== p.accent) { bg = mix(acc, '#ffffff', .94); line = mix(acc, '#ffffff', .86); } }
    const fl = fill(acc), act = asText(acc, card, dark);
    return { bg, card, tx, mut, line, ac: fl.f, ink: fl.ink, act, acs: mix(acc, card, dark ? .8 : .88), g: `linear-gradient(135deg,${mix(fl.f, '#ffffff', .1)},${fl.f} 50%,${mix(fl.f, '#000000', .14)})`, sh: dark ? 'rgba(0,0,0,.45)' : toRgba(fl.f, .18), mut2: asText(mut, card, dark), dark };
  }
  const toRgba = (h, a) => 'rgba(' + hex2(h).join(',') + ',' + a + ')';
  function vars(p) { return `--bg:${p.bg};--card:${p.card};--tx:${p.tx};--mut:${p.mut2};--line:${p.line};--ac:${p.ac};--ink:${p.ink};--act:${p.act};--acs:${p.acs};--g:${p.g};--sh:${p.sh};color-scheme:${p.dark ? 'dark' : 'light'}`; }
  function css(theme, accent) {
    const p = PRESETS[theme] || PRESETS.rose; const light = palette(theme, accent);
    if (p.dark) return ':root{' + vars(light) + '}';
    const d = palette('dark', accent || p.accent);
    return ':root{' + vars(light) + '}@media (prefers-color-scheme:dark){:root{' + vars(d) + '}}';
  }
  const api = { PRESETS, css, palette, contrast, mix, validHex };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Theme = api;
})(typeof window !== 'undefined' ? window : globalThis);
