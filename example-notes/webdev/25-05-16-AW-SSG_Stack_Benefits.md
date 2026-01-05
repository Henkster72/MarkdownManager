## AW-SSG + MarkdownManager: a sane stack for fast, secure websites (without the modern web circus)

Most websites are still just content + layout. Yet we keep shipping them like they’re SaaS products: databases, plugin ecosystems, endless updates, fragile dependency chains, and the security anxiety that comes free with all of that.

**AW-SSG** is a minimalist static-site pipeline (Python + Jinja-style templating + Tailwind-friendly workflow) that outputs plain, production-ready HTML.
**MarkdownManager** is a flat-file Markdown viewer/editor in plain PHP: your content stays as real `.md` files on disk.

### Why these two fit together

Because both tools are **file-first**. That means the workflow is dead simple:

* Write/edit content in **MarkdownManager** (locally, on a NAS, VPS, wherever you host it).
* That content is just Markdown files, so it can live in Git, be synced, backed up, and reviewed.
* Run **AW-SSG** to render the site into static HTML (fast, consistent output).
* Publish the generated site (FTP/CDN/static hosting). No CMS runtime, no database, no attack surface shaped like Swiss cheese.

If you want “remote publishing” without building a whole CMS: this is it. MarkdownManager becomes your lightweight remote content cockpit, AW-SSG becomes your deterministic publisher.

---

## Benefits by role

### 1) For a solo user (creator, blogger, developer, photographer)

* **You own the content**: Markdown files on disk. No proprietary editor prison, no database export rituals.
* **Edit from anywhere**: host MarkdownManager on a box you control; update pages like you update notes.
* **Fast by default**: static output loads instantly and stays cheap to host.
* **Low maintenance**: fewer moving parts means fewer things that break on weekends.
* **Portable workflow**: content can move between machines, repos, and hosts without drama.

### 2) For a web designer / freelancer

* **Repeatable builds**: templates + partials give consistent output across pages and projects.
* **No plugin roulette**: you’re not assembling a site from 37 third-party plugins with unknown half-lives.
* **Better client handoff**: clients get content as files, not a fragile admin panel with “don’t click that” warnings.
* **Fewer support tickets**: static sites don’t wake you at 2am because an update nuked the theme.
* **Performance is not a “project phase”**: it’s baked in, because the site is literally just static assets.

### 3) For a web design agency

* **Standardized stack**: same pipeline across multiple clients, less bespoke chaos.
* **Faster delivery**: ship sites quicker because you’re not building a runtime app for static needs.
* **Easier QA**: deterministic builds mean fewer “works on staging” surprises.
* **Security posture improves overnight**: static output reduces the public-facing attack surface drastically.
* **Scales cleanly**: static hosting + CDN works the same for 1k or 1M visitors.

### 4) For a company (marketing + comms + IT)

* **Marketing can publish without CMS bloat**: Markdown content updates, predictable deploys.
* **IT gets fewer liabilities**: no database, fewer services, fewer patch emergencies.
* **Audit-friendly**: content changes can be reviewed in Git like normal work, with real history.
* **Cheap and resilient hosting**: static output is easy to mirror, cache, and back up.
* **Separation of concerns**: private editing environment, public static site. Clean boundary.

---

## And for visitors (because they’re the ones stuck using it)

* **Pages load fast** (even on mediocre mobile connections).
* **Fewer tracking shenanigans** by default, because there’s no bloated runtime stack forcing it.
* **More reliable UX**: fewer scripts, fewer failures, fewer spinners pretending to work.
* **Better readability**: clean HTML tends to behave better than a JavaScript theme park.

---

### Repos

```text
AW-SSG: https://github.com/Henkster72/AW-SSG
MarkdownManager: https://github.com/Henkster72/MarkdownManager
```

If someone still insists they “need” a full CMS for a brochure site, that’s not a technical requirement. That’s Stockholm syndrome.
