# Firebase setup (about 10 minutes, free plan)

This turns on **real client accounts** (work on any device, with password reset)
and **public reviews** that every visitor sees. Until you do it, the site runs in
preview mode (accounts/reviews stay in each visitor's own browser).

You need a Google account. The free "Spark" plan is plenty for this site.

## 1. Create the project
1. Go to https://console.firebase.google.com and click **Add project**.
2. Name it (e.g. `sameline-shuttle`). You can switch Google Analytics off.

## 2. Turn on sign-in
1. **Build → Authentication → Get started**.
2. **Sign-in method → Email/Password → Enable → Save.**
3. (Optional) **Templates → Password reset** lets you edit the reset email's wording/sender name.

## 3. Create the database
1. **Build → Firestore Database → Create database**.
2. Pick a location near your clients (e.g. `africa-south1` Johannesburg).
3. Choose **Production mode**.

## 4. Add the security rules (important)
1. In Firestore, open the **Rules** tab.
2. Delete what's there, paste the entire contents of `firestore.rules` from this folder.
3. Click **Publish**.

These rules mean: anyone can *read* reviews, but a person can only write their own
single review; profile details and quote requests are visible only to their owner.

## 5. Connect the website
1. **Project settings (gear icon) → General → Your apps → Web (`</>`)**, register an app.
2. Copy the `firebaseConfig` values into the `firebase: { ... }` block in `config.js`:
   `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`.
   (These are safe to publish; the rules above protect the data.)

## 6. Allow your website address
**Authentication → Settings → Authorized domains → Add domain**, and add your site's
address, e.g. `yourname.github.io` (or the client's own domain). `localhost` is already allowed.

## 7. Upload and test
Upload the site, then: create an account, log out and back in, post a review, and open the
site in a private window or on a phone — the review should appear there too.

## Day-to-day
- **Remove an inappropriate review:** Firestore Database → `reviews` → delete the document.
- **See registered clients:** Authentication → Users.
- **Quote requests** are still emailed to the client; copies appear for each customer on their
  account page. (The business can also see them in Firestore → `requests`.)
- If you ever see "Missing or insufficient permissions" in the browser console, the rules from
  step 4 haven't been published.
