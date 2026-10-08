'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';

type Entry = { name: string; value: number };
type ReadyReport = {
  status: 'ready';
  propertyId: string;
  days: number;
  updatedAt: string;
  realtimeUsers: number;
  summary: { users: number; views: number; sessions: number; engagementRate: number };
  trend: Array<{ date: string; users: number; views: number }>;
  countries: Entry[];
  sources: Entry[];
  pages: Entry[];
  devices: Entry[];
};
type Report = ReadyReport | {
  status: 'not_configured' | 'error';
  propertyId: string;
  days: number;
  message: string;
};
const count = (value: number) => Number(value).toLocaleString();

function Ranking({ title, items, empty }: { title: string; items: Entry[]; empty: string }) {
  return (
    <div className="panel website-traffic-panel">
      <h3>{title}</h3>
      {items.length ? items.map((item, i) => (
        <div key={item.name + i} className="website-traffic-list-row">
          <span><strong style={{overflowWrap:'anywhere'}}>{item.name}</strong></span>
          <b>{count(item.value)}</b>
        </div>
      )) : <p className="muted">{empty}</p>}
    </div>
  );
}

export function PlatformGoogleAnalytics({ token }: { token: string }) {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const result = await api<Report>(`/platform/google-analytics?days=${days}`, token);
      setReport(result);
      setError('');
    } catch {
      setError('Unable to retrieve Google Analytics reporting status.');
    } finally {
      setLoading(false);
    }
  }, [token, days]);
  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 120_000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const ready = report?.status === 'ready' ? report : null;
  const maxTrend = useMemo(() => Math.max(1, ...(ready?.trend ?? []).map(row => row.views)), [ready]);

  return (
    <section className="platform-website-traffic" aria-label="Google Analytics reports">
      <div className="panel website-traffic-intro">
        <div>
          <p className="eyebrow">RelayWA · Google Analytics 4</p>
          <h2>Website audience and acquisition</h2>
          <p className="muted">Official Google Analytics Data API reports. Separate from RelayWA's own first-party bot analytics.</p>
          <small>GA4 property {report?.propertyId ?? '558119248'} · Statistics may differ from first-party requests due to consent, filtering and tracking blockers.</small>
        </div>
        <div className="website-traffic-controls" aria-label="GA4 reporting period">
          {([7,30,90] as const).map(value => <button
            key={value} type="button" aria-pressed={days === value}
            className={days === value ? 'is-selected' : ''}
            onClick={() => setDays(value)}>{value} days</button>)}
          <button type="button" disabled={loading} onClick={() => void refresh()}>
            {loading ? 'Loading…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {error && <div className="alert" role="alert">{error}</div>}
      {report && report.status !== 'ready' && (
        <div className="panel website-traffic-panel" role="status">
          <h3>{report.status === 'not_configured' ? 'Connection setup required' : 'GA4 reports unavailable'}</h3>
          <p className="muted">{report.message}</p>
          <p className="muted">The service account needs Viewer access to GA4 property 558119248. Its credential file must be mounted into the API container; never upload it to GitHub.</p>
        </div>
      )}

      {ready && <>
        <div className="website-traffic-stats">
          <div className="panel"><span>Active users</span><strong>{count(ready.summary.users)}</strong><small>Selected period</small></div>
          <div className="panel"><span>Page views</span><strong>{count(ready.summary.views)}</strong><small>Tracked site pages</small></div>
          <div className="panel"><span>Sessions</span><strong>{count(ready.summary.sessions)}</strong><small>Selected period</small></div>
          <div className="panel"><span>Engagement rate</span><strong>{ready.summary.engagementRate.toFixed(1)}%</strong><small>GA4 engaged sessions</small></div>
        </div>
        <div className="panel website-traffic-panel">
          <h3>Realtime active users: {count(ready.realtimeUsers)}</h3>
          <p className="muted">Active users in the last 30 minutes. Results are cached on the server for up to two minutes.</p>
        </div>
        <div className="panel website-traffic-panel">
          <h3>Visitor trend</h3>
          <p className="muted">Daily Google Analytics page views over the selected period.</p>
          <div className="website-traffic-trend" role="img" aria-label="Daily GA4 page views">
            {ready.trend.map(item => <div className="website-traffic-day" key={item.date} title={`${item.date}: ${count(item.users)} users, ${count(item.views)} page views`}>
              <div className="website-traffic-column">
                <span className="visitors" style={{height: (item.views / maxTrend * 100) + '%'}}/>
              </div>
              <small>{days === 7 ? item.date.slice(5) : item.date.slice(8)}</small>
            </div>)}
          </div>
          {!ready.trend.length && <p className="muted">No tracked page views yet.</p>}
        </div>
        <div className="website-traffic-grid">
          <Ranking title="Countries by active users" items={ready.countries} empty="No country data yet." />
          <Ranking title="Acquisition channels by sessions" items={ready.sources} empty="No acquisition data yet." />
          <Ranking title="Most viewed pages" items={ready.pages} empty="No page data yet." />
          <Ranking title="Devices by active users" items={ready.devices} empty="No device data yet." />
        </div>
        <p className="website-traffic-disclaimer">Updated {new Date(ready.updatedAt).toLocaleString()}. Realtime and historical metrics come from Google's API, not synthetic data. Conversion metrics can be added once signup and purchase events are configured.</p>
      </>}
      {!report && loading && <p className="muted">Loading Google Analytics reports…</p>}
    </section>
  );
}
