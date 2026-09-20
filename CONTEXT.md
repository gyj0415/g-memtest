# Project Context

## Purpose

This repository contains a static self-test website for enterprise management and technical economics.

## Current Product

The main product is a browser-based question-bank self-test site. It starts on a home page, loads built-in question banks from `site/banks/`, groups banks into expandable collections, and keeps practice state in localStorage. Local `npm start` unlocks a studio page that can write, overwrite, and delete built-in banks (JSON under `site/banks/`, images under `site/images/<bankId>/`). The converter can download a ZIP (JSON + images) for the online site to import. GitHub Pages is not used; publish `site/` to Netlify.

## Domain Vocabulary

- **Question bank**: A JSON collection of questions imported into the self-test site.
- **Bank switcher**: The UI control for switching between locally saved question banks.
- **Bank group**: A named collection that folds several question banks together on the home page and sidebar. Users click a group to expand it. Stored as `group` on each bank JSON and in `site/banks/manifest.json`.
- **Bank catalog import**: A JSON payload with a `banks` array, used to import a whole set of grouped question banks at once.
- **Practice state**: A user's local answers, scoring results, answer visibility, order, and view mode for one question bank.
- **Studio**: Local operator page (`site/studio.html`) available after `npm start`. Writes, overwrites, and deletes built-in banks on disk.
- **Converter**: Page that turns prompt-format markdown into banks, attaches images, downloads ZIP online, and can write built-in banks only when the local server is running.
- **Bank package**: A ZIP with JSON plus image files. The homepage import accepts `.zip` as well as `.json`.
- **Upload package**: The static files intended for deployment to a permanent hosting service.

## Layout Notes

- The deployable static site lives under `site/`.
- Repository-level agent configuration lives under `docs/agents/`.
- Architectural decisions should be recorded under `docs/adr/`.

## Application Map

### Main self-test site

`site/index.html` is the main single-file application. It contains:

- The hero and toolbar controls for bank switching, import/export, filters, full submission, missed-question review, and reset.
- The home page and sidebar question-bank selection, grouped into expandable bank groups.
- The built-in question-bank catalog loader.
- Question-bank normalization and import parsing.
- A multi-bank local storage library keyed by `enterprise-management-bank-library-v1`.
- Per-bank practice state, including answers, scores, visible answers, order, current index, and expanded mode.
- Text-answer scoring, choice-question scoring, feedback rendering, and progress summaries.

### Question-bank converter and studio

`site/converter.html` turns prompt-format markdown into importable banks and can attach images. Online it downloads ZIP. Locally (`npm start`) it can also write built-in banks.

`site/studio.html` is the local operator: list/delete built-in banks, preview markdown with a circle image picker, write banks to disk, and pack `site/` as a zip.

### Upload package

`site/` is the publish root. It currently contains:

- `index.html`
- `converter.html`
- `studio.html` (write APIs only work with `npm start`)
- `banks/`
- `images/`
- `template.json`
- `README.md`

For static hosting, this package is the safest publish root unless the workspace is reorganized into a dedicated website repo.

## Git Publishing Notes

The parent workspace may contain unrelated or sensitive-adjacent materials, including personal documents, course documents, SolidWorks files, temporary files, and generated PDFs. This repository is intentionally kept in `g-memtest/` so only the website project is versioned.

- **Git scope**: version the clean `g-memtest/` repository only.
- **Netlify scope**: upload the zip generated at the parent workspace root from `g-memtest/site/`.

Do not push the parent workspace publicly.

GitHub Pages is not currently configured for this repo.
