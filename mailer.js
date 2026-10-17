/* Sends form submissions via EmailJS when configured (config.js),
   otherwise falls back to the visitor's e-mail app (mailto:). */
window.Mailer = {
  isLive() {
    const c = (window.SAMELINE && SAMELINE.emailjs) || {};
    return !!(c.publicKey && c.serviceId && c.templateId && window.emailjs);
  },

  async send(params) {
    const cfg = window.SAMELINE || {};
    if (this.isLive()) {
      emailjs.init({ publicKey: cfg.emailjs.publicKey });
      await emailjs.send(cfg.emailjs.serviceId, cfg.emailjs.templateId, params);
      return { ok: true, via: "emailjs" };
    }
    const subject = encodeURIComponent(params.subject || "Website enquiry");
    const body = encodeURIComponent(
      (params.message || "") +
        "\n\n— " + (params.name || "") +
        (params.email ? "\n" + params.email : "") +
        (params.phone ? "\n" + params.phone : "")
    );
    window.location.href = "mailto:" + cfg.email + "?subject=" + subject + "&body=" + body;
    return { ok: true, via: "mailto" };
  }
};
