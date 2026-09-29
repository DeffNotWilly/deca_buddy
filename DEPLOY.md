# Publishing DECA Study Hub to GitHub

Two ways to do it. **Option A** is one command and is worth 2 minutes to set up
once. **Option B** needs no setup at all and works right now.

Everything is free. GitHub Pages hosts the site, so you get a real
`https://` URL for your chapter at $0.

---

## Option A - one command (recommended)

### 1. Make a free token (about 1 minute)

1. Open <https://github.com/settings/tokens/new>
2. **Note:** anything, e.g. `deca deploy`
3. **Expiration:** 90 days
4. **Select the `repo` checkbox** - that is the only scope you need
5. Click **Generate token**, then copy it

### 2. Run the deploy

Open PowerShell in this folder and run:

```powershell
.\deploy.ps1 -Token "ghp_paste_your_token_here"
```

That single command will:

- check git and the app files are all present
- ignore scratch files so they never get published
- commit your app
- create the repo `deca_buddy` on your GitHub (public)
- push it to `main`
- switch on GitHub Pages
- print your live URL

The live site takes **1-2 minutes** to build the first time.

### 3. Publishing changes later

Make your edits, then just run:

```powershell
.\deploy.ps1 -Token "ghp_paste_your_token_here"
```

It is safe to run over and over - it reuses the existing repo, and skips
anything that has not changed.

### Prefer not to paste the token every time?

Put it in a file called `github-token.txt` in this folder. It is listed in
`.gitignore`, so it will never be published:

```powershell
"ghp_paste_your_token_here" | Out-File -Encoding ascii github-token.txt
```

Then `.\deploy.ps1` on its own is enough. Or set it for the current window:

```powershell
$env:GITHUB_TOKEN = "ghp_paste_your_token_here"
```

> **Token safety.** A token with `repo` scope can write to your public repos.
> Treat it like a password, delete it when the 90 days are up
> (Settings -> Developer settings -> Personal access tokens), and never paste
> it into a file that gets committed. If you are ever unsure, revoke it -
> GitHub tells you instantly and you can make a new one in a minute.

---

## Option B - no token, just drag and drop

Works immediately, no setup.

```powershell
.\make-zip.ps1
```

Then:

1. Go to <https://github.com/new>
2. Name it `deca_buddy`, click **Create repository**
3. On the empty repo page click **uploading an existing file**
4. Drag `dist\deca_buddy.zip` in, then click **Commit changes**
5. **Settings -> Pages ->** Source: **Deploy from a branch** ->
   branch **main**, folder **/ (root)** -> **Save**

Wait a minute or two, and your site is live at
`https://<your-username>.github.io/deca_buddy/`.

> GitHub unzips the archive for you. If you still see a file browser, the
> upload worked - that is normal.

To publish changes this way, run `.\make-zip.ps1` again and drag the new zip
over the old files.

---

## Seeing it before you publish

```powershell
.\deploy.ps1 -DryRun
```

Prints every step it *would* take and changes nothing. Good for checking
nothing weird is about to get published.

---

## What actually gets published

| Published | Never published |
| --- | --- |
| `index.html` | `nc_err.txt`, `nc_exit.txt` (old debug leftovers) |
| `css/`, `js/` | `github-token.txt` and any token file |
| `start.md`, `DEPLOY.md` | `dist/`, `*.zip` |
| `deploy.ps1`, `make-zip.ps1` | `.git/`, `node_modules/` |
| `.gitignore`, `.gitattributes` | `.vscode/`, OS junk |

You can always check before committing:

```powershell
git status
```

---

## If something goes wrong

**"git is not installed"**
Install from <https://git-scm.com/download/win>, then reopen PowerShell.

**"running scripts is disabled on this system"**
Use the one-liner that bypasses it, no settings change needed:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy.ps1 -Token "ghp_..."
```

**"That token was rejected by GitHub."**
Usually a stray space or a truncated paste. Re-copy the token. If it is really
correct but still fails, generate a fresh one.

**"push failed / asks for a password"**
Username is your GitHub username. For the password, paste your **token**, not
your GitHub password (GitHub removed password login).

**"remote origin already exists"**
Expected if you deployed before. The script reuses it. If you want to start
clean: `git remote remove origin`.

**Pages shows 404**
The first build takes a minute or two. If it is still 404 after 5, check
Settings -> Pages and make sure Source is **Deploy from a branch**, branch
**main**, folder **/ (root)**.

**Repo name is taken**
Pick another: `.\deploy.ps1 -RepoName deca-study-hub`

---

## Your data does not travel with the repo

Progress, profiles and the leaderboard all live in each visitor's own browser
(`localStorage`). Publishing the repo shares the *app*, not anyone's stats, and
there is no server holding anything. Clearing browser data wipes it locally.
