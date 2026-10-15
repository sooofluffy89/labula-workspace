# Složení a přístup k receptům ve Workspace 2.0

## Jeden produkt, zachované zdroje

`lib/workspace-menu.ts` vytváří čtecí pohled nad existujícím notebookem a aplikovanými Review záznamy. Samotné otevření Menu nepřevádí ani nepřepisuje jídla, varianty, množství nebo vazby.

| Zdroj | Zobrazení produktu | Výrobní závislosti |
| --- | --- | --- |
| `Notebook.workspaceRecipes` | Výslovně uložené složení konkrétního produktu; Bought obsahuje dodavatelské složení | Místní recept může změnit jednoduchý recept; společné a neúplné výrobní závislosti zůstávají zachované |
| Aplikovaný Review proces | Pouze doložené vazby na obsah produktu; neurčené rozdělení výstupů zůstane neúplné | Původní výrobní vstupy zůstávají dohledatelné samostatně |
| `ProductionProcess` | U jednoho výstupu existující recept; u více výstupů vyžaduje obsah jednotlivého produktu vlastní potvrzení | Společná výroba a její vstupy se nekopírují do každého produktu jako jeho jisté složení |
| `Item.inputs` | Zachovaný recept, pokud jej nenahrazuje autoritativní zdroj | Původní vazby; bez oživení překonaného receptu při nedostupném Review |

Quick review s rozsahem a prací není úplný recept. Nedostupný schválený zdroj ani neúplné rozdělení společných výstupů nepřepnou čtení na staré `item.inputs`. Dodavatelské složení Bought položky se nezapojuje do místních výrobních/checklist závislostí. Případné skutečné místní zpracování stejné Bought položky zůstává zachováno.

Množství, jednotky, kusové významy a konverze se přenášejí beze změny. Výslovné `null` u výnosu nepoužije starší známý výnos. Množství z pozorované Review dávky se nevydávají za současný standard receptu. Projekce nemá dvouúrovňový limit vnoření; zápis odmítá cykly i neexistující reference.

## Výslovná editace a opakování požadavku

`PUT /api/menu` přijímá konkrétní produkt, očekávanou revizi notebooku, token jeho zdroje, nové složení/postup/výnos, referenci a výslovné potvrzení. U dodavatelských ingrediencí je povinný odkaz na obal nebo dokument. Zápis smí provést Owner nebo aktivní Manager.

Původní `Item`, výrobní proces a Review evidence zůstávají uložené. Nová definice má původ, revizi a čas. Stejná transakce uloží revizně podmíněný zápis a `catalog_operations` receipt typu `workspace-recipe` s úplným stavem před/po. Ztracenou odpověď lze opakovat se stejným ID a stejným obsahem bez druhého zápisu. Jiný obsah pod stejným ID je konflikt.

Starý klient nesmí zahodit `workspaceRecipes` ani zapisovat ingredience/postup do překonaného editoru. Takový záměr se odmítne a koncept se ponechá. Review apply nesmí převzít autoritu nad již převzatým produktem; staré odpovědi zůstávají jako evidence. Běžné změny jména a praktického skladování používají zachované notebookové protokoly.

Import notebookového konceptu zachová současnou receptovou autoritu. Odlišný nebo nový `workspaceRecipes` z importu výslovně označí jako neobnovený a odkáže Ownera/Managera na Menu → Ingredients & prep → položka → Edit item. Původní soubor a jeho receptové hodnoty zůstávají beze změny. Překonaná raw pole ingrediencí/postupu/výnosu se u takového produktu nepoužijí jako náhrada; ostatní bezpečně obnovitelné změny lze aplikovat. Úplný automatický import canonical receptů by vyžadoval vlastní mapování identit a samostatné revizně chráněné příkazy a není součástí notebookového importu.

Všechny příslušné notebookové, katalogové a nové receptové zápisy zahrnují kontrolu starých aktivních ranních plánů také v atomické podmínce zápisu. Pokud by nový klient změnil odvozovaný rozsah publikace ve starém formátu, vyžaduje nejprve výslovnou opravu a opětovné publikování této kontroly. Nové publikace zachovávají svoji práci nezávisle na pozdější změně menu.

## Co přesně čte Cook

`GET /api/menu` používá stejnou ověřenou identitu a kontrolu odvolání přístupu jako ostatní API. Vrací výslovně sestavenou projekci, nikoli celý notebook nebo Review payload. Čtení existujícího Menu je SELECT-only a nevytváří ani nemigruje notebook.

Kořeny Cook projekce jsou:

- Aktivní varianty jídel ve stavu Ready.
- Zahrnuté a sledované položky výslovně potřebné mimo menu, včetně doložených externích výrobních výstupů.
- Nezrušené úkoly publikovaných plánů pro aktuální provozní den v Praze nebo pozdější den.

Z těchto kořenů jsou dostupné nutné ingredience, uložené variantní možnosti a navazující společná výroba. Samotné zaslání cizího `itemId` práva nerozšiřuje. Nesouvisející katalog, neveřejné poznámky neaktivních jídel, dodavatelské účty, tým, analytické profily, schvalovací data a exporty nejsou součástí projekce. Cook nemůže zapisovat přes nové receptové API. Legacy role nezískává nový receptový zápis, ale `canOrdinaryEdit` zachovává její dosavadní omezené notebookové operace.

## Variantní fakta a praktické skladování

Review může mít aplikovaný záznam s volitelnými ingrediencemi, skupinami výběru a množstvími, který se záměrně nepřeváděl na současně používaný plochý seznam. `reviewEvidence` je zachovává jako pojmenovaná fakta s hranicí platnosti a varováním při nesouladu/neúplnosti. Neprovádí automatickou obsahovou změnu současného menu a nepředstírá nové potvrzení receptu.

Praktické podmínky, kvalita, pravidlo, zdroj a neznámé hodnoty se čtou z `prepProfile.storage` přes `storageSetups`; součástí jsou také způsob přípravy a praktická poznámka. Původní `Item.storage` je další samostatný záznam, nikoli automaticky novější nebo autoritativnější údaj. Úprava praktických setupů zachová ostatní profilová pole a původní evidenci; samotné zobrazení neuděluje údajům novou bezpečnostní certifikaci.

## Preview a migrace

`POST /api/menu/preview` pouze porovnává přesný navržený soubor aktivních variant a stavů jídel. Vrací revizi, změny provozního rozsahu, opuštění menu, zachované sdílené/externí použití, neúplnosti a případný blok starého plánu. Potvrzení změny stále podléhá aktuální revizi na skutečné zapisující cestě.

Migrace `0022_workspace_product_sources.sql` doplňuje `workspaceRecipes` do budoucích záznamů `menu_scope_sources`. Nemění dřívější snapshoty ani současný obsah jídel. Manifest a preflight musí nad skutečným chráněným prostředím ověřit zachování produkčního menu; syntetické testy nejsou dokladem jeho aktuálního obsahu.

Regrese `scripts/check-workspace-menu.mjs` ověřuje zdrojovou autoritu, 101 úrovní syntetického vnoření, produktové rozdělení společné výroby, dodavatelskou hranici, zachování hodnot, praktické setupy, variantní fakta, Cook/Manager/Owner/legacy API, původ a účet požadavku, revizní konflikty, atomický retry/rollback, ochranu starých klientů, bezpečný notebookový import, odmítnutí nevyžádané změny původu při sloučení a minimální provozní čtecí rozsah. Další existující testy kryjí katalog, produkční převod, menu scope, jednotky a Review handoff.
