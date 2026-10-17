# LABULA Workspace 2.0 — klikací prototyp

17. října 2026. Návrh sjednocení současné aplikace podle [předchozí analýzy](../menu-composition-analysis-2026-10-17/README.md).

[Otevřít klikací prototyp v Pages](https://chatgpt.com/space/page_ef4426b3b47081918f68e5f9ed1f32a2) · [Samostatný HTML soubor](index.html)

Názvy 19 jídel a 24 variant vycházejí ze současného `lib/menu.ts`. Složení, zásoby a kontroly jsou výslovně ilustrační. Prototyp se nepřipojuje k produkčním API, nemění provozní data a není nasazením změn do aplikace. Výchozí data obsahují 14 aktivních variant, 15 house-made a 27 nakupovaných ingrediencí.

## Co vyzkoušet

1. **Menu → Silken tofu chili → Chilli sauce → Confirm list.** Souhrn se přepočítá ze 7/14 na 12/14 dokončených aktivních variant. Vlastní potvrzení jídla zůstává odlišené od úplnosti jeho závislostí.
2. V pravém panelu přidej více komponent, odeber položku, vrať ji přes Undo removal nebo založ novou z výběru. Množství a poznámky zůstávají u původní vazby. Uprav rozpracované složení, přepni záložku a vrať se; návrh zůstává zachovaný.
3. **House-made** ukazuje všechny vlastní komponenty včetně dosud nepoužitých. **Ingredients** výchozí seznam odvozuje z aktuálního menu i přes house-made vazby a končí na nakupované položce.
4. Označ varianty, změň filtr, zobraz skrytý výběr, otevři náhled změny On/off menu a vyzkoušej Undo. Souhrn rozlišuje počet jídel a variant.
5. **Today → Evening check:** označ sledované položky jako Enough / Needs prep / Needs restock. Publikuj ukázkový plán, přejdi do Morning prep a označ Ready. Následující změna složení nepřepíše uložený plán.
6. Použij **Co vyzkoušet** pro přímé vstupy do scénářů nebo **Obnovit ukázku** pro obnovení dat.

## Rozhraní

Společná hlavička, nízký přehled složení, vyhledávání, filtry, kompaktní tabulka a trvalý pravý panel pro Menu / House-made / Ingredients. Bez přepínače hustoty, skrývání detailu nebo sbalování navigace. Stejný vizuální systém pro Today. Od 760 px jsou seznam a detail vedle sebe; při 560–759 px zůstávají oba zobrazené pod sebou. Pouze při šířce do 559 px se používá mobilní seznam → detail → Back. Otevření položky v nízkém úzkém náhledu posune pracovní plochu k detailu.

Změny se ukládají pouze do odděleného úložiště prototypu v prohlížeči; při nedostupnosti úložiště zůstávají v relaci. V prostředí podporujícím `window.openai.widgetState` se používá i stav vizualizace. Uložení a potvrzení složení mají odlišný význam. Obnova ukázky nezasahuje skutečnou aplikaci.

Prototyp předvádí produktové chování a vztahy, nikoli plnou backendovou implementaci: neprovádí přihlášení, oprávnění, produkční synchronizaci, migraci autoritativních zdrojů ani skutečné výrobní plánování. Today je ilustrační návaznost a sjednocení vzhledu. Výrobní postupy, časy ani povinné gramáže se do tohoto pracovního toku nepřidávají.

## Ověření

[10 funkčních scénářů prošlo](qa-evidence/results.json), bez chyb JavaScriptu. Pokrývají vnořené složení a přepočet zdraví, návrhy po navigaci a reloadu, množství a poznámky, novou ingredienci, cykly, potvrzení neaktivní varianty, skrytý výběr, hromadný náhled a Undo, souběh místního návrhu s hromadnou změnou, filtry metrik, nepřímé použití, publikovaný plán a klávesnicové/mobilní ovládání.

Rozložení bylo prohlédnuté při 1366, 1440, 1920 a 390 px; 720×450 bylo ověřené jako reflow, nikoli fyzické nastavení zoomu. Bez vodorovného přesahu stránky. Desktop má panel 360/400 px, řádky Menu 44 px a viditelnou patičku. Page verze má navíc ověřený lokální náhled 1440 px s funkcí potvrzení a přepočtu 7→12.

Vložení HTML vizualizace do soukromé Page a nastavení celé šířky byly potvrzené zápisem a zpětným přečtením. Skutečné vykreslení uvnitř klienta Pages nelze z tohoto prostředí samostatně zkontrolovat. K dispozici je také identický samostatný HTML soubor.

Oprava skrytého detailu v úzkém náhledu: původní hranice 1000 px nesprávně přepínala i desktopovou Page do mobilního režimu. [Kontrola devíti šířek 390–1440 px](qa-evidence/detail-fix-results.json) po opravě ověřila trvalý detail od 560 px, přepínání položek, vnořené složení, potvrzení s přepočtem 7→12 a Today; bez chyb JavaScriptu a přesahu stránky. Náhled [900 px](qa-evidence/detail-fix-900.png) a [640 px](qa-evidence/detail-fix-640.png). Kontrola typů projektu také prošla.

## Zdroj a reprodukce

- `index.template.html`, `styles.css`, `model.js`, `app.js`: zdroje prototypu.
- `node build.mjs`: vytvoří `index.html` a variantu `page.html` pro vložení do Pages.
- `qa-browser.cjs`: lokální prohlížečové scénáře se syntetickými daty.
- [Menu desktop](qa-evidence/example-menu-1440.png), [House-made](qa-evidence/example-house-made-1440.png), [Ingredients](qa-evidence/example-ingredients-1440.png), [Today](qa-evidence/example-today-1440.png), [mobilní detail](qa-evidence/example-detail-390.png).

Aplikační soubory v `app/`, `lib/`, databáze ani produkční Sites deployment se tímto návrhem nemění.
