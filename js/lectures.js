/* ==========================================================================
   DHL — lectures.js (lectures.html)
   Categories and lectures come from content/lectures.json, edited in
   Pages CMS ("Lectures"). Three views on one page:
     lectures.html                  all categories + latest lectures
     lectures.html?c=CATEGORY       one category and its lectures
     lectures.html?c=CATEGORY&l=ID  one lecture (video, article, slides…)
   ========================================================================== */
(() => {
  "use strict";
  const D = window.DHL;
  const { $, $$, esc, icon, safeUrl, isExternal, renderChips, longDate, articleHtml, bibleUrl } = D;
  const root = $("#lectures-root"); if (!root) return;

  const TYPES = {
    video: { label: "Video", plural: "Videos", icon: "youtube" },
    article: { label: "Article", plural: "Articles", icon: "book" },
    slides: { label: "Slides", plural: "Slides", icon: "spark" },
    pdf: { label: "PDF", plural: "PDFs", icon: "download" },
    audio: { label: "Audio", plural: "Audio", icon: "play" },
    playlist: { label: "Playlist", plural: "Playlists", icon: "youtube" },
    link: { label: "Link", plural: "Links", icon: "external" }
  };
  const t = type => TYPES[type] || TYPES.article;
  const cats = (window.lectureCategories || []).filter(c => c && c.enabled !== false && c.title && c.id);
  /* Members-only lectures from the members service are added by category. */
  const extra = {};
  const lecturesOf = c => [...(c.lectures || []), ...(extra[c.id] || [])].filter(l => l && l.enabled !== false && l.title && l.id);
  const byNewest = (a, b) => String(b.date || "").localeCompare(String(a.date || ""));
  const params = new URLSearchParams(location.search);
  const catUrl = c => `lectures.html?c=${encodeURIComponent(c.id)}`;
  const lecUrl = (c, l) => `${catUrl(c)}&l=${encodeURIComponent(l.id)}`;
  const ytId = s => { s = String(s || "").trim(); const m = s.match(/(?:youtu\.be\/|v=|\/shorts\/|\/embed\/|\/live\/)([A-Za-z0-9_-]{11})/) || s.match(/^([A-Za-z0-9_-]{11})$/); return m ? m[1] : ""; };
  /* YouTube playlist ID from a link like https://www.youtube.com/playlist?list=PL… */
  const listId = s => { s = String(s || "").trim(); const m = s.match(/[?&]list=([A-Za-z0-9_-]+)/) || s.match(/^((?:PL|UU|FL|OL|LL|RD)[A-Za-z0-9_-]+)$/); return m ? m[1] : ""; };
  const playlistBlock = (id, title, note) => `
    <div class="lec-playlist">
      <div class="lec-video"><iframe src="https://www.youtube-nocookie.com/embed/videoseries?list=${esc(id)}&rel=0" title="${esc(title)} (YouTube playlist)" loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>
      <p class="lec-playlist-note">${icon("youtube", "icon icon-sm")}<span>${esc(note)}</span><a href="https://www.youtube.com/playlist?list=${esc(id)}" target="_blank" rel="noopener">Open the playlist on YouTube<span class="sr-only"> (opens in a new tab)</span></a></p>
    </div>`;
  const ext = u => { const s = String(u || ""); const n = (s.match(/[?&]name=([^&]+)/) || [])[1]; return decodeURIComponent(n || s.split("?")[0]).split(".").pop().toLowerCase(); };
  const abs = u => { try { return new URL(u, location.href).href; } catch (e) { return u; } };

  /* A category can be a topic or a person (speaker profile). "style" in
     Pages CMS: person, topic, or empty = decide from the photo's shape. */
  const isPerson = c => c.style === "person";
  const bioHtml = text => articleHtml(String(text || "").trim());
  const hasList = text => /^\s*[-*•]\s+/m.test(String(text || ""));
  function markPortraits(scope) {
    $$("[data-cat-style]", scope).forEach(card => {
      if (card.dataset.catStyle !== "auto") return;
      const img = card.querySelector("img"); if (!img) return;
      const check = () => { if (img.naturalWidth && img.naturalWidth / img.naturalHeight < 1.25) card.classList.add("is-person"); };
      img.complete ? check() : img.addEventListener("load", check, { once: true });
    });
  }

  function setHero(title, lede, crumbs) {
    const h1 = $(".page-hero h1"); if (h1) h1.textContent = title;
    const p = $(".page-hero .lede"); if (p) { p.textContent = lede || ""; p.hidden = !lede; }
    const ol = $(".page-hero .crumbs ol");
    if (ol && crumbs) ol.innerHTML = crumbs.map(([l, h], i) => i === crumbs.length - 1 ? `<li><span aria-current="page">${esc(l)}</span></li>` : `<li><a href="${esc(h)}">${esc(l)}</a></li>`).join("");
    document.title = `${title} | DHL – Diaspora Hub for Leaders`;
  }
  const typeTags = list => [...new Set(list.map(l => l.type))].filter(x => TYPES[x]).map(x => `<span class="lec-type type-${x}">${icon(t(x).icon, "icon icon-sm")}${t(x).plural}</span>`).join("");

  function lectureCard(c, l, showCat) {
    const k = t(l.type);
    return `<li class="lec-card">
      <a href="${esc(lecUrl(c, l))}">
        <span class="lec-badges"><span class="lec-type type-${esc(l.type)}">${icon(k.icon, "icon icon-sm")}${k.label}</span>${l.membersOnly ? `<span class="lec-lock">${l.locked ? "🔒 " : ""}${l.audience === "students" ? "Students" : "Members"}</span>` : ""}</span>
        <h3>${esc(l.title)}</h3>
        <p class="lec-meta">${showCat ? `<span>${esc(c.title)}</span>` : ""}${l.speaker ? `<span>${icon("user", "icon icon-sm")}${esc(l.speaker)}</span>` : ""}${l.date ? `<span>${longDate(l.date)}</span>` : ""}</p>
        ${l.summary ? `<p class="lec-summary">${esc(l.summary)}</p>` : ""}
        <span class="lec-open" aria-hidden="true">Open</span>
      </a></li>`;
  }

  /* ---------- 1. All categories ---------- */
  function renderHome() {
    const intro = (window.lecturesIntro || "").trim();
    const all = cats.flatMap(c => lecturesOf(c).map(l => ({ c, l }))).sort((a, b) => byNewest(a.l, b.l));
    root.innerHTML = `
      <section class="section" aria-labelledby="lec-cats-title">
        <div class="wrap">
          ${intro ? `<div class="lec-intro">${articleHtml(intro)}</div>` : ""}
          <h2 id="lec-cats-title" class="sr-only">Categories</h2>
          <ul class="lec-cat-grid">${cats.length ? cats.map(c => {
            const ls = lecturesOf(c);
            const style = c.style === "person" || c.style === "topic" ? c.style : "auto";
            return `<li class="lec-cat${style === "person" ? " is-person" : ""}" data-cat-style="${style}"><a href="${esc(catUrl(c))}">
              <span class="lec-cat-img">${c.image ? `<img src="${esc(c.image)}" alt="${style === "topic" ? "" : `Photo of ${esc(c.title)}`}" loading="lazy">` : ""}</span>
              <span class="lec-cat-body">
                <h3>${esc(c.title)}</h3>
                ${c.description ? `<span class="lec-bio">${bioHtml(c.description)}</span>` : ""}
                <span class="lec-count">${ls.length ? `${ls.length} ${ls.length === 1 ? "lecture" : "lectures"}` : listId(c.playlist) ? "YouTube playlist" : "Lectures coming soon"}</span>
                ${ls.length || listId(c.playlist) ? `<span class="lec-types">${typeTags(ls)}${listId(c.playlist) && !ls.some(l => l.type === "playlist") ? `<span class="lec-type type-playlist">${icon("youtube", "icon icon-sm")}Playlist</span>` : ""}</span>` : ""}
              </span></a></li>`;
          }).join("") : '<li class="empty">No categories yet. Add them in Pages CMS → Lectures.</li>'}</ul>
        </div>
      </section>
      <section class="section section--white" aria-labelledby="lec-latest-title">
        <div class="wrap">
          <div class="section-head"><h2 id="lec-latest-title">Latest lectures</h2><p>Search all lectures, articles and slides.</p></div>
          <form class="search-bar" role="search" id="lec-search-form" aria-label="Search lectures">
            <label for="lec-search" class="sr-only">Search lectures</label>
            ${icon("search")}<input id="lec-search" type="search" placeholder="Search by title, speaker or topic" autocomplete="off">
          </form>
          <p class="result-count" id="lec-count" aria-live="polite"></p>
          <ul class="lec-list" id="lec-latest"></ul>
        </div>
      </section>`;
    markPortraits(root);
    const input = $("#lec-search"), list = $("#lec-latest"), count = $("#lec-count");
    const draw = () => {
      const q = input.value.trim().toLowerCase();
      const f = q ? all.filter(({ c, l }) => `${l.title} ${l.summary || ""} ${l.speaker || ""} ${c.title} ${l.content || ""}`.toLowerCase().includes(q)) : all.slice(0, 6);
      list.innerHTML = f.length ? f.map(({ c, l }) => lectureCard(c, l, true)).join("") : `<li class="empty">${q ? `No lectures match “${esc(input.value)}”.` : "New lectures will appear here."}</li>`;
      count.textContent = q ? `${f.length} result${f.length === 1 ? "" : "s"}` : "";
    };
    input.addEventListener("input", draw);
    $("#lec-search-form").addEventListener("submit", e => e.preventDefault());
    draw();
  }

  /* ---------- 2. One category ---------- */
  function renderCategory(c) {
    const ls = lecturesOf(c).sort(byNewest);
    setHero(c.title, hasList(c.description) ? "" : String(c.description || "").trim(), [["Home", "index.html"], ["Lectures", "lectures.html"], [c.title, ""]]);
    const style = c.style === "person" || c.style === "topic" ? c.style : "auto";
    const present = [...new Set(ls.map(l => l.type))].filter(x => TYPES[x]);
    root.innerHTML = `
      <section class="section" aria-labelledby="lec-cat-title">
        <div class="wrap">
          <div class="lec-profile${style === "person" ? " is-person" : ""}" data-cat-style="${style}">
            ${c.image ? `<img class="lec-profile-img" src="${esc(c.image)}" alt="${style === "topic" ? "" : `Photo of ${esc(c.title)}`}">` : ""}
            <div>
              ${hasList(c.description) ? `<div class="lec-bio">${bioHtml(c.description)}</div>` : ""}
              <h2 id="lec-cat-title">Lectures</h2>
              <p class="lec-count">${ls.length ? `${ls.length} ${ls.length === 1 ? "lecture" : "lectures"}` : "Lectures coming soon."}</p>
              <span class="lec-types">${typeTags(ls)}</span>
            </div>
          </div>
          ${listId(c.playlist) ? `<details class="lec-cat-playlist"><summary class="btn btn-mango">${icon("play")}Watch the full playlist</summary>${playlistBlock(listId(c.playlist), c.title, "Use the playlist button in the player to pick a video.")}</details>` : ""}
          <div class="filter-bar lec-filters">
            <form class="search-bar" role="search" id="lec-cs-form" aria-label="Search this category">
              <label for="lec-cs" class="sr-only">Search this category</label>
              ${icon("search")}<input id="lec-cs" type="search" placeholder="Search in ${esc(c.title)}" autocomplete="off">
            </form>
            <div class="chips" id="lec-type-filter" role="group" aria-label="Type"></div>
          </div>
          <p class="result-count" id="lec-cs-count" aria-live="polite"></p>
          <ul class="lec-list" id="lec-items"></ul>
          <p style="margin-top:1.5rem"><a class="text-link" href="lectures.html">All lecture categories</a></p>
        </div>
      </section>`;
    markPortraits(root);
    let type = "all";
    const input = $("#lec-cs"), list = $("#lec-items");
    const draw = () => {
      const q = input.value.trim().toLowerCase();
      const f = ls.filter(l => (type === "all" || l.type === type) && (!q || `${l.title} ${l.summary || ""} ${l.speaker || ""} ${l.content || ""}`.toLowerCase().includes(q)));
      list.innerHTML = f.length ? f.map(l => lectureCard(c, l, false)).join("") : `<li class="empty">${ls.length ? "Nothing matches. Try another word or type." : "Lectures for this category are coming soon."}</li>`;
      $("#lec-cs-count").textContent = ls.length ? `${f.length} of ${ls.length}` : "";
    };
    if (present.length > 1) renderChips($("#lec-type-filter"), [["all", "All"], ...present.map(x => [x, t(x).plural])], v => { type = v; draw(); });
    else $("#lec-type-filter").hidden = true;
    input.addEventListener("input", draw);
    $("#lec-cs-form").addEventListener("submit", e => e.preventDefault());
    draw();
  }

  /* ---------- 3. One lecture ---------- */
  function fileRow(f) {
    const url = f.file || f.url; if (!url) return "";
    const e = ext(url), label = f.label || url.split("/").pop();
    const office = ["ppt", "pptx", "doc", "docx", "xls", "xlsx"].includes(e);
    const kind = { pdf: "PDF", ppt: "PowerPoint", pptx: "PowerPoint", doc: "Word", docx: "Word", xls: "Excel", xlsx: "Excel", mp3: "Audio", m4a: "Audio" }[e] || (isExternal(url) ? "Link" : "File");
    const viewOnline = office && !f.protected && isExternal(abs(url)) && !/^(localhost|127\.)/.test(location.hostname)
      ? `<a class="btn btn-quiet btn-small" href="https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(abs(url))}" target="_blank" rel="noopener">View online<span class="sr-only">: ${esc(label)} (opens in a new tab)</span></a>` : "";
    const open = (isExternal(url) && !(f.protected && e !== "pdf")) || e === "pdf"
      ? `<a class="btn btn-primary btn-small" href="${esc(safeUrl(url))}" target="_blank" rel="noopener">Open<span class="sr-only">: ${esc(label)} (opens in a new tab)</span></a>` : "";
    const download = f.protected && e !== "pdf" ? `<a class="btn btn-quiet btn-small" href="${esc(url)}">Download<span class="sr-only">: ${esc(label)}</span></a>`
      : !isExternal(url) ? `<a class="btn btn-quiet btn-small" href="${esc(url)}" download>Download<span class="sr-only">: ${esc(label)}</span></a>` : "";
    return `<li class="lec-file"><span class="lec-file-kind">${esc(kind)}</span><span class="lec-file-name">${esc(label)}</span><span class="btn-row">${viewOnline}${open}${download}</span></li>`;
  }
  function renderLecture(c, l) {
    const all = lecturesOf(c).sort(byNewest);
    const i = all.findIndex(x => x.id === l.id), prev = all[i + 1], next = all[i - 1];
    const k = t(l.type), pl = listId(l.playlist) || listId(l.youtube), yt = ytId(l.youtube), isShort = !pl && /\/shorts\//.test(String(l.youtube || ""));
    setHero(l.title, l.summary, [["Home", "index.html"], ["Lectures", "lectures.html"], [c.title, catUrl(c)], [l.title, ""]]);
    const pdfF = (l.files || []).find(f => { const u = f.file || f.url; return u && ext(u) === "pdf" && (f.protected || !isExternal(u)); });
    const pdfFile = pdfF ? (pdfF.file || pdfF.url) : "";
    if (l.locked) return renderGate(c, l, k);
    root.innerHTML = `
      <section class="section section--white">
        <article class="wrap article lecture" aria-label="${esc(l.title)}">
          <p class="feed-meta"><span class="lec-type type-${esc(l.type)}">${icon(k.icon, "icon icon-sm")}${k.label}</span>${l.membersOnly ? `<span class="lec-lock">${l.audience === "students" ? "Students" : "Members"}</span>` : ""}${l.date ? `<time datetime="${esc(l.date)}">${longDate(l.date)}</time>` : ""}<a href="${esc(catUrl(c))}">${esc(c.title)}</a></p>
          ${l.speaker ? `<p class="article-byline">By <strong>${esc(l.speaker)}</strong></p>` : ""}
          ${yt && pl ? `<div class="lec-video"><iframe src="https://www.youtube-nocookie.com/embed/${esc(yt)}?list=${esc(pl)}&rel=0" title="${esc(l.title)}" loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div><p class="lec-playlist-note">${icon("youtube", "icon icon-sm")}<span>This video is part of a playlist.</span><a href="https://www.youtube.com/playlist?list=${esc(pl)}" target="_blank" rel="noopener">Open the playlist on YouTube<span class="sr-only"> (opens in a new tab)</span></a></p>`
            : pl ? playlistBlock(pl, l.title, "Use the playlist button in the player to pick a video.")
            : yt ? `<div class="lec-video${isShort ? " is-short" : ""}"><iframe src="https://www.youtube-nocookie.com/embed/${esc(yt)}?rel=0" title="${esc(l.title)}" loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>` : ""}
          ${!yt && !pl && l.image ? `<figure class="article-image"><img src="${esc(l.image)}" alt=""></figure>` : ""}
          ${l.audio ? `<audio class="lec-audio" controls preload="none" src="${esc(l.audio)}">Your browser can't play this audio. <a href="${esc(l.audio)}">Download it</a>.</audio>` : ""}
          ${l.content ? `<div class="article-body">${articleHtml(l.content)}</div>` : ""}
          ${pdfFile ? `<div class="lec-pdf"><iframe src="${esc(pdfFile)}" title="${esc(l.title)} (PDF)" loading="lazy"></iframe></div>` : ""}
          ${(l.files || []).length ? `<h3>Files</h3><ul class="lec-files">${l.files.map(fileRow).join("")}</ul>` : ""}
          <div class="lec-tasks" id="lec-tasks" data-key="${esc(c.id + "/" + l.id)}" hidden></div>
          ${l.link ? `<p class="btn-row"><a class="btn btn-mango" href="${esc(safeUrl(l.link))}"${isExternal(l.link) ? ' target="_blank" rel="noopener"' : ""}>${l.type === "article" && !l.content ? "Read the full article" : l.type === "video" && !yt ? "Watch the video" : "Open link"}</a></p>` : ""}
          ${l.scripture ? `<dl class="article-facts"><div><dt>Scripture</dt><dd><a href="${bibleUrl(l.scripture)}" target="_blank" rel="noopener">${esc(l.scripture)}</a></dd></div>${l.speaker ? `<div><dt>Speaker</dt><dd>${esc(l.speaker)}</dd></div>` : ""}</dl>` : ""}
          <nav class="lec-nav" aria-label="More lectures">
            ${prev ? `<a href="${esc(lecUrl(c, prev))}"><span>Older</span>${esc(prev.title)}</a>` : "<span></span>"}
            ${next ? `<a class="lec-next" href="${esc(lecUrl(c, next))}"><span>Newer</span>${esc(next.title)}</a>` : "<span></span>"}
          </nav>
          <p><a class="text-link" href="${esc(catUrl(c))}">All ${esc(c.title)} lectures</a></p>
        </article>
      </section>`;
    loadTasks($("#lec-tasks"));
  }

  /* ---------- Student tasks (after the files) ---------- */
  const fmtDate = d => (d ? longDate(String(d).slice(0, 10)) : "");
  function requestButton(user) {
    if (user && user.studentRequested) return '<p class="muted">✓ Your request to become a student has been sent. DHL will let you know.</p>';
    return '<button type="button" class="btn btn-mango btn-small" data-request-student>Request to become a student</button>';
  }
  function taskPanel(t, sess) {
    const M = window.DHLMembers, back = M.here();
    if (!t.canDo) {
      if (!sess.loggedIn) return `<p>This task is for <strong>DHL students</strong>. Log in or create a free account, then ask to become a student.</p>
        <div class="btn-row"><a class="btn btn-mango btn-small" href="${esc(M.accountUrl("register", back))}">Create a free account</a><a class="btn btn-quiet btn-small" href="${esc(M.accountUrl("login", back))}">Log in</a></div>`;
      return `<p>This task is for <strong>DHL students</strong>. You're logged in as a member.</p>${requestButton(sess.user)}`;
    }
    const sub = t.submission;
    return `
      ${t.instructions ? `<div class="task-instructions">${articleHtml(t.instructions)}</div>` : ""}
      ${t.due ? `<p class="task-due">${icon("calendar", "icon icon-sm")}Due ${fmtDate(t.due)}</p>` : ""}
      ${sub ? `<div class="task-status status-${esc(sub.status)}">
          <p><strong>${esc(sub.statusLabel)}</strong> · submitted ${fmtDate(sub.submittedAt)}${sub.score ? ` · <strong>Score: ${esc(sub.score)}</strong>` : ""}</p>
          ${sub.feedback ? `<div class="task-feedback"><p class="task-feedback-label">Feedback from DHL</p>${articleHtml(sub.feedback)}</div>` : ""}
          ${sub.file ? `<p>Your file: <a href="${esc(sub.file.url)}">${esc(sub.file.name)}</a></p>` : ""}
        </div>` : ""}
      <form class="admin-form task-form" novalidate data-task="${t.id}">
        <div class="form-msg"></div>
        ${t.allowText ? `<div class="field"><label for="ta-${t.id}">Your answer</label><textarea id="ta-${t.id}" name="answer" rows="6" aria-describedby="ta-${t.id}-err">${esc(sub ? sub.answer : "")}</textarea><p class="field-error" id="ta-${t.id}-err" hidden></p></div>` : ""}
        ${t.allowFile ? `<div class="field"><label for="tf-${t.id}">${sub && sub.file ? "Replace your file (optional)" : "Attach a file (optional)"}</label><input id="tf-${t.id}" name="file" type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.mp3,.m4a"><p class="field-hint">PDF, Word, PowerPoint, Excel, image or MP3.</p></div>` : ""}
        ${sub && sub.file ? '<input type="hidden" name="keep_file" value="1">' : ""}
        <button type="submit" class="btn btn-primary">${sub ? "Update my submission" : "Submit task"}</button>
      </form>`;
  }
  async function loadTasks(box) {
    const M = window.DHLMembers;
    if (!box || !M || !M.enabled) return;
    let data, sess;
    try { [data, sess] = await Promise.all([M.call("tasks", undefined, { lecture: box.dataset.key }), M.session()]); }
    catch (e) { return; }
    const tasks = data.tasks || [];
    if (!tasks.length) return;
    sess = { ...sess, loggedIn: data.loggedIn, user: data.user || sess.user };
    box.hidden = false;
    box.innerHTML = `<h3>Student tasks</h3>` + tasks.map(t => `
      <div class="task-block" id="task-${t.id}">
        <div class="task-head">
          <button type="button" class="btn btn-mango task-btn" aria-expanded="false" aria-controls="task-panel-${t.id}">📝 Task: ${esc(t.title)}</button>
          ${t.due ? `<span class="task-due-chip">Due ${fmtDate(t.due)}</span>` : ""}
          ${t.submission ? `<span class="task-chip status-${esc(t.submission.status)}">${esc(t.submission.statusLabel)}</span>` : t.canDo ? "" : '<span class="task-chip">For students</span>'}
        </div>
        <div class="task-panel" id="task-panel-${t.id}" hidden>${taskPanel(t, sess)}</div>
      </div>`).join("");
    if (location.hash.startsWith("#task-")) { const b = box.querySelector(`${location.hash} .task-btn`); if (b) { b.click(); } }
  }
  document.addEventListener("click", async e => {
    const btn = e.target.closest(".task-btn");
    if (btn) {
      const panel = document.getElementById(btn.getAttribute("aria-controls")), open = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!open)); panel.hidden = open;
      if (!open) { const f = panel.querySelector("textarea, input, a, button"); if (f) f.focus(); }
      return;
    }
    const req = e.target.closest("[data-request-student]");
    if (req) {
      req.disabled = true;
      try { const r = await window.DHLMembers.call("request-student", {}); req.outerHTML = `<p class="muted">✓ ${esc(r.message)}</p>`; window.DHLMembers.session(true); }
      catch (err) { req.disabled = false; req.insertAdjacentHTML("afterend", `<p class="field-error">${esc(err.message)}</p>`); }
    }
  });
  document.addEventListener("submit", async e => {
    const form = e.target.closest(".task-form"); if (!form) return;
    e.preventDefault();
    const btn = form.querySelector("button[type=submit]"), label = btn.textContent, msg = form.querySelector(".form-msg");
    const fd = new FormData(form); fd.append("task_id", form.dataset.task);
    if (fd.get("file") && !fd.get("file").name) fd.delete("file");
    btn.disabled = true; btn.textContent = "Sending…"; msg.innerHTML = "";
    $$(".field-error", form).forEach(p => { p.hidden = true; });
    try {
      const r = await window.DHLMembers.upload("submit-task", fd);
      const block = form.closest(".task-block"), sess = await window.DHLMembers.session();
      block.querySelector(".task-panel").innerHTML = `<div class="admin-notice notice-info" role="status" tabindex="-1">✓ ${esc(r.message)}</div>` + taskPanel(r.task, sess);
      const chip = block.querySelector(".task-chip");
      const html = `<span class="task-chip status-${esc(r.task.submission.status)}">${esc(r.task.submission.statusLabel)}</span>`;
      chip ? (chip.outerHTML = html) : block.querySelector(".task-head").insertAdjacentHTML("beforeend", html);
      block.querySelector(".notice-info").focus();
    } catch (err) {
      const f = (err.data && err.data.fields) || {};
      if (f.answer) { const p = form.querySelector(".field-error"); if (p) { p.textContent = f.answer; p.hidden = false; } }
      msg.innerHTML = `<div class="admin-notice notice-error" role="alert">${esc(err.message)}</div>`;
      btn.disabled = false; btn.textContent = label;
    }
  });

  /* Members-only lecture that the visitor can't open yet */
  function renderGate(c, l, k) {
    const M = window.DHLMembers, back = M ? M.here() : "";
    setHero(l.title, l.summary, [["Home", "index.html"], ["Lectures", "lectures.html"], [c.title, catUrl(c)], [l.title, ""]]);
    root.innerHTML = `
      <section class="section section--white">
        <article class="wrap article lecture" aria-label="${esc(l.title)}">
          <p class="feed-meta"><span class="lec-type type-${esc(l.type)}">${icon(k.icon, "icon icon-sm")}${k.label}</span><span class="lec-lock">🔒 Members</span>${l.date ? `<time datetime="${esc(l.date)}">${longDate(l.date)}</time>` : ""}<a href="${esc(catUrl(c))}">${esc(c.title)}</a></p>
          ${l.speaker ? `<p class="article-byline">By <strong>${esc(l.speaker)}</strong></p>` : ""}
          <div class="members-gate">
            ${l.lockReason === "students" ? `<h3>🔒 This lecture is for DHL students</h3>
              <p>You're logged in as a member. Students can open this lecture and do its tasks.</p>
              <div class="gate-request" id="gate-request"></div>`
            : `<h3>🔒 This lecture is for DHL ${l.audience === "students" ? "students" : "members"}</h3>
              <p>${l.audience === "students" ? "Log in, or create a free account and ask to become a student, to open this lecture." : "Log in, or create a free account, to watch the video and open the notes and files."}</p>
              <div class="btn-row"><a class="btn btn-mango" href="${esc(M.accountUrl("register", back))}">Create a free account</a><a class="btn btn-ghost" href="${esc(M.accountUrl("login", back))}">Log in</a></div>`}
          </div>
          <p><a class="text-link" href="${esc(catUrl(c))}">All ${esc(c.title)} lectures</a></p>
        </article>
      </section>`;
    if (l.lockReason === "students") M.session().then(s => { const g = $("#gate-request"); if (g) g.innerHTML = requestButton(s.user); });
  }

  /* ---------- route ---------- */
  function route() {
    const c = cats.find(x => x.id === params.get("c"));
    const l = c && lecturesOf(c).find(x => x.id === params.get("l"));
    if (c && l) renderLecture(c, l);
    else if (c) renderCategory(c);
    else {
      if (params.get("c")) root.insertAdjacentHTML("beforebegin", `<div class="wrap"><p class="notice" style="margin-top:1.5rem">That page wasn't found. Here are all the lecture categories.</p></div>`);
      renderHome();
    }
  }
  (async () => {
    const M = window.DHLMembers;
    if (M && M.enabled) {
      root.innerHTML = '<div class="wrap section"><p class="muted">Loading lectures…</p></div>';
      try {
        const r = await M.call("lectures");
        (r.lectures || []).forEach(l => { (extra[l.category] = extra[l.category] || []).push(l); });
      } catch (e) { console.warn("[DHL] Members-only lectures are unavailable:", e.message); }
    }
    route();
  })();
})();
