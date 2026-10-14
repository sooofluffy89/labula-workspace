# Quick kitchen review — pokrytí a hranice

Zadání: `navrh-dotazniku-2026-09-19/master-prompt-quick-review.md` (2026-09-20). Výchozí kód byl v25 / 4f8fe847046d01ca56a9bf6d024f97126f8c32d9. Během práce se ověřil živý notebook rev317 a nově vyplněný původní review rev32. Žádné odpovědi kuchaře nebyly nahrazeny testovacími daty.

## Rozsah požadavků

| Požadavek | Řešení a důkaz |
|---|---|
| Jediný výchozí formulář | `/review` vykresluje QuickReview, osm stabilních případů; landing používá stejný výpočet průběhu. Staré odkazy s parametry otevírají nový průchod s informací o zachovaných odpovědích. |
| Starý formulář a koncepty | `/review/archive` kontroluje vlastníka na serveru, je pouze ke čtení; výslovný odkaz `/review/archive/edit` zachovává původní editor. Kuchař má export/import/porovnání starých místních kopií v běžném review bez vstupu do archivu. |
| Osm případů, tři kroky | `lib/quick-review/model.ts` obsahuje skutečné stabilní identity. Počet případů se nezvětšuje při přidání úkonu ani společného výstupu. Všechny tři krátké větve mají dosažitelný konec bez dávek. |
| Šest témat | Rozsah práce; použitelný výstup a stav; aktivní práce a lidé; plné dávky a dodělávky za týden; spouštěč; omezení a původ. Jednotlivé nejistoty zakládají konkrétní návrhy kontrol. |
| Společné a následné úkony | Proces má jednu identitu a několik výstupů; lze jej propojit mezi případy. Navazující úkon vyžaduje vstup a oddělení práce. Kruhové započtení i kruhová návaznost jsou blokované. Odpojení zachová proces i historii. |
| Výrobní výluky | Používá dosavadní identifikaci podle ID a aliasů. Výrobní část neoddělitelné společné práce není aktivní ani zahrnutá do výsledků. Server odmítne nové výrobní údaje mimo rozsah; dřívější zůstávají zachované. |
| Starší údaje | Jednotlivě převzatelné jsou jednoznačné množství v metrické jednotce a již zapsané provozní dny. Převzetí je výslovné, s původem a revizí; nic není automaticky potvrzené. Sáčky, denní časy a nejasné četnosti se nepřepočítávají. Vlastní vymazání a odmítnutí nabídky jsou uložená rozhodnutí. |
| Přesný návrat | Pokračování zachová krok i vybraný úkon posledního případu. Dokončené/odložené případy nejsou vnucené do povinné smyčky. Sdílená uložená pozice vlastníka nezpůsobí prázdný formulář kuchaři. |
| Pravdivé dokončení | Hlavní počet má jmenovatel 8. Prázdná odpověď není „nevím“. Hotové odpovědi, návrhy kontrol, přidělení a doložené výsledky jsou odlišné. Změna závislých údajů zneplatní dokončení bez smazání odpovědí. |
| Ukládání a obnova | Stejná skutečná SaveQueue a recovery vrstva jako původní formulář; nová pole jsou aditivní. Nové ukládání má clientVersion4. Starý klient nemůže odstranit quick; dříve přijaté operace lze přesně zopakovat. |
| Vlastník a Notebook | Preview → schválení přesné verze → samostatné apply. Kuchař nemá schválení ani apply. Vyplnění, finish a uzavření kontroly Notebook nepíší. Stávající schvalování plného auditu nebylo oslabené. |
| Zálohování | Doplněný owner-only read-only export všech deseti tabulek, včetně plných textů historie. Bez nových oprávnění, migrace nebo možnosti obnovou přepsat produkci. |

## Přesné mapování na starší datový model

- **Přímo reprezentovatelná oprava:** celá samostatná příprava jednoho výstupu; jeden člověk; známé minuty celé práce; známá týdenní četnost; žádné dodělávky; existující workflow ahead/hybrid; jednotka kg/g/l/ml/kusy; bez dalšího procesu pro stejný produkt. Vzniká přesný návrh změny pouze batch profilu, s kontrolou celého předchozího přípravného profilu. Ostatní pole včetně skladování se zachovají. Hodnoty zůstávají označené jako odhad.
- **Samostatný procesní záznam:** společná výroba, více lidí, jiné jednotky, navazující úkony, více úkonů a částečná použitelnost. Po samostatném approval/apply se uloží omezený záznam do existujících `reviewed_entities` s vlastní působností QUICK-01. Nevyrábí se falešný profil jedné dávky pro každý společný výstup.
- **Neověřený podklad:** explicitní nejistoty a návrhy kontrol; lze je uchovat jako součást omezeného procesního záznamu, ale nejsou potvrzené měření, bezpečné skladovací pravidlo ani automaticky schválená výroba.

Dosavadní dashboardy nepovažují QUICK-01 za plně ověřený výrobní proces. Sdílené procesy jsou nyní přehledně dostupné ve výsledku review a historii schválených záznamů; plné analytické rozšíření přehledů není součástí této změny. Bezpečnost skladování ani optimální dávka se neodvozují z odhadů.

## Automatické ověření

- Všech **35 původních** regresních skriptů zachováno. Jediná změna starého testu UI je explicitní otevření `legacy:true`, protože jeho původní testovaný editor se přesunul do archivu vlastníka; žádná původní ochranná aserce nebyla vynechána.
- `check-quick-review.mjs`: skutečný model, SaveQueue a API proti izolované SQLite; průběh, nejistoty, společná práce, výluky, odhady, jednotky, více lidí, dodělávky, změny A/B/C/D během ukládání, přesné opakování, starý klient, role, náhled, schválení, nezávislé apply, zachování novější nesouvisející změny Notebooku, rollback, obnova legacy a uzavírání kontrol s doloženým výsledkem.
- `check-quick-ui.mjs`: skutečné obsluhy nového komponentu; osm dokončitelných případů, neznámá/odložená odpověď, návrat ke kroku, žádné automatické approval/apply, synchronní busy ochrana, pozice vlastníka při otevření kuchařem.
- `check-private-backup.mjs`: anonymní a kuchař odmítnutí; pouze existující vlastník; všech deset tabulek; dlouhé hodnoty bez zkrácení; pouze SELECT; no-store.
- Celkem **38 skriptů**. Zvláštní staré řízené testy dále ověřují timeouty před/po potvrzení, 401/403, konflikty, blokované úložiště, mezitím vzniklé odpovědi, návraty z propojených záznamů, dvouzáložkové konflikty, importy a neměnné opakování požadavků.

## Skutečný prohlížeč — oddělená lokální data

Lokální původní testovací SQLite byla předem zálohována mimo repozitář. Nová syntetická data mají předponu Test a neobsahují kuchařovy odpovědi.

1. Staré místní recovery kopie se nabídly k porovnání; pokračování se sdílenými daty je zachovalo.
2. Jednoznačný běžný česnek: rozsah → dávka → spouštěč/omezení → finish. 2 kg, 15 min, 6× týdně, 0 dodělávek; výsledek 90 člověkominut jako odhad. Notebook zůstal rev500 po vyplnění i schválení; teprve explicitní apply vytvořilo rev501.
3. Společný proces pěti výstupů: jeden čas dvou lidí, 3 dávky/týden a 2 dodělávky; čtyři neznámé výstupy a box bez známé hmotnosti vytvořily 5 konkrétních návrhů kontrol. Odložení a návrat zachovaly krok i hodnoty. Hotové odpovědi neuzavřely kontroly.
4. Výpadek: zastavený lokální server, další zadávání a změna kroku, stav Saving needs attention, Retry saving, opětovné spuštění, potvrzené uložení, reload a zachovaný přesný krok i text.
5. Desktop a viewport375×812; document width375 bez vodorovného posuvu, přímé volby a čitelné stavy. Chybové dokončení zaměřilo text konkrétního nedostatku; po opravě chybová zpráva mizí.
6. Soukromý backup endpoint stažen a ověřen také v prohlížeči na lokální testovací sadě.

Syntetický běžný případ: **3 formulářové kroky**, navíc přehled a jednorázový vstup „Describe the work“. Testem se záměrně přidaly dva přechody pro ověření návratu; běžné vyplnění je nepotřebuje. Společná výroba používá stejné tři kroky, má však více řádků výstupů. Jde o počet kroků, nikoli naměřenou dobu kuchaře. Čas 4–7 minut/případ a 60–90 minut na první sběr zůstává cílem pilotu.

Síťové timeouty po potvrzení, dvě současně zapisující záložky a rozdílné role byly zkoušeny řízenými automatickými testy, nikoli současným přihlášením skutečného kuchaře v produkčním prohlížeči.

## Nasazení a vratnost

Nebyla přidána databázová migrace. V26 přidala pouze soukromý export a ponechala starý formulář. Přes běžné přihlášení vlastníka byl poté stažen úplný snímek: notebook317, review32, 315 notebook_commands, 32 plných data_review_commands, všech dalších šest datových/historických tabulek včetně prázdných. Běžný omezený náhled historie nebyl vydáván za úplnou zálohu.

Finální nasazení ani běžné otevření nového průvodce nepřepisuje žádný review payload. Quick je přidáno až skutečnou uživatelskou akcí. Soukromé přístupy jsou ponechány.

Případný návrat provést opravou/vrácením rozhraní nad současným kompatibilním serverem a zachovat clientVersion4 guard. Nepoužívat starou databázovou zálohu přes novější odpovědi a nevracet bez kontroly starý server, který ještě neznal quick pole. Autoritativní stav deploymentu a porovnání dat po nasazení jsou v předávacím protokolu mimo repozitář.
