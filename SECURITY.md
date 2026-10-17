# Säkerhet

Rapportera sårbarheter till **info@pataholmsystem.se**, inte som ett öppet ärende.
Vi svarar inom tre arbetsdagar.

## Hur hjälparen är byggd

- **Inget skickas.** `heimdall-post` har ingen väg till SMTP. Den lägger utkast
  (IMAP APPEND) och läser rubriker.
- **Lösenord** ligger i operativsystemets nyckelring, aldrig i filer, argument
  eller loggar. I Claude Desktop förvarar Desktop lösenordet från formuläret.
- **Inloggningen mot Heimdall** sker på naringslivscentralen.se (OAuth med PKCE,
  svaret till en port på den egna datorn). Token gäller Heimdalls MCP-server och
  `/api/post`, och kan dras in under naringslivscentralen.se/konto/mcp.
- **Guiden** lyssnar bara på 127.0.0.1, kräver en hemlig nyckel per start,
  prövar värdnamnet mot DNS-rebinding och får inte ramas in.
- **TLS** kontrolleras alltid. Proton Bridges självsignerade certifikat hämtas
  från Bridge när korgen kopplas och godtas sedan bara på sitt fingeravtryck.
- **Det som lämnar datorn** är bara rubriker för mejl som rör användarens
  prospektlistor – matchade lokalt mot hashar – och, om användaren slagit på
  det, svarstexter till AI-assistenten.
- **Releaser** byggs i GitHub Actions: `Heimdall.mcpb` på releasen, och npm-paketet med proveniens.
