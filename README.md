# Synergy – Focus & Study Planner

A web application for students: Pomodoro focus timer, tasks, calendar (Today / Schedule / Week / Month / Year), alarms,
stopwatch, chat-with-yourself reminders, file storage, strict mode, dictionary, mood check-in with starter tasks,
stickers, three colours in light and dark mode, streak and weekly statistics. It can be installed like an app (PWA).

## Folder structure

```
synergy-app/
├── index.html              HTML – page structure (timer, calendar, chat, clock, help, dictionary)
├── css/style.css           CSS  – layout, colours (light and dark), calendar, chat, stickers
├── js/config.js            JavaScript – optional setting for server mode (empty = browser mode)
├── js/database.js          JavaScript – storage layer: state, load/save, IndexedDB helpers
├── js/app.js               JavaScript – application logic (timer, tasks, calendar, alarms, chat, dictionary ...)
├── manifest.webmanifest    PWA – name, colours and icon so the app can be installed
├── sw.js                   PWA – service worker: keeps the files so the app opens offline
├── icons/                  logo.png, favicon.png
└── README.md               this file
```

Load order in `index.html`: `config.js` → `database.js` → `app.js`.

## How to run (Visual Studio Code)

1. Open the `synergy-app` folder in VS Code.
2. Install the **Live Server** extension once.
3. Right-click `index.html` → **Open with Live Server**.

Live Server (localhost) is needed for voice notes, notifications, keep-screen-awake and the service worker.
Double-clicking `index.html` also works, but those features may be unavailable.
Internet is needed only for the Google font, embedded YouTube videos and online dictionary look-ups.

## How to publish (free hosting)

Synergy is a static site (no build step), so any static host works:

- **Netlify Drop:** open https://app.netlify.com/drop and drag the `synergy-app` folder onto the page. You get a link at once.
- **GitHub Pages:** upload the folder contents to a repository → Settings → Pages → deploy from the `main` branch, root folder.

Use the https link on a phone, open the browser menu and choose *Add to Home screen* to install it.

## Dictionary

The book button at the top opens the dictionary. A word is looked up in this order:

1. saved copy of an earlier look-up (works offline)
2. Free Dictionary API (api.dictionaryapi.dev)
3. Wiktionary (en.wiktionary.org REST API)
4. built-in glossary of IT and study words (works offline)
5. My words – meanings you saved with **Save word** (works offline)

Plural and verb forms are tried too (studies → study, running → run). If a word is not found, spelling suggestions
come from Datamuse online, or from the built-in glossary and saved words when offline.
It also works while strict mode is on.

## Database (storage) design

There is no database server by default. All data stays in the user's own browser (**browser mode**).

### 1. localStorage – key `synergy-v1` (one JSON object, saved after every change)

| Field | Type | Meaning |
|---|---|---|
| `dur` | {focus, short, long} | Timer lengths in minutes |
| `sound`, `theme`, `tone`, `strict` | misc | Settings (sound on, colour/mode, alarm tone, strict mode) |
| `done`, `day` | number / text | Focus sessions counted today and the date they belong to |
| `active` | number | Id of the star (focus) task |
| `tasks[]` | list | `{id, text, done, imp, d (YYYY-MM-DD), t (HH:MM)}` |
| `hist{}` | map | `"YYYY-MM-DD": {n: sessions, m: minutes}` – calendar and statistics |
| `msgs[]` | list | Chat items: `{id, d, t, text, atts[], type ('note' or 'rem'), fired, ts}` |
| `stick{}`, `mood{}` | map | Stickers and mood per date |
| `alarms[]` | list | `{id, t, label, days[], rep, on, last, tone, vib}` |
| `words[]` | list | Saved dictionary words `{w, m}` |
| `dcache{}` | map | Saved copies of dictionary look-ups (latest 150) |
| `askDay`, `starterDone`, `unread` | misc | Mood check-in date, starter tasks shown, unread reminders |

### 2. IndexedDB – database `synergy-files` (version 1)

| Object store | Key | Value |
|---|---|---|
| `files` | attachment id | the file itself (chat copy) |
| `offline` | attachment id | the offline copy used during study sessions |

### 3. Optional server mode (XAMPP / WAMP with PHP and MySQL)

If `window.SYNERGY_API` in `js/config.js` points to a backend folder that offers `state.php` and `files.php`,
`database.js` loads and saves the same state object on the server and keeps the browser copy as a cache.
Leave it empty to stay in browser mode.

### See the data (useful for a viva)

Browser → press F12 → **Application** tab → *Local Storage* (key `synergy-v1`) and *IndexedDB* (`synergy-files`).

## Main functions

| Module | Functions (js/app.js) |
|---|---|
| Timer | setMode, start, stop, finish, tick, render, breakUI |
| Tasks | newTask, taskLi, taskClick, tasks, updateLabel |
| Calendar | cal, calViews, weekRender, schedRender, yearRender, detail, openDay, miniRender |
| Clock and alarms | openAlarm, dialSvg, due, ring, alRender, playTone, keepAwake |
| Chat and reminders | addMsg, chatRender, sendMsg, ping |
| Files and offline | dl, openAtt, askClean, storUI |
| Strict mode and study tools | challenge, lock, typed, focusPlayer, study |
| Mood and starter tasks | onboard, moodRender, starterRender |
| Dictionary | lookup, forms, near, dist, srcA, srcB, dictShow, dictWords, openDict |
| Themes and stickers | applyTheme, stk, faceSvg |
| Stats and tips | statsRender, streaks, tipsRender |
| Storage layer (js/database.js) | load, save, openDB, idb, srvFile |
