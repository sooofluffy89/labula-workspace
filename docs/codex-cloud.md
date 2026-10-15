# Vývoj Workspace 2.0 v Codex Cloud

## Připravený repozitář

Repozitář obsahuje úplné zdroje aplikace ze Sites, npm lockfile, migrace,
regresní kontroly, místní D1 konfiguraci, syntetického vlastníka a `AGENTS.md`.
Používej Node.js 24 a npm. Produkční databáze, fotky, exporty a přihlašovací
tokeny se do cloudového vývoje nepřenášejí.

## Založení současného cloudového prostředí

Podle [oficiální dokumentace Cloud environments](https://learn.chatgpt.com/docs/environments/cloud-environments):

1. V novém chatu vyber **Work in → Cloud → Select environment → Create environment**.
   Alternativně otevři **Settings → Codex Cloud → Environments → Create environment**.
2. Vyber GitHub repozitář `sooofluffy89/labula-workspace` a **Get started**.
3. Pro přípravu použij Node.js 24 a instalační příkaz `npm run cloud:setup`.
4. Ověř `npm run validate`. Vývojový server se spouští `npm run dev` na portu 5173.
5. Zkontroluj výsledek přípravy, ulož nastavení a vyber **Publish**.
6. Po **Environment published** vyber **Start a new task**.

V konfiguraci sítě stačí pro instalaci preset **Package managers**. Vývoj
nepotřebuje přístup do produkčního Sites ani produkční secrets. Nepřidávej tokeny
nebo skutečné uživatelské zálohy jen kvůli testům. Současná oficiální dokumentace
uvádí, že cloudové prostředí nepodporuje ovládání prohlížeče/počítače; regresní
skripty a build lze spouštět bez prohlížeče. Vizuální QA lze dokončit lokálně.

Publikované cloudové prostředí je samostatné nastavení účtu: samotné nahrání
repozitáře ho nevytvoří ani nepublikuje. Po změně jeho instalace ho znovu
publikuj přes **Republish**; existující chaty si ponechávají vlastní stav.

## Příkazy

| Účel | Příkaz |
| --- | --- |
| Čerstvá příprava | `npm run cloud:setup` |
| Uzamčená instalace | `npm run install:ci` |
| Místní migrace a vývojový vlastník | `npm run db:setup:local` |
| Vývojový server | `npm run dev` |
| Typy | `npm run typecheck` |
| Regrese | `npm run check` |
| Worker build | `npm run build` |
| Celé ověření | `npm run validate` |

Příkazy místní databáze mají pevné `--local`; používají placeholder DB a
`.wrangler/state`. Vývojové přihlášení je loopback-only a existuje pouze ve
vývojovém pluginu. `npm run start` je zachovaný místní Wrangler náhled sestaveného
Workeru; nepoužívá vývojové přihlášení a není běžnou cestou pro vývoj UI.

## GitHub a produkční Sites

GitHub repozitář je hlavní pracovní zdroj pro nový vývoj. Produkční aplikace
nadále běží na https://labula-kitchen-recipes.jan984079.chatgpt.site/ . Zachovej
`.openai/hosting.json` a identitu `appgprj_6aa56065ff148191bca78164158e3a4c`.

Publikace se provádí samostatně přes dostupný Sites plugin:

1. Ověř aktuální Site, přístup a novější zdroje v jeho zdrojovém repozitáři.
2. Přenes schválené změny z GitHubu do správného Sites checkoutu. Při souběžných
   změnách sjednoť rozdíly; nepřepisuj vzdálenou historii force pushem.
3. Spusť odpovídající kontroly a build. Zachovej integraci `sites()` a D1/R2.
4. Získej krátkodobý zdrojový credential nativním Sites nástrojem a předej jej
   pouze přes stdin oficiálnímu source helperu. Credential neukládej na disk.
5. Source helper musí pushnout přesně ověřený zdroj a z něj vytvořit deployment
   archiv. Poté použij nativní save/deploy se stejným commitem a archivem.
6. Ověř úspěšný deployment a zachovej dosavadní audience. Nevytvářej nový Site
   ani novou databázi jako náhradu za aktualizaci existující aplikace.

Pokud Sites plugin v cloudovém chatu není dostupný, vývoj a GitHub PR jsou
samostatně proveditelné. Publikaci dokonči v lokálním Codex chatu s dostupným
Sites pluginem. Do GitHub Actions není přidáno žádné produkční nasazování.
