# Workspace 2.0 — implementace pro review

Workspace 2.0 soustřeďuje běžnou práci do dvou hlavních míst: **Today** pro předání směny a **Menu** pro jídla a jejich složení. Nastavení, historie, zálohy a starší analytické podklady zůstávají dostupné mimo hlavní pracovní cestu. Cílem změny je méně rozhodování při práci v kuchyni; zachování „80 % hodnoty“ není vydáváno za změřenou uživatelskou metriku.

Jde o upgrade existující aplikace a jejích dat. Zůstávají React 19, Vinext/Vite, Cloudflare D1/R2, integrace `sites()`, identita Site a existující bindings. Název rozhraní je **Workspace 2.0**, jazyk UI zůstává anglický. Původní logo LABULA, favicon a červeno-bílo-šedá paleta jsou zachované. [Kontrola identity ve zdrojích](evidence/identity-source-check.json) potvrzuje také shodné bajty faviconu; sama není vizuálním testem.

Pracovní větev je `feat/workspace-2-0`, výchozí commit `93eab5d471c3af35de72a2b2278b96c66d788ad6`. Tento základ obsahuje předchozí UX opravy a změna navazuje na [PR #2](https://github.com/sooofluffy89/labula-workspace/pull/2). Review Workspace 2.0 má posuzovat její změny vůči tomuto základu; nezaměňovat je s původním auditovaným commitem `1b583b6`. Produkční nasazení není výsledkem tohoto implementačního běhu.

## Co se mění při práci

| Místo | Výsledné chování | Přínos |
| --- | --- | --- |
| **Today → Evening check** | Jednoznačný nadpis a datum, dvě textové odpovědi, filtr stanice a dostupné **Finish check**. Uložení odpovědí a publikování plánu jsou oddělené kroky. | Večerní kontrola připraví jasné předání; uložené dílčí odpovědi nepředstírají hotový plán. |
| **Today → Morning prep** | První pracovní úlohy předcházejí podrobnostem synchronizace. Řádky obsahují Prepare/Restock, stanici a Ready. **Undo last change** zůstává dostupné i při přesunu řádku mezi hotové. | Kuchař vidí, co má udělat, a může bezpečně opravit omyl. |
| **Menu → Dishes** | Seznam jídel a variant, recept, množství a rozbalitelné ingredience. Detail pokračuje do sdíleného produktu a dalších úrovní jeho složení; návrat zachovává cestu. | Stejná surovina nebo polotovar má jeden sdílený detail napříč jídly. |
| **Menu → Ingredients & prep** | Vyhledávání podle jména i alternativních názvů, filtry, počet výsledků, praktický postup/skladování, Used in a Daily checks. | Obsah receptu, jeho použití a zařazení do kontrol se řeší na jednom místě. |
| **Settings** | Schedule včetně Round days, People, Data & backup a dohledatelné historické podklady. CSV aktuálního pohledu, lokální koncept a úplná záloha mají rozdílný význam. | Administrativa zůstává dostupná, ale nezabírá první obrazovku denní práce. |

Hlavní destinace, datum a relevantní výběr používají URL. Zachované staré odkazy se mapují do odpovídajícího nového kontextu; informační detail a jeho historii není potřeba opouštět přes novou kartu. Kompaktní navigace má stejné principy pro Cook i správce. Detail a editor reagují na dostupnou šířku; úzké obrazovky dostávají samostatný pracovní detail místo stlačeného editoru vedle katalogu.

Změna vzhledu stojí na prostoru, čitelnosti, pořadí obsahu a ovládání. Používá viditelné popisky, nativní výběry Frequency/Station, pohodlné dotykové plochy, Skip to content a sjednocené zacházení s fokusem a reduced motion. Přesné rozměry a skutečné vykreslení patří do prohlížečových důkazů níže, nikoli pouze do kontroly CSS.

## Recepty, role a původ informací

Čtecí adaptér Menu při otevření nepřepisuje současná jídla, varianty ani ingredience. Respektuje existující `Item.inputs`, výrobní procesy a aplikované Review zdroje. Neúplný nebo nedostupný autoritativní zdroj zůstane výslovně neúplný; starý recept se tiše nevrátí jako aktuální. Neznámé množství nebo výnos zůstává neznámé. Jednotky, význam kusu a doložené konverze se zachovávají.

Výslovně uložená definice produktu ve `workspaceRecipes` obsahuje původ a revizi. Změna probíhá s kontrolou revize notebooku i tokenu konkrétního zdroje a s atomickým záznamem stavu před/po. Společná výroba s více výstupy zůstává oddělená od potvrzeného složení každého produktu. Dodavatelské složení Bought položky nevytváří automaticky místní výrobní úkoly. Zápis odmítá cykly a neexistující reference.

| Role | Zachovaný nebo nově zpřístupněný rozsah |
| --- | --- |
| Owner / aktivní Manager | Správa menu, sdílených receptů a kontrol v mezích skutečných serverových oprávnění. Operace vyhrazené Ownerovi zůstávají chráněné. |
| Cook | Denní práce a čtecí projekce relevantního menu, nutných navazujících ingrediencí a provozních receptů. Nové receptové API mu nepovoluje zápis; celý notebook, citlivé Review záznamy a management exporty nedostává. |
| Legacy | Dosavadní omezené notebookové operace zůstávají zachované. Role nezískává oprávnění k novému kanonickému receptovému zápisu. |

Oprávnění se kontrolují na API a při zápisu v transakci, nikoli jen skrytím tlačítek. Zůstávají kontrola původu zápisů, vazba na přihlášený účet a ochrana proti změně role za běhu. Podrobná pravidla a konkrétní datové hranice popisuje [Složení a přístup](composition-and-access.md).

## Předání směny, vratnost a koncepty

Nově publikovaný plán používá **policy 2**: pozdější změna menu sama nezmění jeho seznam úloh, uložené instrukce ani Ready. Budoucí kontroly a otevřený koncept mohou pracovat s novým menu. Změna již publikované práce vede přes výslovnou opravu a opětovné Finish; náhled ukáže přidané i odebrané úlohy a nezměněné Ready se zachová.

Historické publikace zůstávají v **policy 1**. Migrace je hromadně nepřepíná, protože by to mohlo bez rozhodnutí kuchyně obnovit dříve pozastavenou práci. Nový klient dostane `409 legacy_plan_scope`, pokud by změnou menu ovlivnil dnešní nebo budoucí starý plán; zpráva uvádí datum a cestu **Evening → Correct check → Finish**. Stejná podmínka je i uvnitř atomického zápisu, takže ochranu neobejde plán publikovaný mezi náhledem a uložením.

Ready/Undo používá aktuální revizi úlohy. Pozdější změna jiného uživatele zneplatní staré Undo. Odebrání ingredience se vrací jako konkrétní změna vazby nad aktuálním receptem, nikoli obnovením celého zastaralého snapshotu. Přesné opakování přijatého požadavku nezapisuje účinek podruhé. Již přijatý příkaz pozastaveného spolupracovníka má zachovanou bezpečnou čtecí obnovu; nové příkazy i běžné neoprávněné čtení zůstávají odmítnuté.

Nové formuláře rozlišují lokální koncept, odesílaný požadavek a potvrzený sdílený stav. Zavření editoru nemá samo zahodit rozepsané údaje. Obnova zachovává původní účet, přesný čekající příkaz a samostatné kopie z více otevřených stránek; chyba browser storage nesmí předstírat bezpečně uložený koncept. Zachované starší koncepty a Review evidence mají dostupnou obnovu v Data & backup.

## Tři navazující migrace a vydání

| Migrace | Účel | Hranice změny |
| --- | --- | --- |
| `0021_published_plan_policy.sql` | Verze chování publikovaného plánu. | Existující řádky dostávají policy 1; nová výslovná publikace používá policy 2. Žádná automatická změna historických úloh. |
| `0022_workspace_product_sources.sql` | Produktové definice ve zdrojových snapshotech menu. | Aktualizuje spouštěče budoucích snapshotů; dřívější evidence se nepřepisuje. |
| `0023_workspace_runtime_policy.sql` | Řízené pozastavení zápisů a minimální verze klienta. | Výchozí stav zápisy nepřerušuje. Kontrola v transakci a DB chrání také souběh s přepnutím politiky. |

Již aplikované migrační soubory se nemění. Kontrolované vydání používá úplnou chráněnou zálohu, porovnání původních dat, inventuru konceptů a explicitní rozhodnutí o aktivních starých plánech. Mature provozní čtení během pozastavení neprovádí bootstrap zápisy. Po přepnutí minimální verze na 2 dostane starý klient obnovitelnou chybu místo povolení zastaralého zápisu.

Po nových produkčních zápisech není bezpečným rollbackem samotné vrácení starého kódu nebo přepsání databáze starou zálohou. Předchozí verze musí umět zachovat nové produktové definice, policy 2, receipts a koncepty. Konkrétní kroky a podmínky jsou v [MIGRATION.md](MIGRATION.md).

## Doložené ověření

Jednotlivé kontroly níže byly spuštěné na **Node.js 24.19.0**, nad syntetickými daty a lokálními SQLite/D1 fixtures. Finální společný stav prošel celým `npm run validate`; prohlížečové důkazy jsou uvedené samostatně níže.

| Druh | Spuštěné kontroly | Co prokazují |
| --- | --- | --- |
| Typy | `npm run typecheck` | TypeScript kontrola prošla i ve finálním společném validate. |
| Denní API a klient | `check-workspace2-daily`, `check-evening`, `check-morning` | Unchecked brání publikování; přesné receipts; plány policy 2; shoda full/batch/delta; Ready/Undo; odmítnutí zastaralé revize; výslovná oprava; nezměněná historie a platný plán s nulou úloh. |
| Staré aktivní plány | `check-workspace2-plan-guard` | Skutečné ordinary notebook/save receipt/Menu/catalog API odmítnou ovlivnění legacy plánu; správný náhled s datem; žádný osiřelý receipt; atomická ochrana při souběžném vzniku plánu; výslovné přijetí policy 2. |
| Autorizace a údržba | `check-team-application-access`, `check-stock-activity`, `check-workspace-runtime-policy` | Role/účet/původ, odvolání oprávnění během operace, zachovaná obnova přijatého příkazu; řízené pozastavení a verze klienta; skutečné mature GET včetně Morning, Menu a zálohy bez DB zápisu. |
| Recepty a Menu | `check-workspace-menu`, `check-workspace2-menu` | Zdrojová autorita, hluboké vnoření, supplier/local hranice, společné výstupy, množství/konverze, úzký Cook payload, revize, retry a rollback; vyhledávání, filtry a návrat ve stromu receptu. Regrese aktivní/vypnuté varianty stejného jídla rozlišuje aktuální a off-menu ingredience pro Owner, Manager i Cook. |
| Zachování dat a návrat | `check-workspace2-preflight`, `check-review-workflow`, `check-review-production-handoff`, `check-review-source-context` | Přesná syntetická porovnání dat a byte obsahů fotek, starší evidence, autorita, schválené aplikace a jejich souběh/rollback. [Preflight výsledek](evidence/preflight-test-result.json), [porovnání](evidence/preflight-synthetic-comparison.json). |
| React handlery a obnovy | `check-morning-layout`, `check-calm-ui`, `check-kitchen-preparation-integration` | Skutečné komponentové handlery nad emulací hooků: klidný přesun Ready, Undo při nové revizi, fokus Finish, navigace při save, zachované koncepty; správný předchozí otevřený večer a role v no-plan CTA. Nejde o fyzický dotykový test. |
| Další změněné hranice | Kontroly rounds/rounds-client/round-tracking, stock, ingredient-groups, historie, záloh a zachovaných formulářů | Přesné opakování a konflikty, seed podle ověřené identity, pohledy bez výsledků a ochrana navazujících historických funkcí. |

Názvy v tabulce odpovídají `scripts/check-*.mjs`. Kompletní runner tyto soubory dál automaticky objevuje; změněná očekávání staršího UI neslouží k vypnutí věcných regresí. Přehled jejich úprav a důvodů uvádí [REGRESSION-UPDATES.md](REGRESSION-UPDATES.md). Podrobné přiřazení změn a důkazů ke všem požadavkům včetně původních ID 01–31 je v [REQUIREMENTS.md](REQUIREMENTS.md).

**Finální integrované výsledky:**

| Kontrola | Výsledek | Důkaz |
| --- | --- | --- |
| Celá validace | **PASS**: `npm run validate`, exit 0, Node 24.19.0; typecheck, všech **116 regresních skriptů** a produkční build po poslední opravě obnovy tvorby. | [Výsledek](evidence/validation-result.json), [úplný log](evidence/validate.log). |
| Funkční scénáře | **24/24 PASS**: navigace, koncepty ve dvou tabech, validace, historie, kalendářní diff, stanice, exporty, přístupové role a úplný Evening → Finish → Morning → Ready → Undo. | [Browser report](evidence/browser-results.json), včetně zdrojových běhů a diagnostiky opakovaných kontrol. |
| Responzivní matice | **48/48 vykreslení**, čtyři pohledy při 320, 360, 390, 767, 768, 1023, 1024, 1100, 1119, 1120, 1280 a 1440 px. Jedno odpovídající h1, bez horizontálního přetečení dokumentu. | [Rozsah a geometrie](evidence/verification-scope.json). |
| Editor | Sedm šířek, měření po dokončení skutečné animace: dialog 296/366/744/760 px při viewportu 320/390/768/1024+; žádný ovladač oříznutý. | `recipeEditor` v [browser metrikách](evidence/browser-results.json). |
| Sestavená aplikace | **9/9 kontrol** Today, Menu a otevřeného editoru při 390/1100/1440 px. Sestavené/minifikované CSS bez přetečení a runtime výjimek. | `compiled-preview` a `compiled-confirmed` ve zdrojových bězích. Syntetická identita na loopback, nejde o test produkčního přihlášení. |
| Role | Owner, Manager, Cook a legacy. Cook má čtecí recepty, chráněné zápisy a exporty API odmítá. Po testu obnoven místní Owner. | Role scénář v browser reportu a serverové regresní testy. |
| Přístupnost | Skip, Tab/Shift+Tab, návrat fokusu, 44–48px dotykové plochy, reduced motion a cílené měření kontrastu polí. | Normální hranice **3,64:1**, focus **6,31:1**, invalid **6,24:1**, disabled **3,18:1**. Nejde o úplnou certifikaci WCAG. |

Celý validační běh a jeho přesný výsledek zaznamenávají [validation-result.json](evidence/validation-result.json) a [validate.log](evidence/validate.log). Zdroje posledních vizuálních kontrol předcházejí pouze následné opravě synchronního odmítnutí tvorby před zápisem; ta nemění rozložení a má samostatné fault-injection regrese pro položku, jídlo i variantu.

## Vizuální srovnání a hranice důkazů

Srovnávací základ není původní screenshot z auditu před opravami. Je to skutečně vykreslená aplikace z commitu `93eab5d`, nad izolovanými syntetickými daty: 100 položek, 19 jídel, 24 receptů a dvě ranní úlohy pro 15. 10. 2026. [Rozsah srovnání](evidence/verification-scope.json) a [původní naměřené hodnoty](evidence/before-browser-results.json) zaznamenávají výchozí stav pro šířky 320, 360, 390, 768, 1024, 1100, 1280 a 1440 px.

Cílená kontrola aktuálního Morning při **390 × 844 px** naměřila první řádek na **y = 351,09 px**, oproti **562,48 px** ve srovnávacím základu. Začátek práce se tedy posunul o **211,39 px vzhůru**; tato hodnota vyjadřuje polohu řádku, nikoli procento produktivity nebo celkovou úsporu času. Oba běžné úkoly se vejdou nad spodní navigaci. [Interaktivní galerie před/po](visual-review.html) obsahuje skutečné screenshoty, nikoli návrhy. Stejný syntetický notebook před/po má shodný SHA-256; porovnané úlohy mají shodný obsah a instrukce. Revize a historie záměrných Ready/Undo testů se pochopitelně liší.

| Obrazovka | Před | Po |
| --- | --- | --- |
| Morning, 390 × 844 | [Původní](evidence/before-morning-390.png) | [Workspace 2.0](evidence/after-morning-390.png) |
| Evening, 390 × 844 | [Původní](evidence/before-evening-390.png) | [Workspace 2.0](evidence/after-evening-390.png) |
| Menu, 390 × 844 | [Původní](evidence/before-menu-390.png) | [Workspace 2.0](evidence/after-menu-390.png) |
| Menu, 1440 × 844 | [Původní](evidence/before-menu-1440.png) | [Workspace 2.0](evidence/after-menu-1440.png) |
| Morning, 1440 × 844 | [Původní](evidence/before-morning-1440.png) | [Workspace 2.0](evidence/after-morning-1440.png) |

Další důkazy: [vnořený recept](evidence/after-deep-recipe-390.png), [editor při 1100 px](evidence/after-compiled-editor-1100.png), [Ready / Undo](evidence/after-ready-undo.png), [obnova tvorby](evidence/after-creation-recovery.png), [kalendářní diff](evidence/after-calendar-preview.png).

Ověření má čtyři odlišné úrovně:

- **Automatizované modelové/API testy:** skutečné doménové funkce, klienty a API nad syntetickou lokální databází; zahrnují konflikty, chyby a souběh.
- **Komponentové testy:** skutečné React handlery s emulovanými hooky a vybranými DOM kontrakty; samy nedokládají rozložení ani funkci skutečné klávesnice.
- **Prohlížečové ověření:** skutečně vykreslená aplikace v Chromiu, s uloženými screenshoty a naměřenou geometrií; rozsah je uveden v browser reportu; reprezentativní mobilní i desktopové snímky byly také vizuálně prohlédnuté.
- **Emulované podmínky:** velikost viewportu, coarse pointer, reduced motion, zvětšení a nižší výška okna. Emulace není zkouška na fyzickém telefonu, tabletu nebo s reálnou virtuální klávesnicí.

**Zbývající limity:** nebyla ověřena shoda s právě nasazeným produkčním menu ani proveden skutečný produkční cutover. Produkční data se nekopírovala do vývoje. Nebyla provedena zkouška na fyzických kuchyňských zařízeních ani v Safari či Firefoxu. Syntetický preflight a Chromium nenahrazují tyto kroky. 200% reflow bylo emulováno polovičním CSS viewportem a dvojnásobným device scale; nativní zoom prohlížeče ani systémové zvětšení textu ověřené nebyly. Prázdné/chybové odpovědi, hluboké stromové podklady a část chybových scénářů byly řízeně emulované, jak uvádí každý scénář. Notebookový import záměrně nepřelévá nové kanonické receptové definice automaticky: rozdíly výslovně oznámí, zachová soubor a současnou definici a vyžaduje porovnání v Menu. Upgrade stávajících dat používá přímý čtecí adaptér a touto importní cestou neprochází.
