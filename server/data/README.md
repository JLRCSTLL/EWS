# Philippine hospital directory

`philippines-hospitals.json` is a filtered and deduplicated derivative of
[Philippines Healthsites on HDX](https://data.humdata.org/dataset/philippines-healthsites),
published by Open Healthsite Consulting from OpenStreetMap contributors.
The downloaded resource was last updated on **29 September 2026**, retrieved on
8 November 2026. Its original SHA-256 and excluded record counts are in the file.

© OpenStreetMap contributors. This derived database is available under
[ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
See [OpenStreetMap attribution](https://www.openstreetmap.org/copyright).
Distribute this file and attribution with any copy of the bundled directory.

Only named features tagged `amenity=hospital` or `healthcare=hospital` are included.
Clinics, pharmacies, unnamed entries and invalid geometries are excluded. Nearby
entries with the same normalized name are deduplicated within 120 metres.
Polygon locations use an interior representative point, **not a verified vehicle
entrance**. Individual source links remain attached to every entry.

This is a mapped directory, not a complete official DOH registry. Entries can be
outdated. Hospital licensing, opening hours, receiving capability and current bed
availability have not been verified. Operators must confirm destinations before
transport. An emergency-department map tag does not confirm current availability.

The service seeds each snapshot once at startup. Operator additions are retained;
deleted catalog entries stay deleted after restarts and future catalog imports.
Use `scripts/import-hospital-catalog.py` with a downloaded source GeoJSON to
reproduce the file. Review changes and update snapshot metadata for new imports.
