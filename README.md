# Heimdall för Claude

Koppla [Näringslivscentralens](https://naringslivscentralen.se) prospektverktyg
**Heimdall** till Claude och be om till exempel

> skriv mejl till 10 företag i Hemsidor-listan som inte kontaktats

Claude synkar listan, väljer företagen, läser underlaget och skriver ett mejl per
företag. Utkasten hamnar bland dina vanliga utkast (med hjälparen
`heimdall-post`) eller i Heimdalls utkastlåda. Du läser och skickar själv – och
listan uppdateras när mejlen går iväg.

Repot innehåller två saker:

| | |
| --- | --- |
| [`plugin/`](plugin) | Pluginen för Claude Code: kopplingen till Heimdall, hjälparen och skillen `heimdall`. |
| [`heimdall-post/`](heimdall-post) | Hjälparen för mejlkorgen – lägger utkasten i din egen korg över IMAP och synkar det du skickar. Publiceras på npm. |

## Claude Code

```bash
claude plugin marketplace add PataholmSystem/heimdall
claude plugin install heimdall@heimdall
```

Kör `/mcp`, välj **heimdall** och logga in med ditt konto på
naringslivscentralen.se. Sedan `/heimdall:heimdall skriv mejl till …` – eller
skriv bara *"Heimdall, skriv mejl till …"*.

För mejlkorgen:

```bash
npx heimdall-post setup
```

## Claude på webben och Claude Desktop

Lägg till `https://naringslivscentralen.se/mcp` under *Customize → Connectors →
Add custom connector*, och ladda upp mappen `plugin/skills/heimdall` som skill.
Hjälparen finns som `.mcpb` under [Releases](../../releases) – välj den för ditt
operativsystem och dubbelklicka.

## Vad Claude får se

Företagens namn, bransch, ort, storlek, webbplats och beskrivning, listans
erbjudande och det ni skrivit om läget. **Aldrig** e-postadresser,
telefonnummer, kontaktpersoners namn eller något om enskilda firmor – Heimdall
fyller i mottagaren själv. Företag med reklamspärr och de som tackat nej får
inga utkast. Inget skickas utan att du skickar det.

## Säkerhet

Hittar du en sårbarhet: skriv till info@pataholmsystem.se i stället för att
öppna ett ärende. Se [SECURITY.md](SECURITY.md).
