# heimdall-post

Hjälparen som kopplar **Heimdall** – prospektverktyget på
[Näringslivscentralen](https://naringslivscentralen.se) – till din egen mejlkorg.

När din AI-assistent (Claude, ChatGPT …) skrivit mejl till företagen i en
prospektlista sparas de som utkast i Heimdall. heimdall-post lägger dem bland
utkasten i din mejlkorg, och läser rubrikerna i Skickat och Inkorg så att listan
vet vad som skickats, besvarats och studsat.

**Den skickar aldrig mejl.** Det finns ingen väg till SMTP i koden – du läser och
skickar själv.

## Fungerar med

| Mejl | Inloggning |
| --- | --- |
| Proton Mail | Via Proton Mail Bridge (betalt Proton-konto). Bridges användarnamn och lösenord, och Bridges exporterade certifikat. |
| Gmail / Google Workspace | Applösenord (kräver tvåstegsverifiering). |
| Outlook / Microsoft 365 | Kod i webbläsaren. |
| iCloud | Appspecifikt lösenord. |
| Fastmail, Loopia, One.com, Binero, annan IMAP | Lösenord eller applösenord. |

## Installera

```bash
npx heimdall-post setup
```

Välj din mejltjänst, ange adress och applösenord, och godkänn koden som visas
på naringslivscentralen.se/koppla. Klart på fem minuter.

- **Claude Code:** pluginen `heimdall` startar hjälparen åt dig.
- **Claude Desktop:** installera `heimdall-post.mcpb` (dubbelklicka) och fyll i formuläret.
  Första gången ber hjälparen dig godkänna en kod.

```bash
npx heimdall-post status   # vad som är inställt
npx heimdall-post logout   # tar bort lösenordet och inloggningen
```

## Vad som händer med uppgifterna

- **Lösenordet** ligger i datorns nyckelring (Keychain, Credential Manager,
  Secret Service). Aldrig i filer.
- **Mottagarnas adresser** kommer från Heimdall till hjälparen och går till din
  mejlkorg. AI-modellen ser dem aldrig – bara antal och företagsnamn.
- **Synken** läser bara rubriker (avsändare, mottagare, datum, ämne, Message-ID).
  Den jämför adresserna lokalt mot hashar från Heimdall, och skickar bara det som
  rör dina listor. Allt annat i korgen lämnar aldrig datorn.
- **Svarstexter** skickas till AI-assistenten bara om du sagt ja i setup.
- **TLS** kontrolleras alltid. Bridges självsignerade certifikat fästs – bara
  den Bridge du exporterade certifikatet från godtas.

## Felsökning

- *"Mejlkorgen är inte inställd"* – kör `npx heimdall-post setup`.
- *Gmail: "Invalid credentials"* – använd ett applösenord, inte ditt vanliga.
- *Proton: anslutningen nekas* – starta Bridge, och exportera certifikatet igen om Bridge installerats om.
- *Outlook: "administratören måste godkänna"* – be IT godkänna appen Heimdall, eller använd Bcc-loggningen.
- *Inloggningen mot Heimdall har gått ut* – kör setup igen.

Inställningarna ligger i `~/.config/heimdall-post/` (macOS och Linux) eller
`%APPDATA%\heimdall-post` (Windows).
