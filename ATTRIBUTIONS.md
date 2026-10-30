This Figma Make file includes components from [shadcn/ui](https://ui.shadcn.com/) used under [MIT license](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md).

This Figma Make file includes photos from [Unsplash](https://unsplash.com) used under [license](https://unsplash.com/license).

The initial interface was based on the
[Emergency Command Center Dashboard design](https://www.figma.com/design/l6MkDSarJMxwwnrkzjzHvj/Emergency-Command-Center-Dashboard).

The operations view displays satellite tiles from Esri World Imagery (Esri, Maxar,
Earthstar Geographics, and the GIS User Community) and Standard street tiles from
[OpenStreetMap contributors](https://www.openstreetmap.org/copyright).
Provider attribution is displayed on the map. These external map services require
network access; imagery is not bundled in the app. OpenStreetMap tiles use normal
browser caching and are subject to the [tile usage policy](https://operations.osmfoundation.org/policies/tiles/).

The interface uses Inter, Space Grotesk, and IBM Plex Mono through Google Fonts,
with local system font fallbacks. Icons are provided by the existing Lucide package.

Administrative boundary search uses
[GEODATA Philippine Administrative Boundaries](https://services7.arcgis.com/poQdgvLD6DHnbpsT/arcgis/rest/services/Philippine_Administrative_Boundaries/FeatureServer).
The provider describes the boundaries as indicative; source dates and any geometry
simplification are disclosed in the preview. This is not an assertion of current
official legal boundaries. Map imagery and boundary data are separate services.

## Responder navigation

Road directions use [OSRM](https://project-osrm.org/docs/v5.24.0/api/) with OpenStreetMap road data. Nearby hospital listings use [OpenStreetMap](https://www.openstreetmap.org/copyright) via [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API). Data attribution remains on the map. These services do not establish hospital capacity, receiving capability, emergency access privileges or safe passage.
