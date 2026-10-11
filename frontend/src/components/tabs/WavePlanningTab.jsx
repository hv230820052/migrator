import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { 
  Layers, 
  RefreshCw, 
  CheckCircle2, 
  HardDrive, 
  GitBranch, 
  Clock, 
  AlertTriangle,
  ArrowRight,
  Filter
} from 'lucide-react';

export function WavePlanningTab({
  wavesData,
  loadingAction,
  onRefreshWaves,
  onMoveRepo,
  onApprovePlanGate
}) {
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 1, 2, 3

  const waves = wavesData?.waves || [
    { wave_number: 1, name: "Wave 1: Pilot & Quick Wins", risk_profile: "LOW", target_schedule: "Day 1 (Instant)", description: "Low-risk, lightweight repositories with standard layouts and zero binary bloat.", repos: [], count: 0 },
    { wave_number: 2, name: "Wave 2: Core Applications", risk_profile: "MEDIUM", target_schedule: "Day 2-3 (Standard)", description: "Active business repositories with standard history and clean team mappings.", repos: [], count: 0 },
    { wave_number: 3, name: "Wave 3: Heavy / Complex Legacy", risk_profile: "HIGH", target_schedule: "Day 4-5 (Cutover)", description: "Repositories with files >100MB requiring Git LFS conversion, SVN re-layouts, or secret rotations.", repos: [], count: 0 }
  ];

  // Flatten repos with their assigned wave info
  const allRepos = [];
  waves.forEach((w) => {
    (w.repos || []).forEach((r) => {
      allRepos.push({
        ...r,
        assigned_wave_number: w.wave_number,
        assigned_wave_name: w.name,
        assigned_wave_risk: w.risk_profile,
        assigned_wave_schedule: w.target_schedule
      });
    });
  });

  const displayedRepos = activeFilter === 'all' 
    ? allRepos 
    : allRepos.filter(r => r.assigned_wave_number === Number(activeFilter));

  const totalReposCount = allRepos.length;
  const isRefreshing = loadingAction === 'refresh_waves';

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Wave Planning Panel */}
      <div className="panel">
        <div className="panel-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2 className="panel-title">
              <Layers style={{ width: '16px', height: '16px' }} />
              <span>Migration Wave Planning & Prioritization (FR-20)</span>
            </h2>
            <p className="panel-description">
              Deterministic risk-based wave scheduling: Low-risk pilots first, heavy legacy &amp; LFS workloads scheduled with dedicated cutovers.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onRefreshWaves}
              disabled={isRefreshing}
            >
              <RefreshCw
                style={{
                  width: '13px',
                  height: '13px',
                  animation: isRefreshing ? 'spin 1s linear infinite' : 'none'
                }}
              />
              <span>{isRefreshing ? 'Clustering...' : 'Auto-Cluster (T0 Rules)'}</span>
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onApprovePlanGate}
            >
              <CheckCircle2 style={{ width: '13px', height: '13px' }} />
              <span>Approve Wave Plan (PLAN Gate)</span>
            </button>
          </div>
        </div>

        {/* 1. Wave Architecture Summary Table */}
        <div style={{ marginBottom: '1.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem' }}>
            <h3 style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Wave Schedule Strategy
            </h3>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '22%' }}>Migration Wave</th>
                <th style={{ width: '12%' }}>Risk Tier</th>
                <th style={{ width: '10%' }}>Allocated</th>
                <th style={{ width: '18%' }}>Target Window</th>
                <th style={{ width: '38%' }}>Execution Strategy</th>
              </tr>
            </thead>
            <tbody>
              {waves.map((w) => {
                const badgeClass =
                  w.risk_profile === 'HIGH'
                    ? 'badge-danger'
                    : w.risk_profile === 'MEDIUM'
                    ? 'badge-t3'
                    : 'badge-connected';

                return (
                  <tr key={w.wave_number}>
                    <td style={{ fontWeight: 600 }}>
                      {w.name}
                    </td>
                    <td>
                      <span className={`badge ${badgeClass}`}>{w.risk_profile}</span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      {w.repos?.length || 0} repos
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      {w.target_schedule}
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      {w.recommendation || w.description}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 2. Repository Allocation Table */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Repository Assignments ({displayedRepos.length} / {totalReposCount} total)
              </h3>
            </div>

            {/* Filter Buttons */}
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginRight: '0.2rem' }}>Filter:</span>
              <button
                type="button"
                className="btn-chip"
                onClick={() => setActiveFilter('all')}
                style={{
                  backgroundColor: activeFilter === 'all' ? 'var(--surface-secondary)' : 'var(--surface-primary)',
                  fontWeight: activeFilter === 'all' ? 700 : 500,
                  borderColor: activeFilter === 'all' ? 'var(--border-interactive)' : 'var(--border-subtle)'
                }}
              >
                All ({totalReposCount})
              </button>
              {waves.map((w) => (
                <button
                  key={w.wave_number}
                  type="button"
                  className="btn-chip"
                  onClick={() => setActiveFilter(String(w.wave_number))}
                  style={{
                    backgroundColor: activeFilter === String(w.wave_number) ? 'var(--surface-secondary)' : 'var(--surface-primary)',
                    fontWeight: activeFilter === String(w.wave_number) ? 700 : 500,
                    borderColor: activeFilter === String(w.wave_number) ? 'var(--border-interactive)' : 'var(--border-subtle)'
                  }}
                >
                  Wave {w.wave_number} ({w.repos?.length || 0})
                </button>
              ))}
            </div>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>Repository</th>
                <th>Source</th>
                <th>Assigned Wave</th>
                <th>Size</th>
                <th>Commits</th>
                <th>Branches</th>
                <th>Risk Tier</th>
                <th>Special Handling</th>
                <th>Est. Effort</th>
                <th style={{ textAlign: 'right' }}>Reassign Wave</th>
              </tr>
            </thead>
            <tbody>
              {displayedRepos.map((repo) => {
                const tier = repo.risk_tier || 'LOW';
                const tierBadge =
                  tier === 'HIGH'
                    ? 'badge-danger'
                    : tier === 'MEDIUM'
                    ? 'badge-t3'
                    : 'badge-connected';

                const waveBadge =
                  repo.assigned_wave_number === 3
                    ? 'badge-danger'
                    : repo.assigned_wave_number === 2
                    ? 'badge-t3'
                    : 'badge-connected';

                const sizeMb = ((repo.size || 0) / (1024 * 1024)).toFixed(1);

                return (
                  <tr key={repo.id}>
                    <td style={{ fontWeight: 600 }}>
                      {repo.name}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--status-info)' }}>
                      {repo.source_type}
                    </td>
                    <td>
                      <span className={`badge ${waveBadge}`}>
                        Wave {repo.assigned_wave_number}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>
                      {sizeMb} MB
                    </td>
                    <td>
                      {repo.commits || 1}
                    </td>
                    <td>
                      {repo.branches || 1}
                    </td>
                    <td>
                      <span className={`badge ${tierBadge}`}>{tier}</span>
                    </td>
                    <td style={{ fontSize: '0.78rem' }}>
                      {repo.large_files > 0 ? (
                        <span style={{ color: 'var(--status-danger)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
                          <AlertTriangle style={{ width: '12px', height: '12px' }} />
                          <span>Git LFS (&gt;100MB)</span>
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-tertiary)' }}>Standard Clone</span>
                      )}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                      {repo.effort_estimate || '1-2 days'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.3rem' }}>
                        {[1, 2, 3].map((wNum) => {
                          const isCurrent = repo.assigned_wave_number === wNum;
                          return (
                            <button
                              key={wNum}
                              type="button"
                              className="btn-chip"
                              disabled={isCurrent}
                              onClick={() => onMoveRepo && onMoveRepo(repo.id, wNum - 1)}
                              style={{
                                padding: '0.2rem 0.5rem',
                                fontSize: '0.7rem',
                                opacity: isCurrent ? 0.45 : 1,
                                cursor: isCurrent ? 'default' : 'pointer'
                              }}
                              title={`Move to Wave ${wNum}`}
                            >
                              W{wNum}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {displayedRepos.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-tertiary)' }}>
                    No repositories matching filter. Click "Auto-Cluster (T0 Rules)" to populate waves.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

WavePlanningTab.propTypes = {
  wavesData: PropTypes.object,
  loadingAction: PropTypes.string,
  onRefreshWaves: PropTypes.func.isRequired,
  onMoveRepo: PropTypes.func,
  onApprovePlanGate: PropTypes.func.isRequired
};
