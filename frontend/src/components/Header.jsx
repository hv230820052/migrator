import React from 'react';
import PropTypes from 'prop-types';
import { Activity, ShieldCheck, Cpu, Play, Loader2 } from 'lucide-react';

export function Header({
  wsConnected,
  customTargetOrg,
  runId,
  approvedGatesCount,
  cascadeStats,
  loadingAction,
  onRunPipeline
}) {
  return (
    <header style={{
      backgroundColor: 'var(--surface-primary)',
      borderBottom: '1px solid var(--border-subtle)',
      padding: '0.95rem 2.25rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 50
    }}>
      {/* Brand & Connection State */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: wsConnected ? '#10b981' : 'var(--text-tertiary)',
            boxShadow: wsConnected ? '0 0 6px rgba(16, 185, 129, 0.4)' : 'none',
            border: wsConnected ? '1px solid #059669' : '1px solid var(--border-subtle)'
          }} />
          <span style={{
            fontSize: '1.05rem',
            fontWeight: 800,
            letterSpacing: '0.04em',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)'
          }}>
            PROVENANCE
          </span>
          <span
            className={`badge ${wsConnected ? 'badge-connected' : 'badge-t3'}`}
            style={{ fontSize: '0.65rem', padding: '0.12rem 0.48rem' }}
          >
            {wsConnected ? 'Connected' : 'Offline'}
          </span>
        </div>

        <span style={{
          fontSize: '0.75rem',
          padding: '0.25rem 0.65rem',
          borderRadius: 'var(--radius-sm)',
          backgroundColor: 'var(--surface-primary)',
          border: '1px solid var(--border-subtle)',
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-mono)'
        }}>
          target: <strong style={{ color: 'var(--text-primary)' }}>{customTargetOrg}</strong>
        </span>

        <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
          Run #{runId}
        </span>
      </div>

      {/* KPI Chips & Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.45rem',
          backgroundColor: 'var(--surface-primary)',
          padding: '0.4rem 0.75rem',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-subtle)',
          fontSize: '0.78rem'
        }}>
          <ShieldCheck style={{ width: '14px', height: '14px', color: 'var(--text-primary)' }} />
          <span style={{ color: 'var(--text-tertiary)' }}>Gates:</span>
          <strong style={{ color: 'var(--text-primary)' }}>
            {approvedGatesCount}/4
          </strong>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.45rem',
          backgroundColor: 'var(--surface-primary)',
          padding: '0.4rem 0.75rem',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-subtle)',
          fontSize: '0.78rem'
        }}>
          <Cpu style={{ width: '14px', height: '14px', color: 'var(--text-primary)' }} />
          <span style={{ color: 'var(--text-tertiary)' }}>Cascade:</span>
          <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            {cascadeStats.budget_used || 0} / {cascadeStats.budget_limit || 100000}
          </strong>
        </div>

        <button
          id="btn-golden-path"
          onClick={onRunPipeline}
          disabled={Boolean(loadingAction)}
          className="btn btn-primary"
        >
          {loadingAction ? (
            <>
              <Loader2 className="animate-spin" style={{ width: '14px', height: '14px' }} />
              <span>{loadingAction}</span>
            </>
          ) : (
            <>
              <Play style={{ width: '14px', height: '14px' }} />
              <span>Execute Autonomous Pipeline</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
}

Header.propTypes = {
  wsConnected: PropTypes.bool.isRequired,
  customTargetOrg: PropTypes.string.isRequired,
  runId: PropTypes.number.isRequired,
  approvedGatesCount: PropTypes.number.isRequired,
  cascadeStats: PropTypes.shape({
    budget_used: PropTypes.number,
    budget_limit: PropTypes.number,
    budget_tripped: PropTypes.bool
  }).isRequired,
  loadingAction: PropTypes.string,
  onRunPipeline: PropTypes.func.isRequired
};
