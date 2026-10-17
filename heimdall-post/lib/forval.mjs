/**
 * Mejltjänsterna hjälparen känner, och hur man kopplar var och en – stegen
 * guiden visar, knapparna som öppnar rätt sida, och vad som sägs när
 * lösenordet inte godtas. Allt går över IMAP; det som skiljer är servern och
 * inloggningen.
 *
 * Proton nås bara via Bridge på den egna datorn. Gmail och iCloud vill ha ett
 * applösenord, inte det vanliga. Microsoft har stängt av lösenord för IMAP –
 * där loggar man in med en kod i webbläsaren.
 */
export const FORVAL = {
  proton: {
    namn: 'Proton Mail',
    host: '127.0.0.1',
    port: 1143,
    secure: false,
    auth: 'losenord',
    bridge: true,
    losenordEtikett: 'Lösenordet från Proton Mail Bridge',
    steg: [
      'Öppna programmet Proton Mail Bridge på datorn.',
      'Klicka på ditt konto.',
      'Under "Mailbox details" står ett lösenord. Klicka på kopiera-ikonen bredvid det.',
      'Klistra in det här nedanför.',
    ],
    lankar: [{ text: 'Har du inte Bridge? Ladda ner den', href: 'https://proton.me/mail/bridge' }],
    obs: 'Det är Bridges lösenord, inte lösenordet du loggar in på Proton med. Bridge kräver ett betalt Proton-konto.',
    felLosenord: 'Lösenordet godtogs inte. Kopiera lösenordet under "Mailbox details" i Bridge – inte ditt vanliga Proton-lösenord.',
  },
  gmail: {
    namn: 'Gmail',
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: 'losenord',
    losenordEtikett: 'Applösenordet från Google (16 bokstäver)',
    steg: [
      'Klicka på knappen nedanför. Googles sida för applösenord öppnas.',
      'Skriv Heimdall som namn och klicka på Skapa.',
      'Kopiera koden Google visar – 16 bokstäver – och klistra in den här.',
    ],
    knapp: { text: 'Öppna Googles sida för applösenord', href: 'https://myaccount.google.com/apppasswords' },
    lankar: [
      { text: 'Står det att inställningen inte är tillgänglig? Slå på tvåstegsverifiering först', href: 'https://myaccount.google.com/signinoptions/twosv' },
    ],
    obs: 'Använder ni Google Workspace kan er administratör ha stängt av applösenord. Då kan du hoppa över det här steget – utkasten hamnar i Heimdalls utkastlåda i stället.',
    felLosenord: 'Google godtog inte lösenordet. Använd ett applösenord (16 bokstäver), inte ditt vanliga Google-lösenord.',
  },
  microsoft: {
    namn: 'Outlook / Microsoft 365',
    host: 'outlook.office365.com',
    port: 993,
    secure: true,
    auth: 'microsoft',
    steg: ['Klicka på Logga in med Microsoft.', 'Skriv in koden på Microsofts sida och logga in med ditt vanliga konto.'],
    obs: 'I vissa företag behöver IT-avdelningen godkänna appen första gången.',
    felLosenord: 'Microsoft godtog inte inloggningen. Försök logga in igen.',
  },
  icloud: {
    namn: 'iCloud',
    host: 'imap.mail.me.com',
    port: 993,
    secure: true,
    auth: 'losenord',
    losenordEtikett: 'Det appspecifika lösenordet från Apple',
    steg: [
      'Klicka på knappen nedanför och logga in hos Apple.',
      'Välj Inloggning och säkerhet → Appspecifika lösenord, och klicka på plus.',
      'Skriv Heimdall som namn, kopiera lösenordet och klistra in det här.',
    ],
    knapp: { text: 'Öppna Apples kontosida', href: 'https://account.apple.com/account/manage' },
    felLosenord: 'Apple godtog inte lösenordet. Använd ett appspecifikt lösenord, inte ditt vanliga Apple ID-lösenord.',
  },
  fastmail: {
    namn: 'Fastmail',
    host: 'imap.fastmail.com',
    port: 993,
    secure: true,
    auth: 'losenord',
    losenordEtikett: 'Applösenordet från Fastmail',
    steg: ['Klicka på knappen nedanför.', 'Skapa ett nytt applösenord med åtkomst till IMAP.', 'Kopiera det och klistra in det här.'],
    knapp: { text: 'Öppna Fastmails inställningar', href: 'https://app.fastmail.com/settings/security/apps' },
  },
  loopia: {
    namn: 'Loopia',
    host: 'mailcluster.loopia.se',
    port: 993,
    secure: true,
    auth: 'losenord',
    losenordEtikett: 'Lösenordet till din e-post hos Loopia',
    steg: ['Skriv lösenordet du använder när du loggar in i Loopia Webmail.'],
  },
  onecom: {
    namn: 'One.com',
    host: 'imap.one.com',
    port: 993,
    secure: true,
    auth: 'losenord',
    losenordEtikett: 'Lösenordet till din e-post hos One.com',
    steg: ['Skriv lösenordet du använder när du loggar in i One.com Webmail.'],
  },
  binero: {
    namn: 'Binero',
    host: 'imap.binero.se',
    port: 993,
    secure: true,
    auth: 'losenord',
    losenordEtikett: 'Lösenordet till din e-post hos Binero',
    steg: ['Skriv lösenordet du använder när du loggar in i Binero Webmail.'],
  },
  annan: {
    namn: 'Din e-post',
    host: '',
    port: 993,
    secure: true,
    auth: 'losenord',
    losenordEtikett: 'Lösenordet till din e-post',
    steg: ['Skriv lösenordet du använder när du loggar in i webbmejlen.'],
    obs: 'Vi gissade servern utifrån din adress. Står den fel kan du ändra den under Avancerat – den står i din e-postleverantörs hjälp, ofta som "IMAP-server".',
  },
}
