import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Users, CheckCircle2, GitFork, Edit3, Check, X } from 'lucide-react';

export function MappingsTab({ mappings = [], catalog = [], selectedRepoId, onSelectRepo, onUpdateMapping }) {
  const selectedRepo = catalog.find((r) => r.id === selectedRepoId) || catalog[catalog.length - 1];
  const [editingAuthor, setEditingAuthor] = useState(null);
  const [editForm, setEditForm] = useState({ login: '', email: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [localOverrides, setLocalOverrides] = useState({});

  const startEdit = (m) => {
    const current = localOverrides[m.legacy_id] || m;
    setEditingAuthor(m.legacy_id);
    setEditForm({
      login: current.proposed_login || current.legacy_id,
      email: current.proposed_email || `${current.legacy_id}@users.noreply.github.com`
    });
  };

  const cancelEdit = () => {
    setEditingAuthor(null);
  };

  const saveEdit = async (m) => {
    setIsSaving(true);
    const updatedLogin = editForm.login.trim();
    const updatedEmail = editForm.email.trim();
    try {
      if (onUpdateMapping && selectedRepo?.id) {
        await onUpdateMapping(selectedRepo.id, m.legacy_id, updatedLogin, updatedEmail);
      } else if (selectedRepo?.id) {
        await fetch(`http://localhost:8100/api/repos/${selectedRepo.id}/mappings/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            legacy_id: m.legacy_id,
            proposed_login: updatedLogin,
            proposed_email: updatedEmail
          })
        });
      }
      setLocalOverrides((prev) => ({
        ...prev,
        [m.legacy_id]: {
          proposed_login: updatedLogin,
          proposed_email: updatedEmail,
          status: 'confirmed'
        }
      }));
      setEditingAuthor(null);
    } catch (err) {
      console.error('Failed to update mapping:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="panel">
        <div className="panel-header" style={{ alignItems: 'flex-start' }}>
          <div>
            <h2 className="panel-title">
              <Users style={{ width: '16px', height: '16px' }} />
              <span>Identity Cartographer Author Mapping</span>
            </h2>
            <p className="panel-description">
              Resolves legacy VCS committer usernames to modern GitHub handles using evidence packets.
            </p>

            {/* Repository Selector Dropdown */}
            {catalog.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginTop: '0.85rem' }}>
                <GitFork style={{ width: '14px', height: '14px', color: 'var(--text-secondary)' }} />
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  Active Repository:
                </span>
                <select
                  value={selectedRepo?.id || ''}
                  onChange={(e) => onSelectRepo && onSelectRepo(Number(e.target.value))}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--surface-primary)',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {catalog.map((repo) => (
                    <option key={repo.id} value={repo.id}>
                      #{repo.id} — {repo.name} ({repo.source_type.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span className="badge badge-connected">{mappings.length} Authors</span>
            <span className="badge badge-t0">Cascade Verified</span>
          </div>
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
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {mappings.map((m, idx) => {
              const current = localOverrides[m.legacy_id]
                ? { ...m, ...localOverrides[m.legacy_id] }
                : m;
              const isEditing = editingAuthor === m.legacy_id;

              return (
                <tr key={m.legacy_id || idx}>
                  <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--status-warning)', fontWeight: 600 }}>
                    {m.legacy_id}
                  </td>
                  <td>
                    {isEditing ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>@</span>
                        <input
                          type="text"
                          value={editForm.login}
                          onChange={(e) => setEditForm({ ...editForm, login: e.target.value })}
                          style={{
                            padding: '0.22rem 0.45rem',
                            fontSize: '0.8rem',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-subtle)',
                            backgroundColor: 'var(--surface-primary)',
                            color: 'var(--text-primary)',
                            width: '130px',
                            fontFamily: 'var(--font-mono)'
                          }}
                        />
                      </div>
                    ) : (
                      <span style={{ fontWeight: 600, color: 'var(--status-info)' }}>
                        @{current.proposed_login}
                      </span>
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        style={{
                          padding: '0.22rem 0.5rem',
                          fontSize: '0.8rem',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-subtle)',
                          backgroundColor: 'var(--surface-primary)',
                          color: 'var(--text-primary)',
                          width: '230px',
                          fontFamily: 'var(--font-mono)'
                        }}
                      />
                    ) : (
                      <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                        {current.proposed_email}
                      </span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: '56px', height: '5px', backgroundColor: 'var(--border-strong)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{
                          width: `${Math.round((current.confidence || 0.95) * 100)}%`,
                          height: '100%',
                          backgroundColor: 'var(--status-success)'
                        }} />
                      </div>
                      <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                        {Math.round((current.confidence || 0.95) * 100)}%
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-t0">{current.tier || 'T0'}</span>
                  </td>
                  <td>
                    <span style={{ color: 'var(--status-success)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem' }}>
                      <CheckCircle2 style={{ width: '13px', height: '13px' }} />
                      <span>{current.status === 'confirmed' ? 'Confirmed' : 'Auto-Resolved'}</span>
                    </span>
                  </td>
                  <td>
                    {isEditing ? (
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button
                          type="button"
                          onClick={() => saveEdit(m)}
                          disabled={isSaving}
                          className="btn btn-primary"
                          style={{ padding: '0.2rem 0.55rem', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                        >
                          <Check style={{ width: '12px', height: '12px' }} />
                          <span>Save</span>
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="btn btn-secondary"
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                        >
                          <X style={{ width: '12px', height: '12px' }} />
                          <span>Cancel</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEdit(m)}
                        className="btn btn-secondary"
                        style={{ padding: '0.2rem 0.55rem', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                      >
                        <Edit3 style={{ width: '11px', height: '11px' }} />
                        <span>Edit</span>
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {mappings.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-tertiary)' }}>
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
  mappings: PropTypes.array,
  catalog: PropTypes.array,
  selectedRepoId: PropTypes.number,
  onSelectRepo: PropTypes.func,
  onUpdateMapping: PropTypes.func
};
