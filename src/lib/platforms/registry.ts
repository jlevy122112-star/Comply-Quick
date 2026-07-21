// Supported website-builder / e-commerce platforms for one-click Comply-Quick
// integration. Each entry records the install mechanism and the products we can
// emit platform-native snippets for.

export type PlatformProduct = "cookie-banner" | "privacy-policy" | "terms" | "dpa";
export type InstallType = "theme-edit" | "code-injection" | "plugin" | "embed" | "manual";

export interface Platform {
  id: string;
  name: string;
  /** Short category label shown in the UI. */
  category: string;
  /** How the integration snippet is typically installed on this platform. */
  installType: InstallType;
  /** Human-readable install label for cards. */
  installLabel: string;
  /** Products we can currently generate for this platform. */
  products: PlatformProduct[];
  /** Step-by-step setup instructions (platform-specific). */
  instructions: string[];
  /** Optional hint shown in the snippet preview. */
  snippetHint?: string;
}

const CODE_INJECTION_INSTRUCTIONS = [
  "Copy the generated snippet.",
  "Open your site dashboard and find the custom code / header code section.",
  "Paste the snippet into the site-wide <head> area (before </head>).",
  "Save and publish your site.",
];

export const PLATFORMS: Platform[] = [
  {
    id: "shopify",
    name: "Shopify",
    category: "E-commerce",
    installType: "theme-edit",
    installLabel: "Theme code edit",
    products: ["cookie-banner", "privacy-policy", "terms"],
    instructions: [
      "Copy the generated snippet.",
      "In Shopify admin, go to Online Store > Themes > Actions > Edit code.",
      "Open theme.liquid and paste the snippet just before the closing </body> tag.",
      "Save the theme and preview your store.",
    ],
    snippetHint: "Paste in theme.liquid before </body>",
  },
  {
    id: "wix",
    name: "Wix",
    category: "Site builder",
    installType: "code-injection",
    installLabel: "Custom code",
    products: ["cookie-banner", "privacy-policy", "terms"],
    instructions: [
      "Copy the generated snippet.",
      "In your Wix dashboard, go to Settings > Tracking & Analytics.",
      "Click + New Tool > Custom and paste the snippet into the code box.",
      "Set it to load once per site, apply to all pages, and save.",
    ],
    snippetHint: "Add under Settings > Tracking & Analytics > Custom",
  },
  {
    id: "squarespace",
    name: "Squarespace",
    category: "Site builder",
    installType: "code-injection",
    installLabel: "Code injection",
    products: ["cookie-banner", "privacy-policy", "terms"],
    instructions: [
      "Copy the generated snippet.",
      "Go to Website > Website Tools > Code Injection.",
      "Paste the snippet into the HEADER or FOOTER injection area.",
      "Save the changes.",
    ],
    snippetHint: "Website > Website Tools > Code Injection",
  },
  {
    id: "webflow",
    name: "Webflow",
    category: "Site builder",
    installType: "code-injection",
    installLabel: "Custom code",
    products: ["cookie-banner", "privacy-policy", "terms"],
    instructions: [
      "Copy the generated snippet.",
      "Open Project settings > Custom code.",
      "Paste the snippet into the Footer code area (before </body>).",
      "Save changes and republish the site.",
    ],
    snippetHint: "Project settings > Custom code > Footer code",
  },
  {
    id: "wordpress",
    name: "WordPress.org",
    category: "CMS",
    installType: "plugin",
    installLabel: "Plugin / theme",
    products: ["cookie-banner", "privacy-policy", "terms"],
    instructions: [
      "Copy the generated snippet.",
      "In WordPress admin, go to Appearance > Theme File Editor.",
      "Open footer.php (or use a code snippets plugin) and paste before </body>.",
      "Alternatively, install the Comply-Quick plugin when available.",
    ],
    snippetHint: "Use a child theme or a code-snippets plugin",
  },
  {
    id: "weebly",
    name: "Weebly",
    category: "Site builder",
    installType: "code-injection",
    installLabel: "Header / footer code",
    products: ["cookie-banner", "privacy-policy"],
    instructions: [
      "Copy the generated snippet.",
      "In Weebly, go to Settings > SEO > Footer Code.",
      "Paste the snippet into the Footer Code field.",
      "Publish the site.",
    ],
  },
  {
    id: "bigcommerce",
    name: "BigCommerce",
    category: "E-commerce",
    installType: "theme-edit",
    installLabel: "Theme footer script",
    products: ["cookie-banner", "privacy-policy"],
    instructions: [
      "Copy the generated snippet.",
      "Go to Storefront > Themes > Advanced > Edit Theme.",
      "Open templates/layout/base.html or footer scripts and paste before </body>.",
      "Save and apply the theme.",
    ],
  },
  {
    id: "godaddy",
    name: "GoDaddy Website Builder",
    category: "Site builder",
    installType: "manual",
    installLabel: "Manual embed",
    products: ["privacy-policy", "terms"],
    instructions: [
      "GoDaddy Website Builder does not support arbitrary header/footer code.",
      "For policies, use Comply-Quick hosted pages and link them in your site menu.",
      "For the cookie banner, consider switching to a platform with code-injection support or use a custom HTML section if available.",
    ],
  },
  {
    id: "duda",
    name: "Duda",
    category: "Site builder",
    installType: "code-injection",
    installLabel: "Site HTML",
    products: ["cookie-banner", "privacy-policy", "terms"],
    instructions: [
      "Copy the generated snippet.",
      "In Duda, go to Site > Site Settings > Head and Body.",
      "Paste the snippet into the Body-End (before </body>) section.",
      "Republish the site.",
    ],
  },
  {
    id: "carrd",
    name: "Carrd",
    category: "Landing page",
    installType: "code-injection",
    installLabel: "Embed element",
    products: ["cookie-banner", "privacy-policy"],
    instructions: [
      "Copy the generated snippet.",
      "Edit your Carrd site and add an Embed element.",
      "Paste the snippet and set it to invisible / before </body> if supported.",
      "Publish the site.",
    ],
  },
  {
    id: "strikingly",
    name: "Strikingly",
    category: "Site builder",
    installType: "manual",
    installLabel: "Manual embed",
    products: ["privacy-policy", "terms"],
    instructions: [
      "Strikingly does not allow arbitrary site-wide code injection.",
      "Add a Comply-Quick hosted policy page as an external link in your navigation.",
      "For cookie consent, link visitors to your policy until full code injection is available.",
    ],
  },
  {
    id: "zyro",
    name: "Zyro",
    category: "Site builder",
    installType: "code-injection",
    installLabel: "Integrations > Custom code",
    products: ["cookie-banner", "privacy-policy"],
    instructions: [
      "Copy the generated snippet.",
      "In Zyro, go to Integrations > Custom code.",
      "Paste the snippet and choose to place it in the footer / body end.",
      "Save and republish.",
    ],
  },
  {
    id: "jimdo",
    name: "Jimdo",
    category: "Site builder",
    installType: "manual",
    installLabel: "Manual embed",
    products: ["privacy-policy", "terms"],
    instructions: [
      "Jimdo Dolphin does not support site-wide custom code.",
      "Use Comply-Quick hosted policy pages and link them from your site menu or footer.",
    ],
  },
  {
    id: "webnode",
    name: "Webnode",
    category: "Site builder",
    installType: "code-injection",
    installLabel: "Website settings > SEO",
    products: ["cookie-banner", "privacy-policy"],
    instructions: [
      "Copy the generated snippet.",
      "Go to Website settings > SEO > Header / Footer HTML.",
      "Paste the snippet into the footer HTML field.",
      "Save and publish.",
    ],
  },
  {
    id: "tilda",
    name: "Tilda",
    category: "Site builder",
    installType: "code-injection",
    installLabel: "T123 block / head",
    products: ["cookie-banner", "privacy-policy"],
    instructions: [
      "Copy the generated snippet.",
      "Add a T123 code block to all pages (or paste into Site settings > Head).",
      "Insert the snippet and publish.",
    ],
  },
  {
    id: "bubble",
    name: "Bubble",
    category: "No-code app",
    installType: "code-injection",
    installLabel: "SEO / metatags",
    products: ["cookie-banner", "privacy-policy"],
    instructions: [
      "Copy the generated snippet.",
      "In Bubble, go to Settings > SEO / metatags > Script in the body.",
      "Paste the snippet and deploy.",
    ],
  },
  {
    id: "framer",
    name: "Framer",
    category: "Site builder",
    installType: "code-injection",
    installLabel: "Site settings > Custom code",
    products: ["cookie-banner", "privacy-policy"],
    instructions: [
      "Copy the generated snippet.",
      "Open Site settings > Custom code > End of <body>.",
      "Paste the snippet and republish.",
    ],
  },
  {
    id: "ghost",
    name: "Ghost",
    category: "CMS / blog",
    installType: "code-injection",
    installLabel: "Code injection",
    products: ["cookie-banner", "privacy-policy"],
    instructions: [
      "Copy the generated snippet.",
      "In Ghost admin, go to Settings > Code injection > Site footer.",
      "Paste the snippet and save.",
    ],
  },
  {
    id: "magento",
    name: "Magento / Adobe Commerce",
    category: "E-commerce",
    installType: "theme-edit",
    installLabel: "Theme footer",
    products: ["cookie-banner", "privacy-policy"],
    instructions: [
      "Copy the generated snippet.",
      "Edit your active theme and open app/design/frontend/<Vendor>/<theme>/Magento_Theme/templates/html/footer.phtml.",
      "Paste the snippet before the closing </body> tag.",
      "Clear cache and verify.",
    ],
  },
  {
    id: "drupal",
    name: "Drupal",
    category: "CMS",
    installType: "theme-edit",
    installLabel: "Theme footer",
    products: ["cookie-banner", "privacy-policy"],
    instructions: [
      "Copy the generated snippet.",
      "Edit your active theme's html.html.twig (or page.tpl.php) file.",
      "Paste the snippet just before the closing </body> tag.",
      "Clear caches.",
    ],
  },
  {
    id: "joomla",
    name: "Joomla",
    category: "CMS",
    installType: "plugin",
    installLabel: "Extension / template",
    products: ["cookie-banner", "privacy-policy"],
    instructions: [
      "Copy the generated snippet.",
      "Use a Custom HTML module assigned to a footer position, or paste into your template's index.php before </body>.",
      "Save and clear cache.",
    ],
  },
  {
    id: "generic",
    name: "Any other platform / custom site",
    category: "Other",
    installType: "manual",
    installLabel: "Manual install",
    products: ["cookie-banner", "privacy-policy", "terms"],
    instructions: CODE_INJECTION_INSTRUCTIONS,
  },
];

export function listPlatforms(): Platform[] {
  return PLATFORMS;
}

export function getPlatform(id: string): Platform | undefined {
  return PLATFORMS.find((p) => p.id === id);
}

export function platformsForProduct(product: PlatformProduct): Platform[] {
  return PLATFORMS.filter((p) => p.products.includes(product));
}
