import React from 'react';
import PropTypes from 'prop-types';
import { Lock, CheckCircle2, ShieldCheck } from 'lucide-react';

const GATE_DEFINITIONS = [
  { name: 'PLAN', desc: 'Migration wave sequencing and repository dependency structure', gate: 'PLAN' },
  { name: 'MAPPINGS', desc: 'Identity mapping table (legacy authors to GitHub handles)', gate: 'MAPPINGS' },
  { name: 'SECRETS', desc: 'Remediation plan for discovered credentials and secrets', gate: 'SECRETS' },
  { name: 'CUTOVER', desc: 'Final sign-off to push git mirror and switch remotes to GitHub', gate: 'CUTOVER' },
];

export function GatesTab({ gates, loadingAction, onApproveGate }) {
  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">
              <Lock style={{ width: '16px', height: '16px' }} />
              <span>Governance Hard Approval Gates</span>
            </h2>
            <p className="panel-description">
              Per FR-09 & Cascade Law: Migration cannot proceed past Plan, Mappings, Secrets, or Cutover without human auditor authorization (T3).
            </p>
          </div>
          <span className="badge badge-warning">T3 Gate Enforced</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
          {GATE_DEFINITIONS.map((def) => {
            const state = gates.find((g) => g.gate === def.name);
            const isApproved = state && state.status === 'approved';

            return (
              <div
                key={def.name}
                style={{
                  padding: '1.35rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--surface-primary)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '1.25rem'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                    <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                      GATE: {def.name}
                    </strong>
                    <span className={`badge ${isApproved ? 'badge-t0' : 'badge-t3'}`}>
                      {isApproved ? 'APPROVED' : 'PENDING'}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {def.desc}
                  </p>
                </div>

                <div>
                  {isApproved ? (
                    <div style={{
                      fontSize: '0.78rem',
                      color: 'var(--text-primary)',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.5rem 0'
                    }}>
                      <CheckCircle2 style={{ width: '15px', height: '15px' }} />
                      <span>Gate Cleared by Lead Auditor</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onApproveGate(def.name)}
                      className="btn btn-primary"
                      style={{ width: '100%', fontSize: '0.8rem' }}
                      disabled={Boolean(loadingAction)}
                    >
                      <ShieldCheck style={{ width: '14px', height: '14px' }} />
                      <span>Authorize Gate [T3]</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

GatesTab.propTypes = {
  gates: PropTypes.array.isRequired,
  loadingAction: PropTypes.string,
  onApproveGate: PropTypes.func.isRequired
};
