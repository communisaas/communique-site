# GeoLite2 Database - Automatic via npm

## ✅ No Manual Download Required!

This project uses `geolite2-redist` which **automatically bundles and updates** the GeoLite2 databases.

**You don't need to download anything manually.** The database is included in the npm package and auto-updates in the background.

## How It Works

1. **Installed via npm**: `geolite2-redist` package
2. **Auto-bundled**: Databases are included in `node_modules`
3. **Auto-updates**: Package checks for updates and downloads new versions automatically
4. **No license key needed**: The `-redist` package handles redistribution legally

## Technical Details

- **Package**: `geolite2-redist` v3.1.1+
- **Database**: GeoLite2-City (~70MB bundled in node_modules)
- **Updates**: Automatic background updates (weekly check)
- **Accuracy**: ~75-85% state-level, 55-80% city-level
- **Privacy**: No external API calls, all lookups happen locally

## Manual Download (Alternative - Not Recommended)

If you prefer to manage the database file yourself instead of using `geolite2-redist`:

1. **Create free account**: https://www.maxmind.com/en/geolite2/signup
2. **Generate license key**: https://www.maxmind.com/en/accounts/current/license-key
3. **Download via direct URL**:
   ```bash
   curl "https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&license_key=YOUR_LICENSE_KEY&suffix=tar.gz" -o data/GeoLite2-City.tar.gz
   tar -xzf data/GeoLite2-City.tar.gz -C data --strip-components=1
   rm data/GeoLite2-City.tar.gz
   ```
4. **Update code** to use manual file path instead of `geolite2-redist`

**Recommendation:** Use `geolite2-redist` (current implementation) for automatic management.
