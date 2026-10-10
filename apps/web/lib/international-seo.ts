/**
 * English-only international SEO scope.
 *
 * Countries are research opportunities, NOT necessarily published routes or
 * guaranteed markets for RelayWA subscriptions. Locale switchers, machine
 * translations, geo-IP redirects and unverified region claims are out of scope.
 */
export const publicLanguage = 'en' as const;

export const researchMarkets = [
  { iso: 'IN', slug: 'india', name: 'India', wave: 'initial' },
  { iso: 'BR', slug: 'brazil', name: 'Brazil', wave: 'initial' },
  { iso: 'ID', slug: 'indonesia', name: 'Indonesia', wave: 'initial' },
  { iso: 'MX', slug: 'mexico', name: 'Mexico', wave: 'initial' },
  { iso: 'CO', slug: 'colombia', name: 'Colombia', wave: 'initial' },
  { iso: 'NG', slug: 'nigeria', name: 'Nigeria', wave: 'initial' },
  { iso: 'AE', slug: 'united-arab-emirates', name: 'United Arab Emirates', wave: 'initial' },
  { iso: 'PK', slug: 'pakistan', name: 'Pakistan', wave: 'initial' },
  { iso: 'SA', slug: 'saudi-arabia', name: 'Saudi Arabia', wave: 'research' },
  { iso: 'ZA', slug: 'south-africa', name: 'South Africa', wave: 'research' },
  { iso: 'ES', slug: 'spain', name: 'Spain', wave: 'research' },
  { iso: 'DE', slug: 'germany', name: 'Germany', wave: 'research' },
  { iso: 'GB', slug: 'united-kingdom', name: 'United Kingdom', wave: 'research' },
] as const;

export type ResearchMarket = (typeof researchMarkets)[number];
export type ResearchMarketSlug = ResearchMarket['slug'];
export type ResearchMarketIso = ResearchMarket['iso'];

export function findResearchMarket(slug: string): ResearchMarket | undefined {
  return researchMarkets.find((market) => market.slug === slug);
}

/**
 * Proposed English page convention; DOES NOT add a page to Next routing,
 * public indexability, GA4 or the sitemap.
 */
export function proposedEnglishCountryPath(slug: ResearchMarketSlug): string {
  const market = findResearchMarket(slug);
  if (!market) throw new Error('Unknown country market');
  return `/countries/${market.slug}`;
}

export type EnglishCountryEditorial = {
  market: ResearchMarketSlug;
  language: typeof publicLanguage;
  title: string;
  description: string;
  primaryKeyword: string;
  originalContent: string;
  evidenceUrls: string[];
  uniqueReason: string;
  reviewedBy: string;
  reviewedAt: string;
  productClaimsVerified: boolean;
  livePageVerified: boolean;
};

/**
 * Explicit editorial gate for a FUTURE English country landing page.
 * Evidence and review alone are not approval to add a sitemap entry:
 * the Next.js page, links and 200 response must ALSO exist and be tested.
 */
export function validateEnglishCountryPublication(page: EnglishCountryEditorial): string[] {
  const errors: string[] = [];
  if (!findResearchMarket(page.market)) errors.push('unknown research market');
  if (page.language !== 'en') errors.push('site language must be English');
  if (page.title.trim().length < 30 || page.title.trim().length > 90) {
    errors.push('English title must be 30–90 characters');
  }
  if (page.description.trim().length < 75 || page.description.trim().length > 190) {
    errors.push('English description must be 75–190 characters');
  }
  if (!page.primaryKeyword.trim()) errors.push('target an English search phrase');
  // A rough anti-doorway guard; human editorial approval is still required.
  const words = page.originalContent.trim().split(/\s+/).filter(Boolean);
  if (words.length < 180) errors.push('insufficient unique substantive content');
  if (page.uniqueReason.trim().length < 50) errors.push('insufficient market-specific rationale');
  if (page.evidenceUrls.length < 2 || page.evidenceUrls.some((value) => {
    try { return new URL(value).protocol !== 'https:'; } catch { return true; }
  })) {
    errors.push('at least two HTTPS evidence links required');
  }
  if (!page.reviewedBy.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(page.reviewedAt)) {
    errors.push('editorial reviewer and review date required');
  }
  if (!page.productClaimsVerified) errors.push('product availability/claims not verified');
  if (!page.livePageVerified) errors.push('published route not yet verified');
  return errors;
}
