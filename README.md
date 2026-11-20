# Greensighter · AI UI/UX Designer landing page

Static site with no build step: plain HTML, CSS and JavaScript.

## Structure

```
index.html              Landing page
demo.html               Book-a-demo chat (served at /demo; /waitlist redirects here)
assets/
  css/main.css          Landing styles + shared tokens (colors, fonts, buttons, badge)
  css/waitlist.css      Waitlist page styles
  js/main.js            Landing interactions: CTA scroll, PM-tool badge rotation,
                        FAQ accordion, scroll reveal, smooth scroll, drawing footer
  js/waitlist.js        Form validation and submission
  img/                  Logos, icons, images, favicon
```

## Run locally

Open `index.html` in a browser, or serve the folder:

```
npx serve .
```

## Waitlist form

Sign-ups are saved with **Netlify Forms** (form name `waitlist`). After the first deploy:

1. In Netlify, open the site → **Forms** and enable form detection if asked.
2. Under **Forms → Form notifications**, add an email notification so each sign-up lands in your inbox.

Fields: first_name, last_name, email, website, team_size, pm_tool, designers.
On non-Netlify hosts (local file, preview links) the form only shows the success message.
To use another service, set `WAITLIST_ENDPOINT` in `assets/js/waitlist.js` to any URL that accepts a JSON POST.

## Deploy (GitHub → Netlify)

Every push to `main` publishes automatically.

1. In Netlify: **Add new site → Import an existing project → GitHub**, pick this repository.
2. Build command: leave empty. Publish directory: `.` (already set in `netlify.toml`).
3. **Domain management → Add a domain** → e.g. `ai.greensighter.com`, then add the CNAME record Netlify shows
   (`ai` → `your-site.netlify.app`) where greensighter.com's DNS is managed. HTTPS is automatic.

When CSS/JS changes, bump the `?v=` number on their links in `index.html` and `waitlist.html` so returning visitors get the new files.

## External dependencies

- Google Fonts: Inter, Inter Tight
- Lenis smooth scroll, loaded from jsDelivr (`lenis@1.1.13`). If it fails to load,
  the page falls back to normal scrolling.

## Before launch

- Check the Linear and ClickUp icons in the hero badge (hand-drawn approximations).
- Set the Blog link in the footer and the Terms / Privacy Policy links on the waitlist page.
- Confirm the FAQ promises (NDA, delivery times).
