import React from 'react';
import PropTypes from 'prop-types';
import { Database, RefreshCw, Sparkles, AlertCircle } from 'lucide-react';

export function CatalogTab({
  catalog = [],
  loadingAction = '',
  onReassess = () => {},
  onNavigateToOverview = () => {}
}) {
  const isReassessing = loadingAction.includes('Assessor') || loadingAction.includes('Insights');

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="panel">
        <div className="panel-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2 className="panel-title">
              <Database style={{ width: '16px', height: '16px' }} />
              <span>Discovered Repositories & Risk Scoring</span>
            </h2>
            <p className="panel-description">
              Metadata catalog with autonomous risk tiering and pre-flight effort estimations.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button
              type="button"
              onClick={onNavigateToOverview}
              className="btn btn-secondary"
            >
              <Sparkles style={{ width: '13px', height: '13px' }} />
              <span>AI Pre-Flight Insights</span>
            </button>
            <button
              type="button"
              onClick={onReassess}
              className="btn btn-primary"
              disabled={Boolean(loadingAction)}
            >
              <RefreshCw
                style={{
                  width: '13px',
                  height: '13px',
                  animation: isReassessing ? 'spin 1s linear infinite' : 'none'
                }}
              />
              <span>{isReassessing ? 'Assessing...' : 'Re-assess Risk Score'}</span>
            </button>
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Repository</th>
              <th>Source</th>
              <th>Commits</th>
              <th>Branches</th>
              <th>Tags</th>
              <th>Risk Tier</th>
              <th>Top Risk Factors</th>
              <th>Est. Effort</th>
            </tr>
          </thead>
          <tbody>
            {catalog.map((repo) => {
              const tier = repo.risk_tier || 'LOW';
              const badgeClass =
                tier === 'HIGH'
                  ? 'badge-danger'
                  : tier === 'MEDIUM'
                  ? 'badge-t3'
                  : 'badge-t0';
              const effort =
                repo.effort_estimate ||
                (tier === 'HIGH' ? '1-2 weeks' : tier === 'MEDIUM' ? '3-5 days' : '1-2 days');

              return (
                <tr key={repo.id || repo.name}>
                  <td style={{ fontWeight: 600 }}>{repo.name}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--status-info)' }}>{repo.source_type}</td>
                  <td>{repo.commit_count || 1}</td>
                  <td>{repo.branch_count || 1}</td>
                  <td>{repo.tag_count || 1}</td>
                  <td>
                    <span className={`badge ${badgeClass}`}>{tier}</span>
                  </td>
                  <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {repo.risk_factors && repo.risk_factors.length > 0
                      ? repo.risk_factors.slice(0, 2).join(' · ')
                      : 'Standard commits, clean layout'}
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{effort}</td>
                </tr>
              );
            })}
            {catalog.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-tertiary)' }}>
                  No catalog records found. Connect a source and run Scout discovery first.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

CatalogTab.propTypes = {
  catalog: PropTypes.array.isRequired,
  loadingAction: PropTypes.string,
  onReassess: PropTypes.func.isRequired,
  onNavigateToOverview: PropTypes.func
};
