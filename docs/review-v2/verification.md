# Ověření nového interaktivního review

Implementace navazuje na fcb97eabce999623d5b24be90739fe73109fa30e. Závazné zadání a všechny uvedené podklady z 19.9.2026 byly přečteny. Rozsah:49 skupin,25 cílených karet,57 mapovaných původních bodů s výslovným vyloučením A02. Podrobná mapa je v coverage.md a coverage.json.

## Co je skutečně implementováno

Anglický adaptivní průvodce /review propojuje produkty a jejich fyzické fáze, dodavatelské zdroje, sady, procesy, více skutečných běhů, skladovací stavy, varianty jídel, provozní záznamy a odpovědné ověření. Neznámé hodnoty nejsou nuly. Kuchař může potvrdit fakt, opravit ho nebo vytvořit konkrétní kontrolu s osobou, termínem a metodou. Kontrolu lze uzavřít až po výsledku ve správných původních polích a uvedení důkazu, osoby a data.

Vlastník vidí původní a navržené hodnoty, konflikty s aktuálním notebookem a rozsah připravenosti. Schválení konkrétní verze a její zapracování jsou samostatné serverově autorizované operace. Bezpečný alias merge přepisuje i skutečné katalogové/recepturové vazby; rozdílné profily vyžadují vyřešení konfliktu. Nové struktury se ukládají do reviewed_entities a čtou se v příslušných přehledech. Staré výrobní odhady dotčených produktů se nepoužijí jako současné úplné výsledky; různé běhy a společné pracovní úkony se nesčítají jako jedna receptura.

Autosave uchovává všechny přijaté vstupy, rozepsané řádky a kontroly. „Saved“ odpovídá právě aktuálnímu potvrzenému stavu. Recovery obsahuje původní source/record, current, acknowledged, pending, pendingAction, revizi a identitu. Import porovnává obě verze a nejprve dořeší původní nejisté operace. Zrušený import nesmí později přepsat stav. Soukromý původní archiv je uložen atomicky v menších UTF-8 částech; opakování používá SHA-256 původního požadavku. Definitivní odmítnutí umožní opravit obsah a poslat novou operaci.

Migrace v1 je verzovaná a opakovatelná. Originál zůstává v legacy, staré potvrzení není nové ověření. Aktivní větve, jednotky a selektory množství se překládají konzervativně. Stará otevřená aplikace dostane po změně schématu 426 s možností uchovat a obnovit práci; staré doložené receipts lze stále bezpečně zopakovat.

## Automatické kontroly

Všech 33 regresních skriptů prošlo:29 původních a 4 nově přidané. Nové skripty:

- check-review-workflow.mjs: skutečný API handler nad izolovanou transakční SQLite, původní API, autorizace, konflikty, ověření, schválení, atomické zapracování, idempotence, zachování jiné novější práce, rollback historie i archivu.
- check-review-readiness.mjs: dosažitelné i částečné stavy, potvrzení obou srovnávaných běhů, odhady, sdílená práce, rekurzivní složení, zdroje pro plánování, jejich období a vazby, bezpečné slučování obnovy a potlačení starých odhadů.
- check-review-boundaries.mjs: dodavatelská/domácí varianta, zachovaná procesní média, chybějící výstupy, rozporné balení, duplicitní práce, platnost metod, zdroj skladování, negativní ověření, migrace týdnů a skrytých množství, skutečný alias merge a vyloučená identita.
- check-review-ui.mjs: skutečné handlery/effects komponenty, změny A/B/C během ukládání, pravdivý saved stav, chyba přihlášení a oprava, odmítnutý dlouhý název, remount a oprava přes porovnání/import, dostupné potvrzení podkladů vlastníkem a zánik komponenty s novější místní prací. Síťové chyby jsou řízeně simulované, nejde o fyzicky odpojenou síť.

Samostatná nezávislá kontrola navíc spustila 11 původně problematických analytických scénářů proti čerstvým souborům; všechny známé nálezy uzavřeny. Kontrola bezpečnosti ověřila všech 10 míst selhání při uložení archivu 2.35MB, surrogate/emoji na hranici částí, UTF-8 transportní limit, anonymní odmítnutí, velká schválení a aplikace s odmítnutím 422 před prvním zápisem. Byla provedena read-only vůči projektu, na in-memory SQLite, nikoli na produkčních datech.

TypeScript a lint prošly bez chyb a varování. Produkční build je samostatná závěrečná kontrola před odesláním verze. Finální výsledek publikace a aktivní commit jsou v předávacím záznamu mimo repo.

## Audit z 18.–19.9.

| Nález | Oprava a důkaz |
|---|---|
| F01 odmítnutý požadavek opakovaný po opravě | Definitivní 4 xx uvolní původní pending; UI test dlouhého názvu/restartu/opravy. |
| F02 rozepsaný CHECK | Každé pole součástí autosave; skutečný browser reload u osoby, metody a data. |
| F03 podobná/duplicitní položka bez návratu | Normalizované shody, editace identity, archivace nového návrhu a řízený alias merge. |
| F04 balení | Agregace více velikostí a zbytku, oddělení vzorku/úplného výstupu, vazba na přesný výstup. |
| F05 duplicitní vstupy | Krok + produkt/fáze/zdroj/origin; skutečné opakované přidání vyžaduje rozlišení kroku. |
| F06 Manifesto | Stabilní identity i aliasy, blokované výrobní větve UI/serverové projekce/exportu, outside readiness. |
| F07 neaktivní odpovědi | Rekurzivní aktivní projekce; neaktivní podklad zůstane v konceptu/historii, nevstupuje do výsledků. |
| F08 falešný cyklus | Graf fyzických fází, alternativní metody a původ konkrétní dřívější šarže. |
| F09 nedoložený skutečný běh | Reálné datum, jednoznačný běh/kuchař, evidence hodnot, metoda platná v daný den. |
| F10 příliš obecné větvení |49 tematických obrazovek podle typu a místní práce, související záznamy, návrat na konkrétní téma. |
| Druhý audit: plná dávka vs dodělávka | Dva samostatné vzorky 5 kg/15 min a 1 kg/10 min, srovnání při kompatibilní metodě, fázi a jednotkách. |
| Druhý audit: sběr není očištěný notebook | Funkční CHECK→preview→owner approval→atomic apply→analýzy, ne pouhá poznámka ve starém modelu. |

## Kontrola v prohlížeči

Oddělený localhost 5173 a výhradně syntetická data (Water, Test broth, Test plate apod.). Skutečné produkční odpovědi nebyly zapisovány. Desktop i mobil 390×844: nakupovaný produkt, koriandr a jeho fáze/práce, sada boxů, společná výroba se dvěma výstupy, dodělávka, vyloučená příprava a variantní jídlo. Ověřená šířka stránky 390/390 px, bez horizontálního přetékání stránky; viditelná tlačítka nejméně 44 px.

Důležité výsledky skutečného UI:

- Změna názvu a otevřený CHECK přežily přechod mezi tématy a reload. Datum kontroly přežilo reload po opravě zachycení input události.
- Konkrétní výsledek CHECK byl validován a uzavřen, pozdější změna související identity jej znovu označila ke kontrole.
- Nesplnitelný výběr 3 možností ze 2 blokoval potvrzení; výběr 1 možností byl přípustný.
- Vyloučený výrobní vzorek nezobrazuje dávku, balení, čas ani kapacitu.
- Testovací vlastník provedl preview přejmenování Water, schválení s důkazem a zapracování; výsledkem je „Applied with history“ a zvýšení pouze místní notebook revize.
- STORE-06 uložen přes skutečné UI jako „Confirmed: no storage interval for this state“ s aktérem a datem.
- Stažení recovery skutečně vytvořilo soubor. Automatické nahrání tohoto souboru přes Chrome extension blokovalo její nastavení „Allow access to file URLs“. Importní logika a obnova v reálných handlerech/API jsou testované; skutečný browser upload se proto nevydává za dokončený test.

## Data, migrace a obnova

Před nasazením soukromá záloha mimo repo: notebook rev 317,79 položek,24 receptur, všechny 315 notebook_commands, vlastník a přístupová politika. Produkční data_reviews, data_review_commands a catalog_operations byly prázdné. Existující serverové odpovědi na přípravu a běžné dávky jsou uvnitř notebooku a zůstávají zahrnuté.

Migrace 0004 a 0005 jen přidávají 4 tabulky: review_actions, review_authority, reviewed_entities a review_import_chunks. Oddělená SQLite kopie skutečného notebooku prošla oběma migracemi; payload i revize zůstaly totožné. Drizzle journal a snapshoty jsou součástí zdrojové verze.

Při návratu verze nikdy neobnovovat starý notebook přes novější práci. Nejprve zálohovat aktuální notebook, review, authority, import chunky a veškerou historii; porovnat identity a revize. Starý klient v1 nové review nepřepíše. Bezpečnější oprava je dopředná kompatibilní verze; pokud je nutný návrat UI, v2 sběr se nesmí povolit přes starý nekompatibilní endpoint. Nové tabulky nesmazat.

## Známé hranice

Nebyl proveden pilot se skutečným kuchařem. Aplikace neodvozuje dobu bezpečného skladování ani optimální dávku z dojmu; chybějící podklad musí být doplněn a odpovědná osoba musí ověřit použitelný zdroj. Důkazy jsou přesné dostupné reference dokumentu; nejde o nové veřejné úložiště příloh. Velikost importu je omezená 6.5MB transportu, běžný požadavek 800KB a historie má konzervativní limit pod D1 maximem. Nadlimitní obsah zůstává obnovitelný a dostane konkrétní odmítnutí, ne nekonečný retry.
