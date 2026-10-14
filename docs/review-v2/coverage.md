# Pokrytí review v2

Mapa závazného návrhu z 19.9.2026. Každá skupina má konkrétní adaptivní pole, ne jen nadpis; sdílená definice řídí UI, aktivní projekci a serverové kontroly. A02 zůstává vyloučeno.

## 49 skupin

| Otázka | UI | Uložená struktura | Serverová kontrola / scénář |
|---|---|---|---|
| SET-01: Who is answering, and whose work are you describing? | /review → session → Who is answering, and whose work are you describing? | entities[].answers[SET-01], stabilní řádky + confirmations | fieldIssues + issues + potvrzení při save2; check-review-readiness / check-review-ui |
| SET-02: Is this what you do now? | /review → session → Is this what you do now? | entities[].answers[SET-02], stabilní řádky + confirmations | fieldIssues + issues + potvrzení při save2; check-review-readiness / check-review-ui |
| SET-03: When is this kitchen open, and when can preparation take place? | /review → session → When is this kitchen open, and when can preparation take place? | entities[].answers[SET-03], stabilní řádky + confirmations | fieldIssues + issues + potvrzení při save2; check-review-readiness / check-review-ui |
| SET-04: Which period can you describe from records? | /review → session → Which period can you describe from records? | entities[].answers[SET-04], stabilní řádky + confirmations | fieldIssues + issues + potvrzení při save2; check-review-readiness / check-review-ui |
| MENU-01: Is this exact dish and variant currently served here? | /review → dish → Is this exact dish and variant currently served here? | entities[].answers[MENU-01], stabilní řádky + confirmations | fieldIssues + issues + potvrzení při save2; check-review-boundaries / check-review-readiness |
| MENU-02: What changes between these variants? | /review → dish → What changes between these variants? | entities[].answers[MENU-02], stabilní řádky + confirmations | fieldIssues + issues + potvrzení při save2; check-review-boundaries / check-review-readiness |
| ITEM-01: What exactly is this item? | /review → item → What exactly is this item? | entities[].answers[ITEM-01], stabilní řádky + confirmations | fieldIssues + issues + potvrzení při save2; check-review-boundaries / check-review-workflow |
| ITEM-02: How do you receive this item? | /review → item → How do you receive this item? | entities[].answers[ITEM-02], stabilní řádky + confirmations | fieldIssues + issues + potvrzení při save2; check-review-boundaries / check-review-workflow |
| ITEM-03: What do you actually do to it here? | /review → item → What do you actually do to it here? | entities[].answers[ITEM-03], stabilní řádky + confirmations | fieldIssues + issues + potvrzení při save2; check-review-boundaries / check-review-workflow |
| ITEM-04: Is the item before this step the same as the item used on the plate? | /review → item → Is the item before this step the same as the item used on the plate? | entities[].answers[ITEM-04], stabilní řádky + confirmations | fieldIssues + issues + potvrzení při save2; check-review-boundaries / check-review-workflow |
| ITEM-05: Where is this product used? | /review → item → Where is this product used? | entities[].answers[ITEM-05], stabilní řádky + confirmations | fieldIssues + issues + potvrzení při save2; check-review-boundaries / check-review-workflow |
| PROC-01: Which single process produces or changes this product? | /review → process → Which single process produces or changes this product? | entities[].answers[PROC-01], stabilní řádky + confirmations | fieldIssues + issues + potvrzení při save2; check-review-workflow / check-review-boundaries |
| PROC-02: What goes into this process? | /review → process → What goes into this process? | entities[].answers[PROC-02], stabilní řádky + confirmations | fieldIssues + issues + potvrzení při save2; check-review-workflow / check-review-boundaries |
| PROC-03: What comes out of this same process? | /review → process → What comes out of this same process? | entities[].answers[PROC-03], stabilní řádky + confirmations | fieldIssues + issues + potvrzení při save2; check-review-workflow / check-review-boundaries |
| PROC-04: Are these products made by one shared process, or just at the same time? | /review → process → Are these products made by one shared process, or just at the same time? | entities[].answers[PROC-04], stabilní řádky + confirmations | fieldIssues + issues + potvrzení při save2; check-review-workflow / check-review-boundaries |
| PROC-05: What part is within this review? | /review → process → What part is within this review? | entities[].answers[PROC-05], stabilní řádky + confirmations | fieldIssues + issues + potvrzení při save2; check-review-workflow / check-review-boundaries |
| RUN-01: Which one production run are you describing? | /review → run → Which one production run are you describing? | entities[].answers[RUN-01], stabilní řádky + confirmations | fieldIssues + issues + potvrzení při save2; check-review-workflow / check-review-readiness / check-review-boundaries |
| RUN-02: How much of each input did you use in this run? | /review → run → How much of each input did you use in this run? | entities[].answers[RUN-02], stabilní řádky + confirmations | fieldIssues + issues + potvrzení při save2; check-review-workflow / check-review-readiness / check-review-boundaries |
| RUN-03: What usable amount came out of this run? | /review → run → What usable amount came out of this run? | entities[].answers[RUN-03], stabilní řádky + confirmations | fieldIssues + issues + potvrzení při save2; check-review-workflow / check-review-readiness / check-review-boundaries |
| RUN-04: How is this output packed or counted? | /review → run → How is this output packed or counted? | entities[].answers[RUN-04], stabilní řádky + confirmations | fieldIssues + issues + potvrzení při save2; check-review-workflow / check-review-readiness / check-review-boundaries |
| RUN-05: Have we captured everything from this run? | /review → run → Have we captured everything from this run? | entities[].answers[RUN-05], stabilní řádky + confirmations | fieldIssues + issues + potvrzení při save2; check-review-workflow / check-review-readiness / check-review-boundaries |
| RUN-06: Which hands-on steps are included? | /review → run → Which hands-on steps are included? | entities[].answers[RUN-06], stabilní řádky + confirmations | fieldIssues + issues + potvrzení při save2; check-review-workflow / check-review-readiness / check-review-boundaries |
| RUN-07: How much active work did this step take? | /review → run → How much active work did this step take? | entities[].answers[RUN-07], stabilní řádky + confirmations | fieldIssues + issues + potvrzení při save2; check-review-workflow / check-review-readiness / check-review-boundaries |
| RUN-08: When is the product ready, and what happens while it waits? | /review → run → When is the product ready, and what happens while it waits? | entities[].answers[RUN-08], stabilní řádky + confirmations | fieldIssues + issues + potvrzení při save2; check-review-workflow / check-review-readiness / check-review-boundaries |
| RUN-09: What changes when you make a small top-up? | /review → run → What changes when you make a small top-up? | entities[].answers[RUN-09], stabilní řádky + confirmations | fieldIssues + issues + potvrzení při save2; check-review-workflow / check-review-readiness / check-review-boundaries |
| RUN-10: What batch range have you actually managed with the current setup? | /review → run → What batch range have you actually managed with the current setup? | entities[].answers[RUN-10], stabilní řádky + confirmations | fieldIssues + issues + potvrzení při save2; check-review-workflow / check-review-readiness / check-review-boundaries |
| STORE-01: In which state do you actually keep this product? | /review → storage → In which state do you actually keep this product? | entities[].answers[STORE-01], stabilní řádky + confirmations | fieldIssues + issues + potvrzení při save2; check-review-workflow / check-review-boundaries |
| STORE-02: Where and how is this state kept? | /review → storage → Where and how is this state kept? | entities[].answers[STORE-02], stabilní řádky + confirmations | fieldIssues + issues + potvrzení při save2; check-review-workflow / check-review-boundaries |
| STORE-03: For how long does this state meet your required quality? | /review → storage → For how long does this state meet your required quality? | entities[].answers[STORE-03], stabilní řádky + confirmations | fieldIssues + issues + potvrzení při save2; check-review-workflow / check-review-boundaries |
| STORE-04: Which documented use-by rule applies to this exact state? | /review → storage → Which documented use-by rule applies to this exact state? | entities[].answers[STORE-04], stabilní řádky + confirmations | fieldIssues + issues + potvrzení při save2; check-review-workflow / check-review-boundaries |
| STORE-05: What happens at opening, cooling, freezing, thawing or repacking? | /review → storage → What happens at opening, cooling, freezing, thawing or repacking? | entities[].answers[STORE-05], stabilní řádky + confirmations | fieldIssues + issues + potvrzení při save2; check-review-workflow / check-review-boundaries |
| STORE-06: Has the responsible person checked that this rule applies here? | /review → storage → Has the responsible person checked that this rule applies here? | entities[].answers[STORE-06], stabilní řádky + confirmations | Owner action / fieldIssues / readiness; check-review-workflow / check-review-boundaries |
| DISH-01: What is on one served plate of this exact variant? | /review → dish → What is on one served plate of this exact variant? | entities[].answers[DISH-01], stabilní řádky + confirmations | fieldIssues + issues + potvrzení při save2; check-review-workflow / check-review-readiness |
| DISH-02: How do the choices work? | /review → dish → How do the choices work? | entities[].answers[DISH-02], stabilní řádky + confirmations | fieldIssues + issues + potvrzení při save2; check-review-workflow / check-review-readiness |
| DISH-03: How much of this component goes into one served portion? | /review → dish → How much of this component goes into one served portion? | entities[].answers[DISH-03], stabilní řádky + confirmations | fieldIssues + issues + potvrzení při save2; check-review-workflow / check-review-readiness |
| DISH-04: What work happens after the order arrives? | /review → dish → What work happens after the order arrives? | entities[].answers[DISH-04], stabilní řádky + confirmations | fieldIssues + issues + potvrzení při save2; check-review-workflow / check-review-readiness |
| DISH-05: Does this match the plate you actually serve? | /review → dish → Does this match the plate you actually serve? | entities[].answers[DISH-05], stabilní řádky + confirmations | fieldIssues + issues + potvrzení při save2; check-review-workflow / check-review-readiness |
| OPS-01: What actually triggers the next run of this process? | /review → operations → What actually triggers the next run of this process? | entities[].answers[OPS-01], stabilní řádky + confirmations | fieldIssues + issues + potvrzení při save2; check-review-readiness / independent closure retest |
| OPS-02: How often did each kind of event actually happen? | /review → operations → How often did each kind of event actually happen? | entities[].answers[OPS-02], stabilní řádky + confirmations | fieldIssues + issues + potvrzení při save2; check-review-readiness / independent closure retest |
| OPS-03: Which of these recorded problems still happens? | /review → operations → Which of these recorded problems still happens? | entities[].answers[OPS-03], stabilní řádky + confirmations | fieldIssues + issues + potvrzení při save2; check-review-readiness / independent closure retest |
| OPS-04: What extra work or service delay did that event cause? | /review → operations → What extra work or service delay did that event cause? | entities[].answers[OPS-04], stabilní řádky + confirmations | fieldIssues + issues + potvrzení při save2; check-review-readiness / independent closure retest |
| OPS-05: What happened to unused product? | /review → operations → What happened to unused product? | entities[].answers[OPS-05], stabilní řádky + confirmations | fieldIssues + issues + potvrzení při save2; check-review-readiness / independent closure retest |
| OPS-06: Could another cook repeat this actual method? | /review → operations → Could another cook repeat this actual method? | entities[].answers[OPS-06], stabilní řádky + confirmations | fieldIssues + issues + potvrzení při save2; check-review-readiness / independent closure retest |
| CHECK-01: How will we obtain this missing fact? | /review → manager → How will we obtain this missing fact? | entities[].answers[CHECK-01], stabilní řádky + confirmations | fieldIssues + issues + potvrzení při save2; check-review-workflow / check-review-ui / check-review-boundaries |
| CHECK-02: What was the result of this check? | /review → manager → What was the result of this check? | entities[].answers[CHECK-02], stabilní řádky + confirmations | fieldIssues + issues + potvrzení při save2; check-review-workflow / check-review-ui / check-review-boundaries |
| APPROVE-01: Which source data support the analysis? | /review → manager → Which source data support the analysis? | entities[].answers[APPROVE-01], stabilní řádky + confirmations | Owner action / fieldIssues / readiness; check-review-workflow / check-review-readiness / check-review-ui |
| APPROVE-02: What can we already conclude from these answers? | /review → manager → What can we already conclude from these answers? | entities[].answers[APPROVE-02], stabilní řádky + confirmations | fieldIssues + issues + potvrzení při save2; check-review-workflow / check-review-readiness / check-review-ui |
| APPROVE-03: Which corrections should become the current notebook? | /review → manager → Which corrections should become the current notebook? | entities[].answers[APPROVE-03], stabilní řádky + confirmations | Owner action / fieldIssues / readiness; check-review-workflow / check-review-readiness / check-review-ui |
| APPROVE-04: What is finished, and what remains to be measured? | /review → manager → What is finished, and what remains to be measured? | entities[].answers[APPROVE-04], stabilní řádky + confirmations | fieldIssues + issues + potvrzení při save2; check-review-workflow / check-review-readiness / check-review-ui |

## 25 cílených karet

| Karta | Konkrétní otázka | Návazné strukturované otázky |
|---|---|---|
| T01 | What did the recorded 48 portions refer to? | RUN-01, RUN-03, RUN-04, ITEM-05, DISH-03 |
| T02 | Is this a mixed product, a kit of separate boxes, or a separate ingredient? | ITEM-01, PROC-02, RUN-04, RUN-07, DISH-01 |
| T03 | Do you buy minced pork today or mince meat here? | ITEM-02, PROC-02, RUN-04, RUN-07 |
| T04 | What does 2 / 2 frozen plastic cubes count? | RUN-03, RUN-04, STORE-01 |
| T05 | What does 2 rice cookers count? | RUN-01, RUN-02, RUN-03, RUN-10, STORE-01, OPS-02 |
| T06 | Which operation does the recorded portion or piece count describe? | RUN-01, RUN-03, RUN-04, DISH-03 |
| T07 | What exactly is shared with braised beef shank? | PROC-02, PROC-04, PROC-05, OPS-02 |
| T08 | Which outputs come from the same cook, and which are made later? | PROC-02, PROC-03, PROC-04, PROC-05 |
| T09 | Does the recorded 15 minutes cover a full batch, top-up or whole day? | RUN-03, RUN-04, RUN-06, RUN-07, RUN-09 |
| T10 | At which step was the net usable output measured? | ITEM-01, RUN-03, RUN-04, RUN-10, STORE-01 |
| T11 | Are these the same prepared mushrooms and sauce used in the starter? | ITEM-01, PROC-02, PROC-04, RUN-06, DISH-01 |
| T12 | How does this relate to the other base, and is the routine current? | ITEM-01, PROC-02, PROC-04, RUN-01, OPS-01 |
| T13 | Is this a separate production, part of another production or supplied? | ITEM-02, PROC-01, PROC-03, RUN-01, OPS-01 |
| T14 | Who provides this product, in which state, and what is still done here? | ITEM-02, ITEM-03, PROC-01 |
| T15 | What is actually done to this bought item before service? | ITEM-03, ITEM-04, PROC-01, RUN-06 |
| T16 | What does the recorded temperature represent? | STORE-01, STORE-02, STORE-04, STORE-06 |
| T17 | Which state does the six-hour quality period describe? | ITEM-04, STORE-01, STORE-03, OPS-05 |
| T18 | Which exact package is opened when this clock starts? | STORE-01, STORE-04, STORE-05, STORE-06 |
| T19 | Are these two listings the same dish, different dishes or historical duplicates? | MENU-01, DISH-01, APPROVE-01 |
| T20 | Which tofu and meat variants can a guest order today? | MENU-01, MENU-02, DISH-01, DISH-02 |
| T21 | Are these the real differences between Standard and MAX, including cooked oil? | MENU-02, DISH-01, DISH-03 |
| T22 | Does every serving contain all listed components, or does the guest choose? | DISH-01, DISH-02, DISH-03 |
| T23 | Which exact version is served now, and what is its effective date? | MENU-01, MENU-02, ITEM-01, DISH-01 |
| T24 | Is this current practice, a past issue or a future proposal? | SET-02, MENU-01, OPS-01, OPS-03, OPS-06 |
| T25 | Do the two labour answers describe the same output, batch size and tasks? | RUN-01, RUN-06, RUN-07, RUN-09 |

Odpověď na kartu je uložená jako targeted[card:entity].meaning. Je to vysvětlení starého záznamu; sama nepotvrzuje nové množství ani nenahrazuje návazné otázky. Karty jsou u příslušných pojmenovaných produktů a souvisejících výrob.

## 57 původních bodů

| Bod | Navazující bloky/karty | Rozsah a důvod |
|---|---|---|
| A01 | SET, MENU | covered: Potvrdit současné varianty a datum; plánované změny držet odděleně. |
| A02 | SET | excluded: Na výslovný pokyn uživatele neřešit rozdělování Vinohrady/Manifesto. U čtyř pojmenovaných položek vyloučit dávky, frekvence a čas; složení a místní skladování zůstává v jiných blocích. |
| A03 | MENU, T24 | covered: Aktuální stav, účinnost vyřazení/náhrady, návazné receptury. Beef skewer bez výrobních metrik. |
| A04 | T19, APPROVE | covered: Kids/Children: identita, pickles, následně skutečné POS mapování. |
| A05 | T23, MENU, DISH | covered: Konkrétní aktuální rotující receptura; placeholder se nepočítá jako ingredience. |
| A06 | ITEM, DISH, APPROVE | covered: Jiné místní odběry: přílohy, personál, další prodej; žádné rozdělování do jiného provozu. Cold Xiao Mian a Dragon Mom nepotvrzovat automaticky jako aktivní. |
| A07 | ITEM, T02, T11, T12 | covered: Přejmenování a aliasy podle identity/fáze, bez sloučení pouze podle podobného názvu. |
| B01 | PROC, ITEM | partly_scoped: Všech 41 zdrojových house-made položek vyjasnit podle skutečného původu. U čtyř vyloučených zachovat názvy vstupů a vztahy, bez výrobních množství. |
| B02 | PROC, RUN, T08 | partly_scoped: Všechny výstupy jedné operace; společná práce jednou. Při neoddělitelné vazbě na vyloučenou výrobu nesbírat společné metriky a neprezentovat úplný součet. |
| B03 | T02, PROC, RUN | covered: Sada versus směs versus samostatná ingredience, složení boxů, vlastník 30 minut, původ boxu 4. |
| B04 | T07, T08, PROC | partly_scoped: Potvrdit mapu a opakované médium; braised beef shank výrobní metriky a neoddělitelnou společnou práci vynechat. |
| B05 | T11, PROC, DISH | covered: Woodear: společná příprava, skutečné složení a kroky jen jednou. |
| B06 | T03, T14, ITEM | covered: Zdroj a stav převzetí, místní práce; budoucí nákup minced pork není současnost. |
| B07 | T15, ITEM, PROC, RUN | covered: Všech 11 koupených položek s reálnou místní prací; nevytvářet profil výroby hotovým nakoupeným položkám bez práce. |
| C01 | T01, RUN, DISH | covered: 48 porcí: přesná událost, převod, čistý výstup a odběry. Společná výroba respektuje rozsah. |
| C02 | T02, RUN | covered: Význam 4/16 a různé typy boxů bez dvojího násobení. |
| C03 | T03, T04, RUN | covered: 3/3 bags a 2/2 cubes: celkový počet, čistý obsah a fáze. |
| C04 | RUN, T02, T03, T04, T09, T10 | partly_scoped: Převody konkrétních obalů; fried peanuts výrobní balení a dávku vynechat. Místní obal ve STORE není počet vyrobených obalů. |
| C05 | T05, T09, T10, RUN | covered: Čistý výstup po odpovídající fázi; kapacita/počet zařízení odděleně. |
| C06 | T06, RUN, DISH | covered: Nudlová operace a fáze, kusy vajec versus zlomky na porci, ztráty. |
| C07 | T13, PROC, RUN | covered: Nejdříve původ a vazba, poté chybějící množství; nula není nevím. |
| C08 | RUN, T03, T08, T12 | partly_scoped: Fáze vstup/hotové/odkapané/rozmražené. Braised beef shank a beef skewer výrobní množství vynechat; cooked oil určit účel. |
| D01 | T07, OPS, RUN | partly_scoped: Poslední dvě data feet a význam intervalu; 40 minut nesčítat se společným vyloučeným shank. |
| D02 | T13, OPS | covered: Poslední skutečná výroba, spouštěč a režim; neznámá data zůstávají konkrétním úkolem. |
| D03 | RUN, PROC | partly_scoped: Lidé, aktivní čas, čekání, kompletní rozsah úkonů, souběh; čtyři výjimky bez pracovních časů. |
| D04 | T01, T05, T08, T09, T10, RUN, OPS | covered: Dávka versus den, plná výroba versus dodělávka/ohřev; skutečné servisy. |
| D05 | T25, RUN, CHECK | partly_scoped: Rozdílné velikosti, úkony, kuchaři nebo změna procesu; fried peanuts a chili mayo ze srovnání pracovních časů vynechat. |
| D06 | T12, OPS | covered: Dnešní pondělní rutina versus návrh, datum platnosti a doložené události. |
| D07 | T24, OPS | partly_scoped: Nenapsaná rutina, práh nebo nouze; odpovědnost. Chili mayo výrobní četnost/čas neobnovovat tímto dotazem. |
| D08 | T13, PROC, RUN | covered: Neznámý čas versus již zahrnutý v jiné výrobě; datum ukončení, pokud vyřazeno. |
| E01 | T05, STORE | covered: Suchá syrová, horké držení a chlazená rýže jako různé reálné fáze. |
| E02 | T16, STORE | covered: Teplotní zdroj a oddělené zmrazené/rozmražené fáze; u shank pouze místní skladování. |
| E03 | T18, STORE | covered: Konkrétní otevřený obal a počátek pravidla; nepočítat novou bezpečnou lhůtu od každého přebalení. |
| E04 | T17, STORE, OPS | covered: Šest hodin konkrétního stavu koriandru, oddělené mytí/krájení a osud zbytku. |
| E05 | STORE, CHECK | covered: Neznámá kvalita má přesný stav a ověření; není automatický bezpečnostní limit. |
| E06 | STORE, CHECK, APPROVE | covered: Zkušenost versus doložené pravidlo, dokument, podmínky a odpovědné schválení. |
| E07 | T18, STORE, CHECK | covered: Přesný produkt/etiketa; zda pravidlo opravdu platí po otevření. |
| E08 | STORE | covered: Obal, místní umístění, rezervní zásoba a otevřený výdej jako různé fáze. |
| E09 | STORE, RUN, T05, T10 | partly_scoped: Tok po vaření a ověřená kapacita, nikoli hypotetický souhlas s větší dávkou. U shank bez velikosti výrobní dávky a pracovních časů; místní skladování zachovat. |
| E10 | ITEM, STORE | covered: Konkrétní produkt a fáze u prášků/olejů/směsí; všechny neznámé stavy zodpovědět či adresně ověřit. |
| F01 | T20, DISH, APPROVE | covered: Reálné varianty a složky; dietní tvrzení neodvozovat z názvu tofu. |
| F02 | T21, DISH | covered: Skutečný rozdíl Standard/MAX včetně cooked oil; shank pouze složení/porce. |
| F03 | T22, DISH | covered: Pevné složky, alternativní skupiny a kombinovatelnost; žádné součty všech voleb najednou. |
| F04 | T23, T14, DISH | covered: Obě nudlové a feet varianty, původ ingrediencí i společné/rozdílné kroky. |
| F05 | DISH, RUN | covered: Množství na vydanou porci a fáze s podkladem; není výrobní množství. Neznámé hodnoty mají měřicí úkol. |
| F06 | DISH | covered: Výdej po objednávce, porce, práce a čekání odděleně; přípravu základu neopakovat. U výjimek neznovu sbírat jejich výrobní čas. |
| F07 | DISH, PROC, APPROVE | covered: Kontrola skutečného talíře a skrytých složek; nezdvojit hotový celek a jeho již obsažené části. |
| G01 | OPS, CHECK | partly_scoped: Konkrétní datum/událost a dopad; u shank a skewer bez jejich výrobních minut, dávek a frekvencí. |
| G02 | T24, OPS, CHECK | covered: Problémy v poznámce versus none; současnost a zastupitelnost/SOP, nikoli automatická značka problému. |
| G03 | OPS | partly_scoped: Zůstatek, odpad, personál, přesun a technologická ztráta odděleně. Čtyři výjimky nevyvolají otázky na výrobní množství; místní spotřebu/odpis lze samostatně evidovat, je-li známý. |
| G04 | RUN, STORE | partly_scoped: Praktická kapacita/podklad, žádná lineární úspora; shank a skewer výrobní min/max a časy vynechat. |
| G05 | OPS | partly_scoped: Večerní zásoba, stáří, rozmrazení, poptávka, vlastník a převzetí; bez dopočítávání dávek/frekvencí čtyř výjimek. |
| H01 | APPROVE, MENU, T19 | manager: Vedoucí mapuje POS včetně Stir-fry Pork/Sour & Spicy a Kids/Children; dodá stejné aktuální období a výpadky. Bez nového exportu nenahradit odhadem kuchaře. |
| H02 | RUN, OPS, CHECK | measurement: Pět prioritních příprav: konkrétní měření plné dávky i dodělávky, výkon, zůstatek, spouštěč. Pokud měření neexistuje, naplánovat; nezadávat zpětně vymyšlený deník. |
| H03 | APPROVE, CHECK | manager_partly_scoped: Náklady dodá vedoucí z dokladů. Brown sauce a minced pork lze porovnat při stejném podkladu; výrobní ekonomiku beef skewer nelze uzavřít bez vyřazených metrik a nyní ji nedopočítávat. |
| H04 | SET, CHECK, APPROVE | covered: Dohledatelná změna, důkaz, autor, účinnost a řízené promítnutí proti aktuálnímu notebooku. |
| H05 | RUN, CHECK | measurement_partly_scoped: Druhý kuchař nezávisle pro stejnou velikost a úkony; rozdíly vysvětlit, neprůměrovat. Čtyři výjimky bez sběru výrobních metrik. |

##Procesní kontroly

- Koncept → save2: SaveQueue, úplná recovery včetně původního pending requestu; check-review-ui a check-review-workflow.
- CHECK → oprava původních polí → closeCheck: konkrétní cíle, evidence, osoba a datum, hash závislostí; prázdné povinné pole není „not applicable“.
- STORE-06: serverové právo vlastníka; pozitivní i negativní závěr s důkazem; změna podmínek nebo novější negativní ověření zneplatní použitelnost.
- Preview → approve → apply: třícestné srovnání, ochrana aktuálních revizí, atomická transakce a receipt. Notebook i approved sidecar jsou skutečně aktualizovány.
- Alias: bezpečný merge katalogu včetně receptur, konfliktů profilů a přenosu ochrany čtyř vyloučených identit.
- Čerstvá schválená výrobní data potlačují staré odhady dotčených produktů; společná práce se neduplikuje na výstupy.
- Archiv importu: samostatné soukromé chunky, UTF-8 hranice, receipt SHA-256, atomické opakování; testované selhání všech kroků.

Stavy připravenosti nejsou automaticky úspora ani optimální dávka. Jejich pravidla zahrnují známé období, variantu, fyzickou fázi, zdroj, měření a hranice platnosti.
