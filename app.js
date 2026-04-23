const typographyTokens = [
  {
    name: "font/family/brand",
    label: "Site Name / Brand Font",
    defaultValue: "Playfair Display",
  },
  {
    name: "font/family/heading",
    label: "Heading Font",
    defaultValue: "Inter",
  },
  {
    name: "font/family/body",
    label: "Body Font",
    defaultValue: "Source Sans 3",
  },
];

const colorTokens = [
  {
    name: "color/text/primary",
    label: "Primary Text",
    defaultValue: "#1F1F1F",
  },
  {
    name: "color/background/primary",
    label: "Primary Background",
    defaultValue: "#FAFAF7",
  },
  {
    name: "color/text/secondary",
    label: "Secondary Text",
    defaultValue: "#F1EFEA",
  },
  {
    name: "color/background/secondary",
    label: "Secondary Background",
    defaultValue: "#5A5A5A",
  },
  {
    name: "color/action/primary",
    label: "Primary Action",
    defaultValue: "#2F6FED",
  },
  {
    name: "color/action/hover",
    label: "Primary Action Hover",
    defaultValue: "#1E56C5",
  },
  {
    name: "color/action/secondary",
    label: "Secondary Action",
    defaultValue: "#669C35",
  },
  {
    name: "color/action/secondary-hover",
    label: "Secondary Action Hover",
    defaultValue: "#38571A",
  },
  {
    name: "color/accent",
    label: "Accent / Highlight",
    defaultValue: "#D97706",
  },
];

const optionalTokens = [
  {
    name: "color/border/subtle",
    label: "Subtle Border",
    defaultValue: "#D8D1C7",
  },
  {
    name: "color/text/inverse",
    label: "Inverse Text",
    defaultValue: "#F9F7F2",
  },
  {
    name: "color/background/inverse",
    label: "Inverse Background",
    defaultValue: "#20242D",
  },
];

const optionalTokenNames = new Set(optionalTokens.map((token) => token.name));
const fallbackGoogleFontSuggestions = [
  "Abril Fatface",
  "Alegreya",
  "Archivo",
  "Archivo Narrow",
  "Bebas Neue",
  "Bitter",
  "Bricolage Grotesque",
  "Cormorant Garamond",
  "Crimson Text",
  "DM Sans",
  "DM Serif Display",
  "EB Garamond",
  "Figtree",
  "Fraunces",
  "IBM Plex Sans",
  "IBM Plex Serif",
  "Inconsolata",
  "Instrument Sans",
  "Inter",
  "Josefin Sans",
  "Karla",
  "Lato",
  "Libre Baskerville",
  "Libre Franklin",
  "Lora",
  "Manrope",
  "Merriweather",
  "Montserrat",
  "Newsreader",
  "Nunito",
  "Open Sans",
  "Oswald",
  "Outfit",
  "PT Sans",
  "PT Serif",
  "Playfair Display",
  "Plus Jakarta Sans",
  "Poppins",
  "Public Sans",
  "Raleway",
  "Roboto",
  "Roboto Condensed",
  "Roboto Mono",
  "Roboto Slab",
  "Rubik",
  "Source Sans 3",
  "Space Grotesk",
  "Space Mono",
  "Spectral",
  "Syne",
  "Work Sans",
];

let googleFontSuggestions = [];
let googleFontLookup = new Map();
const fontValidationTimers = new Map();
const fontLoadPromises = new Map();
const fontLoadResults = new Map();
const fontRequestIds = new Map();

const state = {
  values: {},
  enabledOptional: false,
  exportMode: "plain",
  fontStatuses: {},
  fontCatalogStatus: "Loading local Google Fonts catalog...",
};

const tokenForm = document.querySelector("#token-form");
const optionalToggle = document.querySelector("#optional-toggle");
const optionalContainer = document.querySelector("#optional-fields");
const exportModeSelect = document.querySelector("#export-mode");
const exportOutput = document.querySelector("#export-output");
const summaryList = document.querySelector("#summary-list");
const typographyPreview = document.querySelector("#typography-preview");
const tokenCount = document.querySelector("#token-count");
const contrastHints = document.querySelector("#contrast-hints");
const copyButton = document.querySelector("#copy-button");
const resetButton = document.querySelector("#reset-button");
const websitePreviewPrimary = document.querySelector("#website-preview-primary");
const websitePreviewSecondary = document.querySelector("#website-preview-secondary");
const previewActions = document.querySelectorAll(".preview-action");
const fontDatalist = document.querySelector("#google-font-options");
const fontCatalogStatus = document.querySelector("#font-catalog-status");
const rootStyles = document.documentElement.style;
const localGoogleFontCatalog = Array.isArray(window.GOOGLE_FONTS_CATALOG)
  ? window.GOOGLE_FONTS_CATALOG
  : null;

function getFontInput(tokenName) {
  return document.querySelector(`.font-input[data-token="${tokenName}"]`);
}

function getColorPicker(tokenName) {
  return document.querySelector(`.color-picker[data-token="${tokenName}"]`);
}

function getHexInput(tokenName) {
  return document.querySelector(`.hex-input[data-token="${tokenName}"]`);
}

function getTokenMessage(tokenName) {
  return document.querySelector(`[data-token-message="${tokenName}"]`);
}

function getFontSuggestionsNode(tokenName) {
  return document.querySelector(`[data-token-suggestions="${tokenName}"]`);
}

function normalizeHex(value) {
  const cleaned = value.startsWith("#") ? value : `#${value}`;
  return cleaned.toUpperCase();
}

function isValidHex(value) {
  return /^#?([0-9a-fA-F]{6})$/.test(value);
}

function normalizeFontWhitespace(value) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeFontKey(value) {
  return normalizeFontWhitespace(value).toLowerCase();
}

function buildGoogleFontStylesheetUrl(fontName) {
  const encodedFamily = encodeURIComponent(fontName).replace(/%20/g, "+");
  return `https://fonts.googleapis.com/css2?family=${encodedFamily}:wght@400;500;600;700;900&display=swap`;
}

function formatPreviewFontFamily(value, fallbackGeneric) {
  return value ? `"${value}", ${fallbackGeneric}` : fallbackGeneric;
}

function refreshGoogleFontLookup() {
  googleFontLookup = new Map(
    googleFontSuggestions.map((fontName) => [normalizeFontKey(fontName), fontName])
  );
}

function loadGoogleFontsCatalog() {
  if (localGoogleFontCatalog && localGoogleFontCatalog.length > 0) {
    googleFontSuggestions = [...new Set(localGoogleFontCatalog)].sort((left, right) =>
      left.localeCompare(right)
    );
    state.fontCatalogStatus = `Loaded ${googleFontSuggestions.length} Google Fonts from the local catalog file.`;
  } else {
    googleFontSuggestions = [...fallbackGoogleFontSuggestions];
    state.fontCatalogStatus =
      "Could not load the local Google Fonts catalog. Using the fallback font list instead.";
  }

  refreshGoogleFontLookup();
}

function populateFontDatalist() {
  populateFontDatalistForQuery("");
}

function populateFontDatalistForQuery(queryValue) {
  const query = normalizeFontWhitespace(queryValue || "");
  const visibleFonts = query
    ? getMatchingGoogleFonts(query).slice(0, 24)
    : googleFontSuggestions.slice(0, 24);
  const options = document.createDocumentFragment();

  visibleFonts.forEach((fontName) => {
    const option = document.createElement("option");
    option.value = fontName;
    options.appendChild(option);
  });

  fontDatalist.innerHTML = "";
  fontDatalist.appendChild(options);
}

function hideFontSuggestions(tokenName) {
  const node = getFontSuggestionsNode(tokenName);
  if (!node) {
    return;
  }

  node.hidden = true;
  node.innerHTML = "";
}

function hideAllFontSuggestions() {
  typographyTokens.forEach((token) => {
    hideFontSuggestions(token.name);
  });
}

function renderFontSuggestions(tokenName, rawValue) {
  const node = getFontSuggestionsNode(tokenName);
  if (!node) {
    return;
  }

  const value = normalizeFontWhitespace(rawValue || "");
  const matches = value
    ? getMatchingGoogleFonts(value).slice(0, 8)
    : googleFontSuggestions.slice(0, 8);
  const canonical = getCanonicalGoogleFontName(value);

  if (matches.length === 0 || (canonical && matches.length === 1)) {
    hideFontSuggestions(tokenName);
    return;
  }

  node.innerHTML = "";
  const fragment = document.createDocumentFragment();

  matches.forEach((fontName) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "font-suggestion-button";
    button.dataset.fontSuggestion = fontName;
    button.dataset.token = tokenName;
    button.textContent = fontName;
    fragment.appendChild(button);
  });

  node.appendChild(fragment);
  node.hidden = false;
}

function syncStateFromDom() {
  state.enabledOptional = optionalToggle.checked;
  state.exportMode = exportModeSelect.value;

  typographyTokens.forEach((token) => {
    state.values[token.name] = normalizeFontWhitespace(getFontInput(token.name).value);
  });

  [...colorTokens, ...optionalTokens].forEach((token) => {
    state.values[token.name] = getHexInput(token.name).value.trim();
  });
}

function initializeFontStatuses() {
  typographyTokens.forEach((token) => {
    state.fontStatuses[token.name] = {
      tone: "loading",
      message: "Loading Google Font preview...",
    };
  });
}

function getCanonicalGoogleFontName(value) {
  return googleFontLookup.get(normalizeFontKey(value)) || null;
}

function getMatchingGoogleFonts(value) {
  const query = normalizeFontKey(value);

  if (!query) {
    return [];
  }

  return googleFontSuggestions.filter((fontName) => {
    const key = normalizeFontKey(fontName);
    return key.startsWith(query) || key.includes(query);
  });
}

function getEditDistance(source, target) {
  const matrix = Array.from({ length: source.length + 1 }, () =>
    new Array(target.length + 1).fill(0)
  );

  for (let row = 0; row <= source.length; row += 1) {
    matrix[row][0] = row;
  }

  for (let column = 0; column <= target.length; column += 1) {
    matrix[0][column] = column;
  }

  for (let row = 1; row <= source.length; row += 1) {
    for (let column = 1; column <= target.length; column += 1) {
      const cost = source[row - 1] === target[column - 1] ? 0 : 1;
      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + cost
      );
    }
  }

  return matrix[source.length][target.length];
}

function getSuggestedGoogleFontName(value) {
  const query = normalizeFontKey(value);

  if (!query) {
    return null;
  }

  let bestFont = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  googleFontSuggestions.forEach((fontName) => {
    const distance = getEditDistance(query, normalizeFontKey(fontName));

    if (distance < bestDistance) {
      bestDistance = distance;
      bestFont = fontName;
    }
  });

  return bestDistance <= 4 ? bestFont : null;
}

function setFontStatus(tokenName, tone, message) {
  state.fontStatuses[tokenName] = { tone, message };
}

function setFontStatusFromInput(tokenName, rawValue) {
  const value = normalizeFontWhitespace(rawValue);
  populateFontDatalistForQuery(value);
  renderFontSuggestions(tokenName, value);

  if (!value) {
    setFontStatus(
      tokenName,
      "warning",
      "Enter a Google Font name such as Inter or Playfair Display."
    );
    return;
  }

  if (getCanonicalGoogleFontName(value)) {
    setFontStatus(tokenName, "loading", "Matched a Google Font. Loading preview...");
    return;
  }

  if (getMatchingGoogleFonts(value).length > 0) {
    setFontStatus(
      tokenName,
      "loading",
      "Choose one of the autocomplete suggestions so the spelling matches exactly."
    );
    return;
  }

  setFontStatus(tokenName, "loading", "Checking Google Fonts for this spelling...");
}

function loadGoogleFont(fontName) {
  const normalizedName = normalizeFontWhitespace(fontName);
  const cacheKey = normalizeFontKey(normalizedName);

  if (!normalizedName) {
    return Promise.resolve({ ok: false, fontName: normalizedName });
  }

  if (fontLoadResults.has(cacheKey)) {
    return Promise.resolve(fontLoadResults.get(cacheKey));
  }

  if (fontLoadPromises.has(cacheKey)) {
    return fontLoadPromises.get(cacheKey);
  }

  const request = new Promise((resolve) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = buildGoogleFontStylesheetUrl(normalizedName);

    link.onload = async () => {
      try {
        if (document.fonts && document.fonts.load) {
          await Promise.race([
            document.fonts.load(`400 1em "${normalizedName}"`),
            new Promise((done) => window.setTimeout(done, 1500)),
          ]);
        }
      } catch (error) {
        // Keep the preview usable even if FontFaceSet is unavailable.
      }

      resolve({ ok: true, fontName: normalizedName });
    };

    link.onerror = () => {
      resolve({ ok: false, fontName: normalizedName });
    };

    document.head.appendChild(link);
  }).then((result) => {
    fontLoadPromises.delete(cacheKey);
    fontLoadResults.set(cacheKey, result);
    return result;
  });

  fontLoadPromises.set(cacheKey, request);
  return request;
}

function scheduleFontValidation(tokenName) {
  if (fontValidationTimers.has(tokenName)) {
    window.clearTimeout(fontValidationTimers.get(tokenName));
  }

  const timerId = window.setTimeout(() => {
    validateFontToken(tokenName);
  }, 350);

  fontValidationTimers.set(tokenName, timerId);
}

function validateFontToken(tokenName) {
  const input = getFontInput(tokenName);
  const value = normalizeFontWhitespace(input.value);
  input.value = value;

  if (!value) {
    setFontStatus(
      tokenName,
      "warning",
      "Enter a Google Font name such as Inter or Playfair Display."
    );
    updateUI();
    return;
  }

  const canonicalGoogleFont = getCanonicalGoogleFontName(value);
  const localMatches = getMatchingGoogleFonts(value);

  if (!canonicalGoogleFont && localMatches.length > 0) {
    setFontStatus(
      tokenName,
      "loading",
      "Choose one of the autocomplete suggestions so the spelling matches exactly."
    );
    updateUI();
    return;
  }

  const requestId = (fontRequestIds.get(tokenName) || 0) + 1;
  const requestedName = canonicalGoogleFont || value;
  fontRequestIds.set(tokenName, requestId);

  loadGoogleFont(requestedName).then((result) => {
    const latestValue = normalizeFontWhitespace(getFontInput(tokenName).value);

    if (fontRequestIds.get(tokenName) !== requestId) {
      return;
    }

    if (normalizeFontKey(latestValue) !== normalizeFontKey(value)) {
      return;
    }

    if (result.ok) {
      setFontStatus(
        tokenName,
        "good",
        canonicalGoogleFont
          ? "Google Font loaded for preview. Keep this exact spelling for Figma."
          : "Preview loaded from Google Fonts. Double-check the spelling before exporting."
      );
    } else {
      const suggestion = getSuggestedGoogleFontName(latestValue);
      setFontStatus(
        tokenName,
        "warning",
        suggestion
          ? `Google Fonts could not load that name. Try "${suggestion}".`
          : "Google Fonts could not load that name. Check the spelling or choose a suggestion."
      );
    }

    updateUI();
  });
}

function updateFontCatalogStatus() {
  fontCatalogStatus.textContent = state.fontCatalogStatus;
}

function updateFontValidationMessages() {
  typographyTokens.forEach((token) => {
    const message = getTokenMessage(token.name);
    const status = state.fontStatuses[token.name];

    message.textContent = status.message;
    message.className = "validation-message font-validation-message";

    if (status.tone) {
      message.classList.add(status.tone);
    }
  });
}

function getActiveTokens() {
  return [
    ...typographyTokens,
    ...colorTokens,
    ...(state.enabledOptional ? optionalTokens : []),
  ];
}

function updateOptionalVisibility() {
  optionalContainer.hidden = !state.enabledOptional;
}

function getValidColor(name, fallback) {
  if (!state.enabledOptional && optionalTokenNames.has(name)) {
    return fallback;
  }

  const value = state.values[name];
  return isValidHex(value) ? normalizeHex(value) : fallback;
}

function updateTokenCssVariables() {
  rootStyles.setProperty(
    "--token-font-body",
    formatPreviewFontFamily(state.values["font/family/body"], '"Segoe UI", sans-serif')
  );
  rootStyles.setProperty(
    "--token-color-text-primary",
    getValidColor("color/text/primary", "#1F1F1F")
  );
  rootStyles.setProperty(
    "--token-color-background-primary",
    getValidColor("color/background/primary", "#FAFAF7")
  );
  rootStyles.setProperty(
    "--token-color-text-secondary",
    getValidColor("color/text/secondary", "#F1EFEA")
  );
  rootStyles.setProperty(
    "--token-color-background-secondary",
    getValidColor("color/background/secondary", "#5A5A5A")
  );
  rootStyles.setProperty(
    "--token-color-action-primary",
    getValidColor("color/action/primary", "#2F6FED")
  );
  rootStyles.setProperty(
    "--token-color-action-hover",
    getValidColor("color/action/hover", "#1E56C5")
  );
  rootStyles.setProperty(
    "--token-color-action-secondary",
    getValidColor("color/action/secondary", "#669C35")
  );
  rootStyles.setProperty(
    "--token-color-action-secondary-hover",
    getValidColor("color/action/secondary-hover", "#38571A")
  );
  rootStyles.setProperty(
    "--token-color-text-inverse",
    getValidColor("color/text/inverse", "#F9F7F2")
  );
}

function updateSummary() {
  const activeTokens = getActiveTokens();
  summaryList.innerHTML = "";

  activeTokens.forEach((token) => {
    const value = state.values[token.name] || "";
    const item = document.createElement("article");
    item.className = "summary-item";
    item.id = `summary-${token.name.replace(/[/.]/g, "-")}`;

    const main = document.createElement("div");
    main.className = "summary-item-main";

    const label = document.createElement("p");
    label.className = "summary-label";
    label.textContent = token.label;

    const name = document.createElement("p");
    name.className = "summary-token";
    name.textContent = token.name;

    main.append(label, name);

    const valueNode = document.createElement("div");
    valueNode.className = "summary-value";

    if (token.name.startsWith("color/") && isValidHex(value)) {
      const chip = document.createElement("span");
      chip.className = "color-chip";
      chip.style.backgroundColor = normalizeHex(value);
      valueNode.appendChild(chip);
    }

    const valueText = document.createElement("span");
    valueText.textContent = value || "Not set";

    if (token.name.startsWith("font/") && value) {
      valueText.style.fontFamily = formatPreviewFontFamily(value, "sans-serif");
    }

    valueNode.appendChild(valueText);
    item.append(main, valueNode);
    summaryList.appendChild(item);
  });

  tokenCount.textContent = `${activeTokens.length} token${activeTokens.length === 1 ? "" : "s"}`;
}

function updateTypographyPreview() {
  const samples = [
    {
      label: "Brand sample",
      text: "Studio North",
      token: "font/family/brand",
      style: { fontSize: "1.45rem", fontWeight: "700" },
    },
    {
      label: "Heading sample",
      text: "Build a clear layout with reusable decisions",
      token: "font/family/heading",
      style: { fontSize: "1.65rem", fontWeight: "700", lineHeight: "1.15" },
    },
    {
      label: "Body sample",
      text: "Use your body font for paragraphs, UI labels, and other reading text across the website.",
      token: "font/family/body",
      style: { fontSize: "1rem", fontWeight: "500", lineHeight: "1.65" },
    },
  ];

  typographyPreview.innerHTML = "";

  samples.forEach((sample) => {
    const wrapper = document.createElement("article");
    wrapper.className = "type-sample";

    const label = document.createElement("span");
    label.className = "type-sample-label";
    label.textContent = sample.label;

    const text = document.createElement("div");
    text.textContent = sample.text;
    text.style.fontFamily = formatPreviewFontFamily(
      state.values[sample.token],
      "sans-serif"
    );
    Object.assign(text.style, sample.style);

    wrapper.append(label, text);
    typographyPreview.appendChild(wrapper);
  });
}

function applyWebsitePreviewCard({
  card,
  backgroundColor,
  textColor,
  actionColor,
  actionHoverColor,
  brandFont,
  headingFont,
  bodyFont,
}) {
  if (!card) {
    return;
  }

  const brand = card.querySelector(".preview-brand");
  const title = card.querySelector(".preview-title");
  const body = card.querySelector(".preview-body");
  const action = card.querySelector(".preview-action");

  card.style.background = backgroundColor;
  card.style.color = textColor;
  card.style.borderColor = getValidColor(
    "color/border/subtle",
    "rgba(98, 82, 61, 0.16)"
  );

  brand.style.fontFamily = formatPreviewFontFamily(brandFont, "serif");
  brand.style.color = textColor;
  title.style.fontFamily = formatPreviewFontFamily(headingFont, "sans-serif");
  title.style.color = textColor;
  body.style.fontFamily = formatPreviewFontFamily(bodyFont, "sans-serif");
  body.style.color = textColor;

  action.style.backgroundColor = actionColor;
  action.style.color = getValidColor("color/text/inverse", "#FFFFFF");
  action.style.fontFamily = formatPreviewFontFamily(bodyFont, "sans-serif");
  action.dataset.baseColor = actionColor;
  action.dataset.hoverColor = actionHoverColor;
}

function updateWebsitePreview() {
  const bgPrimary = getValidColor("color/background/primary", "#FAFAF7");
  const textPrimary = getValidColor("color/text/primary", "#1F1F1F");
  const actionPrimary = getValidColor("color/action/primary", "#2F6FED");
  const actionPrimaryHover = getValidColor("color/action/hover", "#1E56C5");

  const bgSecondary = getValidColor("color/background/secondary", "#5A5A5A");
  const textSecondary = getValidColor("color/text/secondary", "#F1EFEA");
  const actionSecondary = getValidColor("color/action/secondary", "#669C35");
  const actionSecondaryHover = getValidColor(
    "color/action/secondary-hover",
    "#38571A"
  );

  const brandFont = state.values["font/family/brand"] || "Fraunces";
  const headingFont = state.values["font/family/heading"] || "Manrope";
  const bodyFont = state.values["font/family/body"] || "Manrope";

  applyWebsitePreviewCard({
    card: websitePreviewPrimary,
    backgroundColor: bgPrimary,
    textColor: textPrimary,
    actionColor: actionPrimary,
    actionHoverColor: actionPrimaryHover,
    brandFont: brandFont,
    headingFont: headingFont,
    bodyFont: bodyFont,
  });

  applyWebsitePreviewCard({
    card: websitePreviewSecondary,
    backgroundColor: bgSecondary,
    textColor: textSecondary,
    actionColor: actionSecondary,
    actionHoverColor: actionSecondaryHover,
    brandFont: brandFont,
    headingFont: headingFont,
    bodyFont: bodyFont,
  });
}

function toRgb(hex) {
  const normalized = normalizeHex(hex).replace("#", "");
  const intValue = Number.parseInt(normalized, 16);
  return {
    r: (intValue >> 16) & 255,
    g: (intValue >> 8) & 255,
    b: intValue & 255,
  };
}

function channelToLinear(value) {
  const channel = value / 255;
  return channel <= 0.03928
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}

function getLuminance(hex) {
  const { r, g, b } = toRgb(hex);
  return (
    0.2126 * channelToLinear(r) +
    0.7152 * channelToLinear(g) +
    0.0722 * channelToLinear(b)
  );
}

function getContrastRatio(foreground, background) {
  const lum1 = getLuminance(foreground);
  const lum2 = getLuminance(background);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

function updateContrastHints() {
  const checks = [
    {
      key: "primary-on-primary",
      title: "Primary text | background",
      foreground: getValidColor("color/text/primary", "#1F1F1F"),
      background: getValidColor("color/background/primary", "#FAFAF7"),
      recommended: 4.5,
    },
    {
      key: "secondary-on-secondary",
      title: "Secondary text | background",
      foreground: getValidColor("color/text/secondary", "#F1EFEA"),
      background: getValidColor("color/background/secondary", "#5A5A5A"),
      recommended: 4.5,
    },
    {
      key: "inverse-on-action",
      title: "Inverse text on action color",
      foreground: getValidColor("color/text/inverse", "#FFFFFF"),
      background: getValidColor("color/action/primary", "#2F6FED"),
      recommended: 4.5,
    },
  ];

  checks.forEach((check) => {
    const card = contrastHints.querySelector(`[data-check="${check.key}"]`);
    const isOptionalCheck = check.key === "inverse-on-action";

    if (isOptionalCheck) {
      card.hidden = !state.enabledOptional;
    }

    if (isOptionalCheck && !state.enabledOptional) {
      return;
    }

    const ratio = getContrastRatio(check.foreground, check.background);
    const passes = ratio >= check.recommended;
    const badge = card.querySelector(".hint-badge");
    const badgeIcon = card.querySelector(".hint-badge-icon");
    const badgeLabel = card.querySelector(".hint-badge-label");
    const title = card.querySelector(".hint-title");
    const description = card.querySelector(".hint-description");

    card.classList.remove("good", "warning");
    card.classList.add(passes ? "good" : "warning");

    badge.classList.remove("good", "warning");
    badge.classList.add(passes ? "good" : "warning");

    badgeIcon.textContent = passes ? "✓" : "✕";
    badgeLabel.textContent = passes ? "Pass" : "Fail";
    title.innerHTML = `${check.title}: <b>${ratio.toFixed(2)}:1</b>`;
    description.textContent = passes
      ? "Pairing passes WCAG 2.1"
      : "Pairing fails WCAG 2.1";
  });
}

function buildPlainExport(tokens) {
  return tokens
    .map((token) => `${token.name}=${state.values[token.name] || ""}`)
    .join("\n");
}

function buildGroupedExport(tokens) {
  const groups = [
    {
      title: "Typography",
      tokens: tokens.filter((token) => token.name.startsWith("font/")),
    },
    {
      title: "Color",
      tokens: tokens.filter((token) => token.name.startsWith("color/")),
    },
  ].filter((group) => group.tokens.length > 0);

  return groups
    .map((group) => {
      const lines = group.tokens.map(
        (token) => `- ${token.name}: ${state.values[token.name] || ""}`
      );
      return `${group.title}\n${lines.join("\n")}`;
    })
    .join("\n\n");
}

function updateExportOutput() {
  const activeTokens = getActiveTokens();
  exportOutput.value =
    state.exportMode === "grouped"
      ? buildGroupedExport(activeTokens)
      : buildPlainExport(activeTokens);
}

function updateUI() {
  syncStateFromDom();
  updateTokenCssVariables();
  updateOptionalVisibility();
  updateFontCatalogStatus();
  updateFontValidationMessages();
  updateSummary();
  updateTypographyPreview();
  updateWebsitePreview();
  updateContrastHints();
  updateExportOutput();
}

function updateColorField(tokenName, nextValue) {
  const hexInput = getHexInput(tokenName);
  const picker = getColorPicker(tokenName);
  const message = getTokenMessage(tokenName);

  hexInput.value = nextValue;

  if (isValidHex(nextValue)) {
    const normalized = normalizeHex(nextValue);
    hexInput.value = normalized;
    picker.value = normalized;
    message.textContent = "";
  } else if (nextValue.length === 0) {
    message.textContent = "Enter a hex value such as #1F1F1F.";
  } else {
    message.textContent = "Use a valid 6-digit hex value such as #1F1F1F.";
  }
}

function resetForm() {
  tokenForm.reset();
  initializeFontStatuses();

  [...colorTokens, ...optionalTokens].forEach((token) => {
    getTokenMessage(token.name).textContent = "";
  });

  typographyTokens.forEach((token) => {
    validateFontToken(token.name);
  });

  updateUI();
}

async function copyExport() {
  try {
    await navigator.clipboard.writeText(exportOutput.value);
    copyButton.textContent = "Copied";
  } catch (error) {
    copyButton.textContent = "Copy failed";
  }

  window.setTimeout(() => {
    copyButton.textContent = "Copy export";
  }, 1400);
}

function handleFormInput(event) {
  const target = event.target;

  if (target.matches(".color-picker[data-token]")) {
    updateColorField(target.dataset.token, normalizeHex(target.value));
    updateUI();
    return;
  }

  if (target.matches(".hex-input[data-token]")) {
    updateColorField(target.dataset.token, target.value.trim());
    updateUI();
    return;
  }

  if (target.matches(".font-input[data-token]")) {
    setFontStatusFromInput(target.dataset.token, target.value);
    scheduleFontValidation(target.dataset.token);
    updateUI();
    return;
  }

  updateUI();
}

function handleFormChange(event) {
  const target = event.target;

  if (target.matches(".font-input[data-token]")) {
    const normalized = normalizeFontWhitespace(target.value);
    const canonicalName = getCanonicalGoogleFontName(normalized);
    target.value = canonicalName || normalized;
    populateFontDatalistForQuery(target.value);
    validateFontToken(target.dataset.token);
    renderFontSuggestions(target.dataset.token, target.value);
    updateUI();
    return;
  }

  updateUI();
}

function bindControls() {
  tokenForm.addEventListener("input", handleFormInput);
  tokenForm.addEventListener("change", handleFormChange);
  tokenForm.addEventListener("focusin", (event) => {
    const target = event.target;
    if (target.matches(".font-input[data-token]")) {
      populateFontDatalistForQuery(target.value);
      renderFontSuggestions(target.dataset.token, target.value);
    }
  });
  tokenForm.addEventListener("focusout", (event) => {
    const target = event.target;
    if (target.matches(".font-input[data-token]")) {
      window.setTimeout(() => {
        if (!document.activeElement || !document.activeElement.matches(".font-suggestion-button")) {
          hideFontSuggestions(target.dataset.token);
        }
      }, 80);
    }
  });
  tokenForm.addEventListener("mousedown", (event) => {
    const suggestion = event.target.closest(".font-suggestion-button");
    if (!suggestion) {
      return;
    }

    event.preventDefault();
    const tokenName = suggestion.dataset.token;
    const input = getFontInput(tokenName);
    input.value = suggestion.dataset.fontSuggestion;
    populateFontDatalistForQuery(input.value);
    hideFontSuggestions(tokenName);
    validateFontToken(tokenName);
    updateUI();
  });
  exportModeSelect.addEventListener("change", updateUI);
  copyButton.addEventListener("click", copyExport);
  resetButton.addEventListener("click", resetForm);

  previewActions.forEach((action) => {
    action.addEventListener("click", (event) => event.preventDefault());
    action.addEventListener("mouseenter", () => {
      action.style.backgroundColor = action.dataset.hoverColor;
    });
    action.addEventListener("mouseleave", () => {
      action.style.backgroundColor = action.dataset.baseColor;
    });
  });
}

function dispatchInput(element) {
  element.dispatchEvent(new Event("input", { bubbles: true }));
}

function dispatchChange(element) {
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function assertTest(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function hexToRgbString(hex) {
  const { r, g, b } = toRgb(hex);
  return `rgb(${r}, ${g}, ${b})`;
}

function runInteractionTests() {
  const defaults = {
    brand: getFontInput("font/family/brand").value,
    heading: getFontInput("font/family/heading").value,
    body: getFontInput("font/family/body").value,
    action: getHexInput("color/action/primary").value,
    actionSecondary: getHexInput("color/action/secondary").value,
    textPrimary: getHexInput("color/text/primary").value,
    bgPrimary: getHexInput("color/background/primary").value,
  };
  const results = [];

  try {
    assertTest(
      fontCatalogStatus.textContent.length > 0,
      "font catalog status should not be empty"
    );
    results.push("catalog status");

    getFontInput("font/family/brand").value = "Poppins";
    dispatchInput(getFontInput("font/family/brand"));
    dispatchChange(getFontInput("font/family/brand"));
    getFontInput("font/family/heading").value = "Poppins";
    dispatchInput(getFontInput("font/family/heading"));
    dispatchChange(getFontInput("font/family/heading"));
    getFontInput("font/family/body").value = "Poppins";
    dispatchInput(getFontInput("font/family/body"));
    dispatchChange(getFontInput("font/family/body"));
    assertTest(
      websitePreviewPrimary
        .querySelector(".preview-brand")
        .style.fontFamily.includes("Poppins"),
      "sample website card should use chosen brand font"
    );
    assertTest(
      websitePreviewPrimary
        .querySelector(".preview-title")
        .style.fontFamily.includes("Poppins"),
      "sample website card should use chosen heading font"
    );
    assertTest(
      websitePreviewPrimary
        .querySelector(".preview-body")
        .style.fontFamily.includes("Poppins"),
      "sample website card should use chosen body font"
    );
    assertTest(
      websitePreviewPrimary
        .querySelector(".preview-action")
        .style.fontFamily.includes("Poppins"),
      "primary action button should use chosen body font"
    );
    assertTest(
      websitePreviewSecondary
        .querySelector(".preview-action")
        .style.fontFamily.includes("Poppins"),
      "secondary action button should use chosen body font"
    );
    results.push("font previews");

    getHexInput("color/action/primary").value = "#FF5500";
    dispatchInput(getHexInput("color/action/primary"));
    assertTest(
      getColorPicker("color/action/primary").value.toUpperCase() === "#FF5500",
      "hex and color picker should stay in sync"
    );
    assertTest(
      getComputedStyle(
        websitePreviewPrimary.querySelector(".preview-action")
      ).backgroundColor === hexToRgbString("#FF5500"),
      "sample action button should use primary action color"
    );

    getHexInput("color/action/secondary").value = "#006E61";
    dispatchInput(getHexInput("color/action/secondary"));
    assertTest(
      getComputedStyle(
        websitePreviewSecondary.querySelector(".preview-action")
      ).backgroundColor === hexToRgbString("#006E61"),
      "secondary sample action button should use secondary action color"
    );
    results.push("color sync");

    getHexInput("color/text/primary").value = "#112233";
    dispatchInput(getHexInput("color/text/primary"));
    getHexInput("color/background/primary").value = "#F4F1EA";
    dispatchInput(getHexInput("color/background/primary"));
    assertTest(
      getComputedStyle(websitePreviewPrimary).backgroundColor === hexToRgbString("#F4F1EA"),
      "sample website card should use primary background color"
    );
    assertTest(
      getComputedStyle(websitePreviewPrimary).color === hexToRgbString("#112233"),
      "sample website card should use primary text color"
    );
    results.push("sample card colors");

    assertTest(
      getComputedStyle(
        contrastHints.querySelector('[data-check="primary-on-primary"] .hint-preview')
      ).color === hexToRgbString("#112233"),
      "accessibility preview should match chosen text color"
    );
    results.push("accessibility previews");

    assertTest(
      exportOutput.value.includes("color/text/primary=#112233"),
      "plain export should react to value changes"
    );
    exportModeSelect.value = "grouped";
    dispatchChange(exportModeSelect);
    assertTest(
      exportOutput.value.includes("Typography") &&
        exportOutput.value.includes("Color"),
      "grouped export should show grouped sections"
    );
    results.push("export modes");

    resetForm();
    assertTest(
      getHexInput("color/action/primary").value === defaults.action &&
        getHexInput("color/action/secondary").value === defaults.actionSecondary &&
        getFontInput("font/family/body").value === defaults.body &&
        exportModeSelect.value === "plain",
      "reset should restore form defaults"
    );
    assertTest(
      exportOutput.value.includes(`color/action/primary=${defaults.action}`),
      "reset should restore export output"
    );
    results.push("reset");
  } finally {
    resetForm();
  }

  return results;
}

function init() {
  loadGoogleFontsCatalog();
  populateFontDatalist();
  hideAllFontSuggestions();
  initializeFontStatuses();
  bindControls();
  typographyTokens.forEach((token) => validateFontToken(token.name));
  updateUI();
  window.runInteractionTests = runInteractionTests;
}

init();
