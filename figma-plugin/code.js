const DEFAULT_COLLECTION_NAME = "Website Tokens";
const EXAMPLE_TOKENS = `font/family/brand = Playfair Display
font/family/heading = Inter
font/family/body = Source Sans 3
color/text/primary = #1F1F1F
color/background/primary = #FAFAF7
color/text/secondary = #5A5A5A
color/background/secondary = #F1EFEA
color/action/primary = #2F6FED
color/action/hover = #1E56C5
color/accent = #D97706`;

const SCALE_PRESETS = {
  standard: { desktop: 1.25, mobile: 1.125 },
  balanced: { desktop: 1.5, mobile: 1.25 },
  expressive: { desktop: 1.618, mobile: 1.5 },
};

const DEFAULT_IMPORT_OPTIONS = {
  createColorStyles: true,
  createTextStyles: true,
  includeMobileStyles: true,
  baseFontSize: 16,
  typeScalePreset: "standard",
};

let availableFontsPromise = null;

figma.showUI(__html__, {
  width: 560,
  height: 860,
  themeColors: true,
});

figma.ui.postMessage({
  type: "ready",
  defaultCollectionName: DEFAULT_COLLECTION_NAME,
  exampleTokens: EXAMPLE_TOKENS,
  defaultOptions: DEFAULT_IMPORT_OPTIONS,
});

figma.ui.onmessage = async (message) => {
  if (message.type === "cancel") {
    figma.closePlugin();
    return;
  }

  if (message.type !== "import-tokens") {
    return;
  }

  try {
    const report = await importTokenText({
      text: message.text || "",
      collectionName: message.collectionName || DEFAULT_COLLECTION_NAME,
      options: normalizeImportOptions(message.options),
    });

    const totalCreated =
      report.variables.created +
      report.colorStyles.created +
      report.textStyles.created;
    const totalUpdated =
      report.variables.updated +
      report.colorStyles.updated +
      report.textStyles.updated;
    const totalChanged = totalCreated + totalUpdated;

    if (report.errors.length === 0) {
      figma.notify(
        `Imported ${totalChanged} item${totalChanged === 1 ? "" : "s"} into "${report.collectionName}".`
      );
    } else {
      figma.notify(
        `Imported ${totalChanged} item${totalChanged === 1 ? "" : "s"} with ${report.errors.length} error${report.errors.length === 1 ? "" : "s"}.`,
        { error: true }
      );
    }

    figma.ui.postMessage({
      type: "import-result",
      collectionName: report.collectionName,
      variables: report.variables,
      colorStyles: report.colorStyles,
      textStyles: report.textStyles,
      skipped: report.skipped,
      warnings: report.warnings,
      errors: report.errors,
      totalLines: report.totalLines,
    });
  } catch (error) {
    const messageText =
      error instanceof Error ? error.message : "Unexpected import error.";
    figma.ui.postMessage({
      type: "import-failed",
      message: messageText,
    });
  }
};

function normalizeImportOptions(rawOptions) {
  const options = rawOptions || {};
  const preset = options.typeScalePreset || DEFAULT_IMPORT_OPTIONS.typeScalePreset;
  const hasPreset = Object.prototype.hasOwnProperty.call(SCALE_PRESETS, preset);
  const baseFontSize = Number.parseFloat(options.baseFontSize);
  const safeBaseSize = Number.isFinite(baseFontSize)
    ? Math.max(8, Math.min(72, Math.round(baseFontSize)))
    : DEFAULT_IMPORT_OPTIONS.baseFontSize;

  return {
    createColorStyles:
      options.createColorStyles !== undefined
        ? Boolean(options.createColorStyles)
        : DEFAULT_IMPORT_OPTIONS.createColorStyles,
    createTextStyles:
      options.createTextStyles !== undefined
        ? Boolean(options.createTextStyles)
        : DEFAULT_IMPORT_OPTIONS.createTextStyles,
    includeMobileStyles:
      options.includeMobileStyles !== undefined
        ? Boolean(options.includeMobileStyles)
        : DEFAULT_IMPORT_OPTIONS.includeMobileStyles,
    baseFontSize: safeBaseSize,
    typeScalePreset: hasPreset ? preset : DEFAULT_IMPORT_OPTIONS.typeScalePreset,
  };
}

async function importTokenText({ text, collectionName, options }) {
  const normalizedCollectionName = collectionName.trim() || DEFAULT_COLLECTION_NAME;
  const parsed = parseTokenLines(text);
  const report = {
    collectionName: normalizedCollectionName,
    variables: { created: 0, updated: 0, skipped: 0 },
    colorStyles: { created: 0, updated: 0, skipped: 0 },
    textStyles: { created: 0, updated: 0, skipped: 0 },
    skipped: parsed.skipped,
    warnings: [],
    errors: parsed.errors.slice(),
    totalLines: parsed.totalLines,
  };

  if (parsed.entries.length === 0) {
    return report;
  }

  const collection = await findOrCreateCollection(normalizedCollectionName);
  const modeId =
    collection.defaultModeId || (collection.modes[0] && collection.modes[0].modeId);

  if (!modeId) {
    report.errors.push({
      lineNumber: null,
      message: `Collection "${normalizedCollectionName}" has no writable mode.`,
    });
    return report;
  }

  const variableMap = await buildCollectionVariableMap(collection);
  for (const entry of parsed.entries) {
    const result = await createOrUpdateVariable({
      collection,
      modeId,
      variableMap,
      name: entry.name,
      type: entry.type,
      value: entry.parsedValue,
    });

    if (result.status === "error") {
      report.errors.push({
        lineNumber: entry.lineNumber,
        message: result.message,
      });
      continue;
    }

    if (result.status === "created") {
      report.variables.created += 1;
    } else if (result.status === "updated") {
      report.variables.updated += 1;
    }
  }

  const tokenLookup = buildTokenLookup(parsed.entries);

  if (options.createColorStyles) {
    const colorStyleReport = await createColorStylesFromTokens({
      tokenLookup,
      variableMap,
      report,
    });
    report.colorStyles.created += colorStyleReport.created;
    report.colorStyles.updated += colorStyleReport.updated;
    report.colorStyles.skipped += colorStyleReport.skipped;
  }

  if (options.createTextStyles) {
    const textStyleReport = await createTextStylesFromTokens({
      tokenLookup,
      variableMap,
      options,
      report,
    });
    report.textStyles.created += textStyleReport.created;
    report.textStyles.updated += textStyleReport.updated;
    report.textStyles.skipped += textStyleReport.skipped;
  }

  return report;
}

function parseTokenLines(text) {
  const lines = text.split(/\r?\n/);
  const entries = [];
  const errors = [];
  let skipped = 0;

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = rawLine.trim();

    if (!line || line.startsWith("#") || line.startsWith("//")) {
      skipped += 1;
      return;
    }

    const equalsIndex = line.indexOf("=");
    if (equalsIndex === -1) {
      errors.push({
        lineNumber: lineNumber,
        message: "Invalid format. Expected: token/name = value",
      });
      return;
    }

    const name = line.slice(0, equalsIndex).trim();
    const value = line.slice(equalsIndex + 1).trim();

    if (!name || !value) {
      errors.push({
        lineNumber: lineNumber,
        message: "Token name and value are both required.",
      });
      return;
    }

    try {
      const type = detectTokenType(name);
      const parsedValue = type === "COLOR" ? hexToFigmaRgb(value) : value;

      entries.push({
        lineNumber: lineNumber,
        name: name,
        value: value,
        type: type,
        parsedValue: parsedValue,
      });
    } catch (error) {
      errors.push({
        lineNumber: lineNumber,
        message: error instanceof Error ? error.message : "Invalid token line.",
      });
    }
  });

  return {
    entries: entries,
    errors: errors,
    skipped: skipped,
    totalLines: lines.length,
  };
}

function detectTokenType(name) {
  if (name.startsWith("color/")) {
    return "COLOR";
  }

  if (name.startsWith("font/")) {
    return "STRING";
  }

  throw new Error(
    `Unsupported token prefix in "${name}". Supported prefixes: font/, color/`
  );
}

function hexToFigmaRgb(hexValue) {
  const normalized = hexValue.trim();
  const match = normalized.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);

  if (!match) {
    throw new Error(`Invalid color "${hexValue}". Use #RGB or #RRGGBB.`);
  }

  let hex = match[1];
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((char) => char + char)
      .join("");
  }

  const intValue = Number.parseInt(hex, 16);
  const r = ((intValue >> 16) & 255) / 255;
  const g = ((intValue >> 8) & 255) / 255;
  const b = (intValue & 255) / 255;

  return { r: r, g: g, b: b, a: 1 };
}

function buildTokenLookup(entries) {
  const map = new Map();
  for (const entry of entries) {
    map.set(entry.name, entry);
  }
  return map;
}

function getTokenStringValue(tokenLookup, tokenName) {
  const entry = tokenLookup.get(tokenName);
  if (!entry || entry.type !== "STRING") {
    return null;
  }
  return entry.parsedValue;
}

async function createColorStylesFromTokens({ tokenLookup, variableMap, report }) {
  const styleReport = { created: 0, updated: 0, skipped: 0 };
  const paintStyleMap = await buildPaintStyleMap();

  const colorEntries = [];
  tokenLookup.forEach((entry) => {
    if (entry.type === "COLOR" && entry.name.startsWith("color/")) {
      colorEntries.push(entry);
    }
  });

  for (const entry of colorEntries) {
    const colorVariable = variableMap.get(entry.name) || null;
    const result = await createOrUpdateColorStyle({
      styleMap: paintStyleMap,
      name: entry.name,
      colorValue: entry.parsedValue,
      colorVariable: colorVariable,
    });

    if (result.status === "error") {
      styleReport.skipped += 1;
      report.errors.push({
        lineNumber: entry.lineNumber,
        message: `Color style "${entry.name}": ${result.message}`,
      });
      continue;
    }

    if (result.warning) {
      report.warnings.push({
        lineNumber: entry.lineNumber,
        message: `Color style "${entry.name}": ${result.warning}`,
      });
    }

    if (result.status === "created") {
      styleReport.created += 1;
    } else if (result.status === "updated") {
      styleReport.updated += 1;
    }
  }

  return styleReport;
}

async function createTextStylesFromTokens({
  tokenLookup,
  variableMap,
  options,
  report,
}) {
  const styleReport = { created: 0, updated: 0, skipped: 0 };

  const brandFamily = getTokenStringValue(tokenLookup, "font/family/brand");
  const headingFamily = getTokenStringValue(tokenLookup, "font/family/heading");
  const bodyFamily = getTokenStringValue(tokenLookup, "font/family/body");

  const requiredFamilies = {
    brand: brandFamily,
    heading: headingFamily,
    body: bodyFamily,
  };

  const preset = SCALE_PRESETS[options.typeScalePreset];
  const setConfigs = options.includeMobileStyles
    ? [
        {
          prefix: "text/desktop",
          ratio: preset.desktop,
        },
        {
          prefix: "text/mobile",
          ratio: preset.mobile,
        },
      ]
    : [
        {
          prefix: "text",
          ratio: preset.desktop,
        },
      ];

  const roleConfigs = [
    {
      role: "brand",
      familyKey: "brand",
      preferredStyles: ["SemiBold", "Semi Bold", "DemiBold", "Demi Bold", "Bold", "Regular"],
      lineHeightRatio: 1.2,
      weightClass: "semibold",
    },
    {
      role: "h1",
      familyKey: "heading",
      preferredStyles: ["Bold", "SemiBold", "Semi Bold", "DemiBold", "Demi Bold", "Regular"],
      lineHeightRatio: 1.2,
      weightClass: "bold",
    },
    {
      role: "h2",
      familyKey: "heading",
      preferredStyles: ["Bold", "SemiBold", "Semi Bold", "DemiBold", "Demi Bold", "Regular"],
      lineHeightRatio: 1.2,
      weightClass: "bold",
    },
    {
      role: "h3",
      familyKey: "heading",
      preferredStyles: ["SemiBold", "Semi Bold", "DemiBold", "Demi Bold", "Bold", "Regular"],
      lineHeightRatio: 1.2,
      weightClass: "semibold",
    },
    {
      role: "h4",
      familyKey: "heading",
      preferredStyles: ["SemiBold", "Semi Bold", "DemiBold", "Demi Bold", "Bold", "Regular"],
      lineHeightRatio: 1.2,
      weightClass: "semibold",
    },
    {
      role: "body",
      familyKey: "body",
      preferredStyles: ["Regular", "Book", "Normal", "Roman", "Medium"],
      lineHeightRatio: 1.5,
      weightClass: "regular",
    },
  ];

  const textStyleMap = await buildTextStyleMap();
  const availableFonts = await getAvailableFontsCached();
  const fontIndex = buildAvailableFontIndex(availableFonts);
  const loadedFontCache = new Set();

  for (const setConfig of setConfigs) {
    const scale = generateTypeScale(options.baseFontSize, setConfig.ratio);

    for (const roleConfig of roleConfigs) {
      const styleName = `${setConfig.prefix}/${roleConfig.role}`;
      const familyName = requiredFamilies[roleConfig.familyKey];
      const familyVariableName = `font/family/${roleConfig.familyKey}`;
      const familyVariable = variableMap.get(familyVariableName) || null;

      if (!familyName) {
        styleReport.skipped += 1;
        report.errors.push({
          lineNumber: null,
          message: `Missing token font/family/${roleConfig.familyKey}. Could not create "${styleName}".`,
        });
        continue;
      }

      const resolvedFont = resolveFontName({
        requestedFamily: familyName,
        preferredStyles: roleConfig.preferredStyles,
        fontIndex: fontIndex,
      });

      if (resolvedFont.error) {
        styleReport.skipped += 1;
        report.errors.push({
          lineNumber: null,
          message: `Text style "${styleName}": ${resolvedFont.error}`,
        });
        continue;
      }

      if (resolvedFont.warning) {
        report.warnings.push({
          lineNumber: null,
          message: `Text style "${styleName}": ${resolvedFont.warning}`,
        });
      }

      try {
        await ensureFontLoaded(resolvedFont.fontName, loadedFontCache);
      } catch (error) {
        styleReport.skipped += 1;
        report.errors.push({
          lineNumber: null,
          message: `Text style "${styleName}": Could not load font "${resolvedFont.fontName.family} ${resolvedFont.fontName.style}".`,
        });
        continue;
      }

      const fontSize = getRoleSize(scale, roleConfig.role);
      const lineHeightPx = Math.round(fontSize * roleConfig.lineHeightRatio);

      const result = await createOrUpdateTextStyle({
        styleMap: textStyleMap,
        name: styleName,
        fontName: resolvedFont.fontName,
        fontSize: fontSize,
        lineHeightPx: lineHeightPx,
        description: `Generated ${roleConfig.weightClass} ${roleConfig.role} style from token importer.`,
        fontFamilyVariable: familyVariable,
      });

      if (result.status === "error") {
        styleReport.skipped += 1;
        report.errors.push({
          lineNumber: null,
          message: `Text style "${styleName}": ${result.message}`,
        });
        continue;
      }

      if (result.warning) {
        report.warnings.push({
          lineNumber: null,
          message: `Text style "${styleName}": ${result.warning}`,
        });
      }

      if (result.status === "created") {
        styleReport.created += 1;
      } else if (result.status === "updated") {
        styleReport.updated += 1;
      }
    }
  }

  return styleReport;
}

function generateTypeScale(baseSize, ratio) {
  const body = Math.round(baseSize);
  const h4 = Math.round(baseSize * ratio);
  const h3 = Math.round(baseSize * ratio * ratio);
  const h2 = Math.round(baseSize * ratio * ratio * ratio);
  const h1 = Math.round(baseSize * ratio * ratio * ratio * ratio);
  const brand = h4;

  return {
    brand: brand,
    h1: h1,
    h2: h2,
    h3: h3,
    h4: h4,
    body: body,
  };
}

function getRoleSize(scale, role) {
  if (role === "brand") {
    return scale.brand;
  }
  if (role === "h1") {
    return scale.h1;
  }
  if (role === "h2") {
    return scale.h2;
  }
  if (role === "h3") {
    return scale.h3;
  }
  if (role === "h4") {
    return scale.h4;
  }
  return scale.body;
}

function buildAvailableFontIndex(availableFonts) {
  const map = new Map();
  for (const font of availableFonts) {
    const familyKey = font.fontName.family.trim().toLowerCase();
    if (!map.has(familyKey)) {
      map.set(familyKey, []);
    }
    map.get(familyKey).push(font.fontName);
  }
  return map;
}

async function getAvailableFontsCached() {
  if (!availableFontsPromise) {
    availableFontsPromise = figma.listAvailableFontsAsync();
  }
  return await availableFontsPromise;
}

function resolveFontName({ requestedFamily, preferredStyles, fontIndex }) {
  const familyKey = requestedFamily.trim().toLowerCase();
  const familyFonts = fontIndex.get(familyKey);

  if (!familyFonts || familyFonts.length === 0) {
    return {
      error: `Font family "${requestedFamily}" is not available in this file.`,
    };
  }

  const styleMap = new Map();
  for (const fontName of familyFonts) {
    styleMap.set(fontName.style.trim().toLowerCase(), fontName);
  }

  for (const preferredStyle of preferredStyles) {
    const match = styleMap.get(preferredStyle.trim().toLowerCase());
    if (match) {
      return { fontName: match, warning: null, error: null };
    }
  }

  return {
    fontName: familyFonts[0],
    warning: `Preferred style not found for "${requestedFamily}". Using "${familyFonts[0].style}" instead.`,
    error: null,
  };
}

async function ensureFontLoaded(fontName, loadedFontCache) {
  const cacheKey = `${fontName.family}__${fontName.style}`;
  if (loadedFontCache.has(cacheKey)) {
    return;
  }
  await figma.loadFontAsync(fontName);
  loadedFontCache.add(cacheKey);
}

async function findOrCreateCollection(name) {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const existing = collections.find((collection) => collection.name === name);
  if (existing) {
    return existing;
  }
  return figma.variables.createVariableCollection(name);
}

async function buildCollectionVariableMap(collection) {
  const variables = await figma.variables.getLocalVariablesAsync();
  const map = new Map();
  for (const variable of variables) {
    if (variable.variableCollectionId === collection.id) {
      map.set(variable.name, variable);
    }
  }
  return map;
}

function findExistingVariable(name, variableMap) {
  if (variableMap && variableMap.has(name)) {
    return variableMap.get(name);
  }
  return null;
}

async function createOrUpdateVariable({
  collection,
  modeId,
  variableMap,
  name,
  type,
  value,
}) {
  const existing = findExistingVariable(name, variableMap);

  if (existing) {
    if (existing.resolvedType !== type) {
      return {
        status: "error",
        message: `Type conflict for "${name}". Existing type is ${existing.resolvedType}, incoming type is ${type}.`,
      };
    }

    const updateResult = await setVariableValueSafely({
      variable: existing,
      modeId: modeId,
      value: value,
      tokenName: name,
      tokenType: type,
    });
    if (updateResult.status === "error") {
      return updateResult;
    }
    return { status: "updated" };
  }

  const variable = figma.variables.createVariable(name, collection.id, type);
  // Register immediately so downstream style binding can still find this variable
  // even if setting its initial value fails on this pass.
  variableMap.set(name, variable);

  const setResult = await setVariableValueSafely({
    variable: variable,
    modeId: modeId,
    value: value,
    tokenName: name,
    tokenType: type,
  });
  if (setResult.status === "error") {
    return setResult;
  }
  return { status: "created" };
}

async function setVariableValueSafely({
  variable,
  modeId,
  value,
  tokenName,
  tokenType,
}) {
  try {
    variable.setValueForMode(modeId, value);
    return { status: "ok" };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to set variable value.";
    const canTryFontLoad =
      tokenType === "STRING" &&
      tokenName.startsWith("font/") &&
      typeof value === "string" &&
      value.trim().length > 0;

    if (!canTryFontLoad) {
      return { status: "error", message: errorMessage };
    }

    const loaded = await loadFontsMatchingTokenValue(value);
    if (!loaded) {
      return { status: "error", message: errorMessage };
    }

    try {
      variable.setValueForMode(modeId, value);
      return { status: "ok" };
    } catch (retryError) {
      return {
        status: "error",
        message:
          retryError instanceof Error
            ? retryError.message
            : "Failed to set variable value after loading matching fonts.",
      };
    }
  }
}

async function loadFontsMatchingTokenValue(tokenValue) {
  const requested = tokenValue.trim().toLowerCase();
  const availableFonts = await getAvailableFontsCached();
  const familyMatches = [];
  const exactNameMatches = [];

  for (const font of availableFonts) {
    const family = font.fontName.family.trim();
    const style = font.fontName.style.trim();
    const familyKey = family.toLowerCase();
    const fullKey = `${family} ${style}`.toLowerCase();

    if (familyKey === requested) {
      familyMatches.push(font.fontName);
    }
    if (fullKey === requested) {
      exactNameMatches.push(font.fontName);
    }
  }

  if (exactNameMatches.length > 0) {
    for (const fontName of exactNameMatches) {
      await figma.loadFontAsync(fontName);
    }
    return true;
  }

  if (familyMatches.length > 0) {
    for (const fontName of familyMatches) {
      await figma.loadFontAsync(fontName);
    }
    return true;
  }

  return false;
}

async function getLocalPaintStyles() {
  if (typeof figma.getLocalPaintStylesAsync === "function") {
    return await figma.getLocalPaintStylesAsync();
  }
  return figma.getLocalPaintStyles();
}

async function getLocalTextStyles() {
  if (typeof figma.getLocalTextStylesAsync === "function") {
    return await figma.getLocalTextStylesAsync();
  }
  return figma.getLocalTextStyles();
}

async function buildPaintStyleMap() {
  const styles = await getLocalPaintStyles();
  const map = new Map();
  for (const style of styles) {
    map.set(style.name, style);
  }
  return map;
}

async function buildTextStyleMap() {
  const styles = await getLocalTextStyles();
  const map = new Map();
  for (const style of styles) {
    map.set(style.name, style);
  }
  return map;
}

function findOrCreatePaintStyle(styleMap, name) {
  const existing = styleMap.get(name);
  if (existing) {
    return { style: existing, created: false };
  }

  const style = figma.createPaintStyle();
  style.name = name;
  styleMap.set(name, style);
  return { style: style, created: true };
}

function findOrCreateTextStyle(styleMap, name) {
  const existing = styleMap.get(name);
  if (existing) {
    return { style: existing, created: false };
  }

  const style = figma.createTextStyle();
  style.name = name;
  styleMap.set(name, style);
  return { style: style, created: true };
}

async function createOrUpdateColorStyle({
  styleMap,
  name,
  colorValue,
  colorVariable,
}) {
  const styleResult = findOrCreatePaintStyle(styleMap, name);
  const style = styleResult.style;
  let warning = null;

  let paint = {
    type: "SOLID",
    color: {
      r: colorValue.r,
      g: colorValue.g,
      b: colorValue.b,
    },
    opacity: colorValue.a,
  };

  if (colorVariable && colorVariable.resolvedType === "COLOR") {
    if (
      figma.variables &&
      typeof figma.variables.setBoundVariableForPaint === "function"
    ) {
      try {
        paint = figma.variables.setBoundVariableForPaint(paint, "color", colorVariable);
      } catch (error) {
        warning = "Could not bind color variable to paint style. Used static color value instead.";
      }
    } else {
      warning = "Variable binding for paint styles is unavailable in this Figma version.";
    }
  } else if (!colorVariable) {
    warning = "Matching color variable was not found. Used static color value.";
  }

  try {
    style.paints = [paint];
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Failed to assign paint value.",
    };
  }

  return {
    status: styleResult.created ? "created" : "updated",
    warning: warning,
  };
}

async function createOrUpdateTextStyle({
  styleMap,
  name,
  fontName,
  fontSize,
  lineHeightPx,
  description,
  fontFamilyVariable,
}) {
  const styleResult = findOrCreateTextStyle(styleMap, name);
  const style = styleResult.style;
  let warning = null;

  try {
    style.fontName = fontName;
    style.fontSize = fontSize;
    style.lineHeight = {
      unit: "PIXELS",
      value: lineHeightPx,
    };
    style.description = description;

    if (fontFamilyVariable && fontFamilyVariable.resolvedType === "STRING") {
      if (typeof style.setBoundVariable === "function") {
        style.setBoundVariable("fontFamily", fontFamilyVariable);
      } else {
        warning = "Font family variable binding is unavailable in this Figma version.";
      }
    } else if (fontFamilyVariable) {
      warning = `Could not bind font family variable because "${fontFamilyVariable.name}" is not STRING type.`;
    } else {
      warning = "Matching font family variable was not found for binding.";
    }
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Failed to update text style.",
    };
  }

  return {
    status: styleResult.created ? "created" : "updated",
    warning: warning,
  };
}
