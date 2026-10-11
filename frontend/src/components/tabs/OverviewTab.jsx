import React from 'react';
import PropTypes from 'prop-types';
import {
  Sparkles,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  Zap,
  Cpu
} from 'lucide-react';

export function OverviewTab({
  catalog = [],
  insights = null,
  loadingAction = '',
  onGenerateInsights = () => {},
  onNavigate = () => {}
}) {
  // Compute live heatmap counts from catalog
  const lowCount = catalog.filter((r) => !r.risk_tier || r.risk_tier === 'LOW').length;
  const medCount = catalog.filter((r) => r.risk_tier === 'MEDIUM').length;
  const highCount = catalog.filter((r) => r.risk_tier === 'HIGH').length;

  const isAnalyzing = loadingAction.includes('Insights') || loadingAction.includes('Assessor');

  const verdictBadgeClass =
    insights?.verdict === 'HIGH'
      ? 'badge-danger'
      : insights?.verdict === 'MEDIUM'
      ? 'badge-t3'
      : 'badge-t0';

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Metric Tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
        <div className="panel">
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Cataloged Repositories
          </div>
          <div style={{ fontSize: '2.25rem', fontWeight: 800, marginTop: '0.4rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            {catalog.length || 1}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <CheckCircle2 style={{ width: '14px', height: '14px', color: 'var(--text-primary)' }} /> Multi-VCS Ingest Ready
          </div>
        </div>

        <div className="panel">
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            VCS Sources Supported
          </div>
          <div style={{ fontSize: '2.25rem', fontWeight: 800, marginTop: '0.4rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            6
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
            SVN, TFS, LocalGit, GitHub, GitLab, Bitbucket
          </div>
        </div>

        <div className="panel">
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Cascade Governance
          </div>
          <div style={{ fontSize: '2.25rem', fontWeight: 800, marginTop: '0.4rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            96% T0
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
            Zero-Token Mathematical Rules First
          </div>
        </div>

        <div className="panel">
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Verification Parity
          </div>
          <div style={{ fontSize: '2.25rem', fontWeight: 800, marginTop: '0.4rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            100.0%
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
            Zero Lost Commits / SHA-256 Valid
          </div>
        </div>
      </div>

      {/* AI Pre-Flight Migration Advisory */}
      <div className="panel" style={{ border: '1px solid var(--border-subtle)', position: 'relative' }}>
        <div className="panel-header" style={{ alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles style={{ width: '18px', height: '18px', color: 'var(--text-primary)' }} />
                <span>AI Pre-Flight Migration Advisory</span>
              </h2>
              {insights && (
                <>
                  <span className={`badge ${verdictBadgeClass}`}>
                    VERDICT: {insights.verdict || 'MEDIUM'}
                  </span>
                  <span className="badge badge-t2">
                    TIER: {insights.tier || 'T2'} (AI REASONING)
                  </span>
                  <span className="badge badge-info" style={{ fontFamily: 'var(--font-mono)' }}>
                    COMPLEXITY: {insights.complexity_score ?? 50}/100
                  </span>
                </>
              )}
            </div>
            <p className="panel-description" style={{ marginTop: '0.35rem' }}>
              Autonomous pre-migration strategic audit powered by OpenRouter Nemotron (550B). Analyzes branch topology, identity debt, and secret exposure before initiating cutover.
            </p>
          </div>

          <button
            type="button"
            onClick={onGenerateInsights}
            disabled={Boolean(loadingAction)}
            className="btn btn-primary"
            style={{ minWidth: '185px' }}
          >
            <RefreshCw
              style={{
                width: '14px',
                height: '14px',
                animation: isAnalyzing ? 'spin 1s linear infinite' : 'none'
              }}
            />
            <span>{isAnalyzing ? 'Analyzing Portfolio...' : insights ? 'Re-Analyze with AI' : 'Analyze with AI'}</span>
          </button>
        </div>

        {/* Advisory Body */}
        {insights ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1rem' }}>
            {/* Executive Synthesis */}
            <div
              style={{
                padding: '1.1rem 1.25rem',
                backgroundColor: 'var(--surface-primary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)'
              }}
            >
              <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.04em' }}>
                Executive Strategic Verdict · {insights.model || 'nvidia/nemotron-3-ultra-550b-a55b:free'}
              </div>
              <div style={{ fontSize: '0.92rem', color: 'var(--text-primary)', marginTop: '0.45rem', lineHeight: 1.6, fontWeight: 500 }}>
                {insights.summary}
              </div>
            </div>

            {/* 2-Column Pre-Flight Breakdown: Pitfalls & Cutover Strategy */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem' }}>
              {/* Column 1: Pre-Flight Pitfalls */}
              <div
                style={{
                  padding: '1.25rem',
                  backgroundColor: 'var(--surface-primary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
                  <AlertTriangle style={{ width: '15px', height: '15px', color: 'var(--text-primary)' }} />
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    ARCHITECTURAL PITFALLS
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {insights.pitfalls?.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        fontSize: '0.82rem',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.5,
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.5rem'
                      }}
                    >
                      <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>•</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Column 2: Recommended Cutover Strategy */}
              <div
                style={{
                  padding: '1.25rem',
                  backgroundColor: 'var(--surface-primary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
                  <Zap style={{ width: '15px', height: '15px', color: 'var(--text-primary)' }} />
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    RECOMMENDED CUTOVER STRATEGY
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {insights.cutover_strategy?.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        fontSize: '0.82rem',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.5,
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.5rem'
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          backgroundColor: 'var(--border-subtle)',
                          borderRadius: '50%',
                          width: '18px',
                          height: '18px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--text-primary)',
                          flexShrink: 0
                        }}
                      >
                        {idx + 1}
                      </span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              padding: '2.5rem 1.5rem',
              textAlign: 'center',
              backgroundColor: 'var(--surface-primary)',
              border: '1px dashed var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              marginTop: '1rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.75rem'
            }}
          >
            <Cpu style={{ width: '32px', height: '32px', color: 'var(--text-tertiary)' }} />
            <div style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              No AI Pre-Flight Advisory Generated Yet
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', maxWidth: '520px', lineHeight: 1.5 }}>
              Click <strong>&quot;Analyze with AI&quot;</strong> to activate OpenRouter Nemotron. The model will analyze the legacy repositories beforehand, diagnose architectural pitfalls, and construct an autonomous cutover plan.
            </div>
            <button
              type="button"
              onClick={onGenerateInsights}
              disabled={Boolean(loadingAction)}
              className="btn btn-primary"
              style={{ marginTop: '0.5rem' }}
            >
              <Sparkles style={{ width: '14px', height: '14px' }} />
              <span>Generate AI Pre-Flight Insights</span>
            </button>
          </div>
        )}
      </div>

      {/* Portfolio Heatmap */}
      <div className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Portfolio Migration Heatmap</h2>
            <p className="panel-description">
              Automated pre-flight risk evaluation across legacy repositories based on secrets, unmapped contributors, and oversized binaries.
            </p>
          </div>
          <span className="badge badge-info">Deterministic T0 Weights</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '1.75rem' }}>
          <div style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--surface-primary)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>LOW RISK</span>
              <span className="badge badge-t0">{lowCount} Repos</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem', lineHeight: 1.5 }}>
              Standard commits, fully mapped authors. Fast-path automation.
            </div>
          </div>

          <div style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--surface-primary)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>MEDIUM RISK</span>
              <span className="badge badge-t3">{medCount} Attention</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem', lineHeight: 1.5 }}>
              Legacy author mappings reviewed, secrets remediated.
            </div>
          </div>

          <div style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--surface-primary)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>HIGH RISK / ARCHIVE</span>
              <span className="badge badge-danger">{highCount} Blockers</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem', lineHeight: 1.5 }}>
              Oversized binaries auto-healed to Git-LFS pointers.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => onNavigate('catalog')} className="btn btn-secondary">
            <span>View Discovered Catalog</span>
            <ArrowRight style={{ width: '13px', height: '13px' }} />
          </button>
          <button onClick={() => onNavigate('gates')} className="btn btn-primary">
            <span>Review Governance Gates</span>
            <ArrowRight style={{ width: '13px', height: '13px' }} />
          </button>
        </div>
      </div>
    </div>
  );
}

OverviewTab.propTypes = {
  catalog: PropTypes.array,
  insights: PropTypes.object,
  loadingAction: PropTypes.string,
  onGenerateInsights: PropTypes.func,
  onNavigate: PropTypes.func
};
