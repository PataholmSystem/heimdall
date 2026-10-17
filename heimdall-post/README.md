# Heimdall för Claude

Tillägget som kopplar **Heimdall** – prospektverktyget på
[Näringslivscentralen](https://naringslivscentralen.se) – till Claude och till din
egen e-post.

Be Claude om till exempel *"skriv mejl till 10 företag i Hemsidor-listan som inte
kontaktats"*. Claude väljer företagen, läser underlaget och skriver ett mejl per
företag. Mejlen hamnar som utkast bland dina vanliga utkast – du läser och
skickar själv – och listan uppdateras när du skickar.

**Tillägget skickar aldrig mejl.** Det finns ingen väg till SMTP i koden.

## Installera

1. Ladda ner **Heimdall.mcpb** från naringslivscentralen.se/konto/mcp (eller
   [senaste releasen](https://github.com/PataholmSystem/heimdall/releases/latest)).
2. Dubbelklicka på filen. Claude-appen öppnas – klicka **Installera**.
3. En guide öppnas i webbläsaren: logga in med ditt konto på Näringslivscentralen,
   skriv din e-postadress och följ två–tre steg för just din e-post.

Guiden känner själv igen om du har Proton Mail (via Bridge), Gmail, iCloud,
Outlook, Loopia, One.com, Binero eller annan e-post. Vill du inte koppla e-posten
hamnar mejlen i Heimdalls utkastlåda, där du öppnar dem i ditt mejlprogram med
ett klick.

Behöver du ändra något senare: be Claude *"öppna Heimdalls guide"*.

## Vad som händer med uppgifterna

- **Lösenordet** till e-posten ligger i datorns nyckelring (Keychain, Credential
  Manager, Secret Service). Aldrig i filer.
- **Inloggningen mot Heimdall** sker på naringslivscentralen.se, och kan tas bort
  under Mitt konto → AI-assistenten.
- **Mottagarnas adresser** kommer från Heimdall till tillägget och går till din
  e-post. Claude ser dem aldrig – bara antal och företagsnamn.
- **Synken** läser bara rubriker (avsändare, mottagare, datum, ämne). Den jämför
  adresserna på datorn mot hashar från Heimdall och skickar bara mejl i trådar
  från Heimdall, eller till och från en adress i listan sedan företaget kom in i
  den. Domänen ensam räcker aldrig. Ett mejl från adressen räknas som svar först
  när företaget kontaktats, och aldrig från noreply@, faktura@ och liknande
  eller när det är ett utskick till många. Allt annat i korgen – ämnesraden
  också – lämnar aldrig datorn.
- **Svarstexter** skickas till Claude bara om du sagt ja i guiden.
- **Guiden** körs bara på din egen dator (127.0.0.1) och kräver en hemlig nyckel
  i adressen. Proton Bridges certifikat sparas första gången och kontrolleras
  sedan vid varje anslutning.

## För utvecklare

```bash
npx heimdall-post setup    # samma guide, från en terminal
npx heimdall-post status
npx heimdall-post logout
```

`HEIMDALL_URL=http://localhost:3400` pekar ut en utvecklingsserver; den får egna
inloggningar i nyckelringen. Testerna: `npm test`.
