# Workspace 2.0

Interní kuchyňská aplikace LABULA. Dvě hlavní pracovní oblasti: **Today** pro
Evening check, předání směny a Morning prep; **Menu** pro aktuální jídla, suroviny
a vnořené složení příprav. Původní logo LABULA, favicon a barevná paleta zůstávají.
Workspace 2.0 je nový název produktu; identita projektu a uložená data se nemění.

- Aplikace: https://labula-kitchen-recipes.jan984079.chatgpt.site/
- Zdrojový repozitář: https://github.com/sooofluffy89/labula-workspace
- Pokyny pro Codex: [AGENTS.md](AGENTS.md)
- Cloudové prostředí a nasazování: [docs/codex-cloud.md](docs/codex-cloud.md)
- Přechod, ochrana menu a rollback: [docs/workspace-2-0/MIGRATION.md](docs/workspace-2-0/MIGRATION.md)
- Implementace, testy a screenshoty: [docs/workspace-2-0/IMPLEMENTATION.md](docs/workspace-2-0/IMPLEMENTATION.md)

## Spuštění vývoje

Použij Node.js 24 (soubor `.nvmrc`) a npm. V kořeni repozitáře spusť:

```sh
npm run cloud:setup
npm run dev
```

`cloud:setup` nainstaluje závislosti přes `npm ci`, aplikuje všechny migrace
do místní D1 a založí syntetického vývojového vlastníka. Je opakovatelné;
existující data ani rozpracované místní koncepty nemaže.

Otevři http://localhost:5173/signin-with-chatgpt?return_to=/ . Místní přihlášení
používá účet `local_seedy` / `seedy@sites.test`. R2 se emuluje místně.
Vývoj nepotřebuje produkční token, OpenAI API klíč ani skutečná uživatelská data.
Lokální přihlášení je dostupné pouze ve vývojovém serveru na loopback adrese.

## Ověření

```sh
npm run typecheck
npm run check
npm run build
# Celá kontrola jedním příkazem:
npm run validate
```

GitHub Actions provádí instalaci, místní databázové migrace, typovou kontrolu,
existující regresní skripty a produkční build na Linuxu. CI nic nenasazuje.

## Struktura a ukládání

| Cesta | Obsah |
| --- | --- |
| `app/` | Stránky, komponenty aplikace a serverové API |
| `lib/` | Doménové modely, serverové služby a klientská synchronizace |
| `db/`, `drizzle/` | D1 schéma a historie migrací |
| `components/`, `hooks/` | Sdílené UI komponenty a hooky |
| `scripts/` | Instalace, místní databáze, regresní kontroly a měření |
| `build/` | Zachovaná integrace Sites a místní vývojové přihlášení |
| `.openai/hosting.json` | Identita existujícího Sites projektu a vazby DB/BUCKET |
| `docs/` | Vývojová dokumentace a historické reporty |

React 19 běží přes Vinext/Vite s kompatibilními Next API. Produkční runtime je
Cloudflare Worker s D1 (`DB`) a R2 (`BUCKET`). Výstup sestavení je v `dist/`.
Lokální databáze a soubory leží v ignorované `.wrangler/state/`.

Produkční obsah databáze a R2 není součástí Git repozitáře. Migrace obsahují
historickou inicializaci přístupů; nejsou zálohou dat. Aplikace ověřuje identitu,
oprávnění, původ zapisujícího požadavku, revize a opakovatelné potvrzení zápisů.

Změny schématu přidávej novou migrací (`npm run db:generate`). Již aplikované
migrace neměň. Místní migrace lze spustit samostatně přes
`npm run db:migrate:local`; testovacího vlastníka doplní `npm run db:setup:local`.

## Publikace

GitHub je zdroj pro další vývoj. Push nebo sloučení PR samo o sobě nenahraje
aplikaci do Sites. Publikace používá existující projekt
`appgprj_6aa56065ff148191bca78164158e3a4c`; adresa a produkční vazby zůstávají
spravované Sites. Postup je v [cloudové dokumentaci](docs/codex-cloud.md).

Starší reporty popisují stav při daném vydání. Archivovaný checkpoint
`docs/history/resume-2026-10-02.md` není aktuální zadání ani pokyn k pokračování.
