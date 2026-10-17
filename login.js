/* Login / register / account overview. */
document.addEventListener("DOMContentLoaded", () => {
  const S = window.SamelineStore;
  const $ = (id) => document.getElementById(id);
  if (!S) return;

  const params = new URLSearchParams(location.search);
  // only allow redirects to our own pages, e.g. "Reviews.html#write"
  const nextRaw = params.get("next") || "";
  const next = /^[A-Za-z0-9_-]+\.html(#[A-Za-z0-9_-]+)?$/.test(nextRaw) ? nextRaw : "";


  /* ---- tabs ---- */
  function showTab(name) {
    const reg = name === "register";
    $("loginForm").hidden = reg;
    $("registerForm").hidden = !reg;
    $("tabLogin").classList.toggle("active", !reg);
    $("tabRegister").classList.toggle("active", reg);
    $("tabLogin").setAttribute("aria-selected", String(!reg));
    $("tabRegister").setAttribute("aria-selected", String(reg));
  }
  $("tabLogin").addEventListener("click", () => showTab("login"));
  $("tabRegister").addEventListener("click", () => showTab("register"));
  if (params.get("tab") === "register") showTab("register");

  /* ---- show / hide password ---- */
  document.querySelectorAll(".pass-toggle").forEach((b) => {
    b.addEventListener("click", () => {
      const input = b.parentElement.querySelector("input");
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      b.firstElementChild.className = show ? "fa-regular fa-eye-slash" : "fa-regular fa-eye";
      b.setAttribute("aria-label", show ? "Hide password" : "Show password");
    });
  });

  /* ---- forms ---- */
  function done() {
    if (next) location.href = next;
    else render();
  }
  function fail(box, msg) { box.textContent = msg; box.hidden = false; }

  $("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const box = $("loginError"); box.hidden = true;
    const f = e.target.elements;
    const btn = e.target.querySelector(".submit-btn"); btn.disabled = true;
    const res = await S.auth.login(f.email.value, f.password.value);
    btn.disabled = false;
    if (!res.ok) return fail(box, res.error);
    e.target.reset();
    done();
  });

  $("registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const box = $("registerError"); box.hidden = true;
    const f = e.target.elements;
    const btn = e.target.querySelector(".submit-btn"); btn.disabled = true;
    const res = await S.auth.register({ name: f.name.value, email: f.email.value, phone: f.phone.value, password: f.password.value });
    btn.disabled = false;
    if (!res.ok) return fail(box, res.error);
    e.target.reset();
    done();
  });

  $("logoutBtn").addEventListener("click", () => { S.auth.logout(); showTab("login"); });

  /* ---- signed-in view ---- */
  const fmt = (iso) => { try { return new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }); } catch (e) { return iso; } };

  // password reset only exists with the real (Firebase) backend
  const forgot = $("forgotBtn");
  if (S.mode === "firebase") {
    forgot.hidden = false;
    forgot.addEventListener("click", async () => {
      const box = $("loginError"), info = $("loginInfo");
      box.hidden = true; info.hidden = true;
      const res = await S.auth.resetPassword($("l-email").value);
      if (!res.ok) return fail(box, res.error);
      info.textContent = "If that email has an account, a password reset link is on its way. Check your inbox (and spam).";
      info.hidden = false;
    });
  }

  function render() {
    const user = S.auth.current();
    const ready = S.isReady();
    $("storageBlocked").hidden = S.auth.available();
    $("authGuest").hidden = !ready || !!user;
    $("authUser").hidden = !user;
    $("authTitle").textContent = user ? "Welcome back, " + user.name.split(" ")[0] : "Your Sameline account";
    if (!user) return;
    $("userInitial").textContent = user.name.trim()[0].toUpperCase();
    $("userName").textContent = user.name;
    $("userEmail").textContent = user.email;

    const list = $("requestList");
    list.replaceChildren();
    const reqs = S.requests.mine();
    if (!reqs.length) {
      const d = document.createElement("div");
      d.className = "request-empty";
      d.textContent = "No quote requests yet. Your next one will show up here.";
      list.appendChild(d);
      return;
    }
    reqs.forEach((r) => {
      const item = document.createElement("div"); item.className = "request-item";
      const t = document.createElement("strong"); t.textContent = r.tripType;
      const route = document.createElement("span"); route.textContent = r.from + " → " + r.to;
      const when = document.createElement("span");
      when.textContent = fmt(r.date) + (r.time ? " at " + r.time : "") + " · " + r.passengers + (Number(r.passengers) === 1 ? " passenger" : " passengers") + (r.car ? " · " + r.car : "");
      const sent = document.createElement("span"); sent.className = "req-meta";
      sent.textContent = "Requested " + fmt(r.created);
      item.append(t, route, when, sent);
      list.appendChild(item);
    });
  }

  render();
  window.addEventListener("sameline:change", render);
});
