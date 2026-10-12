# GNOSIS | AI Comparison

A public website for comparing recorded responses from the GNOSIS scientific demonstration and Gemini (3.6 Flash). Visitors can browse 12 research questions about the biology of aging. The site does not call a live model.

Expected address after GitHub Pages is enabled:

https://ouahmad.github.io/gnosis-ai-comparison/

## Repository structure

```text
gnosis-ai-comparison/
├── index.html              Website page
├── styles.css              Layout, color, and mobile styles
├── app.js                  Comparison explorer and Markdown rendering
├── use-cases.json          Questions and recorded responses
├── assets/favicon.svg      Small site icon
├── scripts/
│   ├── extract_workbook.py Regenerates use-cases.json from Excel
│   └── check_render.js     Optional formatting check
├── .nojekyll               Tells GitHub Pages not to run Jekyll
├── .gitignore
└── README.md
```

The Excel workbook is not part of the published site. Keep it outside this folder, or leave it untracked. `*.xlsx` is listed in `.gitignore`.

## Preview on your computer

From this folder, start a local web server and open the address it prints:

```bash
python3 -m http.server 8000
```

Then visit http://127.0.0.1:8000/

Opening `index.html` directly from the Finder will not load the comparisons, because the page reads `use-cases.json` with a fetch request.

## Update the use cases

1. Edit the workbook. Keep the `Demo` sheet, the column titles in row 5, and one use case per row starting at row 6.
2. Install the extractor dependency once:

```bash
python3 -m pip install openpyxl
```

3. From the repository root, regenerate the JSON:

```bash
python3 scripts/extract_workbook.py --input "/path/to/GNOSIS Demo Use Cases.xlsx"
```

4. Preview the site and check that every question and both responses appear in full.
5. Commit `use-cases.json` and push `main`.

The script keeps the original response text. Do not paraphrase responses in the JSON. Formatting such as bold, italics, lists, and tables is applied in the browser.

On a Mac with the JavaScriptCore `jsc` tool, this optional check reports leftover Markdown markers:

```bash
/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc app.js scripts/check_render.js
```

`render clean` means the checker did not find unparsed asterisks, missing tables, or missing diagrams.

## Add a use case without Excel

Add an object to the `useCases` array in `use-cases.json`:

```json
{
  "id": 13,
  "title": "Short title",
  "question": "The full research question.",
  "gnosis": "The full GNOSIS response.",
  "gemini": "The full Gemini response."
}
```

Use the next whole number for `id`. Keep the Gemini label in `models.gemini.responseLabel` aligned with the workbook if the model version changes. Do not rename that label silently.

## Publish with GitHub Pages

The site is static. It does not need a build step, a server, or an API key.

1. Push the `main` branch to https://github.com/OUAhmad/gnosis-ai-comparison
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Choose branch `main` and folder `/ (root)`, then save.
5. Wait for the Pages deployment to finish. The site will be at https://ouahmad.github.io/gnosis-ai-comparison/

Asset paths are relative (`./styles.css`, `./app.js`, `./use-cases.json`), so they work when the site is served from `/gnosis-ai-comparison/` rather than the domain root.

A shared question uses a query string, for example:

https://ouahmad.github.io/gnosis-ai-comparison/?case=3

## Change the appearance

Colors, type, spacing, and breakpoints live in `styles.css`, in the `:root` variables at the top. GNOSIS uses the teal variables. Gemini uses the violet variables. Dark mode is the `:root[data-theme="dark"]` block.

The header name, hero, About text, methodology wording, and collaboration text are in `index.html`.

## Collaboration link

`use-cases.json` contains `"collaborationUrl": ""`. Leave it empty until there is a real address. When you have one, set it to an `https://` or `mailto:` link:

```json
"collaborationUrl": "mailto:name@example.org"
```

The **Help Shape GNOSIS** section then turns **Interested in Collaborating?** into that link. Do not invent an address.

The introduction video is `videoUrl` in the same file. The current value is https://www.youtube.com/watch?v=sHaHzk2zHg4&t=1s

## Demo knowledge base

The section **Inside the GNOSIS Demo Knowledge Base** describes the literature used to populate the demonstration: the primary Schilling Lab paper, that paper’s bibliography, and additional recent papers from the lab. The workbook does not list every publication, so the page does not invent that list.

The primary paper link is the verified DOI https://doi.org/10.64898/2026.03.27.714902 (`Shifts in protein aggregate stability define proteostasis decline in the aging human brain`, Anderton et al., 2026, bioRxiv). Change that link in `index.html` only if you have checked a newer URL.

## Introductory video

The video sits in **About GNOSIS**. The page shows a thumbnail first. Playback starts only after a visitor presses play, then loads the YouTube player from `youtube-nocookie.com` at about one second (`sHaHzk2zHg4`). **Watch on YouTube** uses `videoUrl`. To point the external link somewhere else, change `videoUrl` and keep the same video ID in the play button code in `app.js` if the embedded video should change too.
