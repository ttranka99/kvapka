// assets/js/i18n/locales/cs.js
//
// All UI text of the app, in Czech. Edit the text on the right; leave the
// keys on the left alone — they are how the code finds each string.
//
//   {name}  a value filled in by the app (a number, a page name, …). Keep it,
//           though you may move it anywhere in the sentence.
//   { one: "…", few: "…", many: "…", other: "…" }
//           a string may be a plural set instead of a single text; the form
//           is picked by the {count} value (1 / 2–4 / 5+ in Czech).
//
// A new language is a copy of this file with the same keys (e.g. en.js),
// registered in ../i18n.js.

export default {
  // --- Page -------------------------------------------------------------
  // The browser tab title and the page description for search engines.
  "app.title": "kvapka",
  "app.description": "návrhář rozložení Power BI reportů.",

  // --- Top bar ----------------------------------------------------------
  "topbar.brand": "kvapka",
  "topbar.subtitle": "Návrhář rozložení reportu",
  "topbar.export": "Exportovat rozložení",
  "topbar.notifications": "Oznámení",
  // The CS / EN switch (read by screen readers).
  "topbar.language": "Jazyk",

  // --- Page tabs (top bar) ----------------------------------------------
  "tabs.list": "Stránky reportu",
  "tabs.prev": "Předchozí stránky",
  "tabs.next": "Další stránky",
  "tabs.add": "Přidat stránku",
  "tabs.close": "Odebrat stránku",
  // The name a new page gets until the user renames it.
  "tabs.defaultName": "Page {n}",
  // Shown once at start when the browser won't keep pages between visits.
  "session.storageUnavailable": "Tento prohlížeč neuchovává data mezi návštěvami. Po jeho zavření o své stránky přijdete.",

  // --- Undo / redo (top bar) --------------------------------------------
  "history.group": "Zpět a znovu",
  "history.undo": "Zpět (Ctrl+Z)",
  "history.redo": "Znovu (Ctrl+Y)",

  // --- Project file (top bar "Project" menu) ----------------------------
  // Save / open all pages as a .kvapka.json file.
  "project.menu": "Projekt",
  "project.save": "Uložit projekt",
  "project.open": "Otevřít projekt…",
  // Tooltip on "Open project" while the template editor is open.
  "project.openDisabled": "Nejprve zavřete editor šablony.",
  // {name} is the opened file's name.
  "project.opened": "Otevřen soubor {name}.",
  "project.invalidJson": "Soubor nelze načíst jako projekt: nejde o platný JSON.",
  "project.notProject": "Tento soubor není projekt kvapka.",
  "project.newerVersion": "Projekt byl uložen novější verzí aplikace kvapka a zde ho nelze otevřít.",
  "project.damaged": "Soubor projektu je poškozený nebo ručně upravený, proto nebyl otevřen. Vaše stránky zůstaly beze změny.",
  "project.tooLarge": "Soubor je příliš velký na projekt kvapka.",
  "project.readFailed": "Soubor se nepodařilo přečíst.",

  // --- Notifications (bell panel) ---------------------------------------
  "notifications.title": "Oznámení",
  "notifications.empty": "Žádná oznámení.",
  // Severity label above each toast's message.
  "notifications.type.error": "Chyba",
  "notifications.type.warning": "Upozornění",
  "notifications.type.info": "Info",

  // --- Confirm dialog ---------------------------------------------------
  "dialog.cancel": "Zrušit",

  // --- Left rail --------------------------------------------------------
  "rail.label": "Sekce",
  "rail.template": "Šablona",
  "rail.layout": "Vlastní layout",
  "rail.elements": "Přizpůsobit prvky",
  "rail.about": "O aplikaci",

  // --- About modal (opened from the rail) -------------------------------
  "about.title": "O aplikaci kvapka",
  "about.version": "Verze {version}",
  "about.privacy": "Zásady ochrany soukromí",
  "about.terms": "Podmínky použití",
  "about.changelog": "Seznam změn",
  "about.feedback": "Zpětná vazba a zdrojový kód (GitHub)",
  "about.close": "Zavřít",
  "legal.back": "Zpět",
  "legal.loading": "Načítání…",

  // --- Nápověda (tlačítko ? v liště nebo klávesa ?) ------------------------
  // Část v `obrácených apostrofech` se zobrazí jako kód (název souboru či složky).
  "rail.help": "Nápověda",
  "help.button": "Nápověda (?)",
  "help.title": "Nápověda",
  "help.how.title": "Jak to funguje",
  "help.step1.title": "Vyberte šablonu",
  "help.step1.text": "V panelu Šablona zvolte rozlišení stránky, umístění slicerů a kolik se jich vejde do řady, nebo si sestavte vlastní layout.",
  "help.step2.title": "Přidejte a rozmístěte prvky",
  "help.step2.text": "Slicery a KPI přidáte z postranního panelu, nebo najeďte na okraj karty a klikněte na +. Velikost měníte tažením úchytů mezi kartami, zamknete ji ikonou zámku a po kliknutí na kartu uvidíte její přesnou polohu a rozměry.",
  "help.step3.title": "Exportujte do Power BI",
  "help.step3.text": "Tlačítko Exportovat rozložení stáhne zip se všemi stránkami, připravený pro projekt Power BI.",
  "help.how.note": "Stránky se průběžně ukládají v tomto prohlížeči. Pokud si chcete uložit kopii nebo ji někomu poslat, použijte Projekt › Uložit projekt.",
  "help.import.title": "Import do Power BI (PBIR)",
  "help.import.intro": "Export obsahuje složku `definition/pages` projektu Power BI ve formátu PBIR. Nejde o soubor .pbix a nelze ho otevřít přímo.",
  "help.import.step1": "V Power BI Desktop uložte report jako projekt Power BI (.pbip) ve formátu PBIR. Pokud vaše verze uvádí mezi funkcemi ve verzi Preview volby „Power BI Project (.pbip) save option\" a „Store reports using enhanced metadata format (PBIR)\", nejdřív je zapněte.",
  "help.import.step2": "Zavřete Power BI Desktop.",
  "help.import.step3": "Zálohujte složku projektu a pak ve složce `<název>.Report` smažte složku `definition/pages`.",
  "help.import.step4": "Rozbalte export do složky `<název>.Report`, aby jeho `definition/pages` zaujala její místo.",
  "help.import.step5": "Znovu otevřete soubor .pbip a vizuály-zástupce naplňte svými poli.",
  "help.import.note": "Export nahradí všechny stránky reportu, proto je nejbezpečnější začít s novým, prázdným reportem.",
  "help.keys.title": "Klávesové zkratky",
  "help.keys.colKeys": "Klávesy",
  "help.keys.colAction": "Akce",
  "help.keys.save": "Uložit projekt",
  "help.keys.export": "Exportovat pro Power BI",
  "help.keys.undo": "Zpět",
  "help.keys.redo": "Znovu",
  "help.keys.delete": "Odebrat označený prvek",
  "help.keys.deselect": "Zrušit označení",
  "help.keys.arrows": "Označit sousední prvek",
  "help.keys.rename": "Přejmenovat stránku, na které je fokus",
  "help.keys.help": "Otevřít tuto nápovědu",

  // --- Uvítání (jen při první návštěvě) ------------------------------------
  "welcome.title": "Vítejte v aplikaci kvapka",
  "welcome.intro": "Rozložení stránky reportu Power BI navrhnete ve třech krocích:",
  "welcome.guide": "Zobrazit celý návod",
  "welcome.start": "Začít navrhovat",

  // --- "Přizpůsobit prvky" placeholder section ------------------------------
  "elements.title": "Přizpůsobit prvky",
  "elements.text": "Přizpůsobení elementů (brzy dostupné)",

  // --- Slicer placement (sidebar switch, theme editor, summary) ---------
  "placement.horizontal": "Nahoře",
  "placement.verticalLeft": "Vlevo",
  "placement.verticalRight": "Vpravo",

  // --- Sidebar: Šablona panel -------------------------------------------
  "template.title": "Šablona",
  "template.intro": "Nastavení rozložení a vzhledu reportu",
  "template.resolution": "Rozlišení",
  "template.custom": "Vlastní šablona",
  "template.customButton": "Vlastní šablona…",
  "template.scope": "Platnost šablony",
  "template.scopePage": "Tato stránka",
  "template.scopeAll": "Všechny",
  // Note under the scope switch.
  "template.scopeNote": "Tato stránka: {page} · nové stránky: {default}",
  "template.slicers": "Slicery",
  "template.slicersPerRow": "Slicery na řádek",
  "template.kpisPerRow": "KPI na řádek",
  "template.reset": "Resetovat rozložení",
  // A placement option with no template of that shape yet.
  "template.placementMissingTitle": "Zatím neexistuje šablona s tímto umístěním slicerů, vytvořte ji přes „Vlastní šablona…“.",
  "template.placementMissingNote": "Bez šablony: {list}. Vytvořte novou přes „Vlastní šablona…“.",
  // Template chips.
  "template.chipTitle": "{label} - plátno {width} × {height}",
  "template.chipEdit": "Upravit šablonu {label}",
  // A deleted template a page still uses, kept on that page by value.
  "template.chipDeleted": "{label} (smazáno)",
  // Shown when no default template can be found.
  "template.noDefault": "—",

  // The folded panel's summary.
  "template.summary.resolution": "Rozlišení",
  "template.summary.scope": "Platnost",
  "template.summary.slicers": "Slicery",
  "template.summary.kpi": "KPI",
  "template.summary.perRow": "{count} na řádek",
  "template.summary.placementPerRow": "{placement} · {count} na řádek",

  // --- Sidebar: selected element panel ----------------------------------
  "selection.title": "Označený element",
  "selection.empty": "Klikněte na element v náhledu. Najetím kurzorem se zobrazí ovládací prvky.",
  "selection.type": "Typ",
  "selection.index": "Index",
  "selection.width": "Šířka",
  "selection.height": "Výška",
  "selection.x": "X",
  "selection.y": "Y",
  "selection.editHint": "Dvojklikem upravit hodnotu",
  "selection.editValue": "Upravit hodnotu",
  "selection.editWidth": "Upravit šířku",
  "selection.editHeight": "Upravit výšku",
  "selection.copyValue": "Kopírovat hodnotu",
  "selection.copyWidth": "Kopírovat šířku",
  "selection.copyHeight": "Kopírovat výšku",
  "selection.copyX": "Kopírovat hodnotu X",
  "selection.copyY": "Kopírovat hodnotu Y",
  "selection.apply": "Použít změny",
  // The "Typ" value for each kind of element.
  "selection.kind.header": "Hlavička",
  "selection.kind.slicer": "Slicer",
  "selection.kind.kpi": "KPI",
  "selection.kind.kpiBand": "KPI (pás {n})",
  "selection.kind.chartRow": "Řada grafů",
  "selection.kind.stackChart": "Graf (sloupec)",

  // --- Sidebar: Přidat panel --------------------------------------------
  "add.title": "Přidat",
  "add.slicer": "Slicer",
  "add.kpi": "KPI",
  "add.chart": "Graf",
  // Buttons for KPI bands below the header band.
  "add.kpiBand": "KPI – pás {n}",
  "add.kpiBandMiddle": "KPI – prostřední pás",

  // --- Canvas -----------------------------------------------------------
  "canvas.header": "Hlavička ({width} × {height})",
  "canvas.slicer": "Slicer {n}",
  "canvas.kpi": "KPI {n}",
  "canvas.chart": "Graf {row}.{col}",
  "canvas.stackChart": "Graf {row}.{col}.{stack}",
  // Lock buttons (tooltip shows what a click will do).
  "canvas.lockSlicerWidth": "Zamknout šířku sliceru",
  "canvas.unlockSlicerWidth": "Odemknout šířku sliceru",
  "canvas.lockSlicerHeight": "Zamknout výšku sliceru",
  "canvas.unlockSlicerHeight": "Odemknout výšku sliceru",
  "canvas.lockKpiWidth": "Zamknout šířku KPI",
  "canvas.unlockKpiWidth": "Odemknout šířku KPI",
  "canvas.lockChartHeight": "Zamknout výšku grafu",
  "canvas.unlockChartHeight": "Odemknout výšku grafu",
  "canvas.lockChartWidth": "Zamknout šířku grafu",
  "canvas.unlockChartWidth": "Odemknout šířku grafu",
  "canvas.unlockRowHeight": "Odemknout výšku řady",
  "canvas.unlockChartWidthAndRow": "Odemknout šířku grafu i výšku řady",
  // Remove (×) buttons.
  "canvas.removeSlicer": "Odebrat slicer",
  "canvas.removeKpi": "Odebrat KPI",
  "canvas.removeChart": "Odebrat graf",
  // Add (+) buttons.
  "canvas.addSlicer": "Přidat slicer",
  "canvas.addKpi": "Přidat KPI",
  "canvas.addChartBelow": "Přidat graf pod",
  "canvas.addChartLeft": "Přidat graf vlevo",
  "canvas.addChartRight": "Přidat graf vpravo",
  "canvas.addChartRowBelow": "Přidat řadu grafů pod",

  // --- Notifications: slicers -------------------------------------------
  "warnings.slicer.limit": "Bylo dosaženo maximálního počtu slicerů.",
  "warnings.slicer.columnFull": "Další slicer se do sloupce nevejde, odemkněte výšky nebo odeberte slicer.",
  "warnings.slicer.maxPerRow": "Dosaženo maximálního počtu slicerů na řádek. Následující slicery budou umístěny na další řádek.",
  "warnings.slicer.secondRowLimit": "Druhý řádek slicerů překračuje vybraný limit.",
  "warnings.slicer.secondRowOverflow": "Slicery se do druhého řádku nevejdou, upravte šířky nebo odeberte slicer.",
  "warnings.slicer.columnOverflow": "Slicery se do sloupce nevejdou, snižte zamčené výšky nebo odeberte slicer.",
  "warnings.slicer.manualWidthSum": "Součet ručně nastavených šířek slicerů přesahuje dostupnou šířku.",
  "warnings.slicer.tightFit": "Nedostatek místa, některé slicery mohou být příliš úzké.",
  "warnings.slicer.minHeight": "Minimální výška sliceru je {min}px.",
  "warnings.slicer.heightNoFit": "Zadaná výška se do sloupce nevejde, upravte hodnotu.",
  "warnings.slicer.columnWidthMax": "Šířku sloupce nelze dále zvětšit, odemkněte některé grafy nebo KPI.",

  // --- Notifications: KPI -----------------------------------------------
  "warnings.kpi.limit": "Bylo dosaženo maximálního počtu KPI.",
  "warnings.kpi.bandFull": "Pás KPI „{band}“ je plný, zvyšte limit na řádek nebo odeberte KPI.",
  "warnings.kpi.maxPerRow": "Dosažen maximální počet KPI, následující KPI budou umístěny na další řádek.",
  "warnings.kpi.hardLimit": "Dosaženo maximálního počtu KPI.",
  "warnings.kpi.secondRowLimit": "Druhý řádek KPI překračuje vybraný limit.",
  "warnings.kpi.row1ManualWidthSum": "Součet ručně nastavených šířek KPI přesahuje maximální hodnotu.",
  "warnings.kpi.row1Overflow": "KPI se nevejdou do dostupné šířky, upravte šířky nebo odeberte KPI.",
  "warnings.kpi.row2ManualWidthSum": "Součet ručně nastavených šířek KPI na druhém řádku přesahuje maximální hodnotu",
  "warnings.kpi.row2Overflow": "KPI se nevejdou do dostupné šířky, upravte šířku nebo odeberte KPI.",
  "warnings.kpi.bandOverflow": "KPI v pásu „{band}“ se nevejdou do dostupné šířky, upravte šířku nebo odeberte KPI.",
  "warnings.kpi.bandLimit": "KPI v pásu „{band}“ překračují vybraný limit na řádek.",
  "warnings.kpi.minHeight": "Minimální výška KPI je {min}px.",
  "warnings.kpi.cardsDropped": "Šablona bez pásu KPI - {count} KPIs z odstraněného pásu bylo zahozeno.",

  // --- Notifications: charts --------------------------------------------
  "warnings.chart.allLocked": "Nelze přidat další graf, všechny grafy v řadě jsou uzamčené. Nejprve odemkněte alespoň jeden graf.",
  "warnings.chart.allLockedStackNote": "{message} (U sloupce s více grafy je nutné odemknout všechny grafy v tomto sloupci.)",
  "warnings.chart.noSpace": "Nedostatek prostoru pro přidání dalšího grafu",
  "warnings.chart.tooSmall": "Nelze přidat další graf, ostatní grafy by byly příliš malé.",
  "warnings.chart.adjustRowHeights": "Nelze přidat další graf, nejprve upravte výšky řad grafů.",
  "warnings.chart.removeUnlockRow": "Nelze odebrat graf, nejprve odemkněte alespoň jeden graf v řadě.",
  "warnings.chart.splitTooLow": "Nelze rozdělit graf, řada je příliš nízká (min. {min}px).",
  "warnings.chart.stackAllLocked": "Nelze přidat další graf, všechny grafy ve sloupci jsou uzamčené. Nejprve odemkněte alespoň jeden graf.",
  "warnings.chart.stackTooSmall": "Nelze přidat další graf, grafy ve sloupci by byly příliš malé.",
  "warnings.chart.removeLocked": "Nelze odebrat zamčený graf, nejprve jej odemkněte.",
  "warnings.chart.removeUnlockStack": "Nelze odebrat graf, nejprve odemkněte alespoň jeden graf ve sloupci.",
  "warnings.chart.minWidth": "Minimální šířka grafu je {min}px.",
  "warnings.chart.widthUnlockRow": "Nelze upravit šířku grafu, nejprve odemkněte alespoň jeden graf v řadě.",
  "warnings.chart.stackMinHeight": "Minimální výška grafu ve sloupci je {min}px.",
  "warnings.chart.heightUnlockStack": "Nelze upravit výšku grafu, nejprve odemkněte alespoň jeden graf ve sloupci.",
  "warnings.chart.heightNoFitRow": "Zadaná výška se nevejde do řady, zvolte jinou hodnotu.",
  "warnings.chart.rowMinHeightStack": "Minimální výška řady je {min}px (obsahuje sloupec grafů).",
  "warnings.chart.rowMinHeight": "Minimální výška řady grafů je {min}px.",
  "warnings.chart.singleRow": "Nelze upravit výšku, jediná řada grafů vždy vyplňuje celý dostupný prostor.",
  "warnings.chart.rowUnlockOther": "Nelze upravit výšku řady, nejprve odemkněte alespoň jednu řadu grafů.",

  // --- Notifications: typed sizes (selected element panel) --------------
  "warnings.size.minWidth": "Minimální šířka je 50px.",
  "warnings.size.widthNoFit": "Zadaná šířka se nevejde do prostoru, zvolte jinou hodnotu.",
  "warnings.size.heightNoFit": "Zadaná výška se nevejde do prostoru, zvolte jinou hodnotu.",
  "warnings.size.invalidNumber": "Zadejte platné číslo.",
  "warnings.copyFailed": "Kopírování se nezdařilo.",

  // --- Notifications: templates -----------------------------------------
  "warnings.theme.deleted": "Šablona byla smazána.",
  "warnings.theme.saved": "Šablona „{label}\" byla použita a uložena.",

  // --- Power BI export (error toasts) -----------------------------------
  "export.pageInvalid": "Rozložení na stránce \"{page}\" obsahuje chyby (prvky se nevejdou na plátno), před exportem je opravte.",
  "export.pageEmpty": "Stránka \"{page}\" je prázdná, přidejte alespoň jeden prvek.",
  "export.failed": "Export se nečekaně nezdařil. Stránky zůstaly beze změny, zkuste to prosím znovu.",
  // Informační oznámení po úspěšném exportu; {file} je název zipu.
  "export.done": "Exportováno: {file}. Jak pokračovat, najdete v Nápovědě › Import do Power BI.",

  // --- Template editor: header ------------------------------------------
  "editor.region": "Editor vlastní šablony",
  "editor.name": "Název šablony",
  // Suffix of the name a copied template starts with.
  "editor.copyName": "{label} - kopie",
  "editor.import": "Importovat",
  "editor.importTitle": "Načíst šablonu ze souboru JSON",
  "editor.export": "Exportovat",
  "editor.exportTitle": "Uložit tuto šablonu ve formátu JSON",
  "editor.cancel": "Zrušit",
  "editor.delete": "Smazat",
  "editor.deleteTitle": "Smazat tuto šablonu",
  "editor.save": "Uložit a použít",
  // File name of an exported template; {name} is the template name.
  "editor.exportFileName": "kvapka-sablona-{name}.json",
  "editor.exportFallbackName": "sablona",

  // --- Template editor: controls ----------------------------------------
  "editor.resetToBase": "Výchozí nastavení",
  "editor.placement": "Umístění slicerů",
  "editor.placementLocked": "Umístění slicerů je součástí šablony a po uložení se již nemění. Alternativní variantu vytvoříte formou nové šablony.",
  "editor.dragToAdjust": "Tažením upravíte: {field}",

  // KPI bands list.
  "editor.band.header": "Pás KPI (hlavička)",
  "editor.band.afterRow": "Pás KPI {n} · pod {row}. řadou",
  "editor.band.remove": "Odstranit tento pás KPI",
  "editor.band.count": "Počet KPI",
  "editor.band.secondRow": "Druhý řádek",
  "editor.band.yes": "Ano",
  "editor.band.no": "Ne",
  "editor.band.gapBefore": "Mezera před",
  "editor.band.gapBeforeHint": "Auto: mezera se odvozuje z rozvržení. Malá / velká: mezera je pevně daná bez ohledu na okolí.",
  "editor.band.gapAuto": "Auto",
  "editor.band.gapSmall": "Malá",
  "editor.band.gapBlock": "Velká",
  "editor.band.hint": "Každý pás KPI představuje vlastní úsek v rozvržení reportu, první leží pod hlavičkou, každý další uvnitř plochy grafů.",
  "editor.band.add": "Přidat pás KPI",

  // --- Template editor: preview -----------------------------------------
  "editor.preview.title": "Náhled pravidel",
  "editor.preview.rows": "Ukázkové řady grafů",
  "editor.preview.usable": "Použitelná plocha {width} × {height}",
  "editor.preview.margin": "Okraj plátna · {value} px",
  "editor.preview.header": "Hlavička · {height} px",
  "editor.preview.slicerColumn": "Sloupec slicerů · {width} px ({min}–{max})",
  "editor.preview.slicers": "Slicery · {count}× {width} px · min {min} px · výška {height} px",
  "editor.preview.kpi": "KPI · {count}× {width} px · výška {height} px",
  "editor.preview.charts": "Grafy · řada {height} px (min {min}) · min šířka {width} px",
  "editor.preview.band": "Pás KPI · {count}× {width} px · pod {row}. řadou",
  "editor.preview.gap": "{value} px",
  "editor.preview.moveBand": "Přesunout pás: {label}",
  "editor.preview.moveBandHint": "Tažením, nebo Ctrl + šipkou nahoru / dolů, přesunete tento pás.",

  // Readout under the preview.
  "editor.stat.canvas": "Plátno",
  "editor.stat.usable": "Použitelná plocha",
  "editor.stat.rowHeight": "Výška řady grafů",
  "editor.stat.contentWidth": "Šířka obsahu",
  "editor.stat.step": "Krok mřížky",
  "editor.stat.size": "{width} × {height}",
  "editor.stat.px": "{value} px",

  // --- Template editor: messages ----------------------------------------
  "editor.ok": "Šablona je v pořádku.",
  "editor.nameRequired": "Zadejte název šablony.",
  "editor.confirmDeleteTitle": "Smazat šablonu „{label}“?",
  "editor.confirmDelete": "Stránky, které ji používají, si ponechají její současné nastavení; nové stránky začnou na FULL HD nebo HD.",
  "editor.imported": "Načtena šablona „{label}\".",
  "editor.readFailed": "Soubor se nepodařilo přečíst.",

  // Checks shown under the preview.
  "editor.issue.usableWidth": "Použitelná šířka je menší než 200 px, zmenšete okraj nebo zvětšete plátno.",
  "editor.issue.usableHeight": "Použitelná výška je menší než 200 px, zmenšete okraj nebo zvětšete plátno.",
  "editor.issue.columnTooWide": "Sloupec slicerů zabere téměř celou šířku, pro umístění grafu nezbyde minimální šířka.",
  "editor.issue.slicerRow": "Řádek {count} slicerů potřebuje při minimální šířce {need} px. K dispozici je {available} px.",
  "editor.issue.chartRow": "Řada {count} grafů se při nastavené minimální šířce do plátna nevejde.",
  "editor.issue.height": "Hlavička, slicery a KPI potřebují {need} px na výšku, dostupných je {available} px, grafy se zmenší pod minimum.",
  "editor.issue.step": "Krok mřížky je větší než mezera mezi prvky, rozměry mohou vycházet nepřesně.",
  "editor.issue.manyBands": "Rozvržení má {count} pásů KPI, zvolené nastavení ztěžuje orientaci.",
  "editor.issue.rowsTooSmall": "Při {rows} řadách vychází výška řady pod absolutní minimum {min} px.",

  // --- Saving and importing templates -----------------------------------
  "themeStore.builtinOverwrite": "Vestavěnou šablonu nelze přepsat, uložte ji jako novou.",
  "themeStore.saveFailed": "Šablonu se nepodařilo uložit do paměti prohlížeče (úložiště je nedostupné nebo plné).",
  "themeStore.builtinDelete": "Vestavěnou šablonu nelze smazat.",
  "themeStore.notFound": "Šablona neexistuje.",
  "themeStore.changeFailed": "Změnu se nepodařilo uložit.",
  "themeStore.invalidJson": "Soubor není platným JSON.",
  "themeStore.noThemes": "Soubor neobsahuje žádnou šablonu.",

  // --- Template editor: setting groups ----------------------------------
  "themeGroup.canvas": "Plátno",
  "themeGroup.spacing": "Okraje a mezery",
  "themeGroup.header": "Hlavička",
  "themeGroup.slicers": "Slicery",
  "themeGroup.kpis": "KPI",
  "themeGroup.charts": "Grafy",
  "themeGroup.limits": "Počty slicerů a KPI",
  "themeGroup.limits.note": "První dvě hodnoty určují rozsah, které budou dostupné v polích „Slicery na řádek“ a „KPI na řádek“ v postranním panelu. Počet grafů v řadě omezen není, vychází z minimální šířky grafu.",
  "themeGroup.limits.verticalNote": "První dvě hodnoty určují rozsah, které bude dostupné poli „KPI na řádek“ v postranním panelu. Slicerú ve sloupci se nastavení nedotýká. Počet grafů v řadě omezen není, vychází z minimální šířky grafu.",
  "themeGroup.grid": "Mřížka",

  // --- Template editor: settings ----------------------------------------
  // .label is the setting's name, .hint the explanation under it. The
  // .vertical* variants replace them in a layout with slicers in a column.
  "themeField.canvasWidth.label": "Šířka plátna",
  "themeField.canvasHeight.label": "Výška plátna",
  "themeField.margin.label": "Okraj plátna",
  "themeField.margin.hint": "Volný pás mezi okrajem plátna a použitelnou plochou",
  "themeField.gapSmall.label": "Mezera mezi prvky",
  "themeField.gapSmall.hint": "Základní rozestup mezi sousedními prvky v řádku i mezi řadami vizuálů.",
  "themeField.gapKpiToCharts.label": "Mezera mezi bloky",
  "themeField.gapKpiToCharts.hint": "Širší mezera oddělující logické bloky: slicery od obsahu, KPI od grafů.",
  "themeField.titleHeight.label": "Výška hlavičky",
  "themeField.slicerHeight.label": "Výška sliceru",
  "themeField.slicerHeight.hint": "Pevná výška slicerů ve vodorovném pásu.",
  "themeField.slicerHeight.verticalLabel": "Min. výška sliceru",
  "themeField.slicerHeight.verticalHint": "Minimální (a výchozí) výška jednoho sliceru ve sloupci, od které se odvíjí počet dostupných slicerů.",
  "themeField.minSlicerWidth.label": "Min. šířka sliceru",
  "themeField.slicerColumnWidth.label": "Šířka sloupce",
  "themeField.slicerColumnWidth.hint": "Výchozí šířka svislého sloupce slicerů.",
  "themeField.minSlicerColumnWidth.label": "Min. šířka sloupce",
  "themeField.maxSlicerColumnWidth.label": "Max. šířka sloupce",
  "themeField.slicerFillThreshold.label": "Práh dopnění sloupce",
  "themeField.slicerFillThreshold.hint": "Jakmile slicery při minimální výšce zaplní alespoň tuto část sloupce, roztáhnou se rovnomšrně přes celou výšku.",
  "themeField.kpiMinHeight.label": "Výška KPI",
  "themeField.minChartRowHeight.label": "Min. výška řady",
  "themeField.minChartWidth.label": "Min. šířka grafu",
  "themeField.hardMinChartHeight.label": "Absolutní min. výška",
  "themeField.hardMinChartHeight.hint": "Tvrdé dno, na které se smí graf zmenšit, když se řady jinak na plátno nevejdou.",
  "themeField.minPerRow.label": "Min. slicerů / KPI na řádek",
  "themeField.minPerRow.verticalLabel": "Min. KPI na řádek",
  "themeField.maxPerRow.label": "Max. slicerů / KPI na řádek",
  "themeField.maxPerRow.verticalLabel": "Max. KPI na řádek",
  "themeField.secondRowMaxItems.label": "Max. slicerů / KPI na 2. řádku",
  "themeField.secondRowMaxItems.hint": "Kolik se jich vejde na druhý řádek při zaplnění prvního. Součet s limitem na řádek je absolutní strop, 0 druhý řádek vypne. Prostředního pásu KPI se nastavení netýká, je vždy jednořádkový.",
  "themeField.secondRowMaxItems.verticalLabel": "Max. KPI na 2. řádku",
  "themeField.secondRowMaxItems.verticalHint": "Kolik KPI se vejde na druhý řádek při zaplnění prvního. Součet s limitem na řádek je absolutní strop, 0 druhý řádek vypne. Prostředního pásu KPI se nastavení netýká, je vždy jednořádkový.",
  "themeField.defaultSlicersPerRow.label": "Výchozí slicery na řádek",
  "themeField.defaultSlicersPerRow.hint": "Hodnota, na které stránka s touto šablonou začíná. V postranním panelu ji lze kdykoliv změnit.",
  "themeField.defaultKpisPerRow.label": "Výchozí KPI na řádek",
  "themeField.step.label": "Krok mřížky",
  "themeField.step.hint": "Všechny dopočítané i ručně zadané rozměry přiléhají na násobek této hodnoty."
};
