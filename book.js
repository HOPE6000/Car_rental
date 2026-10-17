/* Fleet & booking page: vehicle selection, advance-booking hint,
   account prefill and quote-request submission. */
document.addEventListener("DOMContentLoaded", () => {
  const S = window.SamelineStore;
  const form = document.getElementById("hireForm");
  if (!form) return;

  const $ = (id) => document.getElementById(id);
  const display = $("selectedCarDisplay");
  const carNameEl = $("selectedCarName");
  const errBox = $("formError");
  const okBox = $("formOk");
  const dateEl = form.elements.date;
  const returnEl = form.elements.returnDate;
  const hint = $("dateHint");
  let selectedCar = "";

  /* ---- vehicle selection ---- */
  function selectCar(name) {
    selectedCar = name;
    carNameEl.textContent = "Vehicle: " + name;
    display.style.display = name ? "flex" : "none";
  }
  const fromUrl = new URLSearchParams(window.location.search).get("car");
  if (fromUrl) selectCar(fromUrl);

  document.querySelectorAll(".car-card [data-car]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      selectCar(btn.dataset.car);
      $("hire-form").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
  $("clearCar").addEventListener("click", () => selectCar(""));

  /* ---- dates ---- */
  const pad = (n) => String(n).padStart(2, "0");
  const ymd = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const today = new Date(); today.setHours(0, 0, 0, 0);
  dateEl.min = ymd(today);
  returnEl.min = ymd(today);

  function dateHint() {
    hint.classList.remove("warn");
    if (!dateEl.value) { hint.textContent = "Bookings a week or more ahead are welcome."; return; }
    const d = new Date(dateEl.value + "T00:00:00");
    const days = Math.round((d - today) / 86400000);
    returnEl.min = dateEl.value;
    if (days < 0) { hint.textContent = "Please choose a date that hasn't passed."; hint.classList.add("warn"); }
    else if (days < 7) { hint.textContent = "That's under a week away — we'll do our best, but short-notice trips depend on availability."; hint.classList.add("warn"); }
    else hint.textContent = "Great — that gives us plenty of time to plan your trip.";
  }
  dateEl.addEventListener("change", dateHint);

  /* ---- flight number only for airport transfers ---- */
  const tripEl = form.elements.tripType;
  tripEl.addEventListener("change", () => { $("flightGroup").hidden = !/^Airport/.test(tripEl.value); });

  /* ---- account bar + prefill ---- */
  function paintAccount() {
    const bar = $("accountBar");
    const user = S && S.auth.current();
    bar.replaceChildren();
    const icon = document.createElement("i");
    icon.className = user ? "fa-solid fa-circle-check" : "fa-regular fa-user";
    bar.appendChild(icon);
    if (user) {
      const s = document.createElement("span");
      s.append("Booking as ");
      const b = document.createElement("strong"); b.textContent = user.name; s.appendChild(b);
      s.append(" — this request will be saved to your account.");
      bar.appendChild(s);
      if (!form.elements.name.value) form.elements.name.value = user.name;
      if (!form.elements.email.value) form.elements.email.value = user.email;
      if (!form.elements.phone.value && user.phone) form.elements.phone.value = user.phone;
    } else {
      const s = document.createElement("span");
      const a = document.createElement("a");
      a.href = "Login.html?next=" + encodeURIComponent("HireVehicle.html#hire-form");
      a.textContent = "Log in";
      s.appendChild(a);
      s.append(" to pre-fill your details and keep track of your requests.");
      bar.appendChild(s);
    }
  }
  paintAccount();
  window.addEventListener("sameline:change", paintAccount);

  /* ---- submit ---- */
  const show = (box, text) => {
    errBox.hidden = true; okBox.hidden = true;
    if (box) { box.textContent = text; box.hidden = false; }
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    show(null);
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const f = form.elements;
    if (new Date(f.date.value + "T00:00:00") < today) { show(errBox, "Please choose a travel date that hasn't passed."); return; }
    if (f.returnDate.value && f.returnDate.value < f.date.value) { show(errBox, "The return date can't be before the travel date."); return; }

    const req = {
      car: selectedCar, tripType: f.tripType.value, from: f.from.value.trim(), to: f.to.value.trim(),
      date: f.date.value, time: f.time.value, returnDate: f.returnDate.value,
      passengers: f.passengers.value, flight: f.flight.value.trim(), details: f.details.value.trim()
    };
    const lines = [
      "Quote request — " + req.tripType,
      "Vehicle: " + (req.car || "No preference"),
      "Pick-up: " + req.from,
      "Drop-off: " + req.to,
      "Travel date: " + req.date + " at " + req.time,
      req.returnDate ? "Return date: " + req.returnDate : "",
      "Passengers: " + req.passengers,
      req.flight ? "Flight: " + req.flight : "",
      req.details ? "Details: " + req.details : ""
    ].filter(Boolean);

    const btn = $("hireSubmit");
    const label = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = "Sending…";
    try {
      const res = await Mailer.send({
        subject: "Quote request: " + req.tripType + " on " + req.date,
        name: f.name.value.trim(), email: f.email.value.trim(), phone: f.phone.value.trim(),
        message: lines.join("\n")
      });
      if (S) await S.requests.add(req);
      show(okBox, res.via === "mailto"
        ? "Your email app should now open with the request ready to send. Press send there and we'll reply with your quote."
        : "Request sent — we'll reply with your quote soon.");
      form.reset();
      selectCar("");
      $("flightGroup").hidden = true;
      dateHint();
      paintAccount();
    } catch (err) {
      const phone = (window.SAMELINE && SAMELINE.phone) || "";
      show(errBox, "Sorry, we couldn't send that just now. Please try again" + (phone ? " or call us on " + phone : "") + ".");
    } finally {
      btn.disabled = false;
      btn.innerHTML = label;
    }
  });
});
