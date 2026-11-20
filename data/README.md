# CSK Advertising Catalog Seed

This folder contains reference templates for the CSK advertising, printing, signage, display, and custom-fabrication catalog.

## Important status

`advertising-catalog-seed.json` is a **reference catalog**, not a live-priced inventory list. It does not insert zero-priced items into quotations or the active Materials/Services master.

Before a template becomes an active SKU, the Owner or authorized operator must verify:
- Actual supplier and brand/grade.
- Exact thickness, dimensions, color, finish, and quality.
- Purchase unit and package quantity.
- Usage unit and conversion factor.
- Current purchase price and price date.
- Minimum order, delivery, and other purchase conditions.

No supplier price is fabricated in this seed. Material sizes and thicknesses are common reference options and must be checked against CSK's suppliers.

## Included coverage

- Paper and print substrates: HVS, Art Paper, Art Carton, Ivory, Duplex, Kraft, NCR, Linen/Fancy Paper, Grey Board.
- Adhesive graphics: vinyl, chromo, specialty stickers, and laminate films.
- Wood and panels: plywood, MDF, HDF, blockboard, particle board, and solid wood species.
- Acrylic: clear, milky/opal, colored, mirror, and frosted/texture; multiple thickness options.
- Other panels: PVC foam board, ACP, and polycarbonate.
- Roll media: flexi, mesh, canvas, and backlit film.
- Metals and profiles: aluminum profiles, steel hollow, sheet metal, and stainless.
- Electrical and lighting: LED modules/strips, power supplies, cable, and connectors.
- Consumables: fasteners, adhesives, tapes, paint/finishing, abrasives, and machine consumables.
- Finished product and service templates: design, prepress, printing, finishing, cutting, fabrication, installation, survey, delivery, rental, and maintenance.

## Next implementation step

Build an Owner-only Catalog Manager that can:
1. Browse and search these reference families.
2. Select a variant combination to create a SKU.
3. Capture supplier and price evidence.
4. Define purchase-to-usage conversion and costing method.
5. Validate the SKU before adding it to active Materials or Services.
6. Keep unpriced templates unavailable to quotation and HPP until activated.
