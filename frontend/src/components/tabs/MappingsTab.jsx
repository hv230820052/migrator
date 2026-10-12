import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
  Users,
  CheckCircle2,
  GitFork,
  Edit3,
  Check,
  X,
  Download,
  FileText,
  Sparkles,
  AlertTriangle,
  RotateCw
} from 'lucide-react';

export function MappingsTab({
  mappings = [],
  catalog = [],
  selectedRepoId,
  onSelectRepo,
  onUpdateMapping,
  API_BASE = 'http://localhost:8100'
}) {
  const selectedRepo = catalog.find((r) => r.id === selectedRepoId) || catalog[catalog.length - 1];
  const [editingAuthor, setEditingAuthor] = useState(null);
  const [editForm, setEditForm] = useState({ login: '', email: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [localOverrides, setLocalOverrides] = useState({});
  const [isLookupLoading, setIsLookupLoading] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportText, setExportText] = useState('');
  const [feedback, setFeedback] = useState(null);

  // Check warnings across mappings: duplicate emails and unverifiable domains
  const emailCounts = {};
  const warnings = [];
  mappings.forEach((m) => {
    const current = localOverrides[m.legacy_id] || m;
    const em = (current.proposed_email || current.email || '').trim().toLowerCase();
    if (em) {
      emailCounts[em] = (emailCounts[em] || 0) + 1;
      if (['example.com', 'localhost', 'test', 'local'].some((d) => em.includes(d))) {
        warnings.push(`Email '${em}' uses an unverifiable domain (e.g. example.com, localhost).`);
      }
    }
  });
  Object.entries(emailCounts).forEach(([em, cnt]) => {
    if (cnt > 1) {
      warnings.push(`Multiple source users map to '${em}'. GitHub will merge their commits into one contributor.`);
    }
  });

  const startEdit = (m) => {
    const current = localOverrides[m.legacy_id] || m;
    setEditingAuthor(m.legacy_id);
    setEditForm({
      login: current.proposed_login || current.github_username || current.legacy_id,
      email: current.proposed_email || current.email || ''
    });
  };

  const cancelEdit = () => {
    setEditingAuthor(null);
  };

  const handleLookupNoreply = async () => {
    const target = (editForm.login || editingAuthor || '').trim();
    if (!target) return;
    setIsLookupLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/github/user/${target}/noreply`);
      if (res.ok) {
        const data = await res.json();
        setEditForm((prev) => ({
          ...prev,
          login: data.username,
          email: data.noreply_email
        }));
        setFeedback({
          type: 'success',
          message: `Fetched official GitHub noreply: ${data.noreply_email}`
        });
      } else {
        const err = await res.json();
        setFeedback({ type: 'error', message: err.detail || 'GitHub user not found' });
      }
    } catch (e) {
      setFeedback({ type: 'error', message: `Lookup error: ${e.message}` });
    } finally {
      setIsLookupLoading(false);
    }
  };

  const saveEdit = async (m) => {
    setIsSaving(true);
    const updatedLogin = editForm.login.trim();
    const updatedEmail = editForm.email.trim();
    try {
      if (onUpdateMapping && selectedRepo?.id) {
        await onUpdateMapping(selectedRepo.id, m.legacy_id, updatedLogin, updatedEmail);
      } else if (selectedRepo?.id) {
        await fetch(`${API_BASE}/api/repos/${selectedRepo.id}/mappings/update`, {
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
      setFeedback({ type: 'success', message: `Mapping for '${m.legacy_id}' updated.` });
    } catch (err) {
      console.error('Failed to update mapping:', err);
      setFeedback({ type: 'error', message: `Update error: ${err.message}` });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = async () => {
    if (!selectedRepo?.id) return;
    try {
      const res = await fetch(`${API_BASE}/api/repos/${selectedRepo.id}/authors/export`);
      if (res.ok) {
        const text = await res.text();
        setExportText(text);
        setIsExportModalOpen(true);
      }
    } catch (e) {
      console.error('Export error:', e);
    }
  };

  const handleImport = async () => {
    if (!importText.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/authors/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: importText })
      });
      if (res.ok) {
        const data = await res.json();
        const overrides = {};
        (data.mappings || []).forEach((item) => {
          overrides[item.username] = {
            proposed_login: item.github_username || item.username,
            proposed_email: item.email,
            status: 'confirmed'
          };
        });
        setLocalOverrides((prev) => ({ ...prev, ...overrides }));
        setIsImportModalOpen(false);
        setImportText('');
        setFeedback({
          type: 'success',
          message: `Imported ${data.count} author mapping(s).`
        });
      }
    } catch (e) {
      setFeedback({ type: 'error', message: `Import error: ${e.message}` });
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="panel">
        <div className="panel-header" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2 className="panel-title">
              <Users style={{ width: '16px', height: '16px' }} />
              <span>Identity Cartographer Author Mapping</span>
            </h2>
            <p className="panel-description">
              Resolves legacy VCS committer usernames to modern GitHub handles with strict author email fidelity.
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
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Download style={{ width: '13px', height: '13px' }} />
              <span>Import authors.txt</span>
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <FileText style={{ width: '13px', height: '13px' }} />
              <span>Export authors.txt</span>
            </button>
            <span className="badge badge-connected">{mappings.length} Authors</span>
            <span className="badge badge-t0">Cascade Verified</span>
          </div>
        </div>

        {/* Short Hint per Requirement 3 */}
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.82rem', color: '#334155' }}>
          <Sparkles style={{ width: '16px', height: '16px', color: '#0284c7', flexShrink: 0 }} />
          <div>
            <strong>Attribution Hint:</strong> Use the email verified on the person&apos;s GitHub account or their official noreply address, otherwise commits won&apos;t be linked to their profile.
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            style={{
              padding: '0.65rem 0.95rem',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '1rem',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: feedback.type === 'error' ? '#fff1f2' : '#f0fdf4',
              color: feedback.type === 'error' ? '#9f1239' : '#166534',
              border: `1px solid ${feedback.type === 'error' ? '#fecdd3' : '#bbf7d0'}`
            }}
          >
            <span>{feedback.message}</span>
            <button onClick={() => setFeedback(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>✕</button>
          </div>
        )}

        {/* Warnings Banner */}
        {warnings.length > 0 && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#92400e', fontWeight: 700, fontSize: '0.82rem', marginBottom: '0.25rem' }}>
              <AlertTriangle style={{ width: '15px', height: '15px' }} />
              <span>Attribution Warnings (Non-Blocking)</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.76rem', color: '#78350f', lineHeight: 1.45 }}>
              {warnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </div>
        )}

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
                        @{current.proposed_login || current.github_username || current.legacy_id}
                      </span>
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <input
                          type="email"
                          value={editForm.email}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                          placeholder="email@example.com"
                          style={{
                            padding: '0.22rem 0.5rem',
                            fontSize: '0.8rem',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-subtle)',
                            backgroundColor: 'var(--surface-primary)',
                            color: 'var(--text-primary)',
                            width: '210px',
                            fontFamily: 'var(--font-mono)'
                          }}
                        />
                        <button
                          type="button"
                          onClick={handleLookupNoreply}
                          disabled={isLookupLoading}
                          className="btn btn-secondary"
                          style={{ padding: '0.2rem 0.45rem', fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                          title="Fetch official GitHub noreply email address"
                        >
                          {isLookupLoading ? (
                            <RotateCw style={{ width: '11px', height: '11px', animation: 'spin 1s linear infinite' }} />
                          ) : (
                            <Users style={{ width: '11px', height: '11px' }} />
                          )}
                          <span>Noreply</span>
                        </button>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                        {current.proposed_email || current.email || <em style={{ color: 'var(--status-danger)' }}>Unmapped</em>}
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

      {/* Import Modal */}
      {isImportModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(3px)' }}>
          <div style={{ background: 'var(--surface-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', padding: '1.5rem', width: '90%', maxWidth: '540px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Import authors.txt File</h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Format: <code>username = Full Name &lt;email@example.com&gt;</code> per line.</p>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="abhaypundora17 = Abhay Pundora <abhaypundora17@gmail.com>"
              rows={8}
              style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', marginBottom: '1rem' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button onClick={() => setIsImportModalOpen(false)} className="btn btn-secondary" style={{ fontSize: '0.78rem' }}>Cancel</button>
              <button onClick={handleImport} disabled={!importText.trim()} className="btn btn-primary" style={{ fontSize: '0.78rem' }}>Import &amp; Apply</button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {isExportModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(3px)' }}>
          <div style={{ background: 'var(--surface-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', padding: '1.5rem', width: '90%', maxWidth: '540px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Export authors.txt</h3>
            <textarea
              readOnly
              value={exportText}
              rows={8}
              style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', marginBottom: '1rem' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button onClick={() => navigator.clipboard.writeText(exportText)} className="btn btn-secondary" style={{ fontSize: '0.78rem' }}>Copy</button>
              <button onClick={() => setIsExportModalOpen(false)} className="btn btn-primary" style={{ fontSize: '0.78rem' }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

MappingsTab.propTypes = {
  mappings: PropTypes.array,
  catalog: PropTypes.array,
  selectedRepoId: PropTypes.number,
  onSelectRepo: PropTypes.func,
  onUpdateMapping: PropTypes.func,
  API_BASE: PropTypes.string
};
