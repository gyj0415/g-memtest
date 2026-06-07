# Project Context

## Purpose

This repository contains a static self-test website for enterprise management and technical economics.

## Current Product

The main product is a browser-based question-bank self-test site. It starts on a home page, loads built-in question banks from standalone JSON files, supports local question-bank import/export, switching between multiple banks from the sidebar, answer persistence per bank, scoring feedback, and a question-bank format converter.

## Domain Vocabulary

- **Question bank**: A JSON collection of questions imported into the self-test site.
- **Bank switcher**: The UI control for switching between locally saved question banks.
- **Built-in bank catalog**: The `site/banks/manifest.json` file that lists built-in question banks available on the home page.
- **Practice state**: A user's local answers, scoring results, answer visibility, order, and view mode for one question bank.
- **Converter**: The standalone page that turns copied questions, answers, categories, and choices into importable JSON.
- **Upload package**: The static files intended for deployment to a permanent hosting service.

## Layout Notes

- The deployable static site lives under `site/`.
- Repository-level agent configuration lives under `docs/agents/`.
- Architectural decisions should be recorded under `docs/adr/`.

## Application Map

### Main self-test site

`site/index.html` is the main single-file application. It contains:

- The hero and toolbar controls for bank switching, import/export, filters, full submission, missed-question review, and reset.
- The home page and sidebar question-bank selection.
- The built-in question-bank catalog loader.
- Question-bank normalization and import parsing.
- A multi-bank local storage library keyed by `enterprise-management-bank-library-v1`.
- Per-bank practice state, including answers, scores, visible answers, order, current index, and expanded mode.
- Text-answer scoring, choice-question scoring, feedback rendering, and progress summaries.

### Question-bank converter

`site/converter.html` is a standalone converter. It turns copied questions, answers, categories, and choice options into the importable JSON schema used by the main site.

### Upload package

`site/` is the clean static publishing package. It currently contains:

- `index.html`
- `banks/`
- `converter.html`
- `template.json`
- `README.md`

For static hosting, this package is the safest publish root unless the workspace is reorganized into a dedicated website repo.

## Git Publishing Notes

The parent workspace may contain unrelated or sensitive-adjacent materials, including personal documents, course documents, SolidWorks files, temporary files, and generated PDFs. This repository is intentionally kept in `g-memtest/` so only the website project is versioned.

- **Git scope**: version the clean `g-memtest/` repository only.
- **Netlify scope**: upload the zip generated at the parent workspace root from `g-memtest/site/`.

Do not push the parent workspace publicly.

GitHub Pages is not currently configured for this repo.
