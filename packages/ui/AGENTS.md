# packages/ui — agent guide

Shared primitives consumed by `apps/pwa` and `apps/web`. Touch-first PWA. Read this before editing primitives or adding call-sites.

## Touch sizing — single canonical size per role

The whole point of the touch pass is **one size per role**, not a buffet. Mixed sizes are the symptom we're fixing.

Canonical heights (touch = `@media (pointer: coarse)`, desktop = `pointer: fine`):

| Role                                                                                                               | Touch                 | Desktop              |
| ------------------------------------------------------------------------------------------------------------------ | --------------------- | -------------------- |
| Form-row control (Input, Textarea row, Select/Combobox/DatePicker/TimePicker trigger, Input-group, default Button) | **44 px** (`h-11`)    | **36 px** (`h-9`)    |
| Primary action button (CTA, sticky footer button, submit)                                                          | **48 px** (`h-12`)    | **40 px** (`h-10`)   |
| Icon button                                                                                                        | **44 px** (`size-11`) | **36 px** (`size-9`) |
| Dense icon button (inside an already-44 px tappable row)                                                           | **40 px** (`size-10`) | **32 px** (`size-8`) |
| Bottom-nav item                                                                                                    | **56 px**             | —                    |
| List row (`Item`)                                                                                                  | **min 56 px**         | **min 44 px**        |
| Option row (Select / Dropdown / Command item)                                                                      | **44 px**             | **32 px**            |
| Tabs / Toggle / Segmented control                                                                                  | **44 px**             | **36 px**            |
| Calendar / time-slot cell                                                                                          | **44 px**             | **44 px**            |

Hard rules:

- **R1.** Every control on the same form row has the same height.
- **R2.** There are exactly three button heights: dense (40 / 32), default (44 / 36), primary (48 / 40). No `h-7`, no `h-[42px]`.
- **R3.** Icon buttons mirror text-button heights — `size-11`/`size-9`/`size-12`/`size-10`/`size-9`/`size-8`. No independent icon-button scale.
- **R4.** Select / Dropdown / Command option rows all use the same row height.

Button variant → role:

| Variant   | Role                              | Touch   | Desktop |
| --------- | --------------------------------- | ------- | ------- |
| `sm`      | Dense (inside tappable rows only) | 40      | 32      |
| `default` | Form-row / standard               | 44      | 36      |
| `lg`      | Primary CTA                       | 48      | 40      |
| `icon`    | Icon, default                     | size-11 | size-9  |
| `icon-sm` | Icon, dense                       | size-10 | size-8  |
| `icon-lg` | Icon, primary                     | size-12 | size-10 |

`<Button size="sm">` outside a tappable row is wrong — promote to `default`. `<Button>` used as a hero CTA → `lg`.

### Touch variant

Tailwind v4 custom variant in `styles/globals.css`:

```css
@custom-variant touch (@media (pointer: coarse));
```

Usage: `h-9 touch:h-11`, `size-9 touch:size-11`, `py-1.5 touch:py-3`. Desktop stays tight; coarse-pointer devices get the 44 px floor.

### Hit-area expansion (`hit-area-expand`)

For isolated small visuals (lone switch in a card header, etc.) where row-wrap isn't natural. Adds a transparent 8 px hit-area extension via `::before`. Defined in `styles/globals.css`.

For checkboxes / radios / switches inside `Field`, prefer the row wrap (`flex items-center min-h-11`) instead.

### Deviation policy

A primitive may deviate from the canonical heights **only if all three are true**:

1. A single-line comment above the class string in the component file names the role and why the canonical size fails.
2. PR description notes the file + reason and the reviewer approves it.
3. The deviation is added to the "Sanctioned deviations" list in `TOUCH_OPTIMIZATION_PLAN.md` §1a in the same PR.

Anything else is a bug.

### Alternative-action exception (< 24 px allowed)

A small control may render below 24 px **only when both** hold:

1. The same action is reachable via another ≥ 44 px target on the same viewport.
2. The small control is not the only path for a primary user task.

When applying the exception, add a code comment naming the alternative target.

## Related

- `TOUCH_OPTIMIZATION_PLAN.md` (repo root) — full plan, gaps table, verification protocol, sanctioned deviations.
