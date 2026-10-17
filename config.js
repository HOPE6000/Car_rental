/* ============================================================
   SAMELINE SHUTTLE SERVICE — SITE SETTINGS
   Edit the values below; nothing else needs touching.
   ============================================================ */
window.SAMELINE = {
  name: "Sameline Shuttle Service",

  // Shown in the header/footer/contact page and used for booking e-mails.
  email: "bookings@samelineshuttleservice.co.za",
  phone: "+27 00 000 0000",     // as shown on the site
  phoneTel: "+27000000000",     // digits only, used for tap-to-call
  whatsapp: "",                 // e.g. "27821234567" (country code, no + or spaces). Leave "" to hide WhatsApp buttons.

  // Firebase powers real client accounts (works on any device) and public
  // reviews that every visitor sees. Follow FIREBASE-SETUP.md, then paste the
  // values Firebase gives you below. Leave apiKey empty to run in preview
  // mode, where accounts and reviews only exist in each visitor's own browser.
  // (These values are safe to publish — Firestore security rules protect the data.)
  firebase: {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
  },

  // EmailJS sends the contact + booking forms straight to the client's inbox.
  // Create a free account at emailjs.com, add an e-mail service and a template
  // that uses these variables: {{subject}} {{name}} {{email}} {{phone}} {{message}}
  // Leave the three values empty to fall back to opening the visitor's e-mail app.
  emailjs: {
    publicKey: "",
    serviceId: "",
    templateId: ""
  }
};
