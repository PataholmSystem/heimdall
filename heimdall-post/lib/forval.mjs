/**
 * Mejltjänsterna hjälparen känner. Allt går över IMAP; det som skiljer är
 * servern och hur man loggar in. Proton nås bara via Bridge på den egna
 * datorn, och Microsoft har stängt av lösenord för IMAP – där loggar man in
 * med en kod i webbläsaren i stället.
 */
export const FORVAL = {
  proton: {
    namn: 'Proton Mail (via Proton Mail Bridge)',
    host: '127.0.0.1',
    port: 1143,
    secure: false,
    auth: 'losenord',
    bridge: true,
    hjalp:
      'Kräver ett betalt Proton-konto och Proton Mail Bridge igång. Användarnamnet och lösenordet är Bridges (inte ditt Proton-lösenord) – de står i Bridge under kontot. Exportera också Bridges certifikat (Inställningar → Avancerat → Exportera TLS-certifikat) så att anslutningen kan kontrolleras.',
  },
  gmail: {
    namn: 'Gmail eller Google Workspace',
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: 'losenord',
    hjalp:
      'Använd ett applösenord: myaccount.google.com/apppasswords (kräver tvåstegsverifiering). I Google Workspace kan administratören ha stängt av applösenord.',
  },
  microsoft: {
    namn: 'Outlook, Hotmail eller Microsoft 365',
    host: 'outlook.office365.com',
    port: 993,
    secure: true,
    auth: 'microsoft',
    hjalp: 'Du loggar in med en kod i webbläsaren. I vissa organisationer behöver administratören godkänna appen först.',
  },
  icloud: {
    namn: 'iCloud',
    host: 'imap.mail.me.com',
    port: 993,
    secure: true,
    auth: 'losenord',
    hjalp: 'Använd ett appspecifikt lösenord: account.apple.com → Inloggning och säkerhet → Appspecifika lösenord.',
  },
  fastmail: { namn: 'Fastmail', host: 'imap.fastmail.com', port: 993, secure: true, auth: 'losenord', hjalp: 'Skapa ett applösenord under Settings → Privacy & Security.' },
  loopia: { namn: 'Loopia', host: 'mailcluster.loopia.se', port: 993, secure: true, auth: 'losenord', hjalp: 'Samma lösenord som i Loopia Webmail.' },
  onecom: { namn: 'One.com', host: 'imap.one.com', port: 993, secure: true, auth: 'losenord', hjalp: 'Samma lösenord som i One.com Webmail.' },
  binero: { namn: 'Binero', host: 'imap.binero.se', port: 993, secure: true, auth: 'losenord', hjalp: 'Samma lösenord som i Binero Webmail.' },
  annan: { namn: 'Annan e-post med IMAP', host: '', port: 993, secure: true, auth: 'losenord', hjalp: 'IMAP-servern står i din e-postleverantörs hjälp.' },
}
