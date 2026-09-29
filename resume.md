# Pozastaveno na pokyn uživatele — 2026-09-29

> AKTUALIZACE: Uživatel následně výslovně požádal pokračovat. Níže je zachovaný historický checkpoint, nikoli aktuální zákaz práce. HEAD a všechny změny byly ověřeny beze změny. Poslední TypeScript i lint znovu prošly; 63 regresí zůstává platných. QA server byl znovu spuštěn na 5199. Nejnovější ověřená záloha (36), capturedAt 2026-09-29T11:59:19.167Z, má totožná data všech 29 tabulek. Nasazení a jeho konečný výsledek budou doloženy v release receipt mimo zdrojový strom.

Práci obnovit až na výslovný pokyn uživatele. Žádné změny nebyly vráceny zpět. Zdrojové změny jsou uložené na disku, necommitované. Nasazení nebylo zahájeno. Po žádosti o pauzu nebyla spuštěna další testovací sada; pouze byly převzaty výsledky již běžících procesů a zastaven lokální server.

## Úkol a výchozí stav

- Zadání: `/Users/johnny/Documents/LABULA/navrh-edit-items-pokyny-2026-09-29/master-prompt.md` (celé zadání a závazné podklady již přečteny).
- Projekt: `/Users/johnny/Documents/LABULA/labula-kuchyne`.
- HEAD: `78f45d48cf93010c4b154f8a6b5046bc0e4c3172`.
- Produkce: https://labula-kitchen-recipes.jan984079.chatgpt.site/ — naposledy ověřena v50, zdroj `1a5731cd8217229eb59cc6b264a3ffe4a2055a41`.
- Sites projekt: `appgprj_6aa56065ff148191bca78164158e3a4c`. Soukromé custom publikum, revision 4, beze změny.
- Existující implementace pokynů/feedbacku v lokálním základu ještě není publikovaná. Při budoucím nasazení je nutné zohlednit již existující migraci 0015 (4 tabulky a nullable snapshoty pokynů). Tato úprava další tabulky nepřidává.

## Implementováno

- Tři tlačítka i názvy dialogů `Edit items`; výchozí filtr aktuálního kola.
- Zachování všech filtrů, přidán filtr potvrzených pokynů a přehledné zobrazení příslušnosti ke kolu. Stav filtrů, hledání, skupin a scrollu je oddělen podle účtu/kola.
- Kompaktní potvrzený pokyn a inline Add/Edit editor; jeden otevřený editor, 500 znaků, explicitní Save/Cancel, sdílený koncept s detailem ingredience.
- Hromadný owner-only index pokynů `/api/prep-instructions` bez načítání historie každého řádku.
- Konflikt vyžaduje čerstvé načtení před review; pending/offline stav se nevydává za potvrzené uložení. Obnova konceptů a ochrana navigace při selhání místního úložiště.
- Změny výběru do kol a ukládání pokynů zůstávají oddělené. Po ACK se správně přepočítají filtry; chráněn otevřený/čekající řádek.
- Responzivní úpravy a aktualizace souvisejících testovacích harnessů.

Změněné sledované soubory: `app/check-rounds.tsx`, `app/globals.css`, `app/information-detail.tsx`, `app/prep-notes.tsx`, `app/stock-workflow.tsx`, `lib/prep-notes-client.ts`, `lib/prep-notes-server.ts`, `lib/prep-notes.ts`, `scripts/check-information-ui.mjs`, `scripts/check-kitchen-preparation-integration.mjs`, `scripts/check-operations.mjs`, `scripts/sync-harness.mjs`.

Nové soubory/adresáře: `app/api/prep-instructions/`, `app/round-instructions.tsx`, `lib/round-instructions.ts`, `scripts/check-edit-items-instructions.mjs`, `scripts/check-edit-items-ui.mjs`, `docs/edit-items-instructions/` a tento soubor.

## Výsledky ověření

- Poslední již spuštěná kompletní sada **63 regresních skriptů prošla**, exit 0 (session 29424). Výsledek převzat při pozastavování; nebyla spuštěna další sada.
- TypeScript exit 0 (session 10869), lint exit 0 (22864). Jejich běh předcházel posledním drobným změnám textu editoru a chyby bulk indexu; kompletní regrese už tyto změny obsahuje.
- Produkční build dosud neproveden. Nic nebylo pushnuto, archivováno k publikaci, uloženo jako Sites verze ani nasazeno.
- Nové testy ověřují skutečné API/controller/SQLite, role, koncepty, filtry, ztracené ACK a opakování, konflikty revizí, oddělení od provozních dat, navigaci při selhání storage.
- Opravena syntetická clock stub v `check-operations.mjs`: dvouargumentová SQLite funkce `strftime` místo neúčinné zero-argumentové; produkční kalendář nebyl měněn.
- Prohlížeč na oddělených datech: filtry a návrat po reloadu, sdílený koncept detail/inline, offline a retry, konflikt dvou tabů, přesun syntetické položky mezi koly, starý vs nový snapshot Evening → Morning.
- Skutečné šířky 320/390/430 px bez horizontálního přetečení; ověřena délka 500 znaků, Escape a reduced-motion. Finální ověření focusu po RAF a čisté desktop screenshoty zbývají.
- Žádné skutečné pokyny, komentáře, Track, odpovědi, kola ani Ready nebyly měněny.

## Důkazy a měření

Adresář: `/Users/johnny/Documents/LABULA/edit-items-release-2026-09-29`.

- `check-all.log` končí `All 63 regression scripts passed.`; `typescript.log`, `lint.log` jsou prázdné úspěšné logy.
- `benchmark-current.json`, `benchmark-v50.json`: lokální model 60 ms HTTP / 2 ms SQL, 3 opakování, peer poll 2,5 s. Nejde o měření produkční rychlosti.
- Medián 80 odpovědí + Finish: v50 635,1 ms, nové bez komentáře 551,6 ms, s komentářem 609,3 ms. 30 Ready: 237,5 / 212,2 / 226,5 ms. Doručení druhému klientovi přibližně 2,57–2,71 s. Podrobnosti v `docs/edit-items-instructions/release.md`.
- Screenshoty: `mobile-320.png`, `editor-390.png`, `list-430.png`, `morning-synthetic.png`. Část snímků předchází finálním drobným úpravám; čistý desktop snímek seznamu/editoru ještě chybí.
- Izolovaný baseline benchmark: `/private/tmp/labula-edit-baseline-v50` (git archive, není worktree).

## Záloha a přístupy

- Ověřená kompletní produkční záloha `production-before.json`, capturedAt `2026-09-29T11:17:40.277Z`, 29 tabulek v50; hash `backup-before-sha256.txt`, validace `backup-validation.json`.
- Zdroj stažení `/Users/johnny/Downloads/labula-private-backup (35).json`.
- Před pauzou byl vyžádán ještě čerstvější export přes produkční UI. Jeho doručení do Downloads a obsah **nebyly ověřeny** (možná soubor číslo 36). Před nasazením ověřit nový soubor, případně stáhnout nový; nepovažovat ho automaticky za zálohu.
- `access-before.json` obsahuje privátní snapshot oprávnění. Nezveřejňovat. Po nasazení bude očekáváno 33 tabulek; porovnat všechna původní data a zohlednit legitimní mezitím provedené změny kuchaře. Nikdy neobnovovat starší zálohu přes nová data.
- Krátkodobé credentials nebyly zapsány; pro nasazení vyžádat nové oficiální source credentials.

## Procesy a lokální prostředí

- Regresní session 29424 dokončena exit 0; TypeScript 10869 a lint 22864 dokončeny exit 0.
- Syntetický dev server session **37792 na portu 5199 zastaven Ctrl-C**, exit 130. Otevřený localhost proto nebude po refreshi dostupný. Databáze a soubory zůstávají zachované.
- Žádný známý testovací ani nasazovací proces tohoto úkolu nezůstává běžet. Globální seznam procesů se nepodařilo přečíst (`ps`: sandbox operation not permitted), proto nelze tvrdit nic o nesouvisejících procesech.
- QA kopie: `/private/tmp/labula-prep-notes-qa`, oddělená SQLite. Auth/layout/QA nástroje jsou pouze syntetické a **nesmí se kopírovat do hlavního projektu**. Poslední drobné změny textu editoru a chyby indexu ještě nejsou do QA kopie přeneseny.
- Restart až po pokynu k pokračování: v QA adresáři spustit `PATH=/Users/johnny/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH node node_modules/vinext/dist/cli.js dev --port 5199`.
- QA localhost je owner, 127.0.0.1 Cook. Při aktualizaci context/provideru reloadovat všechny testovací taby; HMR může držet starý context.

## Známé chyby a nedokončené části

- Po dosavadních opravách není potvrzená zbývající kritická chyba. To není potvrzení připravenosti k nasazení: build a závěrečná kontrola ještě chybí.
- Automatické vyplnění přes CUA umí obejít HTML maxLength; syntetický pokus 501 znaků vyvolal chybu a byl nahrazen 500. Server limit platí, nešlo o úspěšný zápis neplatného údaje.
- Okamžitý odečet focusu po Escape byl před RAF; finální návrat focusu je potřeba při pokračování doložit.
- Nová funkce není v produkci. Release dokument nemá potvrzenou publikovanou verzi.

## Přesný další krok po pokynu „pokračuj“

1. Přečíst tento soubor, zadání a aktuální `git status`/HEAD; zachovat jakékoli mezitím provedené změny. **Neopakovat dokončené kroky naslepo.**
2. Dokončit kontrolu finálního zdroje: TypeScript/lint po posledních dvou drobných změnách, produkční build v oficiálním Sites postupu; 63 regresí již na finálním zdroji prošlo. Další sadu pouštět jen při nových změnách či požadavku workflow.
3. Přenést poslední zdrojové změny do QA kopie bez auth/layout/QA tools, restartovat 5199 a dokončit desktop screenshoty a focus/reduced-motion kontrolu. Syntetická data zachovat.
4. Ověřit čerstvou kompletní produkční zálohu a aktuální Sites verzi/přístupy. Přečíst aktuální Sites hosting skill; použít oficiální source workflow, build/push/archive, save version a deploy se zachováním custom audience. Aktuální plugin `/Users/johnny/.codex/plugins/cache/openai-curated-remote/sites/0.1.75`.
5. Po potvrzeném úspěchu nasazení pouze čtením ověřit produkci, stáhnout úplnou post-backup, porovnat data a oprávnění, zapsat skutečnou verzi/commit a dodat screenshoty, výsledky a omezení.

Do dalšího pokynu uživatele nic z těchto kroků nespouštět.
