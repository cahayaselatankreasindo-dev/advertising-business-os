# CSK Business OS — UI Design System

## Product feel
Colorful premium business software: lively and recognisable, but calm enough for daily operational work. The interface is not a marketing landing page; clarity, speed, and trust take priority.

## Core palette
- Navigation shell: deep indigo / violet.
- Brand action: CSK orange.
- Dashboard signature: orange → pink → violet.
- Canvas: cool off-white.
- Surfaces: white with soft elevation.
- Text: deep slate / indigo.

## Module identities
| Module | Accent | Soft surface |
|---|---|---|
| Dashboard | Orange / pink / violet | Gradient hero |
| Leads & CRM | Blue | Pale blue |
| Clients | Indigo | Pale indigo |
| Projects | Emerald | Pale green |
| Products & Services | Violet | Pale violet |
| Purchasing | Amber | Pale amber |
| HPP & Material | Cyan | Pale cyan |
| Quotation & Invoice | Amber | Pale amber |
| Sales Order & Production | Emerald | Pale green |
| Inventory | Teal | Pale teal |
| Finance | Emerald | Pale green |
| Marketing | Pink | Pale pink |
| Business Memory | Amber | Pale amber |
| Analysis | Violet | Pale violet |
| Settings | Slate | Pale slate |

## Component rules
1. Every module starts with a consistent page header: eyebrow/badge, clear title, short explanation, and one primary action where relevant.
2. Cards use white surfaces, subtle borders, soft shadows, and enough spacing.
3. Use saturated colours for navigation, primary actions, charts, and important values. Use pastel tints for large backgrounds.
4. Forms use readable labels, 44px touch targets where practical, clear focus states, and concise validation.
5. Tables have a clear header, tabular number alignment, row hover feedback, and horizontal scrolling on narrow screens.
6. Modals must remain focused, scroll safely on mobile, and preserve the existing document/print layout.
7. Mobile bottom navigation and the "Lainnya" sheet must remain reachable above device safe areas.
8. Respect reduced-motion preferences and visible keyboard focus.
9. Customer-facing PDFs and quotations remain visually separate from the colourful internal UI.

## Implementation files
- `csk-visual-refresh.css`: base colour foundation and dashboard treatment.
- `csk-ui-components.css`: shared module headers, forms, cards, tables, modals, toast, and mobile navigation.
- `csk-visual-refresh.test.cjs` and `csk-ui-components.test.cjs`: regression checks for the visual layers.

## Safety boundary
These CSS layers are additive. Do not change business calculations, authentication, data sync, Google Sheets schemas, PDF output, or production deployments as part of a visual-only task.
