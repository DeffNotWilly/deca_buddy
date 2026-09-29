/* ============================================================
   DECA STUDY HUB  ·  js/app.js
   Made by WILLY for Willy. Built for the DECA grind.
   ============================================================ */
(function () {
  "use strict";

  /* ==================== micro helpers ==================== */
  function $(id) { return document.getElementById(id); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  function num(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function now() { return new Date().getTime(); }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function byVal(a, v) { return a.filter(function (x) { return x === v; }); }
  function ymd(d) {
    d = d || new Date();
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }
  function dayDiff(dayStr) {
    var x = String(dayStr).split("-").map(Number);
    var d = new Date(x[0], x[1] - 1, x[2]);
    var today = new Date();
    return Math.round((today - d) / 86400000);
  }

  /* ==================== toast ==================== */
  var toastTimer = null;
  function toast(msg, ok) {
    var t = $("toast");
    if (!t) return;
    t.textContent = msg;
    t.className = "toast show " + (ok ? "ok" : "err");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = "toast"; }, 2400);
  }

  /* ==================== profiles ====================
     Everything is device-local. A "profile" just namespaces the stats
     blob so two people (or two attempts) on one laptop stay separate.
     This is NOT authentication -- it is a local profile switcher. */
  var PKEY = "deca_profiles_v1";
  var LEGACY_SKEY = "deca_hub_v1";
  var pCache = null;

  function loadProfiles() {
    if (pCache) return pCache;
    try { pCache = JSON.parse(localStorage.getItem(PKEY) || "null"); }
    catch (e) { pCache = null; }
    if (!pCache || typeof pCache !== "object") pCache = { active: null, list: [] };
    if (!Array.isArray(pCache.list)) pCache.list = [];
    return pCache;
  }
  function saveProfiles() {
    try { localStorage.setItem(PKEY, JSON.stringify(pCache)); } catch (e) { }
  }
  function activeProfile() {
    var p = loadProfiles();
    if (!p.active) return null;
    for (var i = 0; i < p.list.length; i++) if (p.list[i].id === p.active) return p.list[i];
    return null;
  }
  function profileName(id) {
    var p = loadProfiles();
    for (var i = 0; i < p.list.length; i++) if (p.list[i].id === id) return p.list[i].name;
    return "";
  }
  function newProfileId() {
    return "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }
  /* adopt the pre-profile stats blob so existing history is not lost */
  function adoptLegacyStats(id) {
    var raw = null;
    try { raw = localStorage.getItem(LEGACY_SKEY); } catch (e) { }
    if (!raw) return;
    try {
      if (!localStorage.getItem(skeyFor(id))) localStorage.setItem(skeyFor(id), raw);
    } catch (e) { }
  }
  function skeyFor(id) { return "deca_hub_v1:" + id; }

  /* ==================== local storage (per profile) ==================== */
  var statCache = null;
  function statKey() {
    var a = activeProfile();
    return a ? skeyFor(a.id) : "deca_hub_v1:anon";
  }
  function loadStat() {
    if (statCache) return statCache;
    try { statCache = JSON.parse(localStorage.getItem(statKey()) || "{}"); }
    catch (e) { statCache = {}; }
    if (!statCache || typeof statCache !== "object") statCache = {};
    return statCache;
  }
  function saveStat() {
    try { localStorage.setItem(statKey(), JSON.stringify(statCache)); } catch (e) { }
  }
  function switchProfile(id) {
    var p = loadProfiles();
    p.active = id;
    saveProfiles();
    statCache = null;      /* force a reload of the new namespace */
    stopAllTimers();
  }
  function statGet(k, d) {
    var s = loadStat();
    return (k in s && s[k] !== undefined && s[k] !== null) ? s[k] : d;
  }
  function statSet(k, v) {
    var s = loadStat();
    s[k] = v;
    saveStat();
  }
  function statBump(k, add) { statSet(k, num(statGet(k, 0)) + (add || 1)); }
  function statVal(k, v, def) {
    var s = loadStat();
    if (typeof s[k] === "boolean") { s[k] = v || false; saveStat(); return s[k]; }
    var cur = num(s[k]);
    if (v === "inc") { s[k] = cur + 1; }
    else if (v === "dec") { s[k] = Math.max(0, cur - 1); }
    else { s[k] = num((v === undefined) ? cur : v); }
    saveStat();
    return s[k];
  }

  /* ==================== study time ====================
     Two sources are tracked:
       - per-mode: an active drill (exam / terms / cards / interview)
       - browse: the tab is open, visible, and the user has interacted
         within the last 90s, so idle tabs don't inflate the number.  */
  var MODE_LABEL = { exam: "Practice Exams", terms: "Terms Quiz", cards: "Flashcards", interview: "Interview", browse: "Browsing & review" };
  var modeStart = {};        /* mode -> timestamp */
  var browseT0 = 0;          /* timestamp of current active browse window */
  var lastTouch = 0;         /* last real user interaction */
  var TICK_MS = 10000;       /* 10s tick */
  var IDLE_MS = 90000;       /* >90s without input counts as idle */
  var tickTimer = null;

  function touch() { lastTouch = now(); }

  function browseOpen() {
    browseT0 = now();
    if (!tickTimer) tickTimer = setInterval(studyTick, TICK_MS);
  }
  function browseClose() {
    commitBrowse();
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
  }
  function commitBrowse() {
    if (!browseT0) return;
    var ms = now() - browseT0;
    browseT0 = 0;
    if (ms > 0) addStudy("browse", ms);
  }
  function studyTick() {
    if (document.visibilityState !== "visible") { commitBrowse(); return; }
    if (now() - lastTouch > IDLE_MS) { commitBrowse(); return; }
    if (!browseT0) browseT0 = now();
  }
  /* bump one bucket of study time, splitting at midnight so daily bars are right */
  function addStudy(mode, ms) {
    if (!(ms > 0)) return;
    /* no profile signed in yet -- don't bank time into a throwaway bucket */
    if (!activeProfile()) return;
    var s = loadStat();
    if (!s.study || typeof s.study !== "object") s.study = {};
    var st = s.study;
    st.total_ms = num(st.total_ms) + ms;
    if (!st.by_mode || typeof st.by_mode !== "object") st.by_mode = {};
    st.by_mode[mode] = num(st.by_mode[mode]) + ms;
    var t0 = now() - ms, key = ymd(new Date(t0)), guard = 0;
    while (t0 <= now() && guard++ < 40) {
      var nk = ymd(new Date(t0));
      var midnight = new Date(new Date(t0).getFullYear(), new Date(t0).getMonth(), new Date(t0).getDate() + 1).getTime();
      var seg = Math.min(now() - t0, midnight - t0);
      if (seg > 0) {
        if (!st.daily || typeof st.daily !== "object") st.daily = {};
        st.daily[nk] = num(st.daily[nk]) + seg;
      }
      t0 = midnight;
      key = nk;
    }
    saveStat();
  }
  function modeOpen(mode) { touch(); if (!modeStart[mode]) modeStart[mode] = now(); }
  function modeClose(mode) {
    if (!modeStart[mode]) return;
    addStudy(mode, now() - modeStart[mode]);
    delete modeStart[mode];
  }
  function stopAllTimers() {
    Object.keys(modeStart).forEach(function (m) { modeClose(m); });
    commitBrowse();
  }
  /* raw ms for a profile, independent of who is active */
  function readStudyOf(id) {
    var raw = null;
    try { raw = localStorage.getItem(skeyFor(id)); } catch (e) { }
    if (!raw) return null;
    var s = null;
    try { s = JSON.parse(raw); } catch (e) { return null; }
    return (s && s.study && typeof s.study === "object") ? s.study : null;
  }
  function streakOf(s) { return num(s && s.streak); }
  function msToday(st) { return st && st.daily ? num(st.daily[ymd()]) : 0; }
  function msThisWeek(st) {
    if (!st || !st.daily) return 0;
    var total = 0;
    for (var i = 0; i < 7; i++) {
      var d = new Date(); d.setDate(d.getDate() - i);
      total += num(st.daily[ymd(d)]);
    }
    return total;
  }
  function fmtHours(ms) {
    var m = num(ms) / 60000;
    if (m < 1) return "<1m";
    if (m < 60) return Math.round(m) + "m";
    var h = m / 60;
    if (h >= 100) return Math.round(h) + "h";
    if (h >= 10) return (Math.round(h * 10) / 10) + "h";
    return (Math.round(h * 100) / 100) + "h";
  }
  function fmtHm(ms) {
    var m = Math.round(num(ms) / 60000);
    if (m < 60) return m + "m";
    return Math.floor(m / 60) + "h " + (m % 60) + "m";
  }

  /* ==================== day / streak activity ==================== */
  function recordDay(label) {
    var s = loadStat();
    if (!s.days || typeof s.days !== "object") s.days = {};
    var today = ymd();
    var firstToday = !s.days[today];
    s.days[today] = 1;
    /* streak = consecutive days ending today (or yesterday, if today not yet logged) */
    var streak = 0, cur = new Date();
    if (!s.days[ymd(cur)]) cur.setDate(cur.getDate() - 1);
    for (var i = 0; i < 3650; i++) {
      if (!s.days[ymd(cur)]) break;
      streak++;
      cur.setDate(cur.getDate() - 1);
    }
    s.streak = streak;
    if (label) {
      if (!Array.isArray(s.recent)) s.recent = [];
      s.recent.unshift({ t: label, d: now() });
      if (s.recent.length > 12) s.recent.length = 12;
    }
    saveStat();
    return firstToday;
  }


  /* ==================== modes/answers for term quiz ==================== */
  var termQ = null; /* current term quiz state */

  /* navigation helper + bootstrap guard */
  var booted = false;
  function onReady() {
    if (booted) return;
    booted = true;
    wireNav();
    wireTracking();
    if (!location.hash) location.hash = "#/home";
    route();
    window.addEventListener("hashchange", route, false);
    showGate();
  }

  function wireTracking() {
    ["pointerdown", "keydown", "wheel", "touchstart", "focus"].forEach(function (ev) {
      window.addEventListener(ev, touch, { passive: true });
    });
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") { touch(); browseOpen(); }
      else { commitBrowse(); }
    }, false);
    /* flush on the way out so time is never lost */
    window.addEventListener("pagehide", stopAllTimers, false);
    window.addEventListener("beforeunload", stopAllTimers, false);
    touch();
    browseOpen();
  }

  /* ==================== profile gate ====================
     A local profile picker, not real auth. Nothing leaves the device. */
  var gateReturnHash = null;
  function showGate() {
    var g = $("gate");
    if (!g) return;
    g.classList.add("on");
    document.body.classList.add("gate-open");
    renderGate();
  }
  function hideGate() {
    var g = $("gate");
    if (!g) return;
    g.classList.remove("on");
    document.body.classList.remove("gate-open");
    touch();
    browseOpen();
    if (gateReturnHash) { var h = gateReturnHash; gateReturnHash = null; if (location.hash !== h) location.hash = h; route(); }
  }
  function renderGate(msg) {
    var g = $("gate");
    if (!g) return;
    var p = loadProfiles();
    var h = '<div class="gate-card">';
    h += '<div class="gate-brand"><svg class="logo" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="6" fill="#0b1220"/><path d="M16 8l6 4v6l-6 4-6-4v-6l6-4z" fill="#4d6bff"/><circle cx="16" cy="15" r="2" fill="#ffffff"/></svg>';
    h += '<span class="name">DECA <b>Study Hub</b></span></div>';
    if (msg) h += '<div class="gate-msg err">' + esc(msg) + "</div>";

    if (p.list.length) {
      h += '<h3>Who is studying?</h3><div class="gate-list">';
      p.list.forEach(function (pr) {
        var st = readStudyOf(pr.id);
        h += '<button class="gate-row" onclick="gatePick(\'' + pr.id + '\')">';
        h += '<span class="gate-avatar">' + esc((pr.name || "?").charAt(0).toUpperCase()) + "</span>";
        h += '<span class="gate-who"><b>' + esc(pr.name) + "</b>";
        h += '<small>' + (pr.pin ? "PIN protected" : "tap to open") + "</small></span>";
        h += '<span class="gate-time">' + (st ? fmtHours(num(st.total_ms)) : "new") + "</span>";
        h += "</button>";
      });
      h += '</div><div class="gate-sep"><span>or</span></div>';
    }
    h += '<h3>' + (p.list.length ? "Add someone" : "Create your profile") + "</h3>";
    h += '<div class="gate-form">';
    h += '<label class="input-label">Name<input id="gate-name" class="gate-input" maxlength="18" placeholder="e.g. Willy" autocomplete="off"></label>';
    h += '<label class="input-label">PIN <span class="pin-opt">optional</span><input id="gate-pin" class="gate-input" maxlength="4" inputmode="numeric" placeholder="4 digits" autocomplete="off"></label>';
    h += '<button class="btn primary gate-go" onclick="gateCreate()">Start Studying</button>';
    h += "</div>";
    h += '<p class="gate-note">Profiles are stored only in this browser. There is no server, no account, and nothing is sent anywhere.</p>';
    h += "</div>";
    g.innerHTML = h;
  }
  function gateCreate() {
    var n = ($("gate-name") && $("gate-name").value || "").trim();
    var pin = ($("gate-pin") && $("gate-pin").value || "").trim();
    if (!n) { renderGate("Enter a name first."); return; }
    if (pin && !/^\d{4}$/.test(pin)) { renderGate("PIN must be exactly 4 digits."); return; }
    var p = loadProfiles();
    var id = newProfileId();
    p.list.push({ id: id, name: n.slice(0, 18), pin: pin || "", created: now() });
    adoptLegacyStats(id);
    switchProfile(id);
    hideGate();
    paintHome();
    toast("Signed in as " + n, true);
  }
  function gatePick(id) {
    var p = loadProfiles();
    var pr = null, i;
    for (i = 0; i < p.list.length; i++) if (p.list[i].id === id) pr = p.list[i];
    if (!pr) return;
    if (pr.pin) {
      gateAskPin(pr);
      return;
    }
    enterProfile(pr);
  }
  function gateAskPin(pr) {
    var g = $("gate");
    if (!g) return;
    var h = '<div class="gate-card">';
    h += '<div class="gate-brand"><span class="name">DECA <b>Study Hub</b></span></div>';
    h += '<h3>Welcome back, ' + esc(pr.name) + "</h3>";
    h += '<div class="gate-form">';
    h += '<label class="input-label">Enter your 4-digit PIN<input id="gate-pin2" class="gate-input" maxlength="4" inputmode="numeric" placeholder="&bull;&bull;&bull;&bull;" autocomplete="off"></label>';
    h += '<button class="btn primary gate-go" onclick="gatePinTry(\'' + pr.id + '\')">Unlock</button>';
    h += '<button class="btn ghost gate-go" onclick="renderGate()">Back</button>';
    h += "</div></div>";
    g.innerHTML = h;
    var f = $("gate-pin2");
    if (f) f.onkeydown = function (e) { if (e.key === "Enter") gatePinTry(pr.id); };
    if (f) f.focus();
  }
  function gatePinTry(id) {
    var p = loadProfiles();
    var pr = null, i;
    for (i = 0; i < p.list.length; i++) if (p.list[i].id === id) pr = p.list[i];
    if (!pr) return;
    var v = ($("gate-pin2") && $("gate-pin2").value || "").trim();
    if (v !== String(pr.pin)) { renderGate("Wrong PIN."); return; }
    enterProfile(pr);
  }
  function enterProfile(pr) {
    switchProfile(pr.id);
    hideGate();
    paintHome();
    toast("Signed in as " + pr.name, true);
  }
  function switchTo() {
    commitBrowse();
    stopAllTimers();
    gateReturnHash = location.hash;
    showGate();
  }
  function lockNow() {
    commitBrowse();
    stopAllTimers();
    loadProfiles().active = null;
    saveProfiles();
    statCache = null;
    gateReturnHash = location.hash;
    showGate();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onReady);
  } else {
    onReady();
  }


  /* ==================== router: view switch + nav glow ==================== */
  var VIEWS = ['home','exams','exams_run','flashcards','flashcards_run','terms','terms_run','interview','interview_run','progress','leaderboard'];
  function curView() {
    var h = location.hash || '#/home';
    var k = h.replace(/^#\//,'').split('/')[0];
    return (VIEWS.indexOf(k) >= 0) ? k : 'home';
  }
  function route() {
    var v = curView();
    $$('.view').forEach(function (el) {
      el.classList.toggle('active', el.id === 'view-' + v);
    });
    $$('#topnav a[data-nav]').forEach(function (a) {
      a.classList.toggle('on', a.getAttribute('data-nav') === v);
    });
    if (v === 'home') paintHome();
    else if (v === 'exams') paintExams();
    else if (v === 'exams_run') paintQ();
    else if (v === 'flashcards') paintFlashcards();
    else if (v === 'flashcards_run') paintFCRun();
    else if (v === 'terms') paintTerms();
    else if (v === 'terms_run') paintTermsRun();
    else if (v === 'interview') paintInterview();
    else if (v === 'interview_run') paintIVRun();
    else if (v === 'progress') paintProgress();
    else if (v === 'leaderboard') paintLeaderboard();
  }
  /* _run hashes -> activate the matching run view and paint it directly
     (base router only knows the 6 top-level views) */
  function routeHashRV(k) {
    var base = k.replace(/_run$/, '');
    location.hash = '#/' + k;
    $$('.view').forEach(function (el) {
      el.classList.toggle('active', el.id === 'view-' + k);
      if (el.id === 'view-' + base) el.classList.remove('active');
    });
    if (k === 'exams_run') paintQ();
    else if (k === 'flashcards_run') paintFCRun();
    else if (k === 'terms_run') paintTermsRun();
    else if (k === 'interview_run') paintIVRun();
    else route();
  }
  function routeHash(k) { routeHashRV(k); }
  function toNu(k) { routeHashRV(k); }
  function wireNav() {
    $$('#topnav a[data-nav]').forEach(function (a) {
      a.addEventListener('click', function () {
        var k = a.getAttribute('data-nav');
        location.hash = '#/' + k;
        if (route._log) {}
      });
    });
  }
  /* ==================== exams: dispatch + runner ==================== */
  var runS = null; /* live exam session */

  function paintExams() {
    var el = $("view-exams");
    if (!el) return;
    var bank = window.EXAM_BANK || {};
    var ys = Object.keys(bank).sort().reverse();
    var h = "";
    h += '<div class="page-head"><h2>Practice Exams</h2>';
    h += '<p class="sub">DECA exam bank &mdash; pick years, drill size and timer, then go.</p></div>';
    h += '<div class="card"><h3>1 &middot; Year</h3><div class="optrow">';
    ys.forEach(function (y) {
      var n = (bank[y] || []).length;
      h += '<label class="ck"><input type="checkbox" class="ey" value="' + esc(y) + '" checked> ' + esc(y) + ' <small>' + n + '</small></label>';
    });
    h += '</div></div>';
    h += '<div class="card"><h3>2 &middot; Questions</h3><div class="optrow">';
    [10, 20, 25, 40, 50].forEach(function (n) {
      h += '<label class="ck"><input type="radio" name="qc" value="' + n + '"' + (n === 25 ? " checked" : "") + '> ' + n + '</label>';
    });
    h += '</div></div>';
    h += '<div class="card"><h3>3 &middot; Time limit</h3><div class="optrow">';
    [10, 15, 20, 25, 30].forEach(function (m) {
      h += '<label class="ck"><input type="radio" name="qm" value="' + m + '"' + (m === 20 ? " checked" : "") + '> ' + m + ' min</label>';
    });
    h += '</div></div>';
    h += '<div class="card"><h3>4 &middot; Mode</h3><div class="optrow">';
    h += '<label class="ck"><input type="radio" name="qmode" value="timed" checked> Timed</label>';
    h += '<label class="ck"><input type="radio" name="qmode" value="untimed"> Untimed</label>';
    h += '</div></div>';
    h += '<div class="actions"><button class="btn primary big" onclick="startExam()">Start Exam</button></div>';
    el.innerHTML = h;
  }

  function startExam() {
    var ys = [];
    $$(".ey").forEach(function (b) { if (b.checked) ys.push(b.value); });
    if (!ys.length) { toast("Pick at least one year.", false); return; }
    var qce = $$('input[name=qc]:checked')[0], qme = $$('input[name=qm]:checked')[0], mde = $$('input[name=qmode]:checked')[0];
    var qc = qce ? num(qce.value) : 25, qm = qme ? num(qme.value) : 20, mode = mde ? mde.value : "timed";
    var pool = [];
    ys.forEach(function (y) {
      ((window.EXAM_BANK || {})[y] || []).forEach(function (x) {
        if (x && x.q) pool.push({ y: y, x: x });
      });
    });
    if (!pool.length) { toast("No questions for that selection.", false); return; }
    pool = shuffle(pool);
    if (qc > 0 && qc < pool.length) pool = pool.slice(0, qc);
    runS = {
      qs: pool, ys: ys.slice(), count: pool.length,
      i: 0, ok: 0, bad: 0, skip: 0, secs: 0, timer: null,
      pick: "", marks: {}, start: now(), mode: mode
    };
    if (mode === "timed") {
      runS.secs = qm * 60;
      runS.timer = setInterval(function () { examTick(); }, 1000);
    }
    statBump("exams_started", 1);
    modeOpen("exam");
    location.hash = "#/exams_run";
    route();
  }

  function examTick() {
    if (!runS) return;
    runS.secs--;
    if (runS.secs <= 0) { finishExam(); return; }
    var t = $("x-run-timer");
    if (t) t.textContent = fmtClock(runS.secs);
    if (runS.secs <= 10) { var b = $("x-run-timer"); if (b) b.classList.add("urgent"); }
  }

  function fmtClock(s) {
    s = Math.max(0, Math.floor(s));
    return pad2(Math.floor(s / 60)) + ":" + pad2(s % 60);
  }

  function paintQ() {
    if (!runS || !runS.qs[runS.i]) { finishExam(); return; }
    var v = $("view-exams_run");
    if (!v) return;
    var m = runS.qs[runS.i], q = m.x;
    var h = "";
    h += '<div class="run-top"><span class="run-q">Q ' + (runS.i + 1) + " of " + runS.count + '</span>';
    if (runS.mode === "timed") h += '<span class="run-clock" id="x-run-timer">' + fmtClock(runS.secs) + '</span>';
    h += '<span class="run-y">' + esc(m.y) + " &middot; " + esc(q.tp || "standard") + '</span></div>';
    h += '<div class="q-card"><div class="q-text">' + esc(q.q) + "</div></div>";
    h += '<div class="opts">';
    q.o.forEach(function (opt) {
      h += '<label class="opt"><input type="radio" name="xans" value="' + esc(opt.l) + '">' +
        '<span class="opt-l">' + esc(opt.l) + '</span><span class="opt-t">' + esc(opt.t) + "</span></label>";
    });
    h += "</div>";
    h += '<div class="run-btns"><button class="btn primary" onclick="confirmQ()">Check Answer</button>' +
      '<button class="btn ghost" onclick="skipQ()">Skip</button></div>';
    h += '<div id="x-reveal"></div>';
    v.innerHTML = h;
  }

  function confirmQ() {
    if (!runS || runS.marks[runS.i]) return;
    var pick = $$('input[name=xans]:checked');
    if (!pick.length) { toast("Select an answer first.", false); return; }
    var l = pick[0].value, q = runS.qs[runS.i].x;
    var ok = l === q.a;
    runS.marks[runS.i] = l;
    if (ok) { runS.ok++; statBump("exams_right", 1); }
    else { runS.bad++; statBump("exams_wrong", 1); recordMiss(q.tp || q.ar || ""); }
    var fb = $("x-reveal");
    if (fb) {
      var corT = null;
      q.o.forEach(function (o) { if (o.l === q.a) corT = o.t; });
      var hv = '<div class="fb ' + (ok ? "ok" : "no") + '"><b>' + (ok ? "Correct!" : "Incorrect") + "</b>" +
        (corT ? "<div>Answer: " + esc(corT) + "</div>" : "") +
        (q.e ? '<div class="fb-e">' + esc(q.e) + "</div>" : "");
      hv += '<button class="btn primary full" onclick="nextQ()">' +
        (runS.i + 1 >= runS.count ? "Finish" : "Next") + "</button></div>";
      fb.innerHTML = hv;
    }
  }

  function skipQ() {
    if (!runS || runS.marks[runS.i]) return;
    runS.marks[runS.i] = "skip";
    runS.skip++;
    statBump("exams_skipped", 1);
    nextQ();
  }

  function nextQ() {
    if (!runS) return;
    runS.i++;
    if (runS.i >= runS.count) { finishExam(); return; }
    paintQ();
  }

  function finishExam() {
    if (!runS) return;
    if (runS.timer) clearInterval(runS.timer);
    modeClose("exam");
    var ok = runS.ok, cnt = runS.count;
    var pct = cnt ? Math.round(100 * ok / cnt) : 0;
    statBump("exams_done", 1);
    recordDay("Finished a " + cnt + "-question exam · " + pct + "%");
    var best = num(statGet("best_pct", 0));
    if (pct > best) { statSet("best_pct", pct); best = pct; }
    statBump("questions_total", cnt);
    var s = loadStat();
    s.total_pct = num(s.total_pct) + pct; /* track cumulative for dashboard */
    saveStat();
    var v = $("view-exams_run");
    if (v) {
      v.innerHTML = '<div class="result-card"><div class="big-score">' + pct +
        "%</div><div class='result-title'>Exam Complete</div>" +
        '<div class="res-row"><div><b>' + ok + "</b> correct</div><div><b>" + (cnt - ok - runS.skip) +
        "</b> wrong</div><div><b>" + runS.skip + "</b> skipped</div></div>" +
        '<div class="best-line">Best: ' + best + '% &middot; Solved ' + num(statGet("questions_total", 0)) +
        " questions total</div>" +
        '<div class="run-btns"><button class="btn primary full" onclick="paintExams()">Back to Setup</button>' +
        '<button class="btn ghost full" onclick="toHome()">Home</button></div></div>';
    }
    runS = null;
  }
  function toHome() {
    if (location.hash === "#/home") route(); else location.hash = "#/home";
  }

  function recordMiss(tp) {
    var s = loadStat();
    var m = (s.weak_terms || {});
    m[tp] = num(m[tp]) + 1;
    s.weak_terms = m;
    saveStat();
  }
  /* ==================== flashcards + terms quiz engine ==================== */
  var fcS = null; /* flashcard session */
  var tzS = null; /* terms quiz session */

  function paintFlashcards() {
    var v = $("view-flashcards");
    if (!v) { toast("Flashcards view is missing from the page.", false); return; }
    var bank = window.TERM_BANK || {};
    var cats = Object.keys(bank);
    var h = "";
    h += '<div class="page-head"><h2>Flashcards</h2>';
    h += '<p class="sub">Tap to flip &middot; mark known or revisit weak ones.</p></div>';
    h += '<div class="card"><h3>1 &middot; Pick categories</h3><div class="optrow">';
    cats.forEach(function (c) {
      var n = (bank[c].terms || []).length;
      h += '<label class="ck"><input type="checkbox" class="fc" value="' + esc(c) + '" checked> ' +
        esc(bank[c].label || c) + ' <small>' + n + '</small></label>';
    });
    h += '</div></div>';
    h += '<div class="card"><h3>2 &middot; Card count</h3><div class="optrow">';
    [10, 15, 20, 25, 30].forEach(function (n) {
      h += '<label class="ck"><input type="radio" name="fcn" value="' + n + '"' + (n === 15 ? " checked" : "") + '> ' + n + '</label>';
    });
    h += '</div></div>';
    h += '<div class="actions"><button class="btn primary big" onclick="startFC()">Start Flashcards</button></div>';
    v.innerHTML = h;
  }

  function startFC() {
    var cc = [], n = 15;
    $$(".fc").forEach(function (b) { if (b.checked) cc.push(b.value); });
    if (!cc.length) { toast("Pick at least one category.", false); return; }
    var ne = $$('input[name=fcn]:checked')[0];
    if (ne) n = num(ne.value);
    var pool = [];
    cc.forEach(function (c) {
      ((window.TERM_BANK || {})[c] || {}).terms.forEach(function (pair) {
        if (pair && pair.length >= 2) pool.push({ c: c, term: pair[0], def: pair[1] });
      });
    });
    if (!pool.length) { toast("No cards for that category.", false); return; }
    pool = shuffle(pool);
    if (n < pool.length) pool = pool.slice(0, n);
    /* group-unknown-first: pull out terms already marked weak */
    var s = loadStat(), weak = s.weak_terms || {};
    pool.sort(function (a, b) {
      var wa = num(weak[a.term]), wb = num(weak[b.term]);
      return (wb - wa);
    });
    fcS = { qs: pool, i: 0, ok: 0, marks: {} };
    modeOpen("cards");
    routeHash("flashcards_run");
  }

  function paintFCRun() {
    var v = $("view-flashcards_run");
    if (!v) return;
    if (!fcS || !fcS.qs[fcS.i]) { finishFC(); return; }
    var c = fcS.qs[fcS.i];
    var h = "";
    h += '<div class="run-top"><span class="run-q">Card ' + (fcS.i + 1) + " of " + fcS.qs.length +
      '</span><span class="run-y">' + esc(catLabel(c.c)) + '</span></div>';
    h += '<div class="fc-card" id="fc-card" onclick="flipFC()">';
    h += '<div class="fc-face fc-front"><div class="fc-label">TERM</div>' + esc(c.term) + '</div>';
    h += '<div class="fc-face fc-back"><div class="fc-label">DEFINITION</div>' + esc(c.def) + '</div>';
    h += "</div>";
    h += '<div class="fc-btns"><button class="btn ghost" onclick="flipFC()">Flip</button>' +
      '<button class="btn primary" onclick="knownFC()">Known</button>' +
      '<button class="btn ghost" onclick="weakFC()">Still Weak</button></div>';
    h += '<div class="run-btns"><button class="btn primary full" onclick="nextFC()">Next Card</button></div>';
    v.innerHTML = h;
    var vb = $("view-flashcards");
    if (vb) vb.classList.remove("active");
    var vv = $("view-flashcards_run");
    if (vv) vv.classList.add("active");
  }

  function flipFC() { var c = $("fc-card"); if (c) c.classList.toggle("flipped"); }
  function knownFC() {
    if (!fcS) return;
    fcS.ok++;
    var v = $("fc-card");
    if (v) { v.classList.add("ok"); setTimeout(function () { nextFC(); }, 320); }
  }
  function weakFC() {
    if (!fcS) return;
    statBump("flashcards_weak", 1);
    bumpTerm(fcS.qs[fcS.i].term);
    toast("Logged as weak.", true);
    nextFC();
  }
  function bumpTerm(t) {
    var s = loadStat();
    var w = s.weak_terms || {}; w[t] = num(w[t]) + 1; s.weak_terms = w; saveStat();
  }
  function nextFC() {
    if (!fcS) return;
    fcS.i++;
    if (fcS.i >= fcS.qs.length) { finishFC(); return; }
    paintFCRun();
  }
  function finishFC() {
    if (!fcS) return;
    modeClose("cards");
    var ok = fcS.ok, n = fcS.qs.length, pct = n ? Math.round(100 * ok / n) : 0;
    statBump("flashcards_done", 1);
    recordDay("Reviewed " + n + " flashcards · " + ok + " known");
    var best = num(statGet("fc_best", 0));
    if (pct > best) statSet("fc_best", pct);
    var v = $("view-flashcards_run");
    if (v) {
      v.innerHTML = '<div class="result-card"><div class="big-score">' + pct +
        '%</div><div class="result-title">Flashcards Done</div>' +
        '<div class="res-row"><div><b>' + ok + '</b> known</div><div><b>' + (n - ok) +
        "</b> weak</div></div>" +
        '<div class="run-btns"><button class="btn primary full" onclick="paintFlashcards()">Back to Setup</button>' +
        '<button class="btn ghost full" onclick="toHome()">Home</button></div></div>';
    }
    fcS = null;
  }

  function paintTerms() {
    var v = $("view-terms");
    if (!v) return;
    var bank = window.TERM_BANK || {};
    var cats = Object.keys(bank);
    var h = "";
    h += '<div class="page-head"><h2>Terms Quiz</h2>';
    h += '<p class="sub">Multiple-choice drill over the DECA glossary.</p></div>';
    h += '<div class="card"><h3>Pick categories</h3><div class="optrow">';
    cats.forEach(function (c) {
      var n = (bank[c].terms || []).length;
      h += '<label class="ck"><input type="checkbox" class="tc" value="' + esc(c) + '" checked> ' +
        esc(bank[c].label || c) + ' <small>' + n + '</small></label>';
    });
    h += '</div></div>';
    h += '<div class="card"><h3>Questions</h3><div class="optrow">';
    [10, 15, 20, 25].forEach(function (n) {
      h += '<label class="ck"><input type="radio" name="tcn" value="' + n + '"' + (n === 15 ? " checked" : "") + '> ' + n + '</label>';
    });
    h += '</div></div>';
    h += '<div class="actions"><button class="btn primary big" onclick="startTQ()">Start Terms Quiz</button></div>';
    v.innerHTML = h;
  }

  function startTQ() {
    var cc = [];
    $$(".tc").forEach(function (b) { if (b.checked) cc.push(b.value); });
    if (!cc.length) { toast("Pick at least one category.", false); return; }
    var ne = $$('input[name=tcn]:checked')[0];
    var n = ne ? num(ne.value) : 15;
    var qq = [];
    cc.forEach(function (c) {
      (bank_terms(c) || []).forEach(function (t) {
        if (t && t.length >= 2) qq.push({ c: c, term: t[0], def: t[1] });
      });
    });
    if (!qq.length) { toast("No terms for that selection.", false); return; }
    qq = shuffle(qq);
    if (n < qq.length) qq = qq.slice(0, n);
    tzS = { qs: qq, i: 0, ok: 0, bad: 0 };
    modeOpen("terms");
    routeHash("terms_run");
  }

  function bank_terms(c) { return ((window.TERM_BANK || {})[c] || {}).terms || []; }
  function catLabel(c) { return ((window.TERM_BANK || {})[c] || {}).label || c || ""; }

  function paintTermsRun() {
    var v = $("view-terms_run");
    if (!v) return;
    if (!tzS || !tzS.qs[tzS.i]) { finishTQ(); return; }
    var t = tzS.qs[tzS.i];
    var wrongs = [];
    /* build distractors from terms in same category/other categories */
    var all = [];
    Object.keys(window.TERM_BANK || {}).forEach(function (c) {
      (bank_terms(c) || []).forEach(function (p) {
        if (p && p.length >= 2 && p[0] !== t.term) all.push({ term: p[0], def: p[1] });
      });
    });
    var distractorPool = shuffle(all).slice(0, 3);
    var opts = distractorPool.map(function (p) { return p.def; });
    opts.push(t.def);
    opts = shuffle(opts);
    var letters = ["A", "B", "C", "D"];
    var h = "";
    h += '<div class="run-top"><span class="run-q">Term ' + (tzS.i + 1) + " of " + tzS.qs.length +
      '</span><span class="run-y">' + esc(catLabel(t.c)) + '</span></div>';
    h += '<div class="q-card"><div class="q-text">' + esc(t.term) + '</div></div>';
    h += '<div class="opts">';
    opts.forEach(function (d, di) {
      h += '<label class="opt"><input type="radio" name="tans" value="' + di + '">' +
        '<span class="opt-l">' + letters[di] + '</span><span class="opt-t">' + esc(d) + "</span></label>";
    });
    h += "</div>";
    h += '<div class="run-btns"><button class="btn primary" onclick="confirmT()">Check</button>' +
      '<button class="btn ghost" onclick="skipT()">Skip</button></div>';
    h += '<div id="x-tz-reveal"></div>';
    v.innerHTML = h;
  }

  function confirmT() {
    if (!tzS) return;
    var pick = $$('input[name=tans]:checked')[0];
    if (!pick) { toast("Pick an answer first.", false); return; }
    var t = tzS.qs[tzS.i];
    var chosen = num(pick.value);
    /* the correct def index was the last pushed before shuffle; we must find def text */
    var rightIndex = -1;
    var ok = false;
    var optsNow = $$('.opts .opt .opt-t').map(function (s) { return s.textContent; });
    if (optsNow[chosen] === t.def) ok = true;
    if (ok) { tzS.ok++; statBump("terms_right", 1); }
    else { tzS.bad++; statBump("terms_wrong", 1); bumpTerm(t.term); }
    var fb = $("x-tz-reveal");
    if (fb) {
      var hv = '<div class="fb ' + (ok ? "ok" : "no") + '"><b>' + (ok ? "Correct!" : "Incorrect") +
        '</b><div>Answer: ' + (ok ? esc(t.def) : "<span class=weak-line>Review &mdash; " + esc(t.term) + "</span>") +
        '</div><button class="btn primary full" onclick="nextT()">' +
        (tzS.i + 1 >= tzS.qs.length ? "Finish" : "Next") + "</button></div>";
      fb.innerHTML = hv;
    }
  }
  function skipT() {
    if (!tzS) return;
    tzS.bad++;
    statBump("terms_skipped", 1);
    nextT();
  }
  function nextT() {
    if (!tzS) return;
    tzS.i++;
    if (tzS.i >= tzS.qs.length) { finishTQ(); return; }
    paintTermsRun();
  }
  function finishTQ() {
    if (!tzS) return;
    modeClose("terms");
    var ok = tzS.ok, n = tzS.qs.length, pct = n ? Math.round(100 * ok / n) : 0;
    statBump("terms_done", 1);
    recordDay("Terms quiz · " + n + " questions · " + pct + "%");
    var v = $("view-terms_run");
    if (v) {
      v.innerHTML = '<div class="result-card"><div class="big-score">' + pct +
        '%</div><div class="result-title">Terms Quiz Done</div>' +
        '<div class="res-row"><div><b>' + ok + '</b> correct</div><div><b>' + (n - ok) +
        "</b> missed</div></div>" +
        '<div class="run-btns"><button class="btn primary full" onclick="paintTerms()">Back to Setup</button>' +
        '<button class="btn ghost full" onclick="toHome()">Home</button></div></div>';
    }
    tzS = null;
  }

  /* ==================== home engine ==================== */
  /* ==================== home + interview + progress ==================== */

  /* ---- home: hero + quick actions + streak ---- */
  function paintHome() {
    var v = $("view-home");
    if (!v) return;
    var s = loadStat(), h = "";
    var me = activeProfile();
    var st = (s.study && typeof s.study === "object") ? s.study : { total_ms: 0, daily: {} };
    var streak = num(s.streak);
    var best = num(s.best_pct);
    var tot = num(s.questions_total);
    var today = ymd();
    var onToday = s.days && s.days[today];
    h += '<div class="hero"><h1>DECA <span class="accent">Study Hub</span></h1>';
    h += '<p class="hero-sub">500-question exam bank &middot; flashcards &middot; terms quiz &middot; interview practice.';
    if (me) h += ' Signed in as <b>' + esc(me.name) + "</b>.";
    h += "</p>";
    h += '<div class="hero-btns"><a class="btn primary" href="#/exams">Start an Exam</a>';
    h += '<a class="btn ghost" href="#/flashcards">Flashcards</a></div></div>';
    h += '<div class="streak-row">';
    h += '<div class="stat-tile"><div class="sv">' + fmtHours(num(st.total_ms)) + '</div><div class="sl">Hours studied</div></div>';
    h += '<div class="stat-tile"><div class="sv">' + streak + '</div><div class="sl">Day streak</div></div>';
    h += '<div class="stat-tile"><div class="sv">' + best + '%</div><div class="sl">Best exam</div></div>';
    h += '<div class="stat-tile"><div class="sv">' + num(s.exams_done) + '</div><div class="sl">Exams done</div></div>';
    h += '<div class="stat-tile"><div class="sv">' + tot + '</div><div class="sl">Questions</div></div>';
    h += "</div>";
    if (!onToday) h += '<div class="warn-strip">Complete one practice task today to keep your streak.</div>';
    h += '<div class="quick-grid">';
    h += '<div class="qk card" onclick="toHomeNu()"><div class="qk-ic">EX</div><div><h3>Practice Exam</h3><p>Timed drills with real DECA years.</p></div></div>';
    h += '<div class="qk card" onclick="toNu(\'flashcards\')"><div class="qk-ic">FC</div><div><h3>Flashcards</h3><p>Flip through DECA terms.</p></div></div>';
    h += '<div class="qk card" onclick="toNu(\'terms\')"><div class="qk-ic">TQ</div><div><h3>Terms Quiz</h3><p>Multiple-choice glossary drill.</p></div></div>';
    h += '<div class="qk card" onclick="toNu(\'interview\')"><div class="qk-ic">IV</div><div><h3>Interview Prep</h3><p>Roleplays, scenarios, questions.</p></div></div>';
    h += '<div class="qk card" onclick="toNu(\'leaderboard\')"><div class="qk-ic">LB</div><div><h3>Leaderboard</h3><p>Study hours head to head.</p></div></div>';
    h += '<div class="qk card" onclick="toNu(\'progress\')"><div class="qk-ic">PR</div><div><h3>Progress</h3><p>Hours, accuracy, milestones.</p></div></div>';
    h += "</div>";
    h += '<div class="card"><h3>Recent activity</h3>';
    var act = s.recent || [];
    if (!act.length) h += '<p class="muted">Nothing yet — go take an exam!</p>';
    else {
      act.slice(0, 5).forEach(function (e) { h += '<div class="act-row">' + esc(e.t) + "</div>"; });
    }
    h += "</div>";
    v.innerHTML = h;
    paintProfileChip();
  }

  /* ---- header profile chip ---- */
  function paintProfileChip() {
    var el = $("profile-chip");
    if (!el) return;
    var me = activeProfile();
    if (!me) { el.style.display = "none"; return; }
    el.style.display = "";
    var s = loadStat();
    var st = (s.study && typeof s.study === "object") ? s.study : { total_ms: 0 };
    el.innerHTML = '<span class="pc-av">' + esc(me.name.charAt(0).toUpperCase()) + "</span>" +
      '<span class="pc-txt"><b>' + esc(me.name) + "</b><small>" + fmtHours(num(st.total_ms)) + " studied</small></span>";
  }

  /* ---- interview: format list + roleplay ---- */
  function paintInterview() {
    var v = $("view-interview");
    if (!v) return;
    var bank = window.INTERVIEW_DATA || {};
    var fmts = bank.formats || [];
    var h = "";
    h += '<div class="page-head"><h2>Interview Prep</h2><p class="sub">DECA roleplays &amp; situational interviews &mdash; pick a format and practice out loud.</p></div>';
    if (!fmts.length) { h += '<div class="card"><p class="muted">No interview data loaded.</p></div>'; v.innerHTML = h; return; }
    var i = statGet("iight", -1) + 1; /* gentle rotation so it's not the same one every time */
    h += '<div class="fmt-grid">';
    fmts.forEach(function (f, fi) {
      h += '<div class="qk card" onclick="startIV(' + fi + ')"><div class="qk-ic">IV</div>' +
        '<div><h3>' + esc(f.name) + '</h3><p>' + esc(f.desc || "") + "</p>" +
        '<small>' + esc(f.time || "") + (f.prep ? " &middot; " + esc(f.prep) + " prep" : "") + "</small></div></div>";
    });
    h += "</div>";
    v.innerHTML = h;
  }

  var ivS = null; /* live interview session */

  function startIV(fi) {
    var bank = ((window.INTERVIEW_DATA || {}).formats || []);
    var f = bank[fi];
    if (!f) { toast("That format isn't available.", false); return; }
    ivS = { f: f, step: 0, started: now() };
    statBump("interview_started", 1);
    modeOpen("interview");
    toNu("interview_run");
    paintIVRun();
  }

  function paintIVRun() {
    var v = $("view-interview_run");
    if (!v || !ivS) return;
    var f = ivS.f, h = "";
    h += '<div class="page-head"><h2>' + esc(f.name) + "</h2><p class=\"sub\">" + esc(f.desc || "") + "</p></div>";
    h += '<div class="run-top"><span class="run-q">' + esc(f.code || "IV") + "</span>";
    h += '<span class="run-y">' + [esc(f.prep || ""), esc(f.time || "")].filter(Boolean).join(" &middot; ") + "</span></div>";
    if (f.parts) {
      h += '<div class="iv-prompt card"><div class="iv-label">FORMAT</div><div class="iv-text">' + esc(f.parts) + "</div></div>";
    }
    if (f.body) h += '<div class="card"><h3>How it works</h3><p>' + esc(f.body) + "</p></div>";
    h += '<div class="iv-tips card"><h3>Coach notes</h3>';
    (f.tips || []).forEach(function (tip, ti) {
      h += '<div class="tip-row"><span class="tip-n">' + (ti + 1) + "</span>" + esc(tip) + "</div>";
    });
    h += "</div>";
    h += '<div class="actions"><button class="btn primary big" onclick="finishIV()">Mark Done</button>' +
      '<button class="btn ghost big" onclick="toNu(\'interview\')">All Formats</button></div>';
    v.innerHTML = h;
  }

  function finishIV() {
    if (!ivS) return;
    modeClose("interview");
    statBump("interview_done", 1);
    recordDay("Practiced " + (ivS.f.name || "an interview format"));
    var v = $("view-interview_run");
    if (v) {
      v.innerHTML = '<div class="result-card"><div class="big-score">' + num(statGet("interview_done", 0)) +
        "</div><div class='result-title'>Interviews Completed</div>" +
        '<div class="res-row"><div><b>Great</b><span>practice!</span></div>' +
        '<div><b>' + esc(ivS.f.name) + "</b><span>format</span></div></div>" +
        '<div class="run-btns"><button class="btn primary full" onclick="toNu(\'interview\')">More Formats</button>' +
        '<button class="btn ghost full" onclick="toNu(\'home\')">Home</button></div></div>';
    }
    ivS = null;
  }

  /* ---- progress: study hours + accuracy + weak terms ---- */
  function paintProgress() {
    var v = $("view-progress");
    if (!v) return;
    var s = loadStat(), h = "";
    var me = activeProfile();
    var st = (s.study && typeof s.study === "object") ? s.study : { total_ms: 0, by_mode: {}, daily: {} };
    var examDone = num(s.exams_done), tqDone = num(s.terms_done), fcDone = num(s.flashcards_done);
    var right = num(s.exams_right) + num(s.terms_right) + num(s.flashcards_right);
    var tot = num(s.exams_wrong) + right + num(s.terms_wrong) + num(s.flashcards_wrong);
    var acc = tot ? Math.round(100 * right / tot) : 0;
    var totalMs = num(st.total_ms), weekMs = msThisWeek(st), todayMs = msToday(st);

    h += '<div class="page-head"><h2>Progress</h2><p class="sub">';
    h += me ? "Everything " + esc(me.name) + " has put in — hours, accuracy, streaks." : "Hours, accuracy, streaks.";
    h += '</p></div>';

    /* headline hours */
    h += '<div class="big-acc card"><div class="big-score">' + fmtHours(totalMs) + "</div><div>total study time</div>";
    h += '<div class="sub-acc">' + fmtHm(weekMs) + " this week</div><div>" + fmtHm(todayMs) + " today</div></div>";

    /* weekly bars */
    h += '<div class="card"><h3>Last 14 days</h3><div class="daybars">';
    var peak = 0, series = [];
    for (var dd = 13; dd >= 0; dd--) {
      var ds = new Date(); ds.setDate(ds.getDate() - dd);
      var ms = num(st.daily && st.daily[ymd(ds)]);
      if (ms > peak) peak = ms;
      series.push({ d: ds, ms: ms });
    }
    if (peak <= 0) h += '<p class="muted">No time logged yet. Start a drill and it will show up here.</p>';
    else {
      series.forEach(function (e) {
        var pct = Math.max(3, Math.round(100 * e.ms / peak));
        h += '<div class="daybar" title="' + e.ms + 'ms"><div class="daybar-col">';
        h += '<div class="daybar-fill' + (e.ms ? " on" : "") + '" style="height:' + pct + '%"></div></div>';
        h += '<div class="dn">' + e.d.getDate() + "</div></div>";
      });
      h += '<div class="daybar-note">peak ' + fmtHm(peak) + " · " + fmtHours(totalMs) + " all time</div>";
    }
    h += "</div></div>";

    /* where the hours went */
    h += '<div class="card"><h3>Where the hours go</h3><div class="modebars">';
    var bm = st.by_mode || {}, any = false;
    ["exam", "terms", "cards", "interview", "browse"].forEach(function (m) {
      var ms = num(bm[m]);
      if (ms > 0) any = true;
      var pc = totalMs ? Math.round(100 * ms / totalMs) : 0;
      h += '<div class="modebar"><span class="mb-l">' + (MODE_LABEL[m] || m) + "</span>";
      h += '<span class="mb-t"><span class="mb-fill" style="width:' + pc + '%"></span></span>';
      h += '<span class="mb-v">' + fmtHm(ms) + "</span></div>";
    });
    if (!any) h += '<p class="muted">Nothing tracked yet.</p>';
    h += "</div></div>";

    /* counts */
    h += '<div class="stat-grid">';
    h += '<div class="stat-tile"><div class="sv">' + examDone + '</div><div class="sl">Exams</div></div>';
    h += '<div class="stat-tile"><div class="sv">' + tqDone + '</div><div class="sl">Terms quizzes</div></div>';
    h += '<div class="stat-tile"><div class="sv">' + fcDone + '</div><div class="sl">Card runs</div></div>';
    h += '<div class="stat-tile"><div class="sv">' + num(s.streak) + '</div><div class="sl">Day streak</div></div>';
    h += '<div class="stat-tile"><div class="sv">' + num(s.best_pct) + '%</div><div class="sl">Best exam</div></div>';
    h += '<div class="stat-tile"><div class="sv">' + num(s.questions_total) + '</div><div class="sl">Questions</div></div>';
    h += "</div>";

    h += '<div class="big-acc card"><div class="big-score">' + acc + '%</div><div>overall accuracy</div>';
    h += '<div class="sub-acc">' + right + " right</div><div>" + (tot - right) + " wrong</div></div>";

    /* achievements */
    h += '<div class="card"><h3>Milestones</h3><div class="ach-grid">';
    ACHIEVEMENTS.forEach(function (a) {
      var got = a.test(s, st);
      h += '<div class="ach' + (got ? " got" : "") + '"><div class="ach-ic">' + (got ? "&#10003;" : "&#9675;") + "</div>";
      h += '<div class="ach-t">' + esc(a.name) + "</div>";
      h += '<div class="ach-d">' + esc(a.desc(got ? s : s, st)) + "</div></div>";
    });
    h += "</div></div>";

    var weak = s.weak_terms || {};
    var wk = Object.keys(weak).sort(function (a, b) { return num(weak[b]) - num(weak[a]); }).slice(0, 12);
    if (wk.length) {
      h += '<div class="card"><h3>Weak spots &mdash; drill these</h3>';
      wk.forEach(function (w) {
        h += '<div class="weak-row"><span>' + esc(w) + '</span><b>' + num(weak[w]) + "</b></div>";
      });
      h += "</div>";
    }
    v.innerHTML = h;
  }

  /* ==================== leaderboard ====================
     Ranks the profiles saved on THIS device only. There is no server,
     so this is not a cross-device or cross-person board. */
  function paintLeaderboard() {
    var v = $("view-leaderboard");
    if (!v) return;
    var p = loadProfiles();
    var rows = p.list.map(function (pr) {
      var st = readStudyOf(pr.id);
      var raw = null;
      try { raw = JSON.parse(localStorage.getItem(skeyFor(pr.id)) || "{}"); } catch (e) { raw = {}; }
      return {
        id: pr.id, name: pr.name,
        total: st ? num(st.total_ms) : 0,
        week: st ? msThisWeek(st) : 0,
        today: st ? msToday(st) : 0,
        streak: num(raw.streak),
        qs: num(raw.questions_total),
        acc: (num(raw.exams_right) + num(raw.terms_right) + num(raw.flashcards_right) + num(raw.exams_wrong) + num(raw.terms_wrong) + num(raw.flashcards_wrong)) > 0
          ? Math.round(100 * (num(raw.exams_right) + num(raw.terms_right) + num(raw.flashcards_right)) /
            (num(raw.exams_right) + num(raw.terms_right) + num(raw.flashcards_right) + num(raw.exams_wrong) + num(raw.terms_wrong) + num(raw.flashcards_wrong)))
          : 0
      };
    });
    var h = "";
    h += '<div class="page-head"><h2>Leaderboard</h2><p class="sub">';
    h += rows.length > 1
      ? "Study hours across the " + rows.length + " profiles on this device."
      : "Study hours for the profiles on this device.";
    h += '</p></div>';

    if (!rows.length) {
      h += '<div class="card"><p class="muted">No profiles yet. Add one from the sign-in screen.</p></div>';
      v.innerHTML = h;
      return;
    }

    var medal = ["&#9733;", "&#9734;", "&#9735;"];
    var byTotal = rows.slice().sort(function (a, b) { return b.total - a.total || a.name.localeCompare(b.name); });
    h += '<div class="card"><h3>All time &mdash; total hours studied</h3>';
    h += '<div class="lb-lb">';
    byTotal.forEach(function (r, i) {
      var top = byTotal[0].total || 1;
      h += '<div class="lb-row' + (r.id === (activeProfile() || {}).id ? " me" : "") + '">';
      h += '<div class="lb-rank">' + (i < 3 ? medal[i] : (i + 1)) + "</div>";
      h += '<div class="lb-name">' + esc(r.name) + (r.id === (activeProfile() || {}).id ? ' <span class="lb-you">you</span>' : "") + "</div>";
      h += '<div class="lb-meter"><span style="width:' + Math.max(2, Math.round(100 * r.total / top)) + '%"></span></div>';
      h += '<div class="lb-hrs">' + fmtHours(r.total) + "</div>";
      h += "</div>";
    });
    h += "</div></div>";

    h += '<div class="card"><h3>This week &mdash; hours in the last 7 days</h3><div class="lb-lb">';
    var byWeek = rows.slice().sort(function (a, b) { return b.week - a.week || a.name.localeCompare(b.name); });
    var wtop = byWeek[0].week || 1;
    byWeek.forEach(function (r, i) {
      h += '<div class="lb-row' + (r.id === (activeProfile() || {}).id ? " me" : "") + '">';
      h += '<div class="lb-rank">' + (i < 3 ? medal[i] : (i + 1)) + "</div>";
      h += '<div class="lb-name">' + esc(r.name) + "</div>";
      h += '<div class="lb-meter"><span style="width:' + Math.max(2, Math.round(100 * r.week / wtop)) + '%"></span></div>';
      h += '<div class="lb-hrs">' + fmtHours(r.week) + "</div>";
      h += "</div>";
    });
    h += "</div></div>";

    h += '<div class="card"><h3>Streaks</h3><div class="lb-lb">';
    var byStreak = rows.slice().sort(function (a, b) { return b.streak - a.streak || a.name.localeCompare(b.name); });
    byStreak.forEach(function (r, i) {
      h += '<div class="lb-row' + (r.id === (activeProfile() || {}).id ? " me" : "") + '">';
      h += '<div class="lb-rank">' + (i < 3 ? medal[i] : (i + 1)) + "</div>";
      h += '<div class="lb-name">' + esc(r.name) + "</div>";
      h += '<div class="lb-meter"><span style="width:' + Math.max(2, Math.min(100, r.streak * 10)) + '%"></span></div>';
      h += '<div class="lb-hrs">' + r.streak + (r.streak === 1 ? " day" : " days") + "</div>";
      h += "</div>";
    });
    h += "</div></div>";

    h += '<div class="card"><h3>Detail</h3><div class="lb-table">';
    h += '<div class="lb-thead"><span>Profile</span><span>Total</span><span>This week</span><span>Today</span><span>Streak</span><span>Questions</span><span>Accuracy</span></div>';
    rows.slice().sort(function (a, b) { return b.total - a.total; }).forEach(function (r) {
      h += '<div class="lb-tr' + (r.id === (activeProfile() || {}).id ? " me" : "") + '">';
      h += '<span class="lb-tname">' + esc(r.name) + "</span>";
      h += "<span>" + fmtHours(r.total) + "</span>";
      h += "<span>" + fmtHours(r.week) + "</span>";
      h += "<span>" + fmtHours(r.today) + "</span>";
      h += "<span>" + r.streak + "</span>";
      h += "<span>" + r.qs + "</span>";
      h += "<span>" + r.acc + "%</span>";
      h += "</div>";
    });
    h += "</div></div>";

    h += '<div class="card"><p class="muted">These numbers come from this browser only. There is no server, so this board shows the profiles on this device &mdash; not your whole chapter. To rank a real group, the app would need a shared database.</p></div>';
    v.innerHTML = h;
  }

  var ACHIEVEMENTS = [
    { name: "First steps", desc: function () { return "Finish any practice session"; }, test: function (s) { return num(s.exams_done) + num(s.terms_done) + num(s.flashcards_done) > 0; } },
    { name: "Century", desc: function () { return "Answer 100 questions"; }, test: function (s) { return num(s.questions_total) >= 100; } },
    { name: "500 club", desc: function () { return "Answer 500 questions"; }, test: function (s) { return num(s.questions_total) >= 500; } },
    { name: "Ten hours", desc: function () { return "Log 10 hours of study time"; }, test: function (s, st) { return num(st.total_ms) >= 10 * 3600000; } },
    { name: "Fifty hours", desc: function () { return "Log 50 hours of study time"; }, test: function (s, st) { return num(st.total_ms) >= 50 * 3600000; } },
    { name: "Week strong", desc: function () { return "Hit a 7-day streak"; }, test: function (s) { return num(s.streak) >= 7; } },
    { name: "Sharpshooter", desc: function () { return "Score 90%+ on an exam"; }, test: function (s) { return num(s.best_pct) >= 90; } },
    { name: "Perfect run", desc: function () { return "Score 100% on an exam"; }, test: function (s) { return num(s.best_pct) >= 100; } }
  ];


  /* ==================== expose handlers (IIFE close) ====================
     inline onclick strings need these on the global scope: attach every
     handler the UI references, then close the module IIFE. */
  window.toNu = toNu;
  window.routeHash = routeHash;
  window.routeHashRV = routeHashRV;
  window.toHome = toHome;
  window.toHomeNu = toHome; /* legacy alias */
  window.paintExams = paintExams;
  window.paintFlashcards = paintFlashcards;
  window.paintTerms = paintTerms;
  window.startExam = startExam;
  window.startFC = startFC;
  window.startTQ = startTQ;
  window.startIV = startIV;
  window.nextQ = nextQ;
  window.skipQ = skipQ;
  window.confirmQ = confirmQ;
  window.nextT = nextT;
  window.skipT = skipT;
  window.confirmT = confirmT;
  window.nextFC = nextFC;
  window.flipFC = flipFC;
  window.knownFC = knownFC;
  window.weakFC = weakFC;
  window.finishFC = finishFC;
  window.finishIV = finishIV;
  /* profiles / gate / leaderboard */
  window.gateCreate = gateCreate;
  window.gatePick = gatePick;
  window.gatePinTry = gatePinTry;
  window.renderGate = renderGate;
  window.switchTo = switchTo;
  window.lockNow = lockNow;
  window.paintLeaderboard = paintLeaderboard;
  window.paintProfileChip = paintProfileChip;
  window.stopAllTimers = stopAllTimers;
  window.flushStudy = function () { commitBrowse(); Object.keys(modeStart).forEach(modeClose); };
})();
