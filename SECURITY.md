# Säkerhet

Rapportera sårbarheter till **info@pataholmsystem.se**, inte som ett öppet ärende.
Vi svarar inom tre arbetsdagar.

## Hur hjälparen är byggd

- **Inget skickas.** `heimdall-post` har ingen väg till SMTP. Den lägger utkast
  (IMAP APPEND) och läser rubriker.
- **Lösenord** ligger i operativsystemets nyckelring, aldrig i filer, argument
  eller loggar. I Claude Desktop förvarar Desktop lösenordet från formuläret.
- **Inloggningen mot Heimdall** är OAuth:s enhetsflöde. Token gäller bara
  `/api/post` och kan dras in under naringslivscentralen.se/konto/ai.
- **TLS** kontrolleras alltid. Proton Bridges självsignerade certifikat fästs
  på sitt fingeravtryck.
- **Det som lämnar datorn** är bara rubriker för mejl som rör användarens
  prospektlistor – matchade lokalt mot hashar – och, om användaren slagit på
  det, svarstexter till AI-assistenten.
- **Releaser** byggs i GitHub Actions och publiceras på npm med proveniens.
