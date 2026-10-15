# Design language — "campus noticeboard"

CampusSquad should feel like the physical board outside a department: posters, pins, stamps, tickets. Not a SaaS template.

## Research that shaped it

| Site | Kept | Avoided |
| --- | --- | --- |
| Luma | Events grouped under sticky time headers; dense, scannable rows | Dark-glass look |
| Devfolio | Small uppercase meta tags (`OFFLINE · OPEN · STARTS 30/10`) | Low-density cards, one per screen on mobile |
| MLH | Monospace for dates/places — reads like a schedule | Gradient hero banners |
| Hack Club | A warm, characterful display face; physical objects (stamped envelope, stickers) | — |
| Unstop | Sticky filter access on mobile; "11 days left" urgency on every card | 3D clip-art icons, busy chrome |

## Rules

- **Colour:** warm paper (`--paper`), ink (`--ink`), one signal (`--signal`) for the primary action and urgency, highlighter (`--marker`) for emphasis only. Each event type has one flat ink (`--type-*`). **No gradients**, no glassmorphism, no purple.
- **Type:** Bricolage Grotesque for headings, Geist for body, Geist Mono uppercase (`.label-mono`) for dates, counts, codes and metadata.
- **Objects:** generated poster art per event (`EventArt`, seeded by id, one motif per type), tear-off `DateBlock`, rubber `Stamp`, ticket-stub registration with a perforation, campus pass on profiles, pins on the landing board.
- **Elevation:** flat by default; interactive cards "lift" off the board on hover/focus (`.lift`: −2px, hard ink offset shadow). No soft blur shadows.
- **Motion:** shared-element morph of poster + title from card to event page; sliding indicators for nav, scope switch and tabs (named view transitions); short staggered rise for lists; page fade-in. Everything is disabled under `prefers-reduced-motion`.
- **Icons:** Lucide, functional only. No sparkle/magic icons, no emoji in UI.

## Accessibility checklist (keep it true)

- Skip link, landmarks (`header`/`nav`/`main`/`footer`), breadcrumbs on deep pages, `aria-current` on active nav/tabs.
- One focus style everywhere: 2px ink outline, 2px offset.
- Text contrast ≥ 4.5:1 in both themes (verified for every token pair; decorative poster art excluded).
- Tap targets ≥ 40px on touch (buttons, inputs, chips); mobile tab bar items 64px.
- Meaning never by colour alone: held skills get a check mark + screen-reader text; match scores show the number, the bar is supplementary (`role="meter"`).
- `/` focuses search; filters are real `<select>`s and checkboxes; active filters are removable chips with labels.
- Dark mode follows the OS.
