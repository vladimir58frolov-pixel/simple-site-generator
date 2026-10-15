'use strict';
/* Служебные команды. Новичку не нужны: всё то же самое делается кнопками в панели платформы. */
const fs = require('fs'), store = require('./lib/store'), auth = require('./lib/auth'), create = require('./lib/create'), demo = require('./lib/demo');
const [cmd, a1] = process.argv.slice(2);
const base = () => (store.readConfig() || {}).baseUrl || 'http://localhost:3000';
function show(r) { const b = base().replace(/\/+$/, ''); console.log(`Страница мастера: ${b}/${r.slug}\nСсылка-приглашение (действует 7 дней, открывается один раз):\n${b}/${r.slug}/admin/invite/${r.inviteToken}`); }
try {
  if (cmd === 'init' || cmd === 'set-password') {
    const pw = process.env.PLATFORM_PASSWORD || ''; if (cmd === 'init' && store.readConfig() && !pw) { console.log('Платформа уже настроена.'); process.exit(0); }
    const e = auth.checkPassword(pw); if (e) { console.error(e); process.exit(2); }
    const c = store.readConfig() || { platformName: 'Beauty Agent', baseUrl: 'http://localhost:3000', allowExternal: false, port: 3000, host: '0.0.0.0' };
    c.passwordHash = auth.hashPassword(pw); store.writeConfig(c);
    if (cmd === 'init') { const made = demo.ensure(); console.log(made.length ? 'Созданы демо-мастера: ' + made.join(', ') : 'Демо-мастера уже есть.'); } else console.log('Пароль платформы изменён.');
  } else if (cmd === 'new') {
    if (!a1 || !fs.existsSync(a1)) { console.error('Укажите файл с анкетой: node engine/cli.js new anketa.txt'); process.exit(2); }
    const r = create.createMaster({ text: fs.readFileSync(a1, 'utf8') }); console.log('Мастер создан: ' + r.slug); show(r);
    r.warnings.filter(w => w.level === 'warn').forEach(w => console.log('  ! ' + w.text));
  } else if (cmd === 'reset') {
    if (!store.masterDir(a1)) { console.error('Мастер не найден: ' + a1); process.exit(2); }
    const x = store.readJSON(a1, 'auth.json', {}); x.passwordHash = ''; x.sessions = []; store.writeJSON(a1, 'auth.json', x, { noBackup: true }); show({ slug: a1, inviteToken: auth.newInvite(a1) });
  } else if (cmd === 'remove') {
    if (!store.masterDir(a1)) { console.error('Мастер не найден: ' + a1); process.exit(2); }
    create.archiveMaster(a1); console.log('Мастер перенесён в папку archive: ' + a1);
  } else { console.log('Команды: init, set-password, new <файл>, reset <slug>, remove <slug>'); process.exit(1); }
} catch (e) { console.error('Ошибка: ' + e.message); process.exit(1); }
