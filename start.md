# DECA Study Hub — Start Here

**DECA Study Hub** is a complete offline practice app (500-question exam bank,
flashcards, terms quiz, interview prep, study-hour tracking, profiles and a
leaderboard). This folder is the whole app. Two ways to use it:

---

## What's inside

| Screen | What it does |
| --- | --- |
| **Practice Exams** | 500 real questions (2022–2026), year filter, drill size, timed or untimed, full explanations |
| **Flashcards** | 11 DECA glossary categories, weak terms come back first |
| **Terms Quiz** | Multiple-choice glossary drill built from the same bank |
| **Interview Prep** | IND / TDM / PI formats with coach notes and a timer-free practice outline |
| **Progress** | Total hours, this week, 14-day chart, where the hours went, accuracy, milestones |
| **Leaderboard** | Ranks profiles by total hours, this week's hours, and day streak |

### Profiles ("sign in")

The first screen asks who is studying. Tap a name to open it, or add a new
profile with an optional 4-digit PIN. **This is a local profile switcher, not
real authentication** — it just keeps separate people's stats apart on one
device. Nothing is sent anywhere, because there is no server.

Click the profile chip in the top-right to switch, or use it to lock the app.

### Study hours

Hours are tracked two ways: per-mode while a drill is running (exams, terms,
cards, interview), plus general browsing time whenever the tab is visible and
you have interacted in the last 90 seconds — so an idle tab left open overnight
does not inflate your total. Time is saved on exit, so closing the tab mid-drill
still counts.

### Leaderboard scope

The leaderboard ranks the **profiles saved in that one browser on that one
device**. It is not a shared, cross-device board — a real group leaderboard
would need a server and a database, which this app deliberately does without.
If you ever want that, the data layer is namespaced per profile
(`deca_hub_v1:<profileId>`) so a backend could be added without a rewrite.

---

## A) Use it locally (no internet, no account)

Double-click `index.html`. Done. Everything runs in your browser, offline.

---

## B) Share it as a free URL via GitHub Pages (~3 minutes)

All prices: **$0**. The only thing you need is a free GitHub account (yours —
I can't create it for you).

### Step 1 — Create a repository
1. Go to **github.com** and sign in.
2. Click the **＋** (top-right) → **New repository**.
3. Name it `deca_buddy`. Leave everything else default. **Create repository**.

### Step 2 — Upload these files (drag and drop)
On the new empty repo page click **"uploading an existing file"**, then drag
in **the contents** of this folder (NOT the folder itself):

```
index.html        <- the page (must sit at the repo root)
css/style.css     <- the theme
js/app.js         <- the app engine
js/data.exams.js  <- 500 practice questions
js/data.terms.js  <- terms quiz bank
js/data.interview.js <- interview formats
```

Scroll down → **Commit changes**.

### Step 3 — Turn on Pages
1. **Settings** tab → **Pages** in the left menu.
2. **Source:** "Deploy from a branch"
3. Branch **main**, folder **/ (root)** → **Save**.
4. Wait 1–2 minutes for the "Your site is live" banner.

Your URL becomes:

```
https://<your-username>.github.io/deca_buddy/
```

Send that link to your chapter. Done.

---

## Notes

- This app uses a **hash router** (`#/flashcards`), so GitHub Pages needs **zero
  extra config** — no redirect files, no 404 tricks. It just works.
- All paths are relative, so it works both in a folder and in a subpath like
  `/deca_buddy/`.
- Every visitor's progress is stored in **their own browser** (localStorage),
  namespaced per profile as `deca_hub_v1:<profileId>`. There is no server, so
  the leaderboard compares the profiles inside one browser — it is not a shared
  board for a whole chapter. Nothing is collected or sent.
- The optional 4-digit PIN is a light lock to stop casual mix-ups on a shared
  laptop. It is stored in plain localStorage and is **not** real security — it
  will not stop anyone who opens devtools. Do not use it to protect anything
  you care about.
- Want a custom domain later (e.g. `decahub.com`)? Optional, costs money, and
  not needed for anything here.

---

Built by **WILLY** · for DECA regionals, states, and ICDC.
