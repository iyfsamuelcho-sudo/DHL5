/* ==========================================================================
   DHL — account.js (account.html): log in, create account, forgot password,
   and the member's own account page. Talks to the members service.
   ========================================================================== */
(() => {
  "use strict";
  const { $, $$, esc, icon, announce } = window.DHL;
  const M = window.DHLMembers;
  const root = $("#account-root"); if (!root) return;
  const params = new URLSearchParams(location.search);
  const ret = M ? M.safeReturn(params.get("return")) : "";
  const notice = (kind, html) => `<div class="admin-notice notice-${kind}" role="${kind === "error" ? "alert" : "status"}" tabindex="-1">${html}</div>`;

  if (!M || !M.enabled) {
    root.innerHTML = `<div class="admin-panel account-panel"><h2>Member accounts are coming soon</h2><p>Most lectures are open to everyone. <a href="lectures.html">Browse the lectures</a>.</p></div>`;
    return;
  }

  const FLASH = {
    "verified=1": ["info", "<strong>Your email is confirmed.</strong> Welcome to DHL!"],
    "verified=expired": ["error", "That confirmation link has expired or was already used. Log in below. If you still need to confirm, we can send a new link."],
    "reset=1": ["info", "<strong>Your password has been changed.</strong> You can log in now."],
    "deleted=1": ["info", "Your account has been deleted."]
  };
  const flashKey = ["verified", "reset", "deleted"].map(k => params.get(k) ? `${k}=${params.get(k)}` : "").find(Boolean);
  const flash = FLASH[flashKey] ? notice(...FLASH[flashKey]) : "";

  function field(id, label, type, attrs = "", hint = "") {
    return `<div class="field"><label for="${id}">${label}</label>${hint ? `<p class="field-hint" id="${id}-hint">${hint}</p>` : ""}
      <input id="${id}" name="${id.replace(/^a-/, "")}" type="${type}" ${attrs} ${hint ? `aria-describedby="${id}-hint ${id}-err"` : `aria-describedby="${id}-err"`}>
      <p class="field-error" id="${id}-err" hidden></p></div>`;
  }
  function showFieldErrors(form, fields = {}) {
    $$(".field-error", form).forEach(p => { p.hidden = true; p.textContent = ""; });
    $$("[aria-invalid]", form).forEach(i => i.removeAttribute("aria-invalid"));
    let first = null;
    Object.entries(fields).forEach(([k, msg]) => {
      const input = form.querySelector(`[name="${k}"]`), err = form.querySelector(`#a-${k}-err`);
      if (input) { input.setAttribute("aria-invalid", "true"); first = first || input; }
      if (err) { err.textContent = msg; err.hidden = false; }
    });
    if (first) first.focus();
  }
  async function submit(form, fn) {
    const btn = form.querySelector("button[type=submit]"), label = btn.innerHTML, box = form.querySelector(".form-msg");
    btn.disabled = true; btn.textContent = "Please wait…"; box.innerHTML = "";
    try { await fn(); }
    catch (err) {
      showFieldErrors(form, (err.data && err.data.fields) || {});
      box.innerHTML = notice("error", esc(err.message) + (err.data && err.data.needsVerification ? ` <button type="button" class="text-btn" data-resend>Send the confirmation link again</button>` : ""));
      box.firstElementChild.focus();
    } finally { btn.disabled = false; btn.innerHTML = label; }
  }

  function renderForms(mode) {
    const tabs = [["login", "Log in"], ["register", "Create account"]];
    root.innerHTML = `${flash}
      <div class="admin-panel account-panel">
        <div class="account-tabs" role="tablist">${tabs.map(([m, l]) => `<button type="button" role="tab" class="account-tab" aria-selected="${m === mode}" data-mode="${m}">${l}</button>`).join("")}</div>
        <div id="account-form"></div>
      </div>
      <p class="fine-print account-note">Members can open members-only lectures, slides and handouts. An account is free.</p>`;
    $$(".account-tab", root).forEach(b => b.addEventListener("click", () => { history.replaceState(null, "", `?${new URLSearchParams({ mode: b.dataset.mode, ...(ret ? { return: ret } : {}) })}`); renderForms(b.dataset.mode); }));
    const box = $("#account-form");

    if (mode === "register") {
      box.innerHTML = `<form class="admin-form" novalidate>
        <div class="form-msg"></div>
        ${field("a-name", "Your name", "text", 'autocomplete="name" maxlength="100" required')}
        ${field("a-email", "Email", "email", 'autocomplete="email" maxlength="190" required')}
        ${field("a-password", "Password", "password", 'autocomplete="new-password" minlength="8" required', "At least 8 characters.")}
        <div class="field field-check"><label><input type="checkbox" name="consent" required> I agree to the <a href="privacy.html" target="_blank" rel="noopener">privacy policy</a>, and I'm 14 or older.</label><p class="field-error" id="a-consent-err" hidden></p></div>
        <button type="submit" class="btn btn-mango">Create my account</button>
      </form>`;
      const form = box.querySelector("form");
      form.addEventListener("submit", e => {
        e.preventDefault();
        submit(form, async () => {
          const f = form.elements;
          const r = await M.call("register", { name: f.name.value.trim(), email: f.email.value.trim(), password: f.password.value, consent: f.consent.checked });
          if (r.loggedIn) { M.session(true); return renderAccount(); }
          box.innerHTML = notice("info", `<strong>Check your email.</strong> ${esc(r.message)} If it doesn't arrive in a few minutes, look in your spam folder.`)
            + `<p><button type="button" class="btn btn-quiet btn-small" data-resend data-email="${esc(f.email.value.trim())}">Send the link again</button></p>`;
        });
      });
    } else if (mode === "forgot") {
      box.innerHTML = `<form class="admin-form" novalidate>
        <div class="form-msg"></div>
        <p>Enter your email and we'll send you a link to choose a new password.</p>
        ${field("a-email", "Email", "email", 'autocomplete="email" required')}
        <div class="btn-row"><button type="submit" class="btn btn-primary">Send reset link</button><button type="button" class="text-btn" data-mode-link="login">Back to log in</button></div>
      </form>`;
      const form = box.querySelector("form");
      form.addEventListener("submit", e => { e.preventDefault(); submit(form, async () => { const r = await M.call("forgot", { email: form.elements.email.value.trim() }); form.querySelector(".form-msg").innerHTML = notice("info", esc(r.message)); }); });
    } else {
      box.innerHTML = `<form class="admin-form" novalidate>
        <div class="form-msg"></div>
        ${field("a-email", "Email", "email", 'autocomplete="username" required')}
        ${field("a-password", "Password", "password", 'autocomplete="current-password" required')}
        <div class="btn-row"><button type="submit" class="btn btn-primary">Log in</button><button type="button" class="text-btn" data-mode-link="forgot">Forgot password?</button></div>
      </form>`;
      const form = box.querySelector("form");
      form.addEventListener("submit", e => {
        e.preventDefault();
        submit(form, async () => {
          await M.call("login", { email: form.elements.email.value.trim(), password: form.elements.password.value });
          if (ret) { location.href = ret; return; }
          await M.session(true); renderAccount(); announce("Logged in");
        });
      });
    }
    box.addEventListener("click", async e => {
      const ml = e.target.closest("[data-mode-link]"); if (ml) { renderForms(ml.dataset.modeLink); return; }
      const rs = e.target.closest("[data-resend]"); if (!rs) return;
      const email = rs.dataset.email || (box.querySelector('[name="email"]') || {}).value || "";
      rs.disabled = true;
      try { const r = await M.call("resend-verification", { email }); rs.outerHTML = `<span class="muted">${esc(r.message)}</span>`; } catch (err) { rs.outerHTML = `<span class="muted">${esc(err.message)}</span>`; }
    });
    const first = box.querySelector("input"); if (first && !flash) first.focus();
  }

  function renderAccount(s) {
    M.session(!s).then(sess => {
      if (!sess.loggedIn) return renderForms("login");
      const u = sess.user;
      if (ret) { location.href = ret; return; }
      const lede = $(".page-hero .lede"); if (lede) lede.textContent = u.role === "member" ? "Your DHL account and access to members-only lectures." : "Your DHL account, lectures and tasks.";
      root.innerHTML = `${flash}
        <div class="admin-panel account-panel">
          <p class="account-hello">${icon("user")}<span>Logged in as <strong>${esc(u.name)}</strong><span class="role-badge">${esc(M.ROLE_LABEL[u.role] || "Member")}</span><br><span class="muted">${esc(u.email)}</span></span></p>
          <div class="btn-row"><a class="btn btn-mango" href="lectures.html">Go to the lectures</a>
            ${u.role === "admin" ? `<a class="btn btn-quiet" href="${esc(M.base)}/admin/" target="_blank" rel="noopener">Admin panel</a>` : ""}
            <button type="button" class="btn btn-quiet" id="logout-btn">Log out</button></div>
        </div>
        ${u.role === "member" ? `<div class="admin-panel account-box">
            <h2>Become a student</h2>
            <p>Students can open students-only lectures and do tasks, with feedback from DHL.</p>
            <div id="student-request">${u.studentRequested ? '<p class="muted">✓ Your request has been sent. DHL will let you know.</p>' : '<button type="button" class="btn btn-mango btn-small" id="request-student">Request to become a student</button>'}</div>
          </div>` : `<div class="admin-panel account-box"><h2>My tasks</h2><ul class="my-tasks" id="my-tasks"><li class="muted">Loading…</li></ul></div>`}
        <details class="account-danger">
          <summary>Delete my account</summary>
          <form class="admin-form" novalidate>
            <div class="form-msg"></div>
            <p>This permanently deletes your account and personal information. It can't be undone.</p>
            ${field("a-password", "Your password", "password", 'autocomplete="current-password" required')}
            <button type="submit" class="btn btn-quiet">Delete my account permanently</button>
          </form>
        </details>`;
      const rq = $("#request-student");
      if (rq) rq.addEventListener("click", async () => {
        rq.disabled = true;
        try { const r = await M.call("request-student", {}); $("#student-request").innerHTML = `<p class="muted">✓ ${esc(r.message)}</p>`; }
        catch (err) { rq.disabled = false; $("#student-request").insertAdjacentHTML("beforeend", `<p class="field-error">${esc(err.message)}</p>`); }
      });
      const mt = $("#my-tasks");
      if (mt) M.call("my-tasks").then(r => {
        const ts = r.tasks || [];
        mt.innerHTML = ts.length ? ts.map(t => {
          const [cat, lec] = String(t.lecture).split("/");
          const st = t.submission ? t.submission.statusLabel : "Not submitted yet";
          return `<li><a href="lectures.html?c=${encodeURIComponent(cat)}&l=${encodeURIComponent(lec || "")}#task-${t.id}"><strong>📝 ${esc(t.title)}</strong>
            <span class="muted">${esc(st)}${t.due ? ` · due ${esc(t.due)}` : ""}${t.submission && t.submission.score ? ` · score ${esc(t.submission.score)}` : ""}</span></a></li>`;
        }).join("") : '<li class="muted">No tasks yet. They appear on lectures as a 📝 Task button.</li>';
      }).catch(() => { mt.innerHTML = '<li class="muted">Tasks couldn\'t be loaded right now.</li>'; });
      $("#logout-btn").addEventListener("click", async () => { await M.call("logout", {}).catch(() => {}); location.href = "account.html"; });
      const form = $(".account-danger form");
      form.addEventListener("submit", e => {
        e.preventDefault();
        if (!confirm("Delete your DHL account permanently?")) return;
        submit(form, async () => { await M.call("delete-account", { password: form.elements.password.value }); location.href = "account.html?deleted=1"; });
      });
    });
  }

  M.session().then(s => {
    if (s.offline) { root.innerHTML = notice("error", "The members service can't be reached right now. Please try again later."); return; }
    if (s.loggedIn) renderAccount(s);
    else renderForms(["register", "forgot"].includes(params.get("mode")) ? params.get("mode") : "login");
  });
})();
