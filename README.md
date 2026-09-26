<p align="center">
  <img src="assets/img/logo.svg" alt="kvapka logo" width="96" />
</p>

<h1 align="center">kvapka</h1>

<p align="center">
  <strong>Power BI report layout designer</strong><br />
  Design Power BI report layouts in your browser: pick a template, arrange visuals and themes,
  then export a PBIR project ready to open in Power BI Desktop.
</p>

<p align="center">
  <img alt="Version 0.9.0" src="https://img.shields.io/badge/version-0.9.0-2b3038" />
  <img alt="MIT licence" src="https://img.shields.io/badge/licence-MIT-2b3038" />
  <img alt="Vanilla JS" src="https://img.shields.io/badge/vanilla-JS-2b3038" />
</p>

<!-- TODO: add a screenshot, e.g. ![kvapka](assets/img/screenshot.png) -->
<!-- TODO: once the domain is set, add:
<p align="center"><a href="URL"><strong>Open kvapka →</strong></a></p>
-->

> 🇨🇿 The app is in Czech by default and has an English UI too. Switch with the CS / EN toggle in the top bar, or open it with `?lang=en` / `?lang=cs`.

---

## What it is

kvapka is a static web app that helps you plan the grid of a Power BI report page: the header, slicers, KPI cards and chart rows. It calculates exact positions and sizes, then exports placeholder visuals in the **PBIR** format that Power BI Desktop reads.

- **Runs entirely in the browser.** There is no backend, no account and no tracking.
- **Nothing to install.** Open it in a browser and start designing.
- **Self-hosted fonts.** The app makes no requests to third parties.

## Features

- **Layout templates** for common resolutions, with slicers in a band at the top or in a column on the left or right.
- **Slicers, KPI cards and charts.** Add, remove and arrange them, with per-row limits and clear warnings when a layout doesn't fit.
- **Precise resizing.** Chart widths and row heights snap to a 5 px grid, to neighbouring edges and to chart columns in other rows.
- **Size locks** on every card. Cards that block an action pulse to show where the conflict is.
- **Custom template editor** for canvas size, margins, gaps, header and KPI bands, with drag-and-drop band reordering that also works from the keyboard. Templates can be imported and exported as JSON.
- **Multiple pages** in tabs, each with its own template.
- **Export to Power BI.** One zip holds every page as a PBIR `definition/pages` folder.
- **Project files.** Save and open all your pages as a `.kvapka.json` file.
- **Autosave** to the browser, so your work survives a refresh.
- **Undo / redo**, keyboard shortcuts and a notifications panel.
- **Czech and English** UI.

## How it works

1. **Pick a template.** In Studio, use the Template panel to choose the page resolution, where the slicers go and how many fit in a row, or build your own layout.
2. **Add and arrange elements.** Add slicers and KPIs from the sidebar, or hover over a card's edge and click **+**. Drag the handles between cards to resize, lock a size with the lock icon, and click a card to see its exact position and size.
3. **Export to Power BI.** **Export Layout** downloads a zip with every page, ready to go into a Power BI project.

## Importing into Power BI (PBIR)

The export contains the `definition/pages` folder of a Power BI project in PBIR format. It is **not** a `.pbix` file and can't be opened directly.

1. In Power BI Desktop, save the report as a Power BI project (`.pbip`) in PBIR format. If your version lists *"Power BI Project (.pbip) save option"* and *"Store reports using enhanced metadata format (PBIR)"* under Preview features, turn them on first.
2. Close Power BI Desktop.
3. Back up the project folder, then delete the `definition/pages` folder inside `<name>.Report`.
4. Unzip the export into `<name>.Report`, so its `definition/pages` takes that place.
5. Open the `.pbip` again and fill the placeholder visuals with your fields.

> [!WARNING]
> The export replaces **all** of the report's pages, so a new, empty report is the safest place to start.

## Keyboard shortcuts

| Keys | Action |
| --- | --- |
| <kbd>Ctrl</kbd>+<kbd>S</kbd> | Save the project |
| <kbd>Ctrl</kbd>+<kbd>E</kbd> | Export for Power BI |
| <kbd>Ctrl</kbd>+<kbd>Z</kbd> | Undo |
| <kbd>Ctrl</kbd>+<kbd>Y</kbd> / <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> | Redo |
| <kbd>Delete</kbd> / <kbd>Backspace</kbd> | Remove the selected element |
| <kbd>Esc</kbd> | Clear the selection |
| <kbd>←</kbd> <kbd>↑</kbd> <kbd>→</kbd> <kbd>↓</kbd> | Select the neighbouring element |
| <kbd>F2</kbd> | Rename the focused page tab |
| <kbd>?</kbd> | Open Help |

On macOS, use <kbd>⌘</kbd> in place of <kbd>Ctrl</kbd>.

## Project structure

```text
index.html            the app shell and icon sprite
privacy.html          privacy policy (CS / EN)
terms.html            terms of use (CS / EN)
assets/
  style.css           app styles
  theme-editor.css    template editor styles
  fonts/              self-hosted Plus Jakarta Sans (SIL OFL)
  img/                logo and favicons
  js/
    app.js            entry point
    version.js        the running version (single source of truth)
    events/           drag, resize and add/remove handlers per element type
    export/           Power BI PBIR export and the zip writer
    i18n/             translation runtime and locale files (cs, en)
    layout/           pure layout maths: rows, columns, bands, snapping
    state/            app state, undo history, autosave, project files, tabs
    theme/            template model, storage and the template editor
    ui/               rendering, sidebar panels, dialogs, help, shortcuts
```

## Translations

All UI text lives in `assets/js/i18n/locales/`. To add a language:

1. Copy `en.js` to `<code>.js` and translate the values. Keep the keys as they are.
2. Import it and add it to `LOCALES` in `assets/js/i18n/i18n.js`.

`{name}` marks a value the app fills in. You can move it anywhere in the sentence, but keep it. A string can also be a plural set (`{ one, few, many, other }`), chosen by its `{count}`.

## Versioning

kvapka follows [Semantic Versioning](https://semver.org/). The version shown in the app comes from [`assets/js/version.js`](assets/js/version.js). Each release adds a [CHANGELOG](CHANGELOG.md) entry and gets a matching `vX.Y.Z` git tag.

## Feedback and contributing

Found a bug or have an idea? [Open an issue](https://github.com/ttranka99/kvapka/issues/new). You can also use the **Report a bug** and **Suggest an idea** links in the app's About panel, which fill in your version for you.

## Privacy

Your pages, templates and settings are stored only in your browser's `localStorage`. Nothing is sent to a server. See the [privacy policy](privacy.html) and [terms of use](terms.html).

## Licence

kvapka is released under the [MIT licence](LICENSE). © 2026 Tien Tran.

The bundled [Plus Jakarta Sans](assets/fonts/OFL.txt) font is licensed under the SIL Open Font License 1.1.
