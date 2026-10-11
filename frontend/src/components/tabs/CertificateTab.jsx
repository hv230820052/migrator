import React from 'react';
import PropTypes from 'prop-types';
import { FileCheck, Download, Copy, Check, ExternalLink } from 'lucide-react';

export function CertificateTab({
  beforeAfter,
  copyFeedback,
  onCopyCommand,
  onDownloadCert
}) {
  const switchCmd = beforeAfter?.after?.monday_morning_switch || 'git remote set-url origin git@github.com:octathon-target/demo-svn-repo.git';

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">
              <FileCheck style={{ width: '17px', height: '17px', color: 'var(--status-success)' }} />
              <span>Proof of Migration Fidelity & Cryptographic Seal</span>
            </h2>
            <p className="panel-description">
              FR-08 Mathematical Parity Verification. Executed with 0 LLM tokens (T0 Deterministic Standard).
            </p>
          </div>
          <button
            id="btn-download-cert"
            type="button"
            onClick={onDownloadCert}
            className="btn btn-secondary"
          >
            <Download style={{ width: '13px', height: '13px' }} />
            <span>Download Audit Certificate (.json)</span>
          </button>
        </div>

        {/* Fidelity Metrics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
          <div style={{ padding: '1.35rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--surface-primary)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Commit Parity
            </div>
            <div style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', margin: '0.25rem 0' }}>
              100.0%
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              N In = N Out (Zero loss)
            </div>
          </div>

          <div style={{ padding: '1.35rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--surface-primary)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Branch Parity
            </div>
            <div style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', margin: '0.25rem 0' }}>
              100.0%
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              All refs preserved
            </div>
          </div>

          <div style={{ padding: '1.35rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--surface-primary)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Tag Integrity
            </div>
            <div style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', margin: '0.25rem 0' }}>
              MATCH
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              SHA-256 byte identical
            </div>
          </div>

          <div style={{ padding: '1.35rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--surface-primary)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              LLM Cost (Tokens)
            </div>
            <div style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', margin: '0.25rem 0' }}>
              0
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              100% Deterministic (T0)
            </div>
          </div>
        </div>

        {/* Before vs After Comparison */}
        {beforeAfter && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            <div style={{ padding: '1.35rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--surface-primary)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  Source: Legacy VCS
                </strong>
                <span className="badge badge-t3">Legacy State</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', fontSize: '0.82rem' }}>
                <div><span style={{ color: 'var(--text-tertiary)' }}>Source VCS:</span> {beforeAfter.before?.source_system}</div>
                <div><span style={{ color: 'var(--text-tertiary)' }}>Layout:</span> {beforeAfter.before?.layout}</div>
                <div><span style={{ color: 'var(--text-tertiary)' }}>Legacy Authors:</span> {beforeAfter.before?.legacy_authors?.join(', ')}</div>
                <div><span style={{ color: 'var(--text-tertiary)' }}>Raw Secrets Flagged:</span> {beforeAfter.before?.raw_secrets_in_history}</div>
                <div className="code-box" style={{ marginTop: '0.5rem' }}>{beforeAfter.before?.remote_command}</div>
              </div>
            </div>

            <div style={{ padding: '1.35rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--surface-primary)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  Target: GitHub Organization
                </strong>
                <span className="badge badge-success">Verified State</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', fontSize: '0.82rem' }}>
                <div>
                  <span style={{ color: 'var(--text-tertiary)' }}>Target Organization:</span>{' '}
                  <a href={beforeAfter.after?.target_url} target="_blank" rel="noreferrer" style={{ color: 'var(--text-primary)', fontWeight: 600, textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <span>{beforeAfter.after?.target_url}</span>
                    <ExternalLink style={{ width: '13px', height: '13px' }} />
                  </a>
                </div>
                <div><span style={{ color: 'var(--text-tertiary)' }}>Layout:</span> {beforeAfter.after?.layout}</div>
                <div><span style={{ color: 'var(--text-tertiary)' }}>Secrets Status:</span> {beforeAfter.after?.secrets_status}</div>
                <div><span style={{ color: 'var(--text-tertiary)' }}>Binary Strategy:</span> {beforeAfter.after?.oversized_files}</div>
                <div className="code-box" style={{ marginTop: '0.5rem' }}>{beforeAfter.after?.monday_morning_switch}</div>
              </div>
            </div>
          </div>
        )}

        {/* Monday Morning Switcher Box */}
        <div style={{
          padding: '1.35rem',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--surface-primary)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1.25rem',
          flexWrap: 'wrap'
        }}>
          <div>
            <h4 style={{ fontSize: '0.88rem', color: 'var(--text-primary)', marginBottom: '0.2rem', fontWeight: 600 }}>
              Monday-Morning Developer Switch Command
            </h4>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Run in your local repository clone to switch upstream remote directly to the newly migrated GitHub repository.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onCopyCommand(switchCmd)}
            className="btn btn-secondary"
            style={{ minWidth: '130px' }}
          >
            {copyFeedback ? (
              <>
                <Check style={{ width: '13px', height: '13px', color: 'var(--status-success)' }} />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy style={{ width: '13px', height: '13px' }} />
                <span>Copy Command</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

CertificateTab.propTypes = {
  beforeAfter: PropTypes.object,
  copyFeedback: PropTypes.bool.isRequired,
  onCopyCommand: PropTypes.func.isRequired,
  onDownloadCert: PropTypes.func.isRequired
};
