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
| [`heimdall-post/`](heimdall-post) | Tillägget för Claude-appen: Heimdalls verktyg, din e-post och guiden som kopplar dem. Släpps som `Heimdall.mcpb`. |

## Claude-appen (Mac och Windows) – enklast

1. Ladda ner **[Heimdall.mcpb](https://github.com/PataholmSystem/heimdall/releases/latest/download/Heimdall.mcpb)**.
2. Dubbelklicka på filen och klicka **Installera** i Claude.
3. Följ guiden som öppnas i webbläsaren – logga in och koppla din e-post.

Det är allt: tillägget ger Claude både Heimdalls verktyg och din e-post.

## Claude på webben och ChatGPT

Lägg till `https://naringslivscentralen.se/mcp` som anpassad anslutning
(*Customize → Connectors → Add custom connector*). Mejlen hamnar då i Heimdalls
utkastlåda, där du öppnar dem i ditt mejlprogram med ett klick.

## Claude Code

```bash
claude plugin marketplace add PataholmSystem/heimdall
claude plugin install heimdall@heimdall
```

Kör `/mcp`, välj **heimdall** och logga in. Sedan `/heimdall:heimdall skriv mejl
till …` – eller skriv bara *"Heimdall, skriv mejl till …"*. För e-posten:
`npx heimdall-post setup` (när paketet finns på npm).

## Vad Claude får se

Företagens namn, bransch, ort, storlek, webbplats och beskrivning, listans
erbjudande och det ni skrivit om läget. **Aldrig** e-postadresser,
telefonnummer, kontaktpersoners namn eller något om enskilda firmor – Heimdall
fyller i mottagaren själv. Företag med reklamspärr och de som tackat nej får
inga utkast. Inget skickas utan att du skickar det.

## Säkerhet

Hittar du en sårbarhet: skriv till info@pataholmsystem.se i stället för att
öppna ett ärende. Se [SECURITY.md](SECURITY.md).
