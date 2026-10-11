import React from 'react';
import PropTypes from 'prop-types';
import { Users, CheckCircle2 } from 'lucide-react';

export function MappingsTab({ mappings }) {
  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">
              <Users style={{ width: '16px', height: '16px' }} />
              <span>Identity Cartographer Author Mapping</span>
            </h2>
            <p className="panel-description">
              Resolves legacy VCS committer usernames to modern GitHub handles using evidence packets.
            </p>
          </div>
          <span className="badge badge-t0">Cascade Verified</span>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Legacy Author</th>
              <th>Proposed GitHub Login</th>
              <th>Verified Email</th>
              <th>Confidence</th>
              <th>Tier</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {mappings.map((m, idx) => (
              <tr key={m.legacy_id || idx}>
                <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--status-warning)', fontWeight: 600 }}>
                  {m.legacy_id}
                </td>
                <td style={{ fontWeight: 600, color: 'var(--status-info)' }}>
                  @{m.proposed_login}
                </td>
                <td style={{ color: 'var(--text-secondary)' }}>
                  {m.proposed_email}
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '56px', height: '5px', backgroundColor: 'var(--border-strong)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${Math.round((m.confidence || 0.95) * 100)}%`,
                        height: '100%',
                        backgroundColor: 'var(--status-success)'
                      }} />
                    </div>
                    <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                      {Math.round((m.confidence || 0.95) * 100)}%
                    </span>
                  </div>
                </td>
                <td>
                  <span className="badge badge-t0">{m.tier || 'T0'}</span>
                </td>
                <td>
                  <span style={{ color: 'var(--status-success)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem' }}>
                    <CheckCircle2 style={{ width: '13px', height: '13px' }} />
                    <span>Auto-Resolved</span>
                  </span>
                </td>
              </tr>
            ))}
            {mappings.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-tertiary)' }}>
                  No identity mappings loaded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

MappingsTab.propTypes = {
  mappings: PropTypes.array.isRequired
};
