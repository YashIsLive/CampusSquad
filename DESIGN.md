# Design language — "team sheet"

**Got Next** is named after the pickup-game question: *who's got next?* You turn up, find people, form a
team. Every part of the interface tells that one story: **a team is a row of spots, and the open spot is
the one someone's got next.**

## The motif

- **The mark is ●●●○**: a team of four with one spot open. Taken spots are ink; the open spot is lime.
- The same dots appear wherever team size matters: open spots on event cards, a team's fill on the
  team board, the team sheet header, the getting-started progress, empty states (all-open = nothing yet).
- **The team sheet** (`TeamSheet`) is the signature component: numbered rows `01 02 03 04`, members
  first, open spots highlighted in lime ("Needs: ML engineer"), unasked-for spots as quiet blanks.
- The vocabulary follows: open **spots** (not roles/vacancies), **free agents** (people without a team),
  **lineup**, **player card** (profile), **I've got it** (the apply action on the landing page).

## Rules

- **Colour:** neutral white / near-black, ink type, one accent, **court lime** `--court`, for the main
  action and open spots (always with ink text on top). **Red `--signal` means urgency only** (closing
  soon, destructive). Event types keep one flat colour each, used as a thin edge, never a fill. No
  gradients, no glass, no cream paper.
- **Type:** one family, **Archivo**, at different widths: headlines wide and heavy (`font-stretch`
  108–118%), dates, labels and numbers condensed (`.label-mono`, `.score`), reading text at normal width.
  Geist Mono only for codes people read out (entry codes).
- **Numbers are a scoreboard:** counts that drive decisions (sign-ups close in, going, open spots) are
  big condensed numerals, in bordered strips.
- **Cards are fixtures:** text first (date · type, title, club, plain facts, open spots, deadline). The
  uploaded poster lives on the event page only.
- **Elevation:** flat. Interactive cards firm up their border to ink and rise 2px on hover; a 2px ink
  underline shadow, no blur.
- **Shape:** 12px card radius, pill buttons and switches.
- **Motion:** the title morphs from card to event page; sliding pill for scope and tabs; open dots pop
  in when they render; the page tour glides scroll, spotlight and card on one eased timeline. All off
  under `prefers-reduced-motion`.
- **Words:** short, plain, second person. "Sign-ups close in 9 days", "No team yet?", "You're in".
  No marketing adjectives, no exclamation marks in UI chrome.

## What we avoided, and why

The first design ("campus noticeboard": cream paper, Bricolage Grotesque, mono uppercase labels,
rubber stamps) was well made but read as the generic look of AI-built sites in 2026. The team-sheet
direction replaces decoration with one idea that carries meaning (the open spot).

## Accessibility checklist (keep it true)

- Skip link, landmarks, breadcrumbs on deep pages, `aria-current` on active nav/tabs.
- One focus style everywhere: 2px ink outline, 2px offset.
- Text contrast ≥ 4.5:1 in both themes; lime is only ever a background behind ink text.
- Dots never carry meaning alone: `Slots` has an accessible label ("2 of 4 spots taken") and every
  count is also written as text.
- Tap targets ≥ 40px on touch; mobile tab bar items 64px.
- `/` focuses search; filters are real `<select>`s and checkboxes.
- Dark mode follows the OS.
