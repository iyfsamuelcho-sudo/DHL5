/* ==========================================================================
   DHL — members.js
   Connects the website to the members service (backend-php on Namecheap).
   Turned on by "Members service address" in Pages CMS → Site settings.
   While that is empty, nothing here changes the website.
   ========================================================================== */
(() => {
  "use strict";
  const { esc, icon } = window.DHL;
  const base = String((CONFIG.members && CONFIG.members.url) || "").trim().replace(/\/+$/, "");
  const enabled = /^https?:\/\//.test(base);
  let sessionPromise = null;

  async function call(action, data, params = {}) {
    const opts = { credentials: "include", headers: {} };
    if (data !== undefined) { opts.method = "POST"; opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(data); }
    let res;
    try { res = await fetch(`${base}/api/?${new URLSearchParams({ action, ...params })}`, opts); }
    catch (e) { throw Object.assign(new Error("Couldn't reach the members service. Check your internet connection and try again."), { status: 0 }); }
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.ok === false) throw Object.assign(new Error(json.error || `The members service returned an error (${res.status}).`), { status: res.status, data: json });
    return json;
  }
  /* File upload (student tasks): needs the member's security token. */
  async function upload(action, formData) {
    const s = await session();
    let res;
    try { res = await fetch(`${base}/api/?${new URLSearchParams({ action })}`, { method: "POST", credentials: "include", headers: { "X-DHL-CSRF": s.csrf || "" }, body: formData }); }
    catch (e) { throw Object.assign(new Error("Couldn't reach the members service. Check your internet connection and try again."), { status: 0 }); }
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.ok === false) throw Object.assign(new Error(json.error || `The members service returned an error (${res.status}).`), { status: res.status, data: json });
    return json;
  }
  function session(fresh) {
    if (!enabled) return Promise.resolve({ loggedIn: false, user: null });
    if (!sessionPromise || fresh) sessionPromise = call("session").catch(() => ({ loggedIn: false, user: null, offline: true }));
    return sessionPromise;
  }
  /* Where to go back to after logging in: only pages on this site. */
  const here = () => (location.pathname.split("/").pop() || "index.html") + location.search;
  const safeReturn = r => (/^[a-z0-9][a-z0-9._-]*\.html(\?[^\s]*)?$/i.test(String(r || "")) ? r : "");
  const accountUrl = (mode, ret) => `account.html?${new URLSearchParams({ ...(mode ? { mode } : {}), return: ret || here() })}`;

  const ROLE_LABEL = { member: "Member", student: "Student", admin: "Admin" };
  window.DHLMembers = { enabled, base, call, upload, session, safeReturn, accountUrl, here, ROLE_LABEL };

  /* Header: "Log in" or the member's first name */
  if (enabled && document.body.dataset.page !== "admin") {
    session().then(s => {
      const actions = document.querySelector(".header-actions");
      if (!actions || actions.querySelector(".account-link")) return;
      const a = document.createElement("a");
      a.className = "account-link";
      const first = s.loggedIn && s.user ? String(s.user.name || "").split(/\s+/)[0] : "";
      a.href = s.loggedIn ? "account.html" : accountUrl("login");
      a.innerHTML = `${icon("user")}<span>${s.loggedIn ? esc(first || "My account") : "Log in"}</span>`;
      a.setAttribute("aria-label", s.loggedIn ? `My account (${s.user.name})` : "Log in");
      a.title = s.loggedIn ? `My account (${s.user.name})` : "Log in";
      actions.insertBefore(a, actions.firstChild);
    });
  }
})();
