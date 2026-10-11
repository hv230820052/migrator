import React from 'react';
import PropTypes from 'prop-types';
import { Network, Link2, Play, Search, FolderGit2, Server, Globe } from 'lucide-react';

export function SourcesTab({
  customVcsType,
  setCustomVcsType,
  customEndpoint,
  setCustomEndpoint,
  customCreds,
  setCustomCreds,
  customTargetOrg,
  setCustomTargetOrg,
  sourcesList,
  loadingAction,
  onConnectSource,
  onLaunchMigration,
  onRunDiscovery
}) {
  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Dynamic VCS Connection Card */}
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">
            <Globe style={{ width: '17px', height: '17px', color: 'var(--status-info)' }} />
            <span>Connect VCS Repository (Autonomous Ingestion)</span>
          </h2>
          <span className="badge badge-t2">Dynamic Introspection</span>
        </div>
        <p className="panel-description">
          Connect any legacy Subversion, Local Git, GitHub, or TFS repository. Agents will dynamically inspect revision logs, map authors, triage secrets, and verify migration parity.
        </p>

        {/* Quick Presets */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            PRESETS:
          </span>
          <button
            type="button"
            onClick={() => {
              setCustomVcsType('svn');
              setCustomEndpoint('https://svn.code.sf.net/p/demo-svn-repo/svn');
              setCustomCreds('abhaypundora17:i@mdeveloperpro');
            }}
            className="btn-chip"
          >
            <Server style={{ width: '12px', height: '12px' }} />
            <span>Remote SVN (SourceForge)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setCustomVcsType('svn');
              setCustomEndpoint('/app/data/messy-svn-repo');
              setCustomCreds('');
            }}
            className="btn-chip"
          >
            <FolderGit2 style={{ width: '12px', height: '12px' }} />
            <span>Local SVN Mirror</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setCustomVcsType('localgit');
              setCustomEndpoint('/app/samples/localgit/dirty-local');
              setCustomCreds('');
            }}
            className="btn-chip"
          >
            <FolderGit2 style={{ width: '12px', height: '12px' }} />
            <span>Local Git Mirror</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setCustomVcsType('tfs');
              setCustomEndpoint('/app/samples/tfs/tfs-sample');
              setCustomCreds('');
            }}
            className="btn-chip"
          >
            <Server style={{ width: '12px', height: '12px' }} />
            <span>TFS Sample Workspace</span>
          </button>
        </div>

        {/* Form Inputs Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <label className="form-label">VCS Source Type</label>
            <select
              value={customVcsType}
              onChange={(e) => setCustomVcsType(e.target.value)}
              className="form-select"
            >
              <option value="svn">Subversion (SVN - Remote or Local)</option>
              <option value="localgit">Local Git Mirror / Bare Repo</option>
              <option value="github">GitHub Organization</option>
              <option value="tfs">Team Foundation Server (TFS / TFVC)</option>
            </select>
          </div>

          <div>
            <label className="form-label">Repository Endpoint URL / Path</label>
            <input
              type="text"
              value={customEndpoint}
              onChange={(e) => setCustomEndpoint(e.target.value)}
              placeholder="e.g. https://svn.server.com/repo or file:///app/..."
              className="form-input font-mono"
            />
          </div>

          <div>
            <label className="form-label">Credentials (Optional)</label>
            <input
              type="password"
              value={customCreds}
              onChange={(e) => setCustomCreds(e.target.value)}
              placeholder="username:password or token"
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label">Target GitHub Organization</label>
            <input
              type="text"
              value={customTargetOrg}
              onChange={(e) => setCustomTargetOrg(e.target.value)}
              placeholder="e.g. octathon-target"
              className="form-input font-mono"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onConnectSource}
            className="btn btn-secondary"
            disabled={Boolean(loadingAction)}
          >
            <Link2 style={{ width: '14px', height: '14px' }} />
            <span>Validate & Connect Source</span>
          </button>
          <button
            type="button"
            onClick={() => onLaunchMigration()}
            className="btn btn-primary"
            disabled={Boolean(loadingAction)}
          >
            <Play style={{ width: '14px', height: '14px' }} />
            <span>Launch Autonomous AI Migration</span>
          </button>
        </div>
      </div>

      {/* Active Connected Sources Grid */}
      <div className="panel">
        <div className="panel-header">
          <h3 className="panel-title">
            <Network style={{ width: '16px', height: '16px' }} />
            <span>Active Connected VCS Sources</span>
          </h3>
          <span className="badge badge-t0">{sourcesList.length} Connected</span>
        </div>
        <p className="panel-description">
          Live repository connections registered with Provenance. Read-only verification ensures zero alteration to original source history.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
          {sourcesList.length > 0 ? (
            sourcesList.map((src) => (
              <div key={src.id} style={{
                padding: '1.35rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--surface-primary)',
                border: '1px solid var(--border-subtle)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                  <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    {src.type} Source #{src.id}
                  </strong>
                  <span className={`badge ${src.status === 'connected' ? 'badge-t0' : 'badge-t3'}`}>
                    {src.status || 'Connected'}
                  </span>
                </div>
                <div style={{
                  fontSize: '0.82rem',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  fontFamily: 'var(--font-mono)',
                  marginBottom: '0.75rem',
                  wordBreak: 'break-all'
                }}>
                  {src.endpoint}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                  Scope: {src.readable_scope || 'Read-only verified'}
                </div>
              </div>
            ))
          ) : (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-tertiary)', gridColumn: '1 / -1', fontSize: '0.84rem' }}>
              No custom sources registered yet. Connect a repository above or trigger discovery.
            </div>
          )}
        </div>

        <div style={{ marginTop: '1.75rem' }}>
          <button
            id="btn-discover"
            type="button"
            onClick={onRunDiscovery}
            className="btn btn-secondary"
            disabled={Boolean(loadingAction)}
          >
            <Search style={{ width: '13px', height: '13px' }} />
            <span>Run Scout Discovery</span>
          </button>
        </div>
      </div>
    </div>
  );
}

SourcesTab.propTypes = {
  customVcsType: PropTypes.string.isRequired,
  setCustomVcsType: PropTypes.func.isRequired,
  customEndpoint: PropTypes.string.isRequired,
  setCustomEndpoint: PropTypes.func.isRequired,
  customCreds: PropTypes.string.isRequired,
  setCustomCreds: PropTypes.func.isRequired,
  customTargetOrg: PropTypes.string.isRequired,
  setCustomTargetOrg: PropTypes.func.isRequired,
  sourcesList: PropTypes.array.isRequired,
  loadingAction: PropTypes.string,
  onConnectSource: PropTypes.func.isRequired,
  onLaunchMigration: PropTypes.func.isRequired,
  onRunDiscovery: PropTypes.func.isRequired
};
