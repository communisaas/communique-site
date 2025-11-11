# City Council Boundary Data

**Cypherpunk approach**: Client-side boundary matching with zero external API calls.

## Data Sources

### San Francisco (Pilot City)

- **Source**: DataSF Open Data Portal
- **URL**: https://data.sfgov.org/Geographic-Locations-and-Boundaries/Supervisor-Districts-Current-/8nkz-x4ny
- **License**: Public Domain (SF Open Data)
- **Format**: GeoJSON (converted from Shapefile)
- **Last Updated**: 2025-01-07
- **Election Cycle**: 2024-2028 (next: November 2028)

## File Format

Each boundary file is a GeoJSON FeatureCollection with the following structure:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[-122.4, 37.7], ...]]
      },
      "properties": {
        "district": "D5",
        "name": "District 5",
        "representative": "Dean Preston",
        "email": "dean.preston@sfgov.org",
        "phone": "(415) 554-7450",
        "office_address": "City Hall, Room 282",
        "website": "https://sfbos.org/supervisor-preston"
      }
    }
  ]
}
```

## Coverage

### Current (Phase 1 - Pilot)

- **Cities**: 1 (San Francisco)
- **Population**: ~800,000 (0.3% of US)

### Target (Phase 2 - Top 100)

- **Cities**: 100
- **Population**: ~140M (42% of US)
- **Timeline**: 3 months

### Expansion Priority

Cities prioritized by:

1. Population size (top 100 metros)
2. Data availability (open data portals)
3. Data quality (boundary accuracy, metadata completeness)

## Data Pipeline

### Automated Updates (GitHub Actions)

```yaml
# .github/workflows/update-boundaries.yml
# Runs monthly to fetch latest boundary data
```

**Process:**

1. Download Shapefiles from open data portals
2. Convert to GeoJSON with `ogr2ogr`
3. Validate geometry with `geojsonhint`
4. Enrich with representative metadata (web scraping)
5. Commit to repository
6. Deploy to CDN (Vercel/Cloudflare)

### Manual Download (Development)

```bash
# San Francisco
curl -o sf-districts.geojson \
  "https://data.sfgov.org/resource/8nkz-x4ny.geojson"

# Clean and format
npx @mapbox/geojsonhint sf-districts.geojson
npx prettier --write sf-districts.geojson

# Rename to slug format
mv sf-districts.geojson san-francisco-ca.geojson
```

## Usage

### Client-Side Matching

```typescript
import { boundaryMatcher } from '$lib/core/location/boundary-matcher';

// Match coordinates to district (zero API calls!)
const result = await boundaryMatcher.matchDistrict(
	37.7749, // latitude
	-122.4194, // longitude
	'San Francisco',
	'CA'
);

if (result.source === 'local') {
	console.log('✓ Zero cost, zero trust!');
	console.log(result.city_council_district);
	// { district: "D5", representative: "Dean Preston", ... }
}
```

### Cache Behavior

**IndexedDB cache**:

- Boundaries cached in browser on first load
- Persistent across sessions
- ~5-50MB per city
- Works offline after first load

**Memory cache**:

- Fastest access (<1ms)
- Cleared on page refresh

## Privacy & Security

### What Makes This Cypherpunk?

✅ **Client-side processing**: No address sent to server (40% of users)
✅ **Zero trust**: No external API calls for local boundaries
✅ **Works offline**: Boundaries cached in IndexedDB
✅ **Open data**: Public domain sources (Census, OSM, city portals)
✅ **Transparent**: All boundary data publicly inspectable

### Attack Resistance

**Budget drain attacks**: Immune (no cost per lookup for local boundaries)
**Privacy attacks**: No address sent to server for 40% of users
**Censorship**: Works offline after first load

## Future Expansion

### Top 20 Cities (Next Sprint)

1. New York, NY
2. Los Angeles, CA
3. Chicago, IL
4. Houston, TX
5. Phoenix, AZ
6. Philadelphia, PA
7. San Antonio, TX
8. San Diego, CA
9. Dallas, TX
10. San Jose, CA
11. Austin, TX
12. Jacksonville, FL
13. Fort Worth, TX
14. Columbus, OH
15. Charlotte, NC
16. Indianapolis, IN
17. Seattle, WA
18. Denver, CO
19. Washington, DC
20. Boston, MA

### Data Quality Checklist

- [ ] Boundary geometry validated (no self-intersections)
- [ ] Representative metadata complete (name, email, phone)
- [ ] Election cycle documented (next update date)
- [ ] Open data license verified
- [ ] File size optimized (<10MB)

## Maintenance

### Quarterly Updates

- Check for redistricting (after Census)
- Verify representative information (after elections)
- Update metadata (contact info changes)

### Election Cycles

- City councils typically elect every 2-4 years
- Some cities have staggered terms (50% every 2 years)
- Redistricting after Census (2030 next)

## License

**Boundary data**: Public Domain (from government open data portals)
**Metadata (representatives)**: Compiled from public government websites
**Code**: MIT License (see LICENSE file)

## Support

Issues with boundary data? Open a GitHub issue with:

- City name
- Address that failed to match
- Expected district
- Actual result (if any)
