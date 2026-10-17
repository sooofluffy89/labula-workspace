# Menu, House-made a Ingredients — analýza pro LABULA

17. října 2026 · Workspace 2.0 · návrh dalšího vývoje

**Doporučení:** postavit část Menu na třech pohledech nad společnými daty: **Menu / House-made / Ingredients**. Menu a House-made mají používat stejný editor složení, Ingredients jednodušší detail nakupované položky. Na desktopu bude jedna kompaktní hustota a stále otevřený pravý panel. Hlavním výsledkem této části aplikace má být odpověď: **„Víme, co je ve všech jídlech, včetně složení našich vlastních komponent?“**

Toto je analýza a návrh, nikoli nasazení změn. [Interaktivní koncept](concept.html) používá výslovně ilustrační receptury a počty.

Koncept předvádí navigaci, rozsahy seznamů a vztahy. Zápisové akce jsou vypnuté; nejde o hotovou specifikaci všech formulářových stavů. V prohlížeči byly ověřené odvozené počty, přepnutí záložek, vnoření a návrat, filtry, zachování skrytého výběru a mobilní Back. Šířky 1366 / 1440 / 1920 / 390 / 720 px neměly vodorovný přesah stránky. Poslední šířka byla ověřena při výšce 450 px jako reflow, nikoli fyzické nastavení zoomu. [Náhled Menu](concept-menu-1440.png) · [Náhled House-made](concept-house-made-1440.png).

## Podklady a hranice zjištění

- Screenshot vlastníka z 17. října: aktuální hlavička Menu / Recipes / Ingredients & prep a souhrn 24 variants / 19 dishes, 14 active variants, 14 lists confirmed, 0 empty lists.
- Zdroj verze 89, commit `ef752c88d6b4ece594b80ed161754092dc94f820`, ve worktree `labula-recipes-compact`.
- Aktuální screenshoty Recipes Compact z ověření sestavené aplikace, se syntetickými daty. Starší screenshoty Workspace 2.0 slouží jako doplněk; současné chování a styly jsou ověřené ve zdroji.
- Neproběhl nový audit obsahu produkční databáze. Nelze z těchto podkladů poctivě určit skutečný počet nedokončených house-made receptur ani udělit vašemu menu procentní známku.
- Rozsah tohoto návrhu je složení a práce s menu. Výrobní postupy, časování a kvantitativní plánování výroby nejsou požadavkem této etapy.

## 1. Co je skutečný problém

### A. Aplikace rozděluje práci jinak, než o ní přemýšlí kuchyň

Ty popisuješ tři přirozené otázky:

1. **Co podáváme?** Jídla a jejich varianty.
2. **Co si pro ně vyrábíme?** Sdílené house-made komponenty a jejich složení.
3. **Co do toho nakupujeme?** Ingredience použité přímo nebo přes house-made komponenty.

Současné rozhraní má Recipes a Ingredients & prep. Druhá záložka kombinuje nakupované položky, vlastní výrobu, informace o složení, postupy a konfiguraci denních kontrol. Uživatel musí nejprve rozklíčovat členění aplikace a teprve potom hledat svoji práci.

### B. Nejpodstatnější pracovní cesta je přerušená

V Recipes lze rychle měnit přímé ingredience jídla. Kliknutí na house-made položku otevře její informace ve stejném panelu, ale z tohoto místa není připojen vstup do plného editoru jejího složení. Ten je dostupný v původní Ingredients & prep obrazovce přes Edit item.

Požadovaná cesta má být plynulá:

**Jídlo → house-made součást → doplnění jejího složení → návrat k jídlu.**

Seznam jídel, pozice, filtr i výběr mají zůstat zachované. Vnořené prohlížení nemá svévolně přepínat hlavní záložku nebo otevírat několik modalů nad sebou.

### C. „List confirmed“ odpovídá na užší otázku, než uživatel očekává

Současný stav vychází z přímého seznamu dané varianty. Neověřuje, že každá house-made položka má úplné složení, ani že je vyřešené další vnoření.

Screenshot tedy může správně ukazovat potvrzení všech 14 aktivních seznamů, a přesto z něj nelze vyvodit úplnou znalost složení menu. Také „0 empty lists“ není kontrola všech house-made receptur. Stav neaktivních variant navíc současná tabulka přepisuje na Inactive, takže jejich rozpracovanost není samostatně vidět.

U house-made je další rozdíl: `composition.status = recorded` může znamenat pouze neprázdné uložené složení. V aktuální definici house-made receptury není stejný samostatný doklad uživatelského potvrzení úplnosti jako u seznamu jídla. Pouhé přejmenování tohoto stavu na Confirmed by bylo zavádějící.

Současné Recipes navíc neumožňuje potvrdit seznam neaktivní varianty. To obrací přirozený pracovní postup. Nový návrh musí umožnit **nejprve připravit a zkontrolovat složení, teprve potom jídlo zařadit do menu**.

### D. Vizuální nesoulad je měřitelný

| Prvek | Recipes Compact | Dosavadní Ingredients & prep |
| --- | --- | --- |
| Řádek seznamu | 42 px v Compact | minimálně 80 px |
| Běžné kompaktní ovládání | 34 px | minimálně 48 px |
| Hlavní nadpis na desktopu | přepsaný na 22 px | 32 px |
| Hlavička aplikace | specifický kompaktní přepis na 56 px | základ 72 px |
| Pracovní plocha | využívá viewport, samostatný posun seznamu/detailu | jiné šířky a pravidla list/detail |
| Úprava složení | rychlá úprava v pravém panelu | samostatný rozsáhlý dialog |

Today používá další podobu vnitřní navigace a provozních seznamů. Větší tlačítka v kuchyni mají smysl; rozdílná vizuální hierarchie a navigace smysl nemají. Sjednocení proto musí zahrnout společnou kostru a chování, ne pouze přebarvení tlačítek.

### E. Rozhraní ukazuje příliš mnoho vedlejších rozhodnutí

Compact/Comfortable, Hide detail, Collapse navigation, export, rozbalení skupin, nastavení kontrol, Method, zdroje a revize soupeří s hlavní prací. Část těchto funkcí je potřebná, ale nepotřebuje být stále v prvním plánu.

Primární obrazovka má říct: **co vybírám, co obsahuje, co chybí a jak to doplním**. Technické údaje o zdroji a revizi patří do podrobností; konkrétní konflikt nebo problém s uložením musí zůstat viditelný.

## 2. Navržená informační struktura

Horní navigace zůstane **Today / Menu / Settings**. V oblasti Menu budou přesně tři záložky:

| Záložka | Co obsahuje | Výchozí rozsah | Hlavní akce |
| --- | --- | --- | --- |
| **Menu** | Jídla a jejich skutečné varianty | Aktuální menu | Add dish |
| **House-made** | Všechny naše vlastní komponenty | All house-made | Add house-made item |
| **Ingredients** | Nakupované položky použité v jídlech | Used in current menu | Add ingredient |

Přejmenování Recipes na Menu splní požadavek. Nevytvářel bych k tomu další pojmy typu Recipe manager, Prep library nebo nový název celé oblasti. Malé opakování Menu v globální a lokální navigaci je přijatelné, když druhá úroveň zřetelně odděluje tři objekty práce.

### Jedna položka, jedna identita

House-made a Ingredients jsou dva pohledy na společný katalog, ne dvě nezávislé databáze. Jídla na položky odkazují. Změna sdílené omáčky se projeví všude, kde se používá; jídla si neukládají vlastní kopie jejího složení.

Jestliže jde o dvě odlišné omáčky, potřebují dvě vědomě odlišené položky. Jestliže jde o překlep nebo alternativní název, patří k jedné identitě. Zachovat existující řešení aliasů a slučování duplicit.

### Co přesně patří do House-made

Všechno, co v kuchyni vzniká jako samostatně používaná komponenta: omáčka, dresink, vývar, marinovaná položka, těsto, směs. Komponenta může obsahovat nakupované suroviny i další house-made komponenty.

Není nutné vytvářet zvláštní house-made položku pro každý kuchařský úkon. „Nakrájet okurku při servisu“ nemusí znamenat nový produkt. „Nakládaná okurka“, kterou připravujeme a samostatně používáme nebo kontrolujeme, už typicky samostatnou položkou je. Rozhoduje skutečný způsob použití, ne počet vstupů.

Výchozí seznam zahrne i house-made položky mimo aktuální menu, jak požaduješ. Rozlišovat:

- Used in current menu.
- Not in current menu, ale použito v jiných house-made nebo neaktivních jídlech.
- Unused: nemá žádné zjištěné použití; absence vazby ještě nemusí v neúplných datech dokazovat nepotřebnost.

Nedávat house-made stejný přepínač On menu jako jídlu. Jeho použití v menu se odvozuje z vazeb.

### Co přesně patří do Ingredients

Nakupované položky dosažitelné z jídel **přímo i přes house-made složení**. Jinak by seznam opomněl například česnek použitý pouze v omáčce.

Při výpočtu se položky sjednotí podle ID. Česnek použitý v pěti jídlech je jeden řádek s pěti použitími, nikoli pět položek.

Nakupovaný složený produkt, například sójová omáčka, je pro kuchyň jednou nakupovanou položkou. Její dodavatelské složení lze zachovat jako doplňující informaci. Nesmí automaticky vytvářet požadavek vyrábět sójovou omáčku nebo nakupovat jednotlivé složky z etikety.

Výchozí Ingredients ukazuje aktuálně používané ingredience. Volba All ingredients umožní dohledat už založenou položku pro další jídlo. Nově vytvořená nebo právě upravená položka musí zůstat viditelná, i když ještě není připojená k aktuálnímu menu; zobrazí se vysvětlení jejího rozsahu. Nic se nemaže jen proto, že to právě není použito.

## 3. Jeden pracovní vzor pro všechny tři záložky

```text
LABULA  Workspace 2.0        Today   Menu                 Settings

Menu       [Menu] [House-made] [Ingredients]              + Add …
Composition: X / Y active variants complete    Z items need attention

┌───────────────────────────────────────┬─────────────────────────┐
│ Search …   Scope   Status   Category   │ Vybraná položka         │
├───────────────────────────────────────┤ typ · stav · použití    │
│ Kompaktní tabulka                     │                         │
│ vybraný řádek                         │ Složení                 │
│ další řádek                           │ + Add ingredient        │
│ další řádek                           │                         │
│                                       │ Used in …               │
├───────────────────────────────────────┤                         │
│ Hromadné akce, jen když je výběr       │ stav uložení / akce     │
└───────────────────────────────────────┴─────────────────────────┘
```

### Pravidla rozložení

- Zrušit Compact/Comfortable. Zachovat jednu kompaktní desktopovou hustotu, přibližně současných 42 px na řádek; delší obsah se smí zalomit a řádek zvětšit.
- Zrušit Hide detail a zavírací křížek desktopového panelu. Když není nic vybráno, panel ukáže stručné „Select an item to see its composition“. Rozložení neskáče.
- Doporučuji také zrušit Collapse navigation. U dvou hlavních oblastí přináší další stav rozhraní malý užitek.
- Seznam dostane zbývající šířku, detail přibližně 360–440 px podle monitoru. Na 1366 px ověřit, že zůstávají čitelné názvy a stavové sloupce; nepřidávat povinný třetí panel.
- Sticky záhlaví a společná poloha vyhledávání. Tabulka i detail se posouvají samostatně v dostatečně širokém zobrazení.
- Hromadná lišta se ukáže až po výběru. Export a méně časté akce pod jedno More menu.
- Kliknutí na název/řádek otevírá detail. Checkbox slouží pouze hromadnému výběru. Obojí má odlišnou vizuální odezvu.
- Na telefonu a při zvětšení, kde se dva panely nevejdou, zůstane běžný přechod seznam → detail → Back. „Vždy ukazovat detail“ na desktopu nemá znamenat nečitelný dvojpanel na 390 px.

### Sjednocení vzhledu celé aplikace

Společné mají být logo a hlavička, aktivní navigace, okraje pracovního prostoru, styl nadpisů, záložky, tlačítka, vstupy, stavy, chybová hlášení a pravidla focusu. Přepnutí Menu → House-made → Ingredients nesmí změnit velikost aplikace.

Today může mít větší cíle pro dotyk a úkolovější obsah. Použije ale stejné komponenty, barvy a hierarchii. Provozní potvrzení Ready v Morning prep musí být textově odlišné od Composition complete v Menu.

Navržený základ: text tabulky 14 px, vysvětlení nejméně 12–13 px, jeden desktopový rozměr formulářových prvků kolem 36 px, dotykové akce alespoň 44–48 px, jednotný rytmus mezer a zaoblení. Zelená označuje konkrétní potvrzený stav, oranžová něco k doplnění, červená chybu nebo hlavní akci podle kontextu. Barva nikdy není jediný nositel významu.

## 4. Konkrétní obsah obrazovek

### Menu

Zachovat jeden řádek na skutečnou variantu, sdružený pod jídlem. Při více variantách je rozdílné složení podstatné pro další provoz. Jídlo s jedinou variantou nepotřebuje všude připsaný Standard.

Navržené sloupce: **Dish / variant · Category · On menu · Composition · House-made**. Počet vstupů lze použít jako sekundární údaj, pokud zbývá místo. Nepřidávat každý dostupný údaj jako další sloupec.

Detail: jméno a varianta, přímé komponenty, jejich typ a případný problém, přidání existující nebo nové položky, informace o úplnosti. U house-made přímý odkaz do jejího složení ve stejném panelu.

Když je problém v omáčce, text musí být konkrétní: „Chilli sauce: composition not confirmed“. Samotné „Needs attention“ bez dalšího kroku nestačí.

### House-made

Stejná tabulka a stejný editor seznamu komponent jako u jídla. Navržené sloupce: **Item · Composition · Used in current menu · Used in house-made**. Detail ukáže také neaktivní použití odděleně.

Vazba na nadřazené house-made je důležitá: česneková pasta může být použitá v omáčce, aniž by byla přímo vypsaná v jídle. Počítat unikátní jídla a varianty zvlášť a uvést, co číslo znamená.

Při změně sdíleného složení stručný dopad: „Used in 4 current dishes and 2 house-made items“. Obyčejné přidání ingredience nepotřebuje samostatný rozsáhlý auditní dialog; uživatel však musí vědět, že upravuje společnou položku.

Primární pole: název, seznam komponent, poznámka ke složení podle potřeby. Množství lze zachovat a doplnit, ale jejich neznalost neblokuje dokončení kvalitativního seznamu. Method, časy, výtěžnost, skladování a stanoviště nemají být povinným průchodem této práce.

### Ingredients

Jednodušší seznam: **Ingredient · Used in current dishes · Used in house-made**. Volitelná skupina má smysl pouze tehdy, pokud se používá a uživateli pomáhá hledat.

Detail: název, případné alternativní názvy, specifikace produktu, kde je použitý. Dodavatelská informace je dostupná podrobnost. Česnek nepotřebuje prázdný recept, velké varování „Composition not recorded“ ani povinný výrobní postup.

Vytvoření položky z House-made předvyplní Made here, z Ingredients Bought. Z jídla nabídne „Ingredient / House-made item“ s krátkým vysvětlením. Typ se nemá odhadovat bez potvrzení podle názvu. Oprava typu je změna společného záznamu s dopadem, nikoli prostý přesun řádku mezi kartami.

## 5. Stavy a dashboard, které dávají pravdivou odpověď

### Oddělit tři různé věci

1. **Použití:** On menu / Off menu; u položek Used in current menu / Not in current menu.
2. **Vlastní seznam:** Not started / Draft / Confirmed / Needs review.
3. **Celé složení včetně závislostí:** Complete, nebo konkrétní seznam nedořešených komponent.

Potvrzený vlastní seznam může odkazovat na house-made s nedokončeným složením. V takovém případě zobrazit například „Own list confirmed · 1 house-made needs review“. Vypnutí jídla nemá smazat nebo vizuálně přebít informaci, jak daleko je jeho složení.

### Definice hotového složení pro tuto etapu

Aktivní varianta je **Composition complete**, pokud:

- má neprázdný, uživatelem potvrzený vlastní seznam;
- všechny odkazy míří na existující a správně rozlišené položky;
- každá dosažitelná house-made komponenta má potvrzený vlastní seznam;
- jsou vyřešené všechny další house-made závislosti;
- není přítomen cyklus, nedostupný autoritativní zdroj ani nevyřešená volba/rozpor ve složení.

Chybějící gramáže, výrobní postupy, pracovní časy nebo skladovací instrukce do této definice nevstupují. Jsou to jiné stupně připravenosti. Nakupovaná základní položka nepotřebuje vlastní recept. Volitelné přílohy a alternativy nesmí být automaticky zploštěny do jednoho souběžného seznamu.

### Dashboard

Doporučuji jeden nízký, klikací přehled nad tabulkou:

| Údaj | Přesný význam | Akce po kliknutí |
| --- | --- | --- |
| X / Y active variants complete | Hotové celé složení / všechny aktivní varianty aktuálního menu | Filtrovat nedokončené varianty |
| N ingredient lists to check | Vlastní seznamy aktivních variant vyžadující kontrolu | Otevřít první nevyřešený seznam |
| H house-made items to complete | Unikátní dosažitelné house-made s nedokončeným vlastním složením | Přepnout House-made s odpovídajícím filtrem |
| R broken or conflicting references | Nevyřešené identity, cykly, zdroje nebo volby | Ukázat konkrétní problémy a dopady |

Neoznačovat tento údaj jako celkové zdraví kuchyně ani readiness pro výrobu. Hlavní text může být „Menu composition“. Případné procento je průhledný podíl hotových aktivních variant, nikoli vážené skóre chutnosti, nákladovosti nebo provozní připravenosti.

Žádné aktivní varianty znamenají „No active menu“, nikoli 100 %. Neúplné složení může skrývat další dosud neznámé suroviny; jejich počet aplikace nesmí domýšlet. Jedna chybějící omáčka použitá v pěti jídlech znamená jeden problém house-made a pět zasažených jídel, ne pět různých chybějících omáček.

Přednostně nabídnout opravu, která odblokuje nejvíce aktivních variant. Uživatel pak ví, kde má začít.

### Co se stane po změně

Změna vlastních komponent otevře vlastní potvrzení. Změna dítěte přepočítá úplnost všech dotčených rodičů. Nemusí zneplatnit fakt, že rodičovský přímý seznam byl zkontrolován, pokud se nezměnil; jeho celkové složení ale nesmí dál neprávem svítit jako hotové.

Potvrzení se váže ke konkrétní obsahové verzi. Přejmenování položky při zachování identity nemusí vyžadovat opakovanou kontrolu všech rodičů. Změna identity, typu nebo složení se musí vyhodnotit podle skutečného dopadu. Staré neprázdné receptury se při přechodu nesmějí automaticky vydávat za nově potvrzené.

## 6. Rychlé úpravy a ukládání

Plynulost nespočívá jen v hustotě tabulky. Zásadní je méně přechodů a stejný způsob práce:

- Hledání podle názvů i aliasů. Hledání použití ingredience v menu má umět i vnořenou house-made cestu a u výsledku ji vysvětlit; současné Recipes hledá jen přímé ingredience.
- Přidávání více existujících komponent jedním výběrem. Novou položku založit až po nabídnutí existujících shod.
- Odebrání komponenty a dostupné Undo bez ztráty jejího původního množství či poznámky.
- Přechod na další nedokončenou položku, klávesové hledání a zřetelný focus.
- Zachovat filtr, scroll, aktivní řádek a návratovou cestu při vstupu do house-made.
- Změněný řádek nemizí bez vysvětlení jen proto, že přestal odpovídat filtru.

Pro společný editor doporučuji sjednotit tento kontrakt: rozpracované složení se automaticky chrání jako místní návrh, **Save composition** vědomě uloží souvislou změnu. Volitelné explicitní potvrzení úplnosti vlastního seznamu může být součástí stejného uložení. Samotný zápis dat a potvrzení úplnosti zůstávají odlišné skutečnosti.

To je návrhové rozhodnutí k implementaci, protože dnes rychlý editor jídel a house-made dialog používají odlišné ukládací cesty. Nesmí se pouze doplnit globální Autosaved nad neodeslaný návrh. Společné stavy mají být jasné: Unsaved changes / Saving / Saved / Could not save, s jediným srozumitelným místem pro Retry. Stejný vzhled nemusí znamenat stejný API endpoint.

### Hromadné akce

| Oblast | Smysluplné nyní | Co nedělat jako běžnou rychlou akci |
| --- | --- | --- |
| Menu | On/off menu s náhledem, kategorie, export výběru | Hromadně označit nezkontrolované složení jako potvrzené |
| House-made | Export, zobrazení použití, případné společné metadata | Automaticky zapnout/vypnout výrobu podle označení řádků |
| Ingredients | Export, skupina, přehled použití | Hromadné slučování nebo změna typu bez srovnání dopadů |

Ve všech záložkách stejné chování výběru: výslovný počet označených položek včetně těch mimo filtr, možnost Show selected, náhled před významnou změnou. Funkce, které nemají reálnou potřebu, nemusí mít tlačítko jen kvůli symetrii.

## 7. Jaký základ tím vznikne pro Evening check a Morning prep

```text
Aktuální menu a varianty
       ↓
Sdílené komponenty a jejich složení
       ↓
Co je relevantní pro provoz + co kuchyň výslovně sleduje
       ↓
Evening check: co máme a co chybí
       ↓
Potvrzené předání / plán
       ↓
Morning prep: konkrétní práce pro ráno
```

Dobrý model složení umožní ukázat, která jídla závisejí na konkrétní omáčce, proč se položka kontroluje a které další komponenty potřebuje. Stejnou omáčku použitou v pěti jídlech bude možné kontrolovat jako jednu sdílenou položku.

**Složení samo neurčuje potřebu vyrábět.** House-made může být připravené dostatek; nakupovaná položka může chybět a potřebovat objednání nebo doplnění. Vnořený česnek se nestává samostatným ranním úkolem jen proto, že je součástí omáčky. Dodavatelské složení se také nestává kuchyňským seznamem výroby.

Pro budoucí provoz bude potřeba samostatně rozhodnout, co kontrolujeme, podle jaké zásoby nebo prahu, jak často, kde a kdo práci přebírá. Pro výpočet přesných množství navíc potřebujeme gramáže, jednotky, výtěžnosti a očekávanou potřebu. Žádnou z těchto věcí nelze spolehlivě dopočítat pouze z názvů složek.

Existující konfigurace kontrol, použití mimo menu a již publikované ranní plány se při sjednocení Menu nesmějí přepisovat. Příští check může vycházet z nové verze menu, už potvrzené předání musí zůstat dohledatelné ve své verzi. Při neúplném složení se potenciálně potřebné položky nemají automaticky vyřazovat.

## 8. Co už aplikace má a co je skutečná změna

| Oblast | Současný základ | Potřebná změna |
| --- | --- | --- |
| Rozdělení typů | `Item.kind`: prep / bought | Tři srozumitelné pohledy, správné výchozí rozsahy |
| Sdílené složení | Projekce Workspace / Review / process / legacy / supplier | Zpřístupnit stejným kompozičním editorem |
| Vnoření | Vazby položek, detekce cyklů, strom a návraty | Plynulý editovatelný detail, cesty použití |
| Použití | `usedIn` s jídly a variantami | Oddělit aktuální / neaktivní použití; přidat přímé rodičovské house-made |
| Potvrzení | U jídel `recorded`; u house-made zdrojový stav | Výslovná evidence vlastní kontroly a odvozená úplnost závislostí |
| Operativní relevance | `menuScope`, konfigurace checks, uložené plány | Zachovat odlišnost složení produktu a výrobních potřeb |
| Desktop | Recipes Compact | Sdílený layout pro tři záložky, odstranění přepínačů |
| Bezpečné ukládání | Revize, source tokeny, receipts, recovery | Jednotný uživatelský kontrakt nad stávající ochranou |

House-made tedy není nová databáze od nuly. Přesné potvrzování a přepočet závislostí však nejsou pouhý rename nebo CSS úprava. Budou vyžadovat rozšíření doménové logiky a pravděpodobně dat nesoucích potvrzení; konkrétní migrační postup má vzniknout až při implementaci po ověření kompatibility stávajících zdrojů.

Podstatná technická hranice: **obsah produktu není totéž co všechny vstupy sdílené výrobní dávky**. Jedna výroba může vytvořit více výstupů; nelze všechny její vstupy bez rozlišení zapsat do každého výsledného produktu. Současný model tyto věci odděluje a nový jednodušší editor to musí zachovat.

## 9. Doporučené pořadí

1. **Sjednotit navigaci a pracovní prostor:** Menu / House-made / Ingredients, jedna hustota, trvalý desktopový detail, společné vizuální komponenty. Zachovat existující odkazy a přesměrovat staré adresy Recipes.
2. **Dokončit propojený editor složení:** jídlo → house-made → další house-made, stejné přidávání, použití a návraty, konzistentní uložení a obnova návrhu.
3. **Doplnit pravdivé stavy a přehled kvality složení:** samostatné potvrzení vlastního seznamu, závislosti, důvody problémů a akce k nápravě. První tři kroky tvoří jeden ucelený produktový cíl.
4. **Sjednotit společnou kostru Today:** stejné názvosloví, navigace, stavy a detaily; ponechat vhodná dotyková tlačítka.
5. **Navázat provozní návrh Evening check / Morning prep:** až na známých vazbách, samostatně od rozhodnutí o výrobních postupech.

## 10. Kritéria přijetí další implementace

1. Ze stejného jídla lze doplnit vnořenou house-made komponentu a vrátit se bez ztráty filtru, výběru či rozpracovaného textu.
2. House-made ve výchozím pohledu obsahuje všechny dostupné house-made položky v rámci oprávnění, i mimo aktuální menu.
3. Ingredients ve výchozím pohledu obsahuje nakupované položky z aktuálního menu i přes vnořené house-made, každou právě jednou.
4. Nakupované položky nejsou označené jako nedokončené jen proto, že nemají vlastní výrobní recept.
5. Jídlo s potvrzeným přímým seznamem a nedokončenou omáčkou není označené jako Composition complete.
6. Úprava sdílené komponenty přepočítá stav a dopad všech rodičů; nepotřebné opakované potvrzování pouhého přejmenování se nevyžaduje.
7. Použití v aktivních jídlech, neaktivních jídlech a rodičovských house-made je rozlišitelné; počty uvádějí rozsah a neduplikují identity.
8. Chybějící zdroj, cyklus, alternativní složení nebo konflikt nejsou nahrazeny domněnkou o úplnosti.
9. Přepnutí mezi třemi záložkami nemění rozměry hlavičky, navigace, ovládání a panelu. V desktopovém režimu není density ani hide-detail přepínač.
10. Na 1366/1440/1920 px je plocha přehledná; na mobilu a při 200% zvětšení lze projít seznam → detail → návrat bez vodorovného posunu celé stránky.
11. Souhrny odlišují jídla, varianty, unikátní house-made a jednotlivé problémy. Prázdné menu nemá skóre 100 %.
12. Selhání ukládání a souběžná změna neztratí návrh a neukážou nepravdivé Saved. Existující oprávnění se nerozšiřují přidáním nové záložky.
13. Výrobní postup, výtěžnost a gramáže nejsou podmínkou potvrzení kvalitativního složení. Dříve uložené údaje zůstávají zachované a dohledatelné.
14. Publikované ranní plány, sledování položek a jejich použití mimo menu zůstávají zachované; změna pohledu nevytváří ani nemaže provozní úkoly.

## Zdrojové opory

- [MenuWorkspace](../../app/menu-workspace.tsx): navigace, původní katalog, rozdílné vstupy do DishEditor/ItemEditor, detail a daily checks.
- [RecipesCompact](../../app/recipes-compact.tsx) a [jeho styly](../../app/recipes-compact.css): kompaktní rozložení, přepínače, kontextový panel a výběr.
- [Původní styly Menu](../../app/menu-workspace.css), [Workspace shell](../../app/workspace-shell.tsx), [Today styles](../../app/today-workspace.css): vizuální a navigační rozdíly.
- [Stavy Recipes Compact](../../lib/recipes-compact.ts): `compactRecipeRows`, přímé hledání a hromadné změny.
- [Workspace menu](../../lib/workspace-menu.ts): `compositionFromState`, `workspaceMenu`, `usedIn`, zdrojové tokeny a `applyWorkspaceMenuCommand`.
- [Menu UI model](../../lib/workspace-menu-ui.ts): současné dva pohledy, filtr aktivního použití, návratové cesty a tvorba záznamu.
- [Notebook schema](../../lib/notebook.ts), [Dish workspace](../../lib/dish-workspace.ts): identity, typy, potvrzení a validace.
- [Menu scope](../../lib/menu-scope.ts), [Approved production](../../lib/approved-production.ts): provozní relevance, neúplné závislosti, externí použití a oddělení společné výroby.
- [Stock workflow](../../app/stock-workflow.tsx), [Stock server](../../lib/stock-server.ts): denní kontrola, potvrzení plánu a konfigurace sledovaných položek.
