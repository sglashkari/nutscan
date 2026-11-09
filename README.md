# Nutscan / Label Lens

Mobile-friendly grocery barcode scanner inspired by Tip of the Iceberg. Uses USDA FoodData Central, with a server-side API key.

## Run

Requires Node 22+.

```sh
npm ci
cp .env.example .env
# Set USDA_API_KEY in .env (never commit it)
npm run build
npm start
```

Open http://localhost:3000. Deploy on an HTTPS Node host for phone camera access. GitHub Pages alone cannot run the API backend. DEMO_KEY is a limited fallback (30 requests/hour, 50/day shared per IP); use your own free USDA key for real use.

## Features

- Camera scanning via bundled ZXing, plus manual UPC/EAN/GTIN entry
- Check-digit validation and exact normalized barcode matching
- USDA nutrition, ingredients, source links and record dates
- Compare the last two products by serving or per 100 g
- Missing nutrients remain unknown rather than zero
- Offline app shell and locally saved previous results
- Camera frames stay on device; barcodes go to the backend and USDA

## Limitations

USDA coverage is incomplete, especially store-specific deli labels. Search examines at most three pages per barcode representation. Manufacturer labels may change. Verify package allergens. Server cache is bounded and lasts one hour. Add authentication and abuse rate limiting before a large public deployment. Clear results removes local food history. Live lookup requires internet.

## Validation

Production bundle built successfully and core barcode/missing-value checks passed. Physical iPhone camera scanning and live USDA lookup have not yet been verified. No personal health records or secret keys are included.
