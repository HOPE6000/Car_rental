/* ============================================================
   SamelineStore — client accounts, reviews and booking history.

   Two modes, chosen automatically from config.js:

   • "firebase"  (config.js → firebase.apiKey + projectId filled in)
       Real accounts (Firebase Authentication) and a shared database
       (Cloud Firestore): reviews are public to every visitor and
       accounts work on any device. See FIREBASE-SETUP.md.

   • "local"     (firebase values left empty)
       Everything is kept in the visitor's own browser (localStorage).
       Fine for previewing, but accounts/reviews are NOT shared.

   The rest of the site only talks to window.SamelineStore. Reads are
   synchronous (served from a cache that stays live); writes return
   promises. "sameline:change" fires whenever data changes.
   ============================================================ */
(function () {
  const cfg = window.SAMELINE || {};
  const fb = cfg.firebase || {};
  const useFirebase = !!(fb.apiKey && fb.projectId);

  const emit = () => { try { window.dispatchEvent(new CustomEvent("sameline:change")); } catch (e) {} };
  const norm = (s) => String(s || "").trim().toLowerCase();
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  function shortName(name) {
    const p = String(name || "Guest").trim().split(/\s+/);
    return p.length > 1 ? p[0] + " " + p[p.length - 1][0].toUpperCase() + "." : p[0];
  }

  /* shared review validation */
  function checkReview({ rating, text }) {
    rating = parseInt(rating, 10);
    text = String(text || "").trim();
    if (!(rating >= 1 && rating <= 5)) return { error: "Please choose a star rating." };
    if (text.length < 10) return { error: "Please write at least a sentence about your trip." };
    if (text.length > 600) return { error: "Please keep your review under 600 characters." };
    return { rating, text };
  }

  function summarise(list) {
    const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let sum = 0;
    list.forEach((r) => { dist[r.rating]++; sum += r.rating; });
    return { count: list.length, average: list.length ? sum / list.length : 0, dist };
  }

  /* ============================================================
     LOCAL MODE
     ============================================================ */
  function makeLocal() {
    const K = { users: "sameline.users.v1", session: "sameline.session.v1", reviews: "sameline.reviews.v1", requests: "sameline.requests.v1" };
    const read = (key, fb2) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fb2; } catch (e) { return fb2; } };
    const write = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; } };

    const toHex = (b) => Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
    const fromHex = (h) => new Uint8Array((h.match(/.{2}/g) || []).map((x) => parseInt(x, 16)));
    function fallbackHash(str) {
      let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
      for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
      h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
      h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
      return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
    }
    async function hashPassword(password, saltHex) {
      if (window.crypto && crypto.subtle) {
        const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
        const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: fromHex(saltHex), iterations: 100000, hash: "SHA-256" }, key, 256);
        return "p1:" + toHex(new Uint8Array(bits));
      }
      return "f1:" + fallbackHash(saltHex + password);
    }
    function newSalt() {
      const a = new Uint8Array(16);
      if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(a);
      else for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256);
      return toHex(a);
    }
    const pub = (u) => u && { uid: u.email, name: u.name, email: u.email, phone: u.phone || "", created: u.created };

    const auth = {
      available() { try { localStorage.setItem("sameline.test", "1"); localStorage.removeItem("sameline.test"); return true; } catch (e) { return false; } },
      current() { const e = read(K.session, null); return e ? pub(read(K.users, {})[e]) || null : null; },
      async register({ name, email, phone, password }) {
        name = String(name || "").trim(); email = norm(email);
        if (name.length < 2) return { ok: false, error: "Please enter your full name." };
        if (!validEmail(email)) return { ok: false, error: "Please enter a valid email address." };
        if (String(password || "").length < 8) return { ok: false, error: "Your password needs at least 8 characters." };
        const users = read(K.users, {});
        if (users[email]) return { ok: false, error: "An account with that email already exists. Try logging in." };
        const salt = newSalt();
        users[email] = { name, email, phone: String(phone || "").trim(), salt, hash: await hashPassword(password, salt), created: new Date().toISOString() };
        if (!write(K.users, users) || !write(K.session, email)) return { ok: false, error: "Your browser is blocking storage, so we can't create an account here." };
        emit();
        return { ok: true, user: pub(users[email]) };
      },
      async login(email, password) {
        email = norm(email);
        const u = read(K.users, {})[email];
        const bad = { ok: false, error: "That email and password don't match an account." };
        if (!u || (await hashPassword(password || "", u.salt)) !== u.hash) return bad;
        write(K.session, email); emit();
        return { ok: true, user: pub(u) };
      },
      async logout() { try { localStorage.removeItem(K.session); } catch (e) {} emit(); },
      async resetPassword() { return { ok: false, error: "Password reset isn't available in preview mode." }; }
    };

    const reviews = {
      all() { return read(K.reviews, []).sort((a, b) => new Date(b.date) - new Date(a.date)); },
      mine() { const u = auth.current(); return u ? read(K.reviews, []).find((r) => r.userEmail === u.email) || null : null; },
      async save(input) {
        const u = auth.current();
        if (!u) return { ok: false, error: "Please log in to leave a review." };
        const v = checkReview(input);
        if (v.error) return { ok: false, error: v.error };
        const list = read(K.reviews, []).filter((r) => r.userEmail !== u.email);
        list.push({ id: uid(), userEmail: u.email, name: shortName(u.name), rating: v.rating, trip: input.trip || "", text: v.text, date: new Date().toISOString() });
        if (!write(K.reviews, list)) return { ok: false, error: "Your browser is blocking storage." };
        emit(); return { ok: true };
      },
      async remove() {
        const u = auth.current(); if (!u) return { ok: false };
        write(K.reviews, read(K.reviews, []).filter((r) => r.userEmail !== u.email)); emit();
        return { ok: true };
      },
      summary() { return summarise(reviews.all()); }
    };

    const requests = {
      async add(req) {
        const u = auth.current(); if (!u) return false;
        const all = read(K.requests, {});
        (all[u.email] = all[u.email] || []).unshift(Object.assign({ id: uid(), created: new Date().toISOString() }, req));
        const ok = write(K.requests, all); if (ok) emit(); return ok;
      },
      mine() { const u = auth.current(); return u ? read(K.requests, {})[u.email] || [] : []; }
    };

    window.addEventListener("storage", emit); // other tabs
    return { mode: "local", isReady: () => true, auth, reviews, requests };
  }

  /* ============================================================
     FIREBASE MODE
     ============================================================ */
  function makeFirebase() {
    const VERSION = "10.12.2";
    const state = { user: null, reviews: [], requests: [], authReady: false, reviewsReady: false, failed: false };
    let fauth = null, db = null, unsubReq = null;

    const loadScript = (src) => new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = () => rej(new Error("load " + src));
      document.head.appendChild(s);
    });

    const friendly = (e) => {
      const c = (e && e.code) || "";
      if (c === "auth/email-already-in-use") return "An account with that email already exists. Try logging in.";
      if (c === "auth/invalid-email") return "Please enter a valid email address.";
      if (c === "auth/weak-password") return "Your password needs at least 8 characters.";
      if (["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found", "auth/invalid-login-credentials"].includes(c)) return "That email and password don't match an account.";
      if (c === "auth/too-many-requests") return "Too many attempts. Please wait a few minutes and try again.";
      if (c === "auth/network-request-failed") return "Network problem — check your connection and try again.";
      return "Something went wrong. Please try again.";
    };

    function userFrom(u, extra) {
      return Object.assign({
        uid: u.uid, email: u.email || "", name: u.displayName || (u.email || "").split("@")[0],
        phone: "", created: (u.metadata && u.metadata.creationTime) || ""
      }, extra || {});
    }

    function watchRequests(u) {
      if (unsubReq) { unsubReq(); unsubReq = null; }
      state.requests = [];
      if (!u) return;
      unsubReq = db.collection("requests").where("uid", "==", u.uid).onSnapshot(
        (snap) => {
          state.requests = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()))
            .sort((a, b) => String(b.created).localeCompare(String(a.created)));
          emit();
        },
        () => {}
      );
    }

    async function init() {
      try {
        const base = "https://www.gstatic.com/firebasejs/" + VERSION + "/";
        await loadScript(base + "firebase-app-compat.js");
        await Promise.all([loadScript(base + "firebase-auth-compat.js"), loadScript(base + "firebase-firestore-compat.js")]);
        firebase.initializeApp({
          apiKey: fb.apiKey, authDomain: fb.authDomain, projectId: fb.projectId,
          storageBucket: fb.storageBucket, messagingSenderId: fb.messagingSenderId, appId: fb.appId
        });
        fauth = firebase.auth();
        db = firebase.firestore();
      } catch (e) {
        state.failed = true; state.authReady = true; state.reviewsReady = true; emit();
        return;
      }

      db.collection("reviews").onSnapshot(
        (snap) => {
          state.reviews = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
          state.reviewsReady = true; emit();
        },
        () => { state.reviewsReady = true; emit(); }
      );

      fauth.onAuthStateChanged(async (u) => {
        if (!u) {
          state.user = null; watchRequests(null);
          state.authReady = true; emit(); return;
        }
        // keep a freshly-registered name/phone if register() already set them
        const keep = state.user && state.user.uid === u.uid ? { name: state.user.name, phone: state.user.phone } : {};
        state.user = userFrom(u, keep.name ? keep : null);
        state.authReady = true; emit();
        watchRequests(u);
        try {
          const d = await db.collection("users").doc(u.uid).get();
          if (d.exists && state.user && state.user.uid === u.uid) {
            const data = d.data();
            if (data.phone) state.user.phone = data.phone;
            if (data.name && !u.displayName) state.user.name = data.name;
            emit();
          }
        } catch (e) {}
      });
    }
    init();

    const auth = {
      available() { return !state.failed; },
      current() { return state.user; },

      async register({ name, email, phone, password }) {
        name = String(name || "").trim(); email = norm(email);
        if (state.failed || !fauth) return { ok: false, error: "Accounts are unavailable right now. Please try again later." };
        if (name.length < 2) return { ok: false, error: "Please enter your full name." };
        if (!validEmail(email)) return { ok: false, error: "Please enter a valid email address." };
        if (String(password || "").length < 8) return { ok: false, error: "Your password needs at least 8 characters." };
        try {
          const cred = await fauth.createUserWithEmailAndPassword(email, password);
          await cred.user.updateProfile({ displayName: name });
          state.user = userFrom(cred.user, { name, phone: String(phone || "").trim() });
          emit();
          try {
            await db.collection("users").doc(cred.user.uid).set({ name, email, phone: state.user.phone, created: new Date().toISOString() });
          } catch (e) { /* profile doc is a convenience; the account itself exists */ }
          return { ok: true, user: state.user };
        } catch (e) { return { ok: false, error: friendly(e) }; }
      },

      async login(email, password) {
        if (state.failed || !fauth) return { ok: false, error: "Accounts are unavailable right now. Please try again later." };
        try {
          const cred = await fauth.signInWithEmailAndPassword(norm(email), String(password || ""));
          state.user = userFrom(cred.user, state.user && state.user.uid === cred.user.uid ? state.user : null);
          emit();
          return { ok: true, user: state.user };
        } catch (e) { return { ok: false, error: friendly(e) }; }
      },

      async logout() {
        try { if (fauth) await fauth.signOut(); } catch (e) {}
        state.user = null; watchRequests(null); emit();
      },

      async resetPassword(email) {
        email = norm(email);
        if (!validEmail(email)) return { ok: false, error: "Enter your email address above first." };
        try { await fauth.sendPasswordResetEmail(email); } catch (e) {
          if (e && e.code !== "auth/user-not-found") return { ok: false, error: friendly(e) };
        }
        // same answer whether or not the account exists
        return { ok: true };
      }
    };

    const reviews = {
      all() { return state.reviews.slice().sort((a, b) => new Date(b.date) - new Date(a.date)); },
      mine() { return state.user ? state.reviews.find((r) => r.uid === state.user.uid) || null : null; },
      async save(input) {
        if (!state.user) return { ok: false, error: "Please log in to leave a review." };
        const v = checkReview(input);
        if (v.error) return { ok: false, error: v.error };
        try {
          await db.collection("reviews").doc(state.user.uid).set({
            uid: state.user.uid, name: shortName(state.user.name), rating: v.rating,
            trip: input.trip || "", text: v.text, date: new Date().toISOString()
          });
          return { ok: true };
        } catch (e) { return { ok: false, error: "We couldn't save your review just now. Please try again." }; }
      },
      async remove() {
        if (!state.user) return { ok: false };
        try { await db.collection("reviews").doc(state.user.uid).delete(); return { ok: true }; }
        catch (e) { return { ok: false }; }
      },
      summary() { return summarise(reviews.all()); }
    };

    const requests = {
      async add(req) {
        if (!state.user) return false;
        try {
          await db.collection("requests").add(Object.assign({}, req, { uid: state.user.uid, created: new Date().toISOString() }));
          return true;
        } catch (e) { return false; }
      },
      mine() { return state.requests; }
    };

    return { mode: "firebase", isReady: () => state.authReady && state.reviewsReady, auth, reviews, requests };
  }

  window.SamelineStore = useFirebase ? makeFirebase() : makeLocal();
})();
