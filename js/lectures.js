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
    link: { label: "Link", plural: "Links", icon: "external" }
  };
  const t = type => TYPES[type] || TYPES.article;
  const cats = (window.lectureCategories || []).filter(c => c && c.enabled !== false && c.title && c.id);
  const lecturesOf = c => (c.lectures || []).filter(l => l && l.enabled !== false && l.title && l.id);
  const byNewest = (a, b) => String(b.date || "").localeCompare(String(a.date || ""));
  const params = new URLSearchParams(location.search);
  const catUrl = c => `lectures.html?c=${encodeURIComponent(c.id)}`;
  const lecUrl = (c, l) => `${catUrl(c)}&l=${encodeURIComponent(l.id)}`;
  const ytId = s => { s = String(s || "").trim(); const m = s.match(/(?:youtu\.be\/|v=|\/shorts\/|\/embed\/|\/live\/)([A-Za-z0-9_-]{11})/) || s.match(/^([A-Za-z0-9_-]{11})$/); return m ? m[1] : ""; };
  const ext = u => String(u || "").split("?")[0].split(".").pop().toLowerCase();
  const abs = u => { try { return new URL(u, location.href).href; } catch (e) { return u; } };

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
        <span class="lec-type type-${esc(l.type)}">${icon(k.icon, "icon icon-sm")}${k.label}</span>
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
            return `<li class="lec-cat"><a href="${esc(catUrl(c))}">
              <span class="lec-cat-img">${c.image ? `<img src="${esc(c.image)}" alt="" loading="lazy">` : ""}</span>
              <span class="lec-cat-body">
                <h3>${esc(c.title)}</h3>
                ${c.description ? `<p>${esc(c.description)}</p>` : ""}
                <span class="lec-count">${ls.length ? `${ls.length} ${ls.length === 1 ? "lecture" : "lectures"}` : "Lectures coming soon"}</span>
                ${ls.length ? `<span class="lec-types">${typeTags(ls)}</span>` : ""}
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
    setHero(c.title, c.description, [["Home", "index.html"], ["Lectures", "lectures.html"], [c.title, ""]]);
    const present = [...new Set(ls.map(l => l.type))].filter(x => TYPES[x]);
    root.innerHTML = `
      <section class="section" aria-labelledby="lec-cat-title">
        <div class="wrap">
          <div class="lec-profile">
            ${c.image ? `<img class="lec-profile-img" src="${esc(c.image)}" alt="">` : ""}
            <div>
              <h2 id="lec-cat-title">Lectures</h2>
              <p class="lec-count">${ls.length ? `${ls.length} ${ls.length === 1 ? "lecture" : "lectures"} in this category` : "Lectures for this category are coming soon."}</p>
              <span class="lec-types">${typeTags(ls)}</span>
            </div>
          </div>
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
    const viewOnline = office && isExternal(abs(url)) && !/^(localhost|127\.)/.test(location.hostname)
      ? `<a class="btn btn-quiet btn-small" href="https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(abs(url))}" target="_blank" rel="noopener">View online<span class="sr-only">: ${esc(label)} (opens in a new tab)</span></a>` : "";
    const open = isExternal(url) || e === "pdf"
      ? `<a class="btn btn-primary btn-small" href="${esc(safeUrl(url))}" target="_blank" rel="noopener">Open<span class="sr-only">: ${esc(label)} (opens in a new tab)</span></a>` : "";
    const download = !isExternal(url) ? `<a class="btn btn-quiet btn-small" href="${esc(url)}" download>Download<span class="sr-only">: ${esc(label)}</span></a>` : "";
    return `<li class="lec-file"><span class="lec-file-kind">${esc(kind)}</span><span class="lec-file-name">${esc(label)}</span><span class="btn-row">${viewOnline}${open}${download}</span></li>`;
  }
  function renderLecture(c, l) {
    const all = lecturesOf(c).sort(byNewest);
    const i = all.findIndex(x => x.id === l.id), prev = all[i + 1], next = all[i - 1];
    const k = t(l.type), yt = ytId(l.youtube);
    setHero(l.title, l.summary, [["Home", "index.html"], ["Lectures", "lectures.html"], [c.title, catUrl(c)], [l.title, ""]]);
    const pdfFile = (l.files || []).map(f => f.file || f.url).find(u => u && ext(u) === "pdf" && !isExternal(u));
    root.innerHTML = `
      <section class="section section--white">
        <article class="wrap article lecture" aria-label="${esc(l.title)}">
          <p class="feed-meta"><span class="lec-type type-${esc(l.type)}">${icon(k.icon, "icon icon-sm")}${k.label}</span>${l.date ? `<time datetime="${esc(l.date)}">${longDate(l.date)}</time>` : ""}<a href="${esc(catUrl(c))}">${esc(c.title)}</a></p>
          ${l.speaker ? `<p class="article-byline">By <strong>${esc(l.speaker)}</strong></p>` : ""}
          ${yt ? `<div class="lec-video"><iframe src="https://www.youtube-nocookie.com/embed/${esc(yt)}?rel=0" title="${esc(l.title)}" loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>` : ""}
          ${!yt && l.image ? `<figure class="article-image"><img src="${esc(l.image)}" alt=""></figure>` : ""}
          ${l.audio ? `<audio class="lec-audio" controls preload="none" src="${esc(l.audio)}">Your browser can't play this audio. <a href="${esc(l.audio)}">Download it</a>.</audio>` : ""}
          ${l.content ? `<div class="article-body">${articleHtml(l.content)}</div>` : ""}
          ${pdfFile ? `<div class="lec-pdf"><iframe src="${esc(pdfFile)}" title="${esc(l.title)} (PDF)" loading="lazy"></iframe></div>` : ""}
          ${(l.files || []).length ? `<h3>Files</h3><ul class="lec-files">${l.files.map(fileRow).join("")}</ul>` : ""}
          ${l.link ? `<p class="btn-row"><a class="btn btn-mango" href="${esc(safeUrl(l.link))}"${isExternal(l.link) ? ' target="_blank" rel="noopener"' : ""}>${l.type === "article" && !l.content ? "Read the full article" : l.type === "video" && !yt ? "Watch the video" : "Open link"}</a></p>` : ""}
          ${l.scripture ? `<dl class="article-facts"><div><dt>Scripture</dt><dd><a href="${bibleUrl(l.scripture)}" target="_blank" rel="noopener">${esc(l.scripture)}</a></dd></div>${l.speaker ? `<div><dt>Speaker</dt><dd>${esc(l.speaker)}</dd></div>` : ""}</dl>` : ""}
          <nav class="lec-nav" aria-label="More lectures">
            ${prev ? `<a href="${esc(lecUrl(c, prev))}"><span>Older</span>${esc(prev.title)}</a>` : "<span></span>"}
            ${next ? `<a class="lec-next" href="${esc(lecUrl(c, next))}"><span>Newer</span>${esc(next.title)}</a>` : "<span></span>"}
          </nav>
          <p><a class="text-link" href="${esc(catUrl(c))}">All ${esc(c.title)} lectures</a></p>
        </article>
      </section>`;
  }

  /* ---------- route ---------- */
  const c = cats.find(x => x.id === params.get("c"));
  const l = c && lecturesOf(c).find(x => x.id === params.get("l"));
  if (c && l) renderLecture(c, l);
  else if (c) renderCategory(c);
  else {
    if (params.get("c")) root.insertAdjacentHTML("beforebegin", `<div class="wrap"><p class="notice" style="margin-top:1.5rem">That page wasn't found. Here are all the lecture categories.</p></div>`);
    renderHome();
  }
})();
