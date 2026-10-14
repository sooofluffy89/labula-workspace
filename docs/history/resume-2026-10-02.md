> OBNOVENO na výslovný pokyn uživatele 2026-10-02. Níže je zachovaný checkpoint pauzy. Aktuální finální regrese, typy a lint prošly; pokračuje oficiální build a nasazení. Závěrečný výsledek bude v ../stanoviste-release-2026-10-02/REPORT.md.

# BEZPEČNĚ ZAPARKOVÁNO — 2026-10-02

Obnovit pouze na výslovný pokyn uživatele. Aktuální úkol jsou stanoviště v Evening check. Všechny rozpracované změny jsou uložené na disku, necommitované. Nic nebylo vráceno zpět. Nasazení nebylo zahájeno; po požadavku na pauzu nebyly spuštěny další testy. Předchozí dokončený checkpoint v51 byl zachován v ../stanoviste-release-2026-10-02/resume-v51-history.md.

## Výchozí stav a rozsah

Zadání: /Users/johnny/Documents/LABULA/navrh-stanoviste-2026-10-02/master-prompt.md. Celé zadání a závazné podklady byly přečteny, včetně Sites building/hosting workflow.
Projekt: /Users/johnny/Documents/LABULA/labula-kuchyne.
HEAD při zastavení: ac70b411781ab0c7b85c6c1405ce07d82b9cfda6; výchozí strom byl čistý.
Produkce naposledy ověřena jako v61, stejný commit; deployment appgdep_6abf00e08e008191b749424c53912ef5.
Sites projekt: appgprj_6aa56065ff148191bca78164158e3a4c.
Soukromé custom audience revize 5 ověřeno; Jan owner, dosavadní přístupy Wen/Mark zachované. Nebyly měněny skutečné účty, stanoviště, Track, kola, odpovědi, pokyny ani Ready.

## Implementováno, ještě NEPUBLIKOVÁNO

- Nové lib/checking-stations.ts, lib/checking-stations-server.ts, app/api/checking-stations/: stabilní stanice 1/2/3 a nullable Not assigned, nezávislé revize, atomický bulk CAS, Owner/Manager server guard, idempotentní operace a audit autora/času, bezpečný no-op.
- lib/stock-client.ts: samostatná bezpečná lokální fronta a původní ID, reload/retry/ztracené ACK, explicitní review konfliktu. Poslední doplnění beforeStationId uchovává původní hodnotu pro obnovu dialogu.
- app/checking-stations.tsx, stock-list.tsx, manage-frequency.tsx: společný single/bulk editor Save station/Cancel, stabilní ID, skrytý výběr, úplné původní → nové hodnoty, filtr stanice s AND, starší pohledy jako All, návrat focusu. Check rounds UI nezměněno.
- evening-server/evening/stock-workflow: frozen snapshot při Start/Add, legacy bez backfillu, okamžité lokální filtry, All skupiny, stabilní pořadí, lokální i globální postup, globální fronta a Finish. Morning ovládání a fast sync zachované.
- db/schema.ts a drizzle/0016_loud_hairball.sql + meta: dvě prázdné nové tabulky checking_station_items/checking_station_commands a nullable evening_answers.station_snapshot, žádné seeding/backfill.
- Backup: 35 tabulek, stations:1 marker, rozlišení úplné původní 33tabulkové legacy zálohy od neúplné aktuální.
- Nejnovější změny information/server/detail + operations/server/workspace: původní stanoviště v potvrzeném zdroji, historii a CSV, Not recorded vs Not assigned.
- Mobilní scoped CSS, současný reduced motion, klávesnice a oprávnění zachované.

## Testy a hranice jejich platnosti

Evidence: /Users/johnny/Documents/LABULA/stanoviste-release-2026-10-02.
- Poslední celá sada 76 regresních skriptů prošla (regressions-final.log). Původních 73 + tři nové stanovištní regrese.
- stations-final.log: skutečný controller/API/SQLite, atomické CAS/rollback, role, no-op/replay, snapshot, dvě identity/delta sync, globální Finish, Morning, durable recovery, konflikty/storage/backup.
- stations-ui.log: výběr/obnova/preference, skupiny/počty/prázdné stavy, explicitní Cancel/Save/no-op, staré pohledy.
- stations-compatibility.log: remove/re-add, merge/Undo po pozdější změně stanice, souběžný Start, Add snapshot, původní v61 Finish journal a aditivní migrace nad původní naplněnou DB.
- TypeScript/lint prošly (types-final.log/lint-final.log). Oficiální produkční build prošel (build.log).
- POZOR: poslední kompletní sada, typy/lint/build PŘEDCHÁZEJÍ posledním změnám beforeStationId a source/history/CSV projekce. Na finálním zdroji ještě ověřit. Netvrdit připravenost finálního zdroje k nasazení.

## Browser QA a nedokončené scénáře

Izolovaná syntetická DB, různé owner/Cook/Helper identity. Ověřen bulk se skrytým výběrem a zachovaným hledáním, explicitní Save/focus, starý snapshot po změně manažerem, dvě identity na různých stanicích a sdílený postup; reálné šířky 320/390/430, dlouhý název, zalomené tabs bez přetečení, klávesnice, forced reduced-motion CSS, globální Finish z filtrované stanice s nevyplněnými skrytými řádky.
Screenshoty: manage-review.jpg, evening-all-390.jpg, evening-station-320.jpg, evening-unassigned-430.jpg, finish-filtered-430.jpg. Finální mobilní snímky ještě vizuálně zkontrolovat.

Zjištěné a opravené, ještě dověřit:
- Return to first unchecked: dialog původně vrátil focus na Finish. Opraveno finishReturn ref/onCloseAutoFocus, finální browser ověření zbývá.
- Vlastní bulk ACK mohl krátce ukázat falešný konflikt. Opraveno lokálním sending stavem; retry/konflikt po reloadu ještě dověřit.
- Nejnovější source/history/CSV a beforeStationId zatím bez finální celé sady.

Aktuální syntetický Cook browser http://127.0.0.1:5205/ má OFFLINE simulaci, 430 px a forced reduced-motion CSS. Jedna odpověď Synthetic 04 je bezpečně v lokální frontě, schovaná Station 1 filtrem; veřejně správně 1 waiting a globální 3/12. LocalStorage ani koncepty NEČISTIT. Po restartu QA přepnout network normal, Retry, ověřit drain a druhému Helper klientovi přenos. Poté dokončit celý syntetický check z filtru, potvrzenou serverovou publikaci a nezměněný Morning. Žádné produkční zápisy.

## Měření

before-performance.json/after-performance.json/measure.mjs a baseline-controller.mjs.
Stejné syntetické podmínky: 80 položek, třikrát 20ms HTTP a třikrát 500ms HTTP +5ms SQL. Obě verze 8 HTTP /28 D1 trips a 80 tasks; bytes 235419 →239499 (+1,73 %).
Průměr Finish přibližně 181,5 →179,0 ms (20ms profil), 3703,4 →3681,8 ms (500ms profil). Peer explicitní fresh read bez poll timeru přibližně 40,3 →37,3 a 612,8 →601,4 ms. Toto není produkční výkon ani důkaz statistického zrychlení. Offline browser tap-to-paint poslední měření 22,9 ms.
Zbývá samostatně doložit skutečné ACK řádkového zápisu a nula dalších API požadavků při lokálním přepínání načtených stanic. Stávající Finish měří celou ACK/publikační cestu.

## Záloha a nasazení

Úplná v61 záloha production-before.json, capturedAt 2026-10-02T09:04:46.078Z, 33 tabulek, counts/hash before-backup-evidence.json. Zdroj /Users/johnny/Downloads/labula-private-backup (57).json.
SHA256 5b98f38c80e893b548d5da1c8f84d28f4c0923417779188b9f3d781b41187aef.
Soukromou zálohu/evidence/QA identity nikdy nebalit do deploymentu. Před nasazením po pauze znovu získat čerstvou úplnou zálohu a ověřit aktuální verzi/přístupy. After-backup má mít 35 tabulek a prázdné nové tabulky; původní řádky/klíče/sloupce porovnat, legitimní nové změny kuchaře nepřepisovat.
Native Sites source workflow potvrdil checkout a základní commit. Krátkodobé credentials vypršely a nebyly zapsány na disk; získat nové oficiálně a předat pouze stdin. Žádná nová verze nebyla uložena, pushnuta ani nasazena.

## Procesy a restart

QA server session 24517, port 5205, při parkování zastaven Ctrl-C, exit 130. Data/soubory/browser journal ponechány. Žádný známý testovací/deploy proces tohoto úkolu neběží. Globální ps sandbox odmítl, nelze tvrdit stav nesouvisejících procesů.
QA kopie /private/tmp/labula-stations-qa s oddělenou SQLite; QA auth/layout/tools NESMĚJÍ do hlavního projektu. localhost = owner, 127.0.0.1 = Cook, [::1] = Helper.
Restart pouze po pokynu, z QA adresáře:
PATH=/Users/johnny/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH node node_modules/vinext/dist/cli.js dev --port 5205 --hostname ::
Node runtime: /Users/johnny/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.
Fungující npm: /private/tmp/labula-desktop-toolchain/node_modules/.bin/npm; staré npm symlinky nefunkční.

## Přesný další krok po pokračování

1. Přečíst tento checkpoint/zadání, ověřit HEAD, status, novější změny a skutečnou Sites verzi. Vše zachovat.
2. Zkontrolovat poslední beforeStationId a source/history/CSV, doplnit cílený důkaz. Restartovat izolovaný QA server a dokončit existující offline Retry → peer sync a focus po Return to first unchecked. Nečistit journal.
3. Dokončit syntetický globální Finish → potvrzená publikace → Morning se dvěma klienty, screenshots a samostatné ACK měření.
4. Finální celá aktuální sada (nyní 76), TypeScript, lint, oficiální build po posledních změnách.
5. Sepsat report/release, čerstvá production backup a kontrola přístupů, commit přesně ověřeného zdroje, oficiální Sites source/build/package/save/deploy na stejné soukromé adrese.
6. Po potvrzeném deploy pouze čtecí QA, úplná after-backup/porovnání všech původních dat a přístupů, potvrdit žádné skutečné přiřazení. Doložit verzi/commit/deployment a postup Manage list → vybrat → Assign station → Save station.

Do pokynu k pokračování žádný další krok nespouštět.
