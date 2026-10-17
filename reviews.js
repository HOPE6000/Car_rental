/* Reviews UI — used by the home page preview and by Reviews.html.
   Data comes from store.js (SamelineStore.reviews). */
(function () {
  const S = window.SamelineStore;
  if (!S) return;

  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const fmtDate = (iso) => {
    try { return new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }); }
    catch (e) { return ""; }
  };

  function stars(rating, large) {
    const wrap = el("span", "stars" + (large ? " lg" : ""));
    const full = Math.round(rating);
    wrap.setAttribute("role", "img");
    wrap.setAttribute("aria-label", "Rated " + (Math.round(rating * 10) / 10) + " out of 5");
    for (let i = 1; i <= 5; i++) wrap.appendChild(el("i", "fa-solid fa-star" + (i <= full ? "" : " off")));
    return wrap;
  }

  function reviewCard(r) {
    const card = el("article", "review-card reveal visible");
    card.appendChild(stars(r.rating));
    card.appendChild(el("p", null, "“" + r.text + "”"));
    const meta = el("div", "review-meta");
    const who = el("div");
    who.appendChild(el("strong", null, r.name));
    if (r.trip) who.appendChild(el("span", null, r.trip));
    meta.appendChild(who);
    meta.appendChild(el("span", null, fmtDate(r.date)));
    card.appendChild(meta);
    return card;
  }

  function emptyState() {
    const user = S.auth.current();
    const box = el("div", "review-empty");
    box.appendChild(el("i", "fa-regular fa-star"));
    box.appendChild(el("h3", null, "No reviews yet"));
    box.appendChild(el("p", null, "Travelled with Sameline? Be the first to share how your trip went."));
    const a = el("a", "btn btn-fill", user ? "Write a review" : "Log in to write a review");
    a.href = user ? "Reviews.html#write" : "Login.html?next=" + encodeURIComponent("Reviews.html#write");
    box.appendChild(a);
    return box;
  }

  /* ---------- home page preview ---------- */
  function renderPreview() {
    const grid = $("reviewPreview");
    if (!grid) return;
    const sum = S.reviews.summary();
    const list = S.reviews.all().slice(0, 3);
    grid.replaceChildren();
    if (!list.length) { if (S.isReady()) grid.appendChild(emptyState()); }
    else list.forEach((r) => grid.appendChild(reviewCard(r)));

    const box = $("rpSummary");
    if (box) {
      box.replaceChildren();
      box.hidden = !sum.count;
      if (sum.count) {
        box.appendChild(el("span", "rp-score", sum.average.toFixed(1)));
        const col = el("div");
        col.appendChild(stars(sum.average, true));
        col.appendChild(el("div", null, "from " + sum.count + (sum.count === 1 ? " review" : " reviews")));
        box.appendChild(col);
      }
    }

    const hero = $("heroRating");
    if (hero) {
      hero.replaceChildren();
      hero.hidden = !sum.count;
      if (sum.count) {
        hero.appendChild(stars(sum.average));
        const t = el("span");
        t.innerHTML = "";
        const s = el("strong", null, sum.average.toFixed(1));
        t.appendChild(s);
        t.appendChild(document.createTextNode(" · " + sum.count + (sum.count === 1 ? " review" : " reviews")));
        hero.appendChild(t);
      }
    }
  }

  /* ---------- reviews page ---------- */
  function renderSummaryPanel() {
    const box = $("reviewSummary");
    if (!box) return;
    const sum = S.reviews.summary();
    box.replaceChildren();
    const left = el("div", "sum-left");
    left.appendChild(el("span", "sum-score", sum.count ? sum.average.toFixed(1) : "–"));
    left.appendChild(stars(sum.count ? sum.average : 0, true));
    left.appendChild(el("span", "sum-count", sum.count ? sum.count + (sum.count === 1 ? " review" : " reviews") : "No reviews yet"));
    box.appendChild(left);

    const bars = el("div", "sum-bars");
    [5, 4, 3, 2, 1].forEach((n) => {
      const row = el("div", "bar-row");
      row.appendChild(el("span", "bar-label", n + " ★"));
      const track = el("div", "bar-track");
      const fill = el("div", "bar-fill");
      fill.style.width = (sum.count ? (sum.dist[n] / sum.count) * 100 : 0) + "%";
      track.appendChild(fill);
      row.appendChild(track);
      row.appendChild(el("span", "bar-count", String(sum.dist[n])));
      bars.appendChild(row);
    });
    box.appendChild(bars);
  }

  function renderList() {
    const list = $("reviewList");
    if (!list) return;
    const all = S.reviews.all();
    list.replaceChildren();
    if (!all.length) { if (S.isReady()) list.appendChild(emptyState()); }
    else all.forEach((r) => list.appendChild(reviewCard(r)));
  }

  function renderForm() {
    const form = $("reviewForm");
    const gate = $("writeGate");
    if (!form || !gate) return;
    const user = S.auth.current();
    const ready = S.isReady();
    gate.hidden = !ready || !!user || !S.auth.available();
    form.hidden = !ready || !user;

    const blocked = $("storageBlocked");
    if (blocked) blocked.hidden = S.auth.available();

    if (user) {
      const mine = S.reviews.mine();
      const who = $("writeAs");
      if (who) who.textContent = user.name;
      if (mine && !form.dataset.filled) {
        form.dataset.filled = "1";
        const radio = form.querySelector('input[name="rating"][value="' + mine.rating + '"]');
        if (radio) radio.checked = true;
        form.elements.trip.value = mine.trip || "";
        form.elements.text.value = mine.text;
        updateCount();
      }
      $("reviewSubmit").innerHTML = mine
        ? 'Update my review <i class="fa-solid fa-pen"></i>'
        : 'Post my review <i class="fa-solid fa-paper-plane"></i>';
      $("reviewDelete").hidden = !mine;
    } else {
      delete form.dataset.filled;
    }
  }

  function updateCount() {
    const form = $("reviewForm");
    const c = $("charCount");
    if (form && c) c.textContent = form.elements.text.value.length + " / 600";
  }

  function wireForm() {
    const form = $("reviewForm");
    if (!form) return;
    const msg = $("reviewMsg");
    form.elements.text.addEventListener("input", updateCount);

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = $("reviewSubmit");
      const rating = (form.querySelector('input[name="rating"]:checked') || {}).value;
      btn.disabled = true;
      const res = await S.reviews.save({ rating, trip: form.elements.trip.value, text: form.elements.text.value });
      btn.disabled = false;
      msg.hidden = false;
      msg.className = res.ok ? "form-ok" : "form-error";
      msg.textContent = res.ok ? "Thank you — your review is now on the page." : res.error;
    });

    $("reviewDelete").addEventListener("click", async () => {
      if (!confirm("Delete your review?")) return;
      const res = await S.reviews.remove();
      if (res && res.ok === false) {
        msg.hidden = false; msg.className = "form-error";
        msg.textContent = "We couldn't delete your review just now. Please try again.";
        return;
      }
      form.reset();
      delete form.dataset.filled;
      updateCount();
      msg.hidden = false;
      msg.className = "form-ok";
      msg.textContent = "Your review has been deleted.";
    });
  }

  function renderAll() {
    renderPreview();
    renderSummaryPanel();
    renderList();
    renderForm();
  }

  document.addEventListener("DOMContentLoaded", () => {
    wireForm();
    renderAll();
    const login = $("gateLogin");
    if (login) login.href = "Login.html?next=" + encodeURIComponent("Reviews.html#write");
    const reg = $("gateRegister");
    if (reg) reg.href = "Login.html?tab=register&next=" + encodeURIComponent("Reviews.html#write");
  });
  window.addEventListener("sameline:change", renderAll);
  window.addEventListener("storage", renderAll);
})();
