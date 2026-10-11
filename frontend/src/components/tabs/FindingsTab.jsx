import React from 'react';
import PropTypes from 'prop-types';
import { ShieldAlert, RefreshCw, KeyRound, GitBranch, UserX } from 'lucide-react';

export function FindingsTab({ findings, loadingAction, onRescan }) {
  const getIcon = (type) => {
    if (type === 'secret') return KeyRound;
    if (type === 'dead_branch') return GitBranch;
    return UserX;
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">
              <ShieldAlert style={{ width: '16px', height: '16px', color: 'var(--status-danger)' }} />
              <span>Curator Pre-Flight Findings & Secrets Scan</span>
            </h2>
            <p className="panel-description">
              Entropy & regex scan across repository history. Sensitive strings are strictly redacted per NFR-09.
            </p>
          </div>
          <button
            type="button"
            onClick={onRescan}
            className="btn btn-secondary"
            disabled={Boolean(loadingAction)}
          >
            <RefreshCw style={{ width: '13px', height: '13px' }} />
            <span>Re-scan History</span>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {findings.map((finding, idx) => {
            const Icon = getIcon(finding.type);
            const isHigh = finding.severity === 'high';

            return (
              <div key={finding.id || idx} style={{
                padding: '1.25rem 1.35rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--surface-primary)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1.25rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.9rem' }}>
                  <div style={{
                    padding: '0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--surface-secondary)',
                    color: 'var(--text-primary)',
                    marginTop: '0.1rem',
                    border: '1px solid var(--border-subtle)'
                  }}>
                    <Icon style={{ width: '16px', height: '16px' }} />
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem' }}>
                      <span className={`badge ${isHigh ? 'badge-danger' : 'badge-t3'}`}>
                        {finding.severity?.toUpperCase()}
                      </span>
                      <strong style={{ fontSize: '0.86rem', color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                        {finding.type?.replace('_', ' ')}
                      </strong>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                        {finding.location}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {finding.recommendation}
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                  FP: {finding.fingerprint}
                </div>
              </div>
            );
          })}

          {findings.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>
              No findings detected. Trigger curation to scan history.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

FindingsTab.propTypes = {
  findings: PropTypes.array.isRequired,
  loadingAction: PropTypes.string,
  onRescan: PropTypes.func.isRequired
};
