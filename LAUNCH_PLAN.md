# VVTT Launch & SEO Plan

Goal: get vvtt.lukantan.com indexed and ranking for vehicle-combat searches, and seed adoption in the
communities that run Descent into Avernus and Ghosts of Saltmarsh.

## What shipped (2026-09-28)

- Static, crawlable landing page at `/` (index.html). The app now lives at `/app`.
- Meta description, canonical, Open Graph + Twitter cards, `SoftwareApplication` + `FAQPage` JSON-LD.
- `robots.txt`, `sitemap.xml`, real favicon, screenshots + 1200×630 social preview image.
- GitHub repo description, homepage, and topics set.

## Your checklist (things only you can do)

### 1. Google Search Console (do this first)
1. Go to https://search.google.com/search-console and add a **Domain** property for `lukantan.com`
   (covers `vvtt.` and any future subdomains), or a **URL prefix** property for `https://vvtt.lukantan.com/`.
2. Google gives you a TXT record. At GoDaddy → DNS for `lukantan.com`, add:
   `TXT  @  google-site-verification=...`
3. Verify, then **Sitemaps → Add** `https://vvtt.lukantan.com/sitemap.xml`.
4. **URL Inspection** → paste `https://vvtt.lukantan.com/` → **Request indexing**.
   Expect first indexing in 1–7 days. Check **Pages** report after a week.

### 2. Bing Webmaster Tools (5 minutes, free traffic)
https://www.bing.com/webmasters — import the site from Search Console with one click.

### 3. Validate the tags
- https://search.google.com/test/rich-results?url=https://vvtt.lukantan.com/
- https://www.opengraph.xyz/url/https://vvtt.lukantan.com/ (social preview check)

### 4. Add a LICENSE file
The repo is public but has no license. Add MIT (or similar) so people can say "open source"
and so the landing page FAQ can too. `gh repo edit` can't do this; add `LICENSE` and push.

### 5. Optional: rename the GitHub repo to `vvtt`
`gh repo rename vvtt` — GitHub redirects the old name. Then update the URLs in
`index.html`, `README.md`, and `CLAUDE.md`.

## Where to post

Post in this order, a few days apart, so each thread gets its own attention. Reply to every
comment in the first 24 hours; that's what keeps threads on the front page.

| Community | Why | Notes |
|---|---|---|
| r/DescentintoAvernus | Highest intent; "war machine combat" is the #1 complaint about the module | Flair: Resource. Include the battlefield screenshot |
| r/GhostsofSaltmarsh | Ship combat is famously underserved | Lead with component damage |
| r/DMAcademy | Big audience, tolerant of tool posts framed as "how I solved X" | Frame as a DM problem + solution, not a launch |
| r/DnD | Huge but skeptical of self-promo; post only after the smaller subs go well | Use the "Resources" flair, no hard sell |
| r/dndnext / r/onednd | Rules-minded; will engage on how the mishap table and chase rules are implemented | |
| Descent into Avernus Discord, Saltmarsh Discord | Slower burn but very high quality feedback | Ask a mod which channel first |
| r/FoundryVTT, r/Roll20 | "Works alongside your VTT" angle | Only if asked; don't push |
| DMs Guild / itch.io listing | Free "tool" listing = another indexed page linking to you | Low effort, permanent backlink |

Reddit threads rank on Google for long-tail queries ("avernus vehicle combat tracker",
"saltmarsh ship combat tool"), so each post is also SEO.

## Draft posts

### r/DescentintoAvernus

**Title:** I built a free web app for running infernal war machine combat (map, stations, mishaps, click-to-roll)

> Running the war machine fights in Avernus was the part of the module my table dreaded most:
> tracking who's at which station, what each station can do, distance and scale changes, and the
> mishap table on top of normal initiative. So I built a tool for just that phase.
>
> **VVTT** (Vehicular Virtual Table Top): https://vvtt.lukantan.com
>
> - All five war machines with stations, upgrades, gadgets, and the mishap table
> - A battlefield map with tokens scaled to real size, firing arcs, range, and cover
> - Seat PCs and NPCs at stations; the current-turn panel shows what they can do from that seat
> - Click any dice expression to roll it
> - Player view on a second screen, synced live
> - Free, sign in with Google so encounters sync
>
> It's meant to run alongside whatever you use for the rest of the session (Roll20, Foundry, paper).
> I'd love to hear what breaks or what's missing. Ships from Ghosts of Saltmarsh are in there too
> if you're running that.

### r/GhostsofSaltmarsh

**Title:** Free tool for ship combat with per-component damage (hull/helm/sails/weapons each track HP)

> Ship-to-ship combat in Saltmarsh is great on paper and a bookkeeping mess at the table, mostly
> because every component has its own AC and HP and destroying one changes what the ship can do.
>
> I built **VVTT** to handle that phase: https://vvtt.lukantan.com
>
> - All six ships from the book plus the Superior Ship Upgrades
> - Hull, helm, sails/oars, and each siege weapon tracked separately; destroy the sails and the
>   speed drops, destroy the helm and it can't turn
> - Target status shows which components are exposed, at what range, with what cover
> - Crew stations, a passengers zone, and bulk deck-crew counts
> - Player view for a second screen
>
> Free, browser-based. Also does the Avernus war machines if you run that campaign. Happy to take
> feature requests, especially from anyone deep into a naval campaign.

### r/DMAcademy

**Title:** How I stopped dreading vehicle combat (Avernus war machines, Saltmarsh ships)

> Vehicle combat in 5e has a bookkeeping problem: stations, per-component HP, changing distance
> scales, and mishaps, all layered on regular initiative. Most VTTs don't model any of it.
>
> After one too many sessions of sticky notes, I built a small free web tool that only does that
> phase: https://vvtt.lukantan.com. You run your normal VTT or theater-of-the-mind for everything
> else and switch to it when the chase starts.
>
> The parts that actually changed my sessions:
> 1. **Seat-based actions.** Each creature sits at a station and the app shows what they can do
>    from there. No more "wait, can I fire from the helm?"
> 2. **Target status.** Pick a shooter and a target and it tells you range, arc, cover, and for
>    ships, which components are in play. Ends the arguments.
> 3. **Player view.** A second window on the TV so players see the map without my controls.
>
> Curious how others handle this. Sticky notes? Homebrewed simplifications? Skipping vehicles
> entirely?

### Discord (short form)

> Made a free browser tool for the war machine / ship combat phase: map with scaled tokens, crew
> stations with per-seat actions, component HP for ships, mishaps, click-to-roll, and a synced
> player view. https://vvtt.lukantan.com — feedback very welcome, especially on rules accuracy.

## Longer-term SEO (when you have a weekend)

The strongest thing you can add is one or two **guide pages** that answer questions DMs actually
search. Each is a static HTML page next to index.html, linked from the landing page and sitemap:

- `/guides/avernus-vehicle-combat` — "How to run infernal war machine combat in Descent into
  Avernus" (rules recap, common mistakes, then how VVTT handles it)
- `/guides/saltmarsh-ship-combat` — "Ghosts of Saltmarsh ship combat, explained"

These target queries with real volume and almost no competition, and they earn links from the
Reddit threads above.
