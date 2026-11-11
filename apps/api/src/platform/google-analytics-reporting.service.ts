import { Injectable } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getGa4AccessToken } from './ga4-service-account';

const PROPERTY_ID = '558119248';
const DATA_ENDPOINT = `https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY_ID}`;
const REPORT_TTL_MS = 120_000;

type Ga4Row = {
  dimensionValues?: Array<{ value?: string }>;
  metricValues?: Array<{ value?: string }>;
};
type Ga4Data = { rows?: Ga4Row[] };
type Entry = { name: string; value: number };
type Daily = { date: string; users: number; views: number };
type ReadyReport = {
  status: 'ready';
  propertyId: string;
  days: number;
  updatedAt: string;
  summary: { users: number; views: number; sessions: number; engagementRate: number };
  realtimeUsers: number;
  trend: Daily[];
  countries: Entry[];
  sources: Entry[];
  pages: Entry[];
  devices: Entry[];
  conversionEvents: Entry[];
  organicCountries: Entry[];
  organicLandingPages: Entry[];
};
type Report = ReadyReport | {
  status: 'not_configured' | 'error';
  propertyId: string;
  days: number;
  message: string;
};

function rowValue(row: Ga4Row | undefined, index: number): number {
  return Number(row?.metricValues?.[index]?.value ?? 0) || 0;
}
function entries(response: Ga4Data, max = 10): Entry[] {
  return (response.rows ?? []).slice(0, max).map(row => ({
    name: row.dimensionValues?.[0]?.value || 'Unknown',
    value: rowValue(row, 0),
  }));
}

@Injectable()
export class GoogleAnalyticsReportingService {
  private token: { accessToken: string; expiresAt: number } | null = null;
  private tokenInFlight: Promise<string> | null = null;
  private reportCache = new Map<number, { expiresAt: number; report: ReadyReport }>();
  private reportInFlight = new Map<number, Promise<ReadyReport>>();

  async report(daysRaw?: string): Promise<Report> {
    const days = Number(daysRaw ?? 30);
    if (![7, 30, 90].includes(days)) {
      // Invalid filters are not sent to Google or allowed to expand reporting quotas.
      return { status: 'error', propertyId: PROPERTY_ID, days: 30, message: 'Choose 7, 30 or 90 days.' };
    }

    if (!(process.env.GA4_SERVICE_ACCOUNT_JSON || process.env.GA4_SERVICE_ACCOUNT_FILE || process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
      return {
        status: 'not_configured', propertyId: PROPERTY_ID, days,
        message: 'Google Analytics reporting needs a server-only service-account JSON secret or credential file.',
      };
    }

    const saved = this.reportCache.get(days);
    if (saved && saved.expiresAt > Date.now()) return saved.report;
    let pending = this.reportInFlight.get(days);
    if (!pending) {
      pending = this.fetchReport(days);
      this.reportInFlight.set(days, pending);
    }
    try {
      const report = await pending;
      this.reportCache.set(days, { report, expiresAt: Date.now() + REPORT_TTL_MS });
      return report;
    } catch {
      // Never expose credential contents, Google response bodies or access tokens.
      return {
        status: 'error', propertyId: PROPERTY_ID, days,
        message: 'Google Analytics could not be loaded. Check the service-account file, property Viewer access and outbound HTTPS.',
      };
    } finally {
      if (this.reportInFlight.get(days) === pending) this.reportInFlight.delete(days);
    }
  }

  private async fetchReport(days: number): Promise<ReadyReport> {
    const token = await this.getToken();
    const dateRanges = [{ startDate: `${days - 1}daysAgo`, endDate: 'today' }];
    const run = (metrics: string[], dimensions: string[] = [], limit = 15) =>
      this.googlePost<Ga4Data>(`${DATA_ENDPOINT}:runReport`, token, {
        dateRanges,
        metrics: metrics.map(name => ({ name })),
        ...(dimensions.length ? { dimensions: dimensions.map(name => ({ name })) } : {}),
        limit: String(limit),
      });

    const organicFilter = { filter: { fieldName: 'sessionDefaultChannelGroup', stringFilter: { value: 'Organic Search', matchType: 'EXACT' } } };
    const conversionNames = ['pricing_view', 'trial_cta_click', 'plan_select', 'docs_cta_click'];
    const [summary, trend, countries, sources, pages, devices, realtime, conversions, organicCountries, organicLandingPages] = await Promise.all([
      run(['activeUsers', 'screenPageViews', 'sessions', 'engagementRate']),
      run(['activeUsers', 'screenPageViews'], ['date'], days),
      run(['activeUsers'], ['country']),
      run(['sessions'], ['sessionDefaultChannelGroup']),
      run(['screenPageViews'], ['pagePath']),
      run(['activeUsers'], ['deviceCategory']),
      this.googlePost<Ga4Data>(`${DATA_ENDPOINT}:runRealtimeReport`, token, {
        metrics: [{ name: 'activeUsers' }],
      }),
      this.googlePost<Ga4Data>(`${DATA_ENDPOINT}:runReport`, token, {
        dateRanges, metrics: [{ name: 'eventCount' }],
        dimensions: [{ name: 'eventName' }],
        dimensionFilter: { filter: { fieldName: 'eventName', inListFilter: { values: conversionNames } } },
        limit: '10',
      }),
      this.googlePost<Ga4Data>(`${DATA_ENDPOINT}:runReport`, token, {
        dateRanges, metrics: [{ name: 'sessions' }], dimensions: [{ name: 'country' }],
        dimensionFilter: organicFilter, limit: '30',
      }),
      this.googlePost<Ga4Data>(`${DATA_ENDPOINT}:runReport`, token, {
        dateRanges, metrics: [{ name: 'sessions' }], dimensions: [{ name: 'landingPage' }],
        dimensionFilter: organicFilter, limit: '30',
      }),
    ]);
    const total = summary.rows?.[0];
    return {
      status: 'ready',
      propertyId: PROPERTY_ID,
      days,
      updatedAt: new Date().toISOString(),
      summary: {
        users: rowValue(total, 0),
        views: rowValue(total, 1),
        sessions: rowValue(total, 2),
        engagementRate: Math.round(rowValue(total, 3) * 1000) / 10,
      },
      realtimeUsers: rowValue(realtime.rows?.[0], 0),
      trend: (trend.rows ?? []).map(row => {
        const value = row.dimensionValues?.[0]?.value ?? '';
        return {
          date: /^\d{8}$/.test(value) ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6)}` : value,
          users: rowValue(row, 0),
          views: rowValue(row, 1),
        };
      }).sort((a, b) => a.date.localeCompare(b.date)),
      countries: entries(countries),
      sources: entries(sources),
      pages: entries(pages),
      devices: entries(devices),
      conversionEvents: entries(conversions, 10),
      organicCountries: entries(organicCountries, 30),
      organicLandingPages: entries(organicLandingPages, 30),
    };
  }

  private async getToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.accessToken;
    if (this.tokenInFlight) return this.tokenInFlight;
    this.tokenInFlight = this.createToken().finally(() => { this.tokenInFlight = null; });
    return this.tokenInFlight;
  }

  private async createToken(): Promise<string> {
    // Prefer an injected server-only JSON secret, including when provisioned through
    // Cloudflare Worker env bindings. Keep the legacy restricted-file fallback for VPS.
    const json = process.env.GA4_SERVICE_ACCOUNT_JSON;
    const file = process.env.GA4_SERVICE_ACCOUNT_FILE || process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const credentials = json || (file ? await readFile(resolve(file), 'utf8') : null);
    if (!credentials) throw new Error('GA4 service-account credential missing');
    const { accessToken, expiresIn } = await getGa4AccessToken(credentials);
    this.token = {
      accessToken,
      expiresAt: Date.now() + expiresIn * 1000,
    };
    return accessToken;
  }

  private async googlePost<T>(url: string, token: string, body: Record<string, unknown>): Promise<T> {
    const response = await fetch(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`Google Analytics reporting HTTP ${response.status}`);
    return response.json() as Promise<T>;
  }
}
