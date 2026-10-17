/* Contact form — sends via EmailJS when configured in config.js,
   otherwise opens the visitor's email app with the message ready. */
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("contactForm");
  if (!form) return;
  const err = document.getElementById("contactError");
  const ok = document.getElementById("contactOk");
  const btn = document.getElementById("contactSubmit");
  const S = window.SamelineStore;

  // pre-fill from the logged-in account
  const user = S && S.auth.current();
  if (user) {
    form.elements.name.value = user.name;
    form.elements.email.value = user.email;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    err.hidden = true; ok.hidden = true;
    const label = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = "Sending…";
    try {
      const f = form.elements;
      const res = await Mailer.send({
        subject: "Website enquiry from " + f.name.value.trim(),
        name: f.name.value.trim(),
        email: f.email.value.trim(),
        phone: "",
        message: f.message.value.trim()
      });
      ok.textContent = res.via === "mailto"
        ? "Your email app should now open with your message ready to send. Press send there and we'll reply soon."
        : "Message sent — we'll get back to you soon.";
      ok.hidden = false;
      form.reset();
      if (user) { f.name.value = user.name; f.email.value = user.email; }
    } catch (error) {
      const phone = (window.SAMELINE && SAMELINE.phone) || "";
      err.textContent = "Sorry, that didn't send. Please try again" + (phone ? " or call us on " + phone : "") + ".";
      err.hidden = false;
    } finally {
      btn.disabled = false;
      btn.innerHTML = label;
    }
  });
});
