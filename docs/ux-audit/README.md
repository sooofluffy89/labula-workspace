# LABULA Worskspace — oprava UX auditu 01–31

Výchozí audit i větev `main` byly na commitu `1b583b61b75d7585e73c9ca90d6837b27d54c255`. Implementace je ve větvi `fix/complete-ux-audit`. Pracovní matice vznikla před změnami a její výsledný úplný tvar je v [status.json](status.json): nález → oprava → soubory → podmínka přijetí → ověření.

Rozhraní zůstává anglicky, název **LABULA Worskspace** i střídmá identita jsou zachované. Změny používají společný shell, dialogy a formulářové vzory. Nezměnily se migrace, autorizace, origin guard, revize, receipt/retry protokoly, D1/R2 bindings ani identita Sites. Produkční nasazení není součástí této větve.

## Změřený přínos

| Stejný rozměr a syntetická data | Audit | Oprava |
| --- | ---: | ---: |
| Šířka editoru s detailem, 1100 px | 168 px, ořezané ovládání | 852 px, detail jako overlay |
| První pracovní karta dashboardu, 390×844 | y = 1421 px | y = 526 px |
| Nadpis jídla, 390×844 | y = 1469 px | y = 387 px |
| Preparation & storage, 390 px, 12 položek | kolem y = 2791 px | y = 228 px |
| Preparation & storage, 390 px, 100 položek | — | y = 228 px |
| Kontrast hranice vstupu vůči výplni | slabé rozlišení | 3,33 : 1 |
| Cook navigace, 320 px | nevyvážená mřížka | 2 × 144×48 px |

Morning na původním datu 15 Oct se stejnými dvěma úlohami a čerstvým potvrzením začíná první položkou na y = 631 px; celé ovládání první úlohy je v 844px viewportu. Po skutečném Finish je potvrzení kompaktní, plán dohledatelný a Undo poslední Ready zůstává dostupné mimo sbalenou sekci hotových. Novější revize položky staré Undo zneplatní.

## Ověření

Finální log kontroly je v [evidence/validation.log](evidence/validation.log); strukturované průchody a naměřené hodnoty v [evidence/verification.json](evidence/verification.json).

- Automaticky: `npm run validate` pod Node.js 24.19.0 (typecheck, všech 94 regresních skriptů, produkční build). Stávající ochrany souběhu, oprávnění, originu, exact replay, atomicity a obnovy konceptů jsou součástí této sady. Nové smysluplné regrese pokrývají URL, inverzní Undo, ochranu rozepsaného formuláře, Batch Back s hodnotami, station default, krokovou validaci a novější peer revizi Ready.
- Prohlížeč: skutečně vykreslené lokální stránky v Chromiu přes Playwright, s vizuální kontrolou reprezentativních screenshotů. Viewporty 320, 360, 390, 768, 1024, 1100, 1280, 1440 a okolí breakpointů 759/760, 1099/1100, 1535/1536. Role Owner, Manager a Cook byly skutečně přepnuty v lokální syntetické databázi a poté obnoveny.
- Emulace: dotyk/coarse pointer včetně širokého displeje, reduced motion, 200% zoom jako odpovídající zmenšení CSS viewportu, malá výška a dlouhý název. Empty/loading/503 a aktivovaný kalendář/Quick review používají výslovné GET fixtures; kalendářní a review fixture zápisy se neposílají na server. Evening/Finish/Ready/Undo a velký katalog používají skutečná lokální API a CAS revize.
- Limity: fyzický telefon/tablet, skutečná softwarová klávesnice, Safari/iOS a Firefox nebyly dostupné. Emulace zoomu a klávesnice nenahrazuje test fyzického zařízení. Produkční URL nebyla tímto místním ověřením potvrzena a nic se nenasazovalo.

## Matice všech nálezů

Úplné podmínky přijetí a seznam dotčených souborů obsahuje [status.json](status.json).

| ID | Konkrétní oprava | Důkaz ověření |
| --- | --- | --- |
| **01 · P1** | Detail pod 1536 px používá overlay; container query sbalí výběr jídel a vnitřní mřížky podle obsahu. Odstraněno vynucené zobrazení sidebaru. | Chromium: šířky 320–1440; detail 1100/1280/1440/1600; geometrie editoru a dlouhý název. |
| **02 · P2** | Mobil má jediný výběr hlavní destinace a výběr analýzy. Onboarding receptů je sbalený, review status přesunutý dolů. | Chromium: první karta v 390×844; screenshoty dashboardu před/po. |
| **03 · P2** | Preparation & storage a Batch details jsou nad kompaktními řádky katalogu. | Chromium: 12 a 100 syntetických položek; pozice Preparation nezávisí na délce seznamu. |
| **04 · P2** | URL obsahuje sekci, jídlo, variantu, datum denní práce a filtr katalogu. Historie ukládá scroll a přesouvá fokus na nadpis. Zachovává stav Vinext i informační detail. | check-ux-behavior; Chromium: Back/Forward/Refresh, scroll, vybraný recept, přímé datum a #info. |
| **05 · P2** | Aktivní denní volba je podmíněná nepřítomností Operations. Hlavní navigace má jedinou destinaci. | Chromium: History/Calendar a Cook Check/Prep; check-calm-ui. |
| **06 · P3** | Odstraněn statický receptový nadpis shellu; každý zobrazený pohled má vlastní h1. | Chromium: právě jeden viditelný h1 ve 33 kombinacích sekce/šířka. |
| **07 · P2** | Koncept, Saving, Autosaved a sdílený stav mají společnou hierarchii. Answers saved výslovně odlišuje nepublikovaný plán; Plan published potvrzený plán. Globální Save je kontextový. | check-stock-motion, check-calm-ui; Chromium: autosave, validace, Evening/Finish/Morning. |
| **08 · P2** | Frekvence a stanice mají viditelné místní popisky a nativní select s textovými volbami. | check-manage-settings-ui; Chromium 390 px: oba popisky a dvě skupinové tab zastávky. |
| **09 · P2** | Katalog rozlišuje načítání, chybu, prázdná data a nulový výsledek. Výsledky mají počet a reset; Batch details vlastní počet a Clear search. | Chromium: skutečné hledání/reset; GET fixtures pro empty/loading/503; check-batch-collection. |
| **10 · P2** | Všechny aktivní filtry historie mají viditelné chips, jednotlivé odstranění, počet More filters a Reset all i bez výsledků. | Chromium: uložený filtr po odchodu a návratu, viditelné odstranění a reset. |
| **11 · P2** | Jednotné názvy Ingredients, Dish recipes, Checklist settings, Preparation analysis, Menu analysis, Operations history. Detail rozlišuje Instruction history a All item activity. | Chromium: navigace a detail; příslušné existující UI regresní testy. |
| **12 · P2** | Correct type je přímo v detailu ingredience i editoru. Otevírá existující náhled dopadů. Role v nápovědě odpovídají Manager oprávněním. | Chromium se skutečnou rolí Manager: detail → Correct type → bezpečný náhled; check-catalog-manager a role/API suite. |
| **13 · P2** | Export obsahuje Complete workspace backup a samostatně pojmenované CSV a notebookový koncept. Oprávnění zálohy jsou zachována. | Chromium: Owner i Manager vidí zálohu, Cook API 403; check-private-backup a check-profile-photo. |
| **14 · P2** | Odebrání nabízí Undo jako inverzní operaci konkrétní ingredience. Novější pole zachová; dokončení vrací pouze při nezměněném zbytku receptu. | check-ux-behavior: novější úpravy, opakování, smazaný cíl; Chromium: remove → Undo. |
| **15 · P2** | Back ze Storage i Batch details vrací Preparation; Close je samostatné zavření. Hodnoty zůstávají v konceptu. | check-prep-workflow: Batch Back, hodnoty a nezavřený formulář; Chromium: krok 3 → Back → krok 1. |
| **16 · P2** | Vstup se validuje před požadavkem. Chyby mají cestu k poli, aria-invalid/describedby, souhrn s odkazy a fokus. Síť/konflikt mají vlastní zotavení. | check-ux-behavior, check-prep-workflow; Chromium: chybějící počátek trvání a platné Not sure bez sync CTA. |
| **17 · P2** | Storage používá rozbalitelné Conditions/Quality/Recorded rule a relevantní podmíněná pole. Dialog sleduje visualViewport, má rolovatelné tělo a hlídá viditelnost aktivního pole nad patičkou. | Chromium: 390×500, fokus pole bez překrytí patičkou; vizuální kontrola; check-prep-fields. |
| **18 · P2** | Jednotný výběr začíná současnou stanicí, smíšený neutrální volbou. Unassign je explicitní. Save je zakázané bez skutečného rozdílu. | check-ux-behavior: shodné/null/mixed; Chromium: Station 1 a Save disabled; existující CAS/replay testy. |
| **19 · P2** | Potvrzení vypíše úplný diff dnů, deadlines, posunů, výjimek a jejich odstranění i účinnost. Neplatná konfigurace vysvětluje blokaci. | check-ux-behavior; Chromium GET fixture: změna dne, 09:30, odstranění obou druhů výjimek a účinnost, bez serverového zápisu. |
| **20 · P2** | Druhý krok Quick review člení Output/Work/Frequency. Continue kontroluje aktuální krok, chyby odkazují na téma/pole. Explicitní unknown zůstává platný; draft a Finish mají oddělený význam. | check-quick-ui: osm případů, blokace neúplného kroku, resume/unknown; Chromium review fixture: chyba, odkaz a fokus. |
| **21 · P2** | Sdílené zavírací X má skutečnou plochu 44×44 px, menší ikonu a rezervu v nadpisu. | Chromium: měřený bounding box X a vizuální kontrola dialogu. |
| **22 · P2** | Dialog uchovává spouštěč a vrací fokus; při zmizení cíle použije otevřený dialog nebo hlavní obsah. Přidán Skip to content a fokus nadpisu po navigaci. | Chromium: Escape, Keep editing, Discard, X a fokus spouštěče; navigační fokus; existující vnořené UI testy. |
| **23 · P2** | Změněná nová položka a přejmenování vyžadují Keep editing / Discard changes při X, Escape i Cancel. Text se při pokračování zachová. | check-catalog-dialogs; Chromium: Escape → Keep editing → zachovaný název → Discard a návrat fokusu. |
| **24 · P2** | Nativní select nahradily série frekvencí a stanic. DOM řadí instruction před More stejně jako vizuální pořadí. | check-manage-settings-ui; Chromium: počet tab zastávek a přístupné názvy. |
| **25 · P2** | Vstupy používají výraznější token hranice #7d8795, konzistentní focus a invalid stav; nativní select v review i workspace má stejný kontrast. | Chromium: vypočtený kontrast hranice vůči výplni ≥3:1, invalid aria a focus; screenshoty formulářů. |
| **26 · P3** | Reduced motion vypne nepodstatné animace a přechody včetně sdílených dialogů a overlay. | Chromium emulace prefers-reduced-motion: animationName none a zachované ovládání/fokus. |
| **27 · P3** | Coarse a hybridní pointer ponechává nejméně 44 px pro ovládání bez ohledu na šířku viewportu. | Chromium hasTouch při 1280 px: any-pointer coarse a měřená výška New item ≥44; Cook 48 px. |
| **28 · P3** | Cook navigace tvoří dvě rovnocenné široké buňky Check a Prep. | Chromium: skutečná Cook role, 320/390, právě dvě stejně široké volby a aktivní stav. |
| **29 · P3** | Kitchen review je součást pracovního shellu ve stejné kartě. Back vrací předchozí destinaci a kontext. Staré /review odkazy přesměrují do workspace; aplikace po Apply načte nový notebook. | Chromium: jedna karta, návrat do katalogu, zachovaný koncept alternativních názvů; existující review save/recovery/API testy. |
| **30 · P3** | Přehled kol trvale vysvětluje model; položky nabízejí Move to round přes původní náhled a potvrzení. Morning bez plánu odkazuje do předchozí otevřené Evening podle kalendáře. | Chromium: chybějící Morning 19 Oct → Evening 18 Oct; model přesunu a ovladače; check-rounds a check-edit-items-ui. |
| **31 · P2** | Morning má kompaktní potvrzení bez CTA na sebe, společné datum/progress a rozbalitelný zdroj/refresh. Undo last change je mimo přesunutý hotový řádek. | Chromium: Evening → Finish → Morning → Ready → Undo; stejné datum 15 Oct a dvě úlohy jako audit, první úloha nad hranicí 844 px; check-morning-layout. |

Celý vizuální přehled a matici podmínek přijetí obsahuje [PDF report](implementation-report.pdf).

## Screenshoty před / po

Původní snímky jsou nezměněné auditní artefakty. Dashboard, recepty a katalog používají původních 12 syntetických identit přes výslovnou browser GET fixture na finálním kódu (zápisy blokované); Morning stejný den a dvě úlohy, včetně skutečného Finish přes lokální API. Pro vizuální porovnání je klientský čas emulovaný na 14 Oct 2026 22:32 Prague jako v auditu. Velký katalog a kalendář/review fixtures mají samostatné důkazy. Původní dlouhé mobilní snímky jsou v HTML přehledu zobrazené jen v rozsahu prvního 844px viewportu; zdrojové PNG zůstaly celé.

- Dashboard · 390×844: [před](evidence/before-home-390.png) · [po](evidence/after-home-390.png)
- Editor a detail · 1100×900: [před](evidence/before-detail-1100.png) · [po](evidence/after-detail-1100.png)
- Ingredients · 390×844: [před](evidence/before-catalog-390.png) · [po](evidence/after-catalog-390.png)
- Morning · 15 Oct · 390×844: [před](evidence/before-morning-390.png) · [po](evidence/after-morning-390.png)

## Opakování prohlížečových průchodů

Použij místní server `npm run dev` na portu 5173 a místní přihlášení. Skripty přijímají `UX_BASE_URL` jen na loopbacku, `PLAYWRIGHT_MODULE`, `UX_CHROMIUM` a `UX_EVIDENCE_DIR`. Testovací výchozí notebook je v [fixtures/notebook.json](fixtures/notebook.json); jde o syntetickou sadu, nikoli produkční export. Průchody správy předpokládají čtyři sledované denní položky a dvě společně ve Station 1 jako v místním auditu. Databáze vždy používá `--local --persist-to .wrangler/state`.

```sh
PLAYWRIGHT_MODULE=/opt/codex/cua_node/lib/node_modules/playwright-core/index.mjs \
UX_CHROMIUM=/usr/bin/chromium UX_EVIDENCE_DIR=/tmp/labula-ux-verification \
node scripts/verify-ux-all.mjs
```

Souhrnný skript spouští průchody postupně. Samostatně lze spustit `verify-ux-browser.mjs`, `verify-ux-scenarios.mjs`, `verify-ux-details.mjs`, `verify-ux-quick-browser.mjs`, `verify-ux-roles.mjs`. Rolový průchod spouštěj samostatně, protože dočasně přepíná oprávnění syntetického `local_seedy`; `finally` je obnoví. Zbylé průchody do produkce nepřistupují. Test 100 položek přidává pouze názvy `QA catalog item …`; opakované spuštění je nerozmnožuje.
