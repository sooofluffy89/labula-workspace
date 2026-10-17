# Recipes Compact

17. října 2026 · rozšíření aktuálního Workspace 2.0

Implementace vychází z aktuálních Sites zdrojů `947ceee047bd9441900d7be714d90b0d89e53739` (ověřená publikovaná verze 88), nikoli ze staršího lokálního checkoutu. Na výslovné upřesnění vlastníka zachovává název **Workspace 2.0**. Identita Sites projektu, logo LABULA, autentizace, databázové vazby a současná práce v Today, katalogu a review zůstávají zachované.

## Chování

- Menu → **Recipes** používá tabulku, kde řádek odpovídá skutečné variantě. Jídla a varianty se počítají samostatně, počty nejsou pevně nastavené podle návrhu.
- Compact má řádky 42 px a text 13–14 px, Comfortable 54 px. Tabulka využívá šířku monitoru; pravý panel má 320 px, od 1700 px viewportu 380 px. Filtry, záhlaví a výběrové akce zůstávají dostupné. Seznam a detail mají samostatný posun.
- Hledání zahrnuje jídlo, variantu a názvy/aliasy přímých ingrediencí. Filtry pokrývají aktivitu, kategorii a stav seznamu. Souhrn je výslovně za celé menu; výsledky ukazují rozsah filtru.
- Otevřená varianta dovoluje přidávání více existujících položek, vytvoření nové sdílené položky, odebrání přímé ingredience a individuální potvrzení seznamu. Množství a poznámky jsou zachované. Současný širší editor receptu je dostupný samostatnou akcí.
- Změna složení používá stávající `patchDishVariant`, takže znovu otevře příslušná potvrzení. **List confirmed** označuje seznam ingrediencí a nepřebírá význam odborného ověření přípravy, skladování nebo celého menu.
- Informace o surovině nahradí obsah stejného panelu. Pracovní notebook, uložený záznam a nová položka **Not shared yet** mají odlišné označení. Samotné otevření informace nevynucuje uložení. Návrat zachová filtr, výběr a posun.
- Na telefonu se po výběru varianty zobrazí detail a přesune se do něj focus. Zavření vrátí tabulku a focus na původní řádek. Široká tabulka se případně posouvá pouze uvnitř svého prostoru.
- Export CSV vychází z přesných filtrovaných variant včetně místní kategorie, stavu nebo zobrazeného výběru; zachovává současné množství, jednotky a poznámky.

## Hromadná práce a ukládání

Akce **Set on menu / Set off menu / Reopen ingredient lists** pracují s ID konkrétních variant. Checkbox v hlavičce vybírá výsledky filtru, včetně sbalených variant. Skrytý výběr je vyčíslený a lze ho samostatně zobrazit. Nedostupná vybraná ID musí uživatel výslovně vyřešit.

Náhled nejprve potvrdí předchozí změny přes existující notebookový controller. Váže se na přesná ID, revizi a kompletní místní snapshot. Ukáže hodnoty před/po, položky beze změny, počet aktivních jídel a jídla opouštějící menu po vypnutí poslední varianty. Při aktivaci/deaktivaci používá současný chráněný `/api/menu/preview`, včetně mezí skladby a ochrany legacy plánů. Neaktivuje archivované nebo rozpracované jídlo obcházením současné správy menu.

Použití náhledu je jedna změna současného pracovního notebooku, uložená stávajícím mechanismem s revizí a receipt. Úspěch místního použití není vydáván za dokončené sdílení. U nejistého zápisu zůstává původní ID příkazu, revize a payload; Retry opakuje stejný příkaz. Nová verze nepřidává vlastní paralelní ukládání ani bulk potvrzování seznamů.

Změněný řádek, který přestal odpovídat filtru, zůstane dočasně označený **Changed — outside current filter**. **Apply filters again** vědomě obnoví výsledky; výběr mimo filtr zůstává vyčíslený.

## Ověření

Regresní model je ve [check-recipes-compact.mjs](../../scripts/check-recipes-compact.mjs). Ověřuje dynamická ID, filtry a aliasy, přesný výběr, poslední aktivní variantu, neplatný náhled, nedostupné/archivované záznamy a zachování chráněného obsahu notebooku.

Browser scénáře jsou v [verify-recipes-compact.mjs](../../scripts/verify-recipes-compact.mjs). Spouštějí se výhradně proti loopback serveru, ověřují syntetickou identitu a používají izolovaná Demo data. Produkční data ani zálohy se do fixture nepřenášejí. Výsledky a měření jsou v [browser-results.json](evidence/browser-results.json).

```sh
npm run validate
PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs \
UX_BASE_URL=http://localhost:5174 \
node scripts/verify-recipes-compact.mjs
```

Kontroly zahrnují požadované desktopové šířky 1366/1440/1920, mobilní šířky 320/390/768 a rozložení při CSS viewportu 720 × 450 odpovídajícím 200% zvětšení obrazovky 1440 × 900. Poslední případ je emulace reflow, nikoli zkouška fyzického zařízení nebo jeho nastavení zoomu.

Testy chyb ukládání a souběhu běží nad skutečným lokálním API: přerušený zápis, přesné Retry po navigaci, nový nesdílený záznam, hromadná změna se skrytým výběrem a zneplatnění náhledu po změně druhého klienta. HTTP 503 pro přerušený zápis je ve scénáři výslovně emulované.

Výsledek: **122 regresních skriptů**, TypeScript a produkční build prošly. V prohlížeči prošlo **9 funkčních scénářů** bez runtime chyb. Sestavený Worker byl navíc ověřen na 1366/1440/1920 a 390 px, včetně návratu z mobilního detailu a zachovaného katalogu; [výsledek produkčního sestavení](evidence/compiled-results.json). Ověření používá lokální syntetickou identitu a není zaměňováno za kontrolu přihlášeného uživatele v produkci.

## Obrazovky

Všechny ukázkové suroviny a provozní stavy na snímcích jsou syntetické.

- [Recipes 1440 px](evidence/recipes-1440.png)
- [Recipes 1920 px](evidence/recipes-1920.png)
- [Tabulka se zavřeným detailem](evidence/recipes-detail-closed-1920.png)
- [Hromadný náhled před/po](evidence/bulk-preview-1440.png)

## Hranice vydání

Tato změna nepřidává databázové migrace, nemění publikum Sites projektu a nepřepisuje současné receptové identity. Rozšíření využívá již publikované Workspace 2.0 a jeho existující pravidla práce s daty. Historické migrační dokumenty nejsou považovány za nové nesplněné zadání.
