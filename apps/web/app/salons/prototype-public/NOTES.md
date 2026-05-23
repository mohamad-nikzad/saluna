# Public salon page — UI prototype

**Question:** Current public salon page + booking flow (`/salons/[slug]` →
`/salons/[slug]/book/[serviceId]`) feels off. Which UI/flow direction should we
take?

**Status:** Prototype only — mock data, no API. Delete this directory once a
direction wins.

## Constraints baked in

- A salon may have many services → every variant has a **search box** and (where
  it fits) **category filter chips**.
- Customers can book up to **30 days** ahead → date pickers expose the full
  30-day window with month markers.
- The horizontal date strip lives in `components/DateStrip.tsx` and is shared
  across A/B/D/F/G. It carries scroll affordances: edge gradient fades, arrow
  buttons (desktop), inline month-break separators, a "روز X از ۳۰" counter, and
  a thin progress bar — so users see at a glance that more days are reachable.

## Variants

Switch via `?variant=A|B|D|F|G|H` on `/salons/prototype-public`. Bottom switcher
pill or ←/→ arrow keys.

- **A — Inline expand.** Single scroll. Search at top, services grouped by
  category, tap → expands inline with 30-day strip + time + form.
- **B — Split panel.** Search + category chips, service grid. Sticky booking
  panel on desktop / bottom sheet on mobile. 30-day strip inside the panel.
- **D — Visual grid.** Image-forward Instagram-style tiles on a dark hero page,
  sticky search + category chips, tap → fullscreen modal with 30-day booking.
- **F — Minimal mobile grid.** Mobile-first, dense 2-col grid of cards showing
  **only the service title** — no time, no price. Tap → bottom-sheet with full
  details + 30-day booking.
- **G — Iconic.** Service tiles use lucide icons in tinted circles instead of
  photos. Icon + name + duration + price. Tap → modal/sheet with booking.
- **H — Agenda timeline.** Different approach to days: instead of a horizontal
  strip + separate time picker, the booking sheet is a **vertical agenda** —
  each day is a row showing its available time chips inline. Quick-jump pills at
  top (امروز / فردا / آخر هفته / هفته بعد / ماه بعد) skip forward. Current day
  is shown in the sticky header as you scroll.

(Removed C — wizard, E — chat per feedback.)

## Verdict

_(fill this in after picking — which variant won, what to steal from others, what
to drop)_

## Cleanup

When the verdict is in:

- Fold the winning structure into `apps/web/app/salons/[slug]/page.tsx` and
  `apps/web/app/salons/[slug]/book/[serviceId]/booking-client.tsx` (rewrite —
  prototype code skipped tests/error handling).
- Delete `apps/web/app/salons/prototype-public/`.
