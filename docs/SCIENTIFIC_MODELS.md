# Scientific models and learning experiences

The first two viewers use provider records rather than generated geometry. They are available at `/labs/planet` and `/labs/molecule`, and appear on articles with a matching Planet or ChemicalCompound ontology. Other article types do not receive an unrelated model.

## Planetary records

- [JPL Horizons lookup](https://ssd.jpl.nasa.gov/api/horizons_lookup.api) resolves the exact body name or SPK ID. Planet and barycenter identities are distinct; an ambiguous result is rejected.
- [Horizons](https://ssd.jpl.nasa.gov/horizons/) supplies physical reports and osculating orbital elements. Parsed quantities retain units, original report excerpts and reported uncertainty when present. No usable radius means no substitute body geometry.
- [NASA PDS Ring-Moon Systems Node](https://pds-rings.seti.org/) supplies available ring boundary tables. Ring geometry uses cataloged inner/outer radii normalized to the body's sourced radius. Missing catalog data does not establish that a body has no rings.
- The time slider solves Kepler's equation for the supplied elliptic elements. This is an educational two-body approximation in the orbital plane, not a precision ephemeris or spacecraft navigation tool.
- Comparison fetches a second real body record. Ratios compare matching property names/units; absent values remain absent. The circle comparison shares one radius scale, while the spacing is schematic.

Colors, lighting, viewing orientation and ring opacity are illustrative. No paid Sketchfab asset or generated surface map is represented as NASA photography. Provider revision dates, retrieval timestamps and the orbital epoch are different fields.

## Molecular records

[PubChem PUG REST](https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest) resolves a unique compound name or explicit CID and supplies the actual conformer record. Atom identifiers are joined to coordinates by ID. Arrays with missing/duplicate IDs, incomplete coordinates/bonds, nonfinite coordinates or unsupported units are rejected. Nanometers are converted to Ångström where explicitly indicated by the provider.

The viewer uses actual atom connectivity and conformer positions. Atom radii/colors are illustrative. The distance selector computes Euclidean separation in this conformer, not a universal experimental bond length. If PubChem has no 3D conformer, the record's properties remain available and the UI explicitly reports that no 3D coordinates were supplied.

WebGL scenes render on demand, use bounded pixel density and are removed while offscreen. A 2D projection of the sourced coordinates remains available without WebGL. Rotation/zoom/reset controls provide a keyboard alternative and also work on the projection. Native scientific provider downloads occur on the Python service, not in the browser.

## Evidence and journeys

Article evidence summaries distinguish recorded source retrieval, editorial claim verification and article modification dates. A missing verification date remains “Not recorded.” Publication preserves the actual source retrieval date rather than stamping it with approval time. No confidence percentage or inferred independent consensus is shown.

Knowledge Journey stores private routes through verified relationships, together with explored concept IDs. Every step explains its relationship and links to its original claim evidence. Beginner/intermediate/advanced options provide different reading guidance; the routes are not certified prerequisite curricula. Progress survives a reload and resumes at the first unexplored concept.

## Storage and failure behavior

Normalized source records cache in PostgreSQL `external_records` for one day. Unavailable providers can return a labeled stale record with its original retrieval timestamp. A missing valid cache produces an explicit service error. Registry discovery metadata and scientific models never bypass article review or publish factual text automatically.

V5 adds source cache, journeys, optional claim verification dates and reserved future-feature tables. V6 adds canonical research identity. These migrations add fields/tables without replacing existing articles. Use forward migrations for further changes and back up PostgreSQL before deployment. Reverting application code should preserve newly saved journeys/source records; dropping them is not part of an automatic rollback.

The checked-in NASA/JPL and PubChem fixtures are recorded provider responses used for parser regression tests. They are not extra published encyclopedia seed articles. Live source availability, 3D conformer coverage and API quotas can change.
