# Website Token Variable + Style Importer (Figma Plugin)

## Files
- `manifest.json`: Plugin manifest used by Figma Development import.
- `code.js`: Plugin controller code (parsing, validation, variable collection + variable create/update + optional style generation).
- `ui.html`: Plugin UI (textarea, collection name, style options, import/cancel, status/warnings/errors).

## Updateable Input Format
Use plain text lines:

```txt
font/family/brand = Playfair Display
color/text/primary = #1F1F1F
```

Supports:
- `font/*` as STRING variables
- `color/*` as COLOR variables (`#RGB` and `#RRGGBB`)

Optional style generation:
- Color styles for each `color/*` token name
- Text styles for `brand + h1-h4 + body`
- Desktop/mobile text style sets with scale presets and base font size

## Run in Figma Desktop
1. Open Figma desktop.
2. Go to `Plugins > Development > Import plugin from manifest...`.
3. Choose this file: `figma-plugin/manifest.json`.
4. Run the plugin from `Plugins > Development`.
