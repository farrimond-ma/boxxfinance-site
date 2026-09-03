import React, { useEffect, useState } from 'react';
import SEO from '../components/SEO';
import blogPostsData from '../data/blogIndex.json';
import locationPagesData from '../data/locationIndex.json';
import partnersData from '../data/partners.json';

const REPO = 'farrimond-ma/boxxfinance-site';
const GH   = `https://api.github.com/repos/${REPO}/actions/workflows`;

// ─── Workflow definitions ─────────────────────────────────────────────────────
// 2026-09-03: rewritten against the actual .github/workflows/*.yml files —
// this had drifted to list three retired blog workflows (publish-blog.yml
// consolidated them on 2026-08-17) while omitting several real ones,
// including the personal-finance news publisher and the index coverage
// watchdog. If a workflow is renamed or retired, this list goes stale again;
// check .github/workflows/ against this array occasionally.
const WORKFLOWS = [
  // Daily publishing
  { id: 'publish-blog.yml',                 label: 'Blog Publisher',              group: 'daily', schedule: '07:37, 14:37, 19:37 UK — bridging ×2, focus-service ×1' },
  { id: 'publish-personal-finance-news.yml',label: 'Personal Finance News',        group: 'daily', schedule: 'Several times daily, weekdays' },
  { id: 'publish-location.yml',             label: 'Location Pages',              group: 'daily', schedule: 'Daily ~9:09am UK, 2/day' },
  { id: 'update-internal-links.yml',        label: 'Internal Links Updater',       group: 'daily', schedule: 'Weekdays ~12:30pm UK' },
  // Social media
  { id: 'publish-linkedin.yml',      label: 'LinkedIn',                  group: 'social',  schedule: 'Weekdays after blog' },
  { id: 'publish-linkedin-news.yml', label: 'LinkedIn (news)',           group: 'social',  schedule: 'After news publisher' },
  { id: 'publish-facebook.yml',      label: 'Facebook',                  group: 'social',  schedule: 'Weekdays 9:30am + 3:30pm UK' },
  { id: 'publish-instagram.yml',     label: 'Instagram',                 group: 'social',  schedule: 'Weekdays 10am + 4pm UK' },
  { id: 'publish-pinterest.yml',     label: 'Pinterest',                 group: 'social',  schedule: 'Weekdays 11am + 3:30pm UK' },
  { id: 'publish-facebook-reels.yml',label: 'Facebook Reels & TikTok (paused)', group: 'social', schedule: 'Paused' },
  { id: 'publish-reddit.yml',        label: 'Reddit',                    group: 'social',  schedule: 'Mon & Thu after monitor' },
  // SEO & visibility
  { id: 'seo-audit.yml',             label: 'SEO Audit',                 group: 'seo',     schedule: 'After each blog + Mondays' },
  { id: 'visibility-check.yml',      label: 'AI Visibility Checker',     group: 'seo',     schedule: 'Mondays 7am UTC' },
  { id: 'sync-content-engine.yml',   label: 'Visibility Gap Scheduler',  group: 'seo',     schedule: 'After AI visibility check' },
  { id: 'index-coverage.yml',        label: 'Index Coverage Watchdog',   group: 'seo',     schedule: 'Weekly' },
  { id: 'regenerate-sitemap.yml',    label: 'Sitemap Regeneration',      group: 'seo',     schedule: 'On content changes' },
  // Infrastructure
  { id: 'deploy.yml',                label: 'Site Deploy',               group: 'infra',   schedule: 'On every push' },
  { id: 'system-status.yml',         label: 'System Status Generator',   group: 'infra',   schedule: 'After each publisher' },
  { id: 'failure-watchdog.yml',      label: 'Failure Watchdog',          group: 'infra',   schedule: 'On workflow failure' },
  { id: 'seed-content-engine.yml',   label: 'Seed Content Engine',       group: 'infra',   schedule: 'Monthly, 1st' },
  { id: 'populate-content-engine.yml',label:'Content Schedule (Quarterly)',group:'infra',  schedule: '1 Jan / Apr / Jul / Oct' },
  { id: 'add-service-topics.yml',    label: 'Add Focus-Service Topics',  group: 'infra',   schedule: 'Manual' },
];

const GROUPS = [
  { id: 'daily',  label: '📅 Daily Publishing',    color: '#031b49' },
  { id: 'social', label: '📣 Social Media',         color: '#b8922a' },
  { id: 'seo',    label: '🔍 SEO & AI Visibility',  color: '#2d6a4f' },
  { id: 'infra',  label: '⚙️ Infrastructure',        color: '#6b4226' },
];

// ─── Daily activity log (from system-status.json, generated server-side) ──────
function ActivityBadge({ status }) {
  const map = {
    'success':       { bg: '#d1fae5', color: '#065f46', label: '✅ Done' },
    'failed':        { bg: '#fee2e2', color: '#991b1b', label: '❌ Failed' },
    'running':       { bg: '#fef3c7', color: '#92400e', label: '🔄 Running' },
    'pending':       { bg: '#e0f2fe', color: '#0369a1', label: '⏳ Due later' },
    'not-due':       { bg: '#f3f4f6', color: '#6b7280', label: '— Not today' },
    'ran-no-output': { bg: '#fef9c3', color: '#854d0e', label: '⚪ Ran, nothing to post' },
  };
  const s = map[status] || map.pending;
  return (
    <span style={{
      background: s.bg, color: s.color,
      padding: '2px 10px', borderRadius: '999px',
      fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  );
}

function londonTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-GB', {
    timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit',
  });
}

function londonDateTime(iso) {
  if (!iso) return 'never';
  return new Date(iso).toLocaleString('en-GB', {
    timeZone: 'Europe/London', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Status helpers ───────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    success:     { bg: '#d1fae5', color: '#065f46', label: '✅ Completed' },
    failure:     { bg: '#fee2e2', color: '#991b1b', label: '❌ Failed'    },
    in_progress: { bg: '#fef3c7', color: '#92400e', label: '🔄 Running'  },
    pending:     { bg: '#fef3c7', color: '#92400e', label: '⏳ Queued'   },
    none:        { bg: '#e0f2fe', color: '#0369a1', label: '🗓 Scheduled' },
    cancelled:   { bg: '#f3f4f6', color: '#6b7280', label: '⊘ Cancelled' },
  };
  const s = map[status] || map.none;
  return (
    <span style={{
      background: s.bg, color: s.color,
      padding: '2px 10px', borderRadius: '999px',
      fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  );
}

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (mins < 2)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ContentDashboard() {
  const [runs, setRuns]       = useState({});
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState(null);
  const [activity, setActivity] = useState(null);
  const [activityError, setActivityError] = useState(false);
  const [pipeline, setPipeline] = useState(null);
  const [pipelineError, setPipelineError] = useState(false);

  async function fetchActivity() {
    try {
      const res = await fetch(`/system-status.json?t=${Date.now()}`);
      if (!res.ok) throw new Error(String(res.status));
      setActivity(await res.json());
      setActivityError(false);
    } catch {
      setActivityError(true);
    }
  }

  // The ContentEngine sheet queue itself — separate file from system-status.json
  // (which answers "did today's jobs run"), generated by
  // generate-content-engine-status.js server-side so the sheet is never read
  // from the browser.
  async function fetchPipeline() {
    try {
      const res = await fetch(`/content-engine-status.json?t=${Date.now()}`);
      if (!res.ok) throw new Error(String(res.status));
      setPipeline(await res.json());
      setPipelineError(false);
    } catch {
      setPipelineError(true);
    }
  }

  const publishedBlogs    = blogPostsData.filter(p => p.status === 'published').length;
  const publishedLocations = locationPagesData.filter(p => p.status === 'published').length;

  async function fetchRuns() {
    setLoading(true);
    const results = {};
    await Promise.all(
      WORKFLOWS.map(async (wf) => {
        try {
          const res  = await fetch(`${GH}/${wf.id}/runs?per_page=1`, {
            headers: { 'User-Agent': 'boxx-dashboard' },
          });
          if (!res.ok) { results[wf.id] = null; return; }
          const data = await res.json();
          results[wf.id] = data.workflow_runs?.[0] || null;
        } catch {
          results[wf.id] = null;
        }
      })
    );
    setRuns(results);
    setLastFetch(new Date());
    setLoading(false);
  }

  useEffect(() => { fetchRuns(); fetchActivity(); fetchPipeline(); }, []);

  const failedCount  = WORKFLOWS.filter(w => runs[w.id]?.conclusion === 'failure').length;
  const successCount = WORKFLOWS.filter(w => runs[w.id]?.conclusion === 'success').length;
  const neverRun     = WORKFLOWS.filter(w => !runs[w.id]).length;

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <SEO
        title="Content Engine Dashboard | Boxx Finance"
        description="Live status dashboard for the Boxx content publishing system."
        noIndex={true}
      />

      {/* Header */}
      <div style={{ background: '#031b49', padding: '2rem 0', marginBottom: '2rem' }}>
        <div className="container" style={{ maxWidth: 1100, margin: '0 auto', padding: '0 1.5rem' }}>
          <h1 style={{ color: '#fff', margin: 0, fontSize: '1.6rem', fontWeight: 700 }}>
            Content Engine Dashboard
          </h1>
          <p style={{ color: '#b8922a', margin: '0.4rem 0 0', fontSize: '0.9rem' }}>
            Live status of all automated publishing workflows
            {lastFetch && ` · Last updated ${timeAgo(lastFetch.toISOString())}`}
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 1.5rem 4rem' }}>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          {[
            { label: 'Blog Posts Published', value: publishedBlogs,    color: '#031b49' },
            { label: 'Location Pages Live',  value: publishedLocations, color: '#b8922a' },
            { label: 'Workflows Healthy',    value: successCount,       color: '#065f46' },
            { label: 'Workflows Failed',     value: failedCount,        color: failedCount > 0 ? '#991b1b' : '#065f46' },
            { label: 'Never Run Yet',        value: neverRun,           color: '#6b7280' },
          ].map(s => (
            <div key={s.label} style={{
              background: '#fff', borderRadius: 8, padding: '1.25rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)', textAlign: 'center',
            }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Content pipeline — the ContentEngine sheet itself ── */}
        <div style={{ marginBottom: '2.5rem' }}>
          <h2 style={{
            fontSize: '1.1rem', fontWeight: 700, color: '#031b49',
            borderBottom: '2px solid #031b49', paddingBottom: '0.5rem', marginBottom: '0.25rem',
          }}>
            🗂️ Content Pipeline
          </h2>
          <p style={{ fontSize: '0.78rem', color: '#9ca3af', margin: '0 0 0.75rem' }}>
            A read-only snapshot of the ContentEngine spreadsheet queue — what's scheduled, what's
            published, and what the duplicate-coverage guard has skipped. Refreshes after each
            publisher run.
            {pipeline && ` Snapshot taken ${londonDateTime(pipeline.generatedAt)}.`}
          </p>

          {pipelineError && (
            <div style={{ background: '#fffbeb', border: '1px solid #fbbf24', borderRadius: 8, padding: '1rem 1.25rem' }}>
              <strong style={{ color: '#92400e' }}>Pipeline snapshot not available yet.</strong>
              <p style={{ margin: '0.4rem 0 0', fontSize: '0.85rem', color: '#78350f' }}>
                Run the <a href={`https://github.com/${REPO}/actions/workflows/system-status.yml`} target="_blank" rel="noopener noreferrer">System Status Generator</a> workflow
                once to create it — it then refreshes automatically after every publisher run.
              </p>
            </div>
          )}

          {pipeline && (
            <>
              {/* Overview counts */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
                {[
                  { label: 'Scheduled', value: pipeline.byStatus.scheduled || 0, color: '#0369a1' },
                  { label: 'Published', value: pipeline.byStatus.published || 0, color: '#065f46' },
                  { label: 'Skipped (duplicate)', value: pipeline.byStatus.duplicate || 0, color: '#92400e' },
                  { label: 'Total rows', value: pipeline.totalRows, color: '#6b7280' },
                ].map(s => (
                  <div key={s.label} style={{
                    background: '#fff', borderRadius: 8, padding: '1rem',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)', textAlign: 'center',
                  }}>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 4 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Per-service breakdown (blog rows) */}
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#2d6a4f', margin: '0 0 0.5rem' }}>
                Blog articles by service
              </h3>
              <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden', marginBottom: '1.5rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      {['Service', 'Scheduled', 'Published', 'Duplicate (skipped)'].map(h => (
                        <th key={h} style={{
                          padding: '0.6rem 1rem', textAlign: h === 'Service' ? 'left' : 'center',
                          fontSize: '0.75rem', fontWeight: 600, color: '#6b7280',
                          borderBottom: '1px solid #e5e7eb', textTransform: 'uppercase', letterSpacing: '0.05em',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(pipeline.serviceBreakdown)
                      .sort((a, b) => (b[1].published + b[1].scheduled) - (a[1].published + a[1].scheduled))
                      .map(([service, counts], idx, arr) => (
                        <tr key={service} style={{ borderBottom: idx === arr.length - 1 ? 'none' : '1px solid #f3f4f6' }}>
                          <td style={{ padding: '0.6rem 1rem', fontWeight: 500, fontSize: '0.85rem', color: '#1f2937' }}>{service}</td>
                          <td style={{ padding: '0.6rem 1rem', textAlign: 'center', fontSize: '0.85rem', color: '#0369a1', fontWeight: 600 }}>{counts.scheduled}</td>
                          <td style={{ padding: '0.6rem 1rem', textAlign: 'center', fontSize: '0.85rem', color: '#065f46', fontWeight: 600 }}>{counts.published}</td>
                          <td style={{ padding: '0.6rem 1rem', textAlign: 'center', fontSize: '0.85rem', color: counts.duplicate > 0 ? '#92400e' : '#d1d5db' }}>{counts.duplicate}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* Location queue health */}
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#2d6a4f', margin: '0 0 0.5rem' }}>
                Location page queue
              </h3>
              <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '1rem 1.25rem', marginBottom: '1.5rem', fontSize: '0.85rem', color: '#1f2937' }}>
                {pipeline.locationQueue.remaining === 0 ? (
                  <span style={{ color: '#991b1b', fontWeight: 600 }}>⚠ Queue is empty — refill with Seed Content Engine before the next run.</span>
                ) : (
                  <>
                    <strong>{pipeline.locationQueue.remaining}</strong> location page(s) queued
                    (~<strong>{pipeline.locationQueue.estimatedDaysRemaining}</strong> day{pipeline.locationQueue.estimatedDaysRemaining === 1 ? '' : 's'} at 2/day)
                    {' · '}
                    {Object.entries(pipeline.locationQueue.byService).map(([s, n]) => `${s}: ${n}`).join(', ')}
                  </>
                )}
              </div>

              {/* Two-column: upcoming + recently published */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#2d6a4f', margin: '0 0 0.5rem' }}>
                    Coming up next
                  </h3>
                  <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                    {pipeline.upcoming.length === 0 ? (
                      <div style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', color: '#6b7280' }}>Nothing scheduled.</div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tbody>
                          {pipeline.upcoming.map((r, idx) => (
                            <tr key={idx} style={{ borderBottom: idx === pipeline.upcoming.length - 1 ? 'none' : '1px solid #f3f4f6' }}>
                              <td style={{ padding: '0.55rem 0.9rem', fontSize: '0.78rem', color: r.overdue ? '#991b1b' : '#9ca3af', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                {r.date}{r.overdue ? ' ⚠' : ''}
                              </td>
                              <td style={{ padding: '0.55rem 0.9rem', fontSize: '0.82rem', color: '#1f2937' }}>
                                {r.title || `${r.type} — ${r.city || r.service}`}
                                <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{r.service}{r.city ? ` · ${r.city}` : ''}</div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#2d6a4f', margin: '0 0 0.5rem' }}>
                    Recently published
                  </h3>
                  <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                    {pipeline.recentlyPublished.length === 0 ? (
                      <div style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', color: '#6b7280' }}>Nothing published yet.</div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tbody>
                          {pipeline.recentlyPublished.map((r, idx) => (
                            <tr key={idx} style={{ borderBottom: idx === pipeline.recentlyPublished.length - 1 ? 'none' : '1px solid #f3f4f6' }}>
                              <td style={{ padding: '0.55rem 0.9rem', fontSize: '0.78rem', color: '#9ca3af', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                {londonDateTime(r.publishedAt)}
                              </td>
                              <td style={{ padding: '0.55rem 0.9rem', fontSize: '0.82rem' }}>
                                {r.url ? (
                                  <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ color: '#031b49' }}>{r.title}</a>
                                ) : r.title}
                                <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{r.service}</div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>

              {/* Skipped duplicates — only shown when there are any */}
              {pipeline.skippedDuplicates.length > 0 && (
                <>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#92400e', margin: '1.5rem 0 0.5rem' }}>
                    Skipped as duplicate coverage
                  </h3>
                  <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <tbody>
                        {pipeline.skippedDuplicates.map((r, idx) => (
                          <tr key={idx} style={{ borderBottom: idx === pipeline.skippedDuplicates.length - 1 ? 'none' : '1px solid #f3f4f6' }}>
                            <td style={{ padding: '0.55rem 0.9rem', fontSize: '0.82rem', color: '#1f2937', width: '40%' }}>{r.title}</td>
                            <td style={{ padding: '0.55rem 0.9rem', fontSize: '0.78rem', color: '#6b7280' }}>{r.notes || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* ── Today's Activity Log ── */}
        <div style={{ marginBottom: '2.5rem' }}>
          <h2 style={{
            fontSize: '1.1rem', fontWeight: 700, color: '#031b49',
            borderBottom: '2px solid #031b49', paddingBottom: '0.5rem', marginBottom: '0.25rem',
          }}>
            📋 Today's Activity{activity ? ` — ${new Date(activity.date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}` : ''}
          </h2>
          {activity && (
            <p style={{ fontSize: '0.78rem', color: '#9ca3af', margin: '0 0 0.75rem' }}>
              Every action the system takes daily, with verified completion times.
              Status checked {londonDateTime(activity.generatedAt)} (auto-refreshes after each publisher runs).
            </p>
          )}

          {activityError && (
            <div style={{ background: '#fffbeb', border: '1px solid #fbbf24', borderRadius: 8, padding: '1rem 1.25rem' }}>
              <strong style={{ color: '#92400e' }}>Status file not available yet.</strong>
              <p style={{ margin: '0.4rem 0 0', fontSize: '0.85rem', color: '#78350f' }}>
                Run the <a href={`https://github.com/${REPO}/actions/workflows/system-status.yml`} target="_blank" rel="noopener noreferrer">System Status Generator</a> workflow
                once to create it — it then refreshes automatically after every publisher run.
              </p>
            </div>
          )}

          {activity && (
            <>
              <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      {['Action', 'Status', 'Completed', 'Verification'].map(h => (
                        <th key={h} style={{
                          padding: '0.65rem 1rem', textAlign: 'left',
                          fontSize: '0.75rem', fontWeight: 600, color: '#6b7280',
                          borderBottom: '1px solid #e5e7eb', textTransform: 'uppercase', letterSpacing: '0.05em',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activity.daily.map((a, idx) => (
                      <tr key={a.id} style={{ borderBottom: idx === activity.daily.length - 1 ? 'none' : '1px solid #f3f4f6' }}>
                        <td style={{ padding: '0.7rem 1rem', fontWeight: 500, fontSize: '0.88rem', color: '#1f2937', whiteSpace: 'nowrap' }}>
                          {a.label}
                        </td>
                        <td style={{ padding: '0.7rem 1rem' }}>
                          <ActivityBadge status={a.status} />
                        </td>
                        <td style={{ padding: '0.7rem 1rem', fontSize: '0.85rem', fontWeight: 600, color: a.status === 'success' ? '#065f46' : '#9ca3af', whiteSpace: 'nowrap' }}>
                          {a.status === 'success' ? londonTime(a.completedAt) : '—'}
                        </td>
                        <td style={{ padding: '0.7rem 1rem', fontSize: '0.8rem', color: '#6b7280' }}>
                          {a.evidence}
                          {a.items && a.items.length > 0 && (
                            <ul style={{ margin: '0.35rem 0 0', paddingLeft: '1.1rem' }}>
                              {a.items.map((item, i) => (
                                <li key={i} style={{ marginBottom: 2 }}>
                                  <span style={{ color: '#031b49', fontWeight: 600 }}>{londonTime(item.time)}</span>
                                  {' — '}
                                  {item.url
                                    ? <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: '#b8922a' }}>{item.detail}</a>
                                    : item.detail}
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Weekly actions */}
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#2d6a4f', margin: '1.5rem 0 0.5rem' }}>
                Weekly actions — last completed
              </h3>
              <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {activity.weekly.map((w, idx) => (
                      <tr key={w.id} style={{ borderBottom: idx === activity.weekly.length - 1 ? 'none' : '1px solid #f3f4f6' }}>
                        <td style={{ padding: '0.6rem 1rem', fontWeight: 500, fontSize: '0.85rem', color: '#1f2937' }}>{w.label}</td>
                        <td style={{ padding: '0.6rem 1rem', fontSize: '0.8rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>{w.cadence}</td>
                        <td style={{ padding: '0.6rem 1rem', fontSize: '0.82rem', fontWeight: 600, color: w.lastSuccess ? '#065f46' : '#991b1b', whiteSpace: 'nowrap' }}>
                          {w.link
                            ? <a href={w.link} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>{londonDateTime(w.lastSuccess)}</a>
                            : londonDateTime(w.lastSuccess)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* ── Partner / introducer registry ── */}
        <div style={{ marginBottom: '2.5rem' }}>
          <h2 style={{
            fontSize: '1.1rem', fontWeight: 700, color: '#031b49',
            borderBottom: '2px solid #031b49', paddingBottom: '0.5rem', marginBottom: '0.25rem',
          }}>
            🤝 Partners ({partnersData.filter(p => p.status === 'active').length} active)
          </h2>
          <p style={{ fontSize: '0.78rem', color: '#9ca3af', margin: '0 0 0.75rem' }}>
            Issued from <code>scripts/content-engine/partners-manager.js</code> — codes are only
            created once an introducer agreement has actually been sent. Sign-up form submissions
            land in the <a href="https://docs.google.com/spreadsheets/d/1244VCHh0asyN9Uav9_7UHcoa8LyuLvHK0uprnHNAVrg" target="_blank" rel="noopener noreferrer" style={{ color: '#031b49' }}>Google Sheet</a> tagged
            "Partner sign-up (introducer)" for review before a code is issued.
          </p>
          {partnersData.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '1.25rem', fontSize: '0.85rem', color: '#6b7280' }}>
              No partners yet. Add one with <code>node scripts/content-engine/partners-manager.js add --firm "..." --contact "..." --email "..."</code>
            </div>
          ) : (
            <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Code', 'Firm', 'Contact', 'Status', 'Joined'].map(h => (
                      <th key={h} style={{
                        padding: '0.65rem 1rem', textAlign: 'left',
                        fontSize: '0.75rem', fontWeight: 600, color: '#6b7280',
                        borderBottom: '1px solid #e5e7eb', textTransform: 'uppercase', letterSpacing: '0.05em',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {partnersData.map((p, idx) => (
                    <tr key={p.code} style={{ borderBottom: idx === partnersData.length - 1 ? 'none' : '1px solid #f3f4f6' }}>
                      <td style={{ padding: '0.7rem 1rem', fontWeight: 600, fontFamily: 'monospace', fontSize: '0.85rem', color: '#031b49' }}>{p.code}</td>
                      <td style={{ padding: '0.7rem 1rem', fontSize: '0.85rem', color: '#1f2937' }}>{p.firm}</td>
                      <td style={{ padding: '0.7rem 1rem', fontSize: '0.85rem', color: '#6b7280' }}>{p.contact} · {p.email}</td>
                      <td style={{ padding: '0.7rem 1rem' }}>
                        <span style={{
                          background: p.status === 'active' ? '#d1fae5' : '#f3f4f6',
                          color: p.status === 'active' ? '#065f46' : '#6b7280',
                          padding: '2px 10px', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 600,
                        }}>{p.status}</span>
                      </td>
                      <td style={{ padding: '0.7rem 1rem', fontSize: '0.82rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>{p.dateJoined}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Refresh button */}
        <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => { fetchRuns(); fetchActivity(); fetchPipeline(); }}
            disabled={loading}
            style={{
              background: '#031b49', color: '#fff', border: 'none',
              padding: '0.6rem 1.4rem', borderRadius: 6, cursor: 'pointer',
              fontWeight: 600, fontSize: '0.85rem', opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? '⏳ Refreshing...' : '🔄 Refresh Status'}
          </button>
        </div>

        {/* Workflow groups */}
        {GROUPS.map(group => {
          const groupWorkflows = WORKFLOWS.filter(w => w.group === group.id);
          return (
            <div key={group.id} style={{ marginBottom: '2rem' }}>
              <h2 style={{
                fontSize: '1rem', fontWeight: 700, color: group.color,
                borderBottom: `2px solid ${group.color}`, paddingBottom: '0.5rem',
                marginBottom: '0.75rem',
              }}>
                {group.label}
              </h2>
              <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      {['Workflow', 'Status', 'Last Run', 'Schedule'].map(h => (
                        <th key={h} style={{
                          padding: '0.65rem 1rem', textAlign: 'left',
                          fontSize: '0.75rem', fontWeight: 600, color: '#6b7280',
                          borderBottom: '1px solid #e5e7eb', textTransform: 'uppercase', letterSpacing: '0.05em',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {groupWorkflows.map((wf, idx) => {
                      const run     = runs[wf.id];
                      const status  = loading ? 'pending' : run ? (run.status === 'in_progress' ? 'in_progress' : run.conclusion) : 'none';
                      const isLast  = idx === groupWorkflows.length - 1;
                      return (
                        <tr key={wf.id} style={{ borderBottom: isLast ? 'none' : '1px solid #f3f4f6' }}>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 500, fontSize: '0.88rem', color: '#1f2937' }}>
                            <a
                              href={`https://github.com/${REPO}/actions/workflows/${wf.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: '#031b49', textDecoration: 'none' }}
                            >
                              {wf.label}
                            </a>
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <StatusBadge status={status} />
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', color: '#6b7280' }}>
                            {run ? (
                              <a
                                href={run.html_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: '#6b7280', textDecoration: 'none' }}
                                title={new Date(run.created_at).toLocaleString('en-GB')}
                              >
                                {timeAgo(run.created_at)}
                              </a>
                            ) : '—'}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', color: '#9ca3af' }}>
                            {wf.schedule}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}

        {/* LinkedIn reshare note */}
        <div style={{
          background: '#fffbeb', border: '1px solid #fbbf24',
          borderRadius: 8, padding: '1rem 1.25rem', marginBottom: '2rem',
        }}>
          <strong style={{ color: '#92400e' }}>⚠️ LinkedIn Company Page Reshare</strong>
          <p style={{ margin: '0.4rem 0 0', fontSize: '0.85rem', color: '#78350f' }}>
            Company page reshares require <code>LINKEDIN_ORG_ID</code> and either{' '}
            <code>LINKEDIN_ORG_ACCESS_TOKEN</code> or a personal token with{' '}
            <code>w_organization_social</code> scope. Check GitHub Secrets if reshares are not appearing.
          </p>
        </div>

        {/* Links */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {[
            { label: '📊 Google Sheet', href: 'https://docs.google.com/spreadsheets/d/1244VCHh0asyN9Uav9_7UHcoa8LyuLvHK0uprnHNAVrg' },
            { label: '⚙️ GitHub Actions', href: `https://github.com/${REPO}/actions` },
            { label: '🔑 GitHub Secrets', href: `https://github.com/${REPO}/settings/secrets/actions` },
          ].map(l => (
            <a
              key={l.label}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: '#031b49', color: '#fff', padding: '0.6rem 1.2rem',
                borderRadius: 6, textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600,
              }}
            >
              {l.label}
            </a>
          ))}
        </div>

      </div>
    </div>
  );
}
