// Token definitions stay data-driven so new groups can be added later.
const typographyTokens = [
  {
    name: "font.family.brand",
    label: "Site Name / Brand Font",
    help: "The font used for the site name, logo text, or branded title.",
    type: "font",
    placeholder: "Playfair Display",
    defaultValue: "Playfair Display",
  },
  {
    name: "font.family.heading",
    label: "Heading Font",
    help: "The main font used for page headings and section headings.",
    type: "font",
    placeholder: "Inter",
    defaultValue: "Inter",
  },
  {
    name: "font.family.body",
    label: "Body Font",
    help: "The font used for paragraph text and most reading text.",
    type: "font",
    placeholder: "Source Sans 3",
    defaultValue: "Source Sans 3",
  },
];

const colorTokens = [
  {
    name: "color.text.primary",
    label: "Primary Text",
    help: "The main text color used for most body copy and headings.",
    type: "color",
    defaultValue: "#1F1F1F",
  },
  {
    name: "color.text.secondary",
    label: "Secondary Text",
    help: "A less prominent text color for supporting information.",
    type: "color",
    defaultValue: "#5A5A5A",
  },
  {
    name: "color.background.primary",
    label: "Primary Background",
    help: "The main page background color.",
    type: "color",
    defaultValue: "#FAFAF7",
  },
  {
    name: "color.background.secondary",
    label: "Secondary Background",
    help: "A background color for cards, sections, or panels.",
    type: "color",
    defaultValue: "#F1EFEA",
  },
  {
    name: "color.action.primary",
    label: "Primary Action",
    help: "The main interactive color for buttons and important links.",
    type: "color",
    defaultValue: "#2F6FED",
  },
  {
    name: "color.action.hover",
    label: "Action Hover",
    help: "The hover state for buttons or interactive links.",
    type: "color",
    defaultValue: "#1E56C5",
  },
  {
    name: "color.accent",
    label: "Accent / Highlight",
    help: "A color used sparingly for emphasis, highlights, or small visual accents.",
    type: "color",
    defaultValue: "#D97706",
  },
];

const optionalTokens = [
  {
    name: "color.border.subtle",
    label: "Subtle Border",
    help: "A light border or divider color.",
    type: "color",
    defaultValue: "#D8D1C7",
  },
  {
    name: "color.text.inverse",
    label: "Inverse Text",
    help: "Text used on dark or strong colored backgrounds.",
    type: "color",
    defaultValue: "#F9F7F2",
  },
  {
    name: "color.background.inverse",
    label: "Inverse Background",
    help: "A dark or contrasting background used for emphasis sections.",
    type: "color",
    defaultValue: "#20242D",
  },
];

const tokenGroups = [
  { key: "typography", title: "Typography", tokens: typographyTokens },
  { key: "color", title: "Color", tokens: colorTokens },
  { key: "optional", title: "Optional", tokens: optionalTokens },
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
let googleFontSuggestions = [...fallbackGoogleFontSuggestions];
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

const fontContainer = document.querySelector("#typography-fields");
const fontCatalogStatus = document.querySelector("#font-catalog-status");
const colorContainer = document.querySelector("#color-fields");
const optionalContainer = document.querySelector("#optional-fields");
const optionalToggle = document.querySelector("#optional-toggle");
const exportModeSelect = document.querySelector("#export-mode");
const exportOutput = document.querySelector("#export-output");
const summaryList = document.querySelector("#summary-list");
const typographyPreview = document.querySelector("#typography-preview");
const tokenCount = document.querySelector("#token-count");
const contrastHints = document.querySelector("#contrast-hints");
const copyButton = document.querySelector("#copy-button");
const resetButton = document.querySelector("#reset-button");
const websitePreview = document.querySelector("#website-preview");
const previewAction = websitePreview.querySelector(".preview-action");
const fontDatalist = document.querySelector("#google-font-options");
const localGoogleFontCatalog = Array.isArray(window.GOOGLE_FONTS_CATALOG)
  ? window.GOOGLE_FONTS_CATALOG
  : null;

function initializeState() {
  refreshGoogleFontLookup();

  tokenGroups.forEach((group) => {
    group.tokens.forEach((token) => {
      state.values[token.name] = token.defaultValue;
    });
  });

  typographyTokens.forEach((token) => {
    state.fontStatuses[token.name] = {
      tone: "loading",
      message: "Loading Google Font preview...",
    };
  });
}

function refreshGoogleFontLookup() {
  googleFontLookup = new Map(
    googleFontSuggestions.map((fontName) => [normalizeFontKey(fontName), fontName])
  );
}

function renderFontFields(tokens, container) {
  const template = document.querySelector("#font-field-template");

  tokens.forEach((token) => {
    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector(".token-card");
    const nameNode = fragment.querySelector(".token-name");
    const labelNode = fragment.querySelector(".token-label");
    const helpNode = fragment.querySelector(".token-help");
    const input = fragment.querySelector(".font-input");
    const validation = fragment.querySelector(".font-validation-message");

    card.dataset.token = token.name;
    nameNode.textContent = token.name;
    labelNode.textContent = token.label;
    helpNode.textContent = token.help;
    input.placeholder = token.placeholder;
    input.value = state.values[token.name];
    input.id = token.name;
    input.setAttribute("list", "google-font-options");
    validation.textContent = state.fontStatuses[token.name].message;
    validation.classList.add(state.fontStatuses[token.name].tone);

    input.addEventListener("input", (event) => {
      state.values[token.name] = normalizeFontWhitespace(event.target.value);
      setFontStatusFromInput(token.name);
      scheduleFontValidation(token.name);
      updateUI();
    });

    input.addEventListener("change", (event) => {
      const canonicalName = getCanonicalGoogleFontName(event.target.value);

      if (canonicalName) {
        event.target.value = canonicalName;
        state.values[token.name] = canonicalName;
      } else {
        state.values[token.name] = normalizeFontWhitespace(event.target.value);
      }

      validateFontToken(token.name);
      updateUI();
    });

    container.appendChild(fragment);
  });
}

function populateFontDatalist() {
  const options = document.createDocumentFragment();

  googleFontSuggestions.forEach((fontName) => {
    const option = document.createElement("option");
    option.value = fontName;
    options.appendChild(option);
  });

  fontDatalist.innerHTML = "";
  fontDatalist.appendChild(options);
}

function fetchGoogleFontsCatalog() {
  if (localGoogleFontCatalog && localGoogleFontCatalog.length > 0) {
    googleFontSuggestions = [...new Set(localGoogleFontCatalog)].sort((left, right) =>
      left.localeCompare(right)
    );
    refreshGoogleFontLookup();
    state.fontCatalogStatus = `Loaded ${googleFontSuggestions.length} Google Fonts from the local catalog file.`;
    return;
  }

  state.fontCatalogStatus =
    "Could not load the local Google Fonts catalog. Using the fallback font list instead.";
}

function renderColorFields(tokens, container) {
  const template = document.querySelector("#color-field-template");

  tokens.forEach((token) => {
    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector(".token-card");
    const nameNode = fragment.querySelector(".token-name");
    const labelNode = fragment.querySelector(".token-label");
    const helpNode = fragment.querySelector(".token-help");
    const picker = fragment.querySelector(".color-picker");
    const hexInput = fragment.querySelector(".hex-input");
    const validation = fragment.querySelector(".validation-message");

    card.dataset.token = token.name;
    nameNode.textContent = token.name;
    labelNode.textContent = token.label;
    helpNode.textContent = token.help;
    picker.value = state.values[token.name];
    hexInput.value = state.values[token.name];
    hexInput.placeholder = "#A1B2C3";
    hexInput.id = token.name;

    picker.addEventListener("input", (event) => {
      const normalized = normalizeHex(event.target.value);
      state.values[token.name] = normalized;
      hexInput.value = normalized;
      validation.textContent = "";
      updateUI();
    });

    hexInput.addEventListener("input", (event) => {
      const rawValue = event.target.value.trim();
      state.values[token.name] = rawValue;

      if (isValidHex(rawValue)) {
        const normalized = normalizeHex(rawValue);
        state.values[token.name] = normalized;
        picker.value = normalized;
        hexInput.value = normalized;
        validation.textContent = "";
      } else if (rawValue.length === 0) {
        validation.textContent = "Enter a hex value such as #1F1F1F.";
      } else {
        validation.textContent = "Use a valid 6-digit hex value such as #1F1F1F.";
      }

      updateUI();
    });

    container.appendChild(fragment);
  });
}

function isValidHex(value) {
  return /^#?([0-9a-fA-F]{6})$/.test(value);
}

function normalizeHex(value) {
  const cleaned = value.startsWith("#") ? value : `#${value}`;
  return cleaned.toUpperCase();
}

function normalizeFontWhitespace(value) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeFontKey(value) {
  return normalizeFontWhitespace(value).toLowerCase();
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

function buildGoogleFontStylesheetUrl(fontName) {
  const encodedFamily = encodeURIComponent(fontName).replace(/%20/g, "+");
  return `https://fonts.googleapis.com/css2?family=${encodedFamily}:wght@400;500;600;700&display=swap`;
}

function formatPreviewFontFamily(value, fallbackGeneric) {
  return value ? `"${value}", ${fallbackGeneric}` : fallbackGeneric;
}

function setFontStatus(tokenName, tone, message) {
  state.fontStatuses[tokenName] = { tone, message };
}

function setFontStatusFromInput(tokenName) {
  const value = state.values[tokenName];

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

  const closeMatches = getMatchingGoogleFonts(value);

  if (closeMatches.length > 0) {
    setFontStatus(
      tokenName,
      "loading",
      "Choose one of the autocomplete suggestions so the spelling matches exactly."
    );
    return;
  }

  setFontStatus(
    tokenName,
    "loading",
    "Checking Google Fonts for this spelling..."
  );
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
        // If the stylesheet loaded, keep the preview usable even if the FontFaceSet API is unavailable.
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
  const value = state.values[tokenName];

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
    const latestValue = state.values[tokenName];

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

function getActiveTokens() {
  return [
    ...typographyTokens,
    ...colorTokens,
    ...(state.enabledOptional ? optionalTokens : []),
  ];
}

function updateSummary() {
  const activeTokens = getActiveTokens();
  summaryList.innerHTML = "";

  activeTokens.forEach((token) => {
    const value = state.values[token.name] || "";
    const item = document.createElement("article");
    item.className = "summary-item";

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

    if (token.type === "color" && isValidHex(value)) {
      const chip = document.createElement("span");
      chip.className = "color-chip";
      chip.style.backgroundColor = normalizeHex(value);
      valueNode.appendChild(chip);
    }

    const valueText = document.createElement("span");
    valueText.textContent = value || "Not set";

    if (token.type === "font" && value) {
      valueText.style.fontFamily = formatPreviewFontFamily(value, "sans-serif");
    }

    valueNode.appendChild(valueText);

    item.append(main, valueNode);
    summaryList.appendChild(item);
  });

  tokenCount.textContent = `${activeTokens.length} token${activeTokens.length === 1 ? "" : "s"}`;
}

function updateFontCatalogStatus() {
  fontCatalogStatus.textContent = state.fontCatalogStatus;
}

function updateFontValidationMessages() {
  typographyTokens.forEach((token) => {
    const card = document.querySelector(`.token-card[data-token="${token.name}"]`);
    const message = card?.querySelector(".font-validation-message");
    const status = state.fontStatuses[token.name];

    if (!message || !status) {
      return;
    }

    message.textContent = status.message;
    message.className = "validation-message font-validation-message";

    if (status.tone) {
      message.classList.add(status.tone);
    }
  });
}

function updateTypographyPreview() {
  const samples = [
    {
      label: "Brand sample",
      text: "Studio North",
      token: "font.family.brand",
      style: { fontSize: "1.45rem", fontWeight: "700" },
    },
    {
      label: "Heading sample",
      text: "Build a clear layout with reusable decisions",
      token: "font.family.heading",
      style: { fontSize: "1.65rem", fontWeight: "700", lineHeight: "1.15" },
    },
    {
      label: "Body sample",
      text: "Use your body font for paragraphs, UI labels, and other reading text across the website.",
      token: "font.family.body",
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

function updateWebsitePreview() {
  const bgPrimary = getValidColor("color.background.primary", "#FAFAF7");
  const bgSecondary = getValidColor("color.background.secondary", "#F1EFEA");
  const textPrimary = getValidColor("color.text.primary", "#1F1F1F");
  const textSecondary = getValidColor("color.text.secondary", "#5A5A5A");
  const actionPrimary = getValidColor("color.action.primary", "#2F6FED");
  const actionHover = getValidColor("color.action.hover", "#1E56C5");
  const brandFont = state.values["font.family.brand"] || "Fraunces";
  const headingFont = state.values["font.family.heading"] || "Manrope";
  const bodyFont = state.values["font.family.body"] || "Manrope";

  websitePreview.style.background = `linear-gradient(180deg, ${bgPrimary} 0%, ${bgSecondary} 100%)`;
  websitePreview.style.color = textPrimary;
  websitePreview.style.borderColor = getValidColor("color.border.subtle", "rgba(98, 82, 61, 0.16)");

  const brand = websitePreview.querySelector(".preview-brand");
  const title = websitePreview.querySelector(".preview-title");
  const body = websitePreview.querySelector(".preview-body");
  brand.style.fontFamily = formatPreviewFontFamily(brandFont, "serif");
  brand.style.color = getValidColor("color.accent", actionPrimary);
  title.style.fontFamily = formatPreviewFontFamily(headingFont, "sans-serif");
  body.style.fontFamily = formatPreviewFontFamily(bodyFont, "sans-serif");
  body.style.color = textSecondary;
  previewAction.style.backgroundColor = actionPrimary;
  previewAction.style.color = getValidColor("color.text.inverse", "#FFFFFF");
  previewAction.dataset.baseColor = actionPrimary;
  previewAction.dataset.hoverColor = actionHover;
}

function getValidColor(name, fallback) {
  if (!state.enabledOptional && optionalTokenNames.has(name)) {
    return fallback;
  }

  const value = state.values[name];
  return isValidHex(value) ? normalizeHex(value) : fallback;
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
  contrastHints.innerHTML = "";

  // Check the text/background pairs students are most likely to use first.
  const checks = [
    {
      title: "Primary text on primary background",
      foreground: getValidColor("color.text.primary", "#1F1F1F"),
      background: getValidColor("color.background.primary", "#FAFAF7"),
      recommended: 4.5,
    },
    {
      title: "Secondary text on primary background",
      foreground: getValidColor("color.text.secondary", "#5A5A5A"),
      background: getValidColor("color.background.primary", "#FAFAF7"),
      recommended: 4.5,
    },
    {
      title: "Inverse text on action color",
      foreground: getValidColor("color.text.inverse", "#FFFFFF"),
      background: getValidColor("color.action.primary", "#2F6FED"),
      recommended: 4.5,
    },
  ];

  checks.forEach((check) => {
    const card = document.createElement("article");
    const ratio = getContrastRatio(check.foreground, check.background);
    const passes = ratio >= check.recommended;

    card.className = `hint-card ${passes ? "good" : "warning"}`;

    const title = document.createElement("p");
    title.className = "hint-title";
    title.textContent = `${check.title}: ${ratio.toFixed(2)}:1`;

    const text = document.createElement("p");
    text.textContent = passes
      ? "This pairing looks reasonably strong for normal-sized text."
      : "This pairing may be hard to read. Try increasing contrast between text and background.";

    card.append(title, text);
    contrastHints.appendChild(card);
  });
}

function buildPlainExport(tokens) {
  return tokens
    .map((token) => `${token.name} = ${state.values[token.name] || ""}`)
    .join("\n");
}

function buildGroupedExport(tokens) {
  const groups = [
    {
      title: "Typography",
      tokens: tokens.filter((token) => token.name.startsWith("font.")),
    },
    {
      title: "Color",
      tokens: tokens.filter((token) => token.name.startsWith("color.")),
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

function updateOptionalVisibility() {
  optionalContainer.hidden = !state.enabledOptional;
}

function updateUI() {
  updateOptionalVisibility();
  updateFontCatalogStatus();
  updateFontValidationMessages();
  updateSummary();
  updateTypographyPreview();
  updateWebsitePreview();
  updateContrastHints();
  updateExportOutput();
}

function resetState() {
  initializeState();
  state.enabledOptional = false;
  state.exportMode = "plain";

  document.querySelectorAll(".font-input").forEach((input) => {
    input.value = state.values[input.id];
  });

  document.querySelectorAll(".token-card[data-token]").forEach((card) => {
    const tokenName = card.dataset.token;
    const colorPicker = card.querySelector(".color-picker");
    const hexInput = card.querySelector(".hex-input");
    const validation = card.querySelector(".validation-message");

    if (colorPicker && hexInput) {
      colorPicker.value = state.values[tokenName];
      hexInput.value = state.values[tokenName];
      validation.textContent = "";
    }
  });

  optionalToggle.checked = false;
  exportModeSelect.value = "plain";
  typographyTokens.forEach((token) => {
    setFontStatus(token.name, "loading", "Loading Google Font preview...");
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

function bindControls() {
  optionalToggle.addEventListener("change", (event) => {
    state.enabledOptional = event.target.checked;
    updateUI();
  });

  exportModeSelect.addEventListener("change", (event) => {
    state.exportMode = event.target.value;
    updateExportOutput();
  });

  copyButton.addEventListener("click", copyExport);
  resetButton.addEventListener("click", resetState);
  previewAction.addEventListener("click", (event) => event.preventDefault());
  previewAction.addEventListener("mouseenter", () => {
    previewAction.style.backgroundColor = previewAction.dataset.hoverColor;
  });
  previewAction.addEventListener("mouseleave", () => {
    previewAction.style.backgroundColor = previewAction.dataset.baseColor;
  });
}

function init() {
  initializeState();
  fetchGoogleFontsCatalog();
  populateFontDatalist();
  renderFontFields(typographyTokens, fontContainer);
  renderColorFields(colorTokens, colorContainer);
  renderColorFields(optionalTokens, optionalContainer);
  bindControls();
  typographyTokens.forEach((token) => validateFontToken(token.name));
  updateUI();
}

init();
