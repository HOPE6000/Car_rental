/* Shared behaviour for every page: header, mobile menu, scroll reveal,
   config values, login link state, fleet slideshows. */
document.addEventListener("DOMContentLoaded", () => {
  const cfg = window.SAMELINE || {};

  /* ---- header ---- */
  const header = document.getElementById("header");
  const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 60);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---- mobile menu ---- */
  const btn = document.getElementById("mobileToggle");
  const nav = document.getElementById("mobileNav");
  const setMenu = (open) => {
    btn.classList.toggle("open", open);
    nav.classList.toggle("open", open);
    btn.setAttribute("aria-expanded", String(open));
    document.body.style.overflow = open ? "hidden" : "";
  };
  btn.addEventListener("click", () => setMenu(!nav.classList.contains("open")));
  nav.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });

  /* ---- values from config.js ---- */
  document.querySelectorAll("[data-cfg]").forEach((el) => {
    const v = cfg[el.dataset.cfg];
    if (v) el.textContent = v;
  });
  document.querySelectorAll("[data-cfg-href]").forEach((el) => {
    const kind = el.dataset.cfgHref;
    if (kind === "tel" && cfg.phoneTel) el.href = "tel:" + cfg.phoneTel;
    else if (kind === "mailto" && cfg.email) el.href = "mailto:" + cfg.email;
    else if (kind === "whatsapp") {
      if (cfg.whatsapp) el.href = "https://wa.me/" + cfg.whatsapp;
      else el.hidden = true;
    }
  });
  document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));

  /* ---- login link in header / mobile menu ---- */
  function paintAuth() {
    const store = window.SamelineStore;
    const user = store && store.auth.current();
    document.querySelectorAll("[data-auth-link]").forEach((a) => {
      const label = a.querySelector("[data-auth-label]");
      const icon = a.querySelector("i");
      if (user) {
        if (label) label.textContent = user.name.split(" ")[0];
        if (icon) icon.className = "fa-solid fa-user";
        a.setAttribute("aria-label", "Your account");
        a.classList.add("is-in");
      } else {
        if (label) label.textContent = "Log in";
        if (icon) icon.className = "fa-regular fa-user";
        a.removeAttribute("aria-label");
        a.classList.remove("is-in");
      }
    });
  }
  paintAuth();
  window.addEventListener("sameline:change", paintAuth);
  window.addEventListener("storage", paintAuth);

  /* ---- scroll reveal ---- */
  const reveal = (els) => {
    if (!("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("visible")); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("visible"); io.unobserve(e.target); } });
    }, { threshold: 0.1 });
    els.forEach((e) => io.observe(e));
  };
  reveal([...document.querySelectorAll(".reveal")]);

  /* ---- fleet slideshows (skip any picture that fails to load) ---- */
  window.addEventListener("load", () => {
    document.querySelectorAll(".car-images").forEach((box) => {
      let slides = [...box.querySelectorAll("img")].filter((i) => !(i.complete && i.naturalWidth === 0));
      box.querySelectorAll("img").forEach((i) => { if (!slides.includes(i)) i.remove(); });
      if (!slides.length) return;
      slides[0].style.opacity = "1";
      if (slides.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      let idx = 0;
      setInterval(() => {
        slides[idx].style.opacity = "0";
        idx = (idx + 1) % slides.length;
        slides[idx].style.opacity = "1";
      }, 3500);
    });
  });
});
