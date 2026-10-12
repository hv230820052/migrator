import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
  Network,
  Database,
  ShieldAlert,
  Cpu,
  Users,
  Lock,
  Terminal,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCw,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Download,
  Copy,
  Check,
  Server,
  Layers,
  ChevronRight,
  AlertTriangle,
  GitBranch,
  GitCommit,
  Clock,
  Search,
  FolderGit2
} from 'lucide-react';

const VCS_PRESETS = [
  {
    id: 'svn-remote',
    name: 'Remote SVN (Live Demo)',
    type: 'svn',
    endpoint: 'https://svn.code.sf.net/p/demo-svn-repo/svn',
    creds: '',
    desc: 'Live SourceForge Subversion repository with branches & revisions'
  },
  {
    id: 'local-git',
    name: 'Local Git Sample',
    type: 'localgit',
    endpoint: 'localgit',
    creds: '',
    desc: 'Local Git repository cluster with full commit tree'
  },
  {
    id: 'github-org',
    name: 'GitHub Org',
    type: 'github',
    endpoint: 'octocat',
    creds: '',
    desc: 'Public / Private GitHub organization via REST API'
  },
  {
    id: 'gitlab-remote',
    name: 'GitLab Remote',
    type: 'gitlab',
    endpoint: 'https://gitlab.com/gitlab-tests/sample-project.git',
    creds: '',
    desc: 'Remote GitLab project via git ls-remote verification'
  },
  {
    id: 'tfs-sample',
    name: 'TFS TFVC Sample',
    type: 'tfs',
    endpoint: 'tfs/tfs-sample.json',
    creds: '',
    desc: 'TFVC changeset repository sample catalog'
  }
];

const TIMELINE_STAGES = [
  { id: 'scout', number: 1, title: 'Scout Discovery', subtitle: 'Structure & Scopes', icon: Network },
  { id: 'curator', number: 2, title: 'Secret & Binaries', subtitle: 'NFR-09 Redaction', icon: ShieldAlert },
  { id: 'assessor', number: 3, title: 'Risk & Pre-Flight', subtitle: 'AI Complexity Tier', icon: Cpu },
  { id: 'cartographer', number: 4, title: 'Identity Mapping', subtitle: 'Authors to GitHub', icon: Users },
  { id: 'gates', number: 5, title: 'Governance Gates', subtitle: 'Hard Policy Checks', icon: Lock },
  { id: 'executor', number: 6, title: 'Migration Push', subtitle: 'LFS & Self-Heal', icon: Terminal },
  { id: 'prover', number: 7, title: 'Parity Proof', subtitle: 'Sealed Certificate', icon: FileCheck },
];

export function MigrationTimelineTab({
  catalog,
  selectedRepoId,
  onSelectRepo,
  customVcsType,
  setCustomVcsType,
  customEndpoint,
  setCustomEndpoint,
  customCreds,
  setCustomCreds,
  customTargetOrg,
  setCustomTargetOrg,
  loadingAction,
  stageStatuses,
  activeInspectorStage,
  setActiveInspectorStage,
  connectionReport,
  isAutoRunning,
  onConnectAndDiscover,
  onRunCurator,
  onRunAssessor,
  onRunCartographer,
  onRunGates,
  onRunExecutor,
  onRunProver,
  onRunFullPipeline,
  findings,
  mappings,
  gates,
  events,
  fidelity,
  certificate,
  insights,
  onUpdateMapping,
  onApproveGate,
  onDownloadCertificate,
  copyFeedback,
  onCopyText,
  accountRepos = [],
  setAccountRepos,
  isFetchingAccountRepos = false,
  onFetchAccountRepos,
  pipelineElapsedSeconds = 0,
  pipelineLiveStep = '',
  API_BASE
}) {
  const [showCreds, setShowCreds] = useState(false);
  const [editingMapping, setEditingMapping] = useState(null);
  const [editLogin, setEditLogin] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [eventFilter, setEventFilter] = useState('ALL');

  // Dedicated SVN credential inputs for effortless credential-only flow
  const initialUser = customCreds && customCreds.includes(':') ? customCreds.split(':')[0] : (customCreds || '');
  const initialPass = customCreds && customCreds.includes(':') ? customCreds.split(':')[1] : '';
  const [svnUsername, setSvnUsername] = useState(initialUser);
  const [svnPassword, setSvnPassword] = useState(initialPass);
  const [svnProvider, setSvnProvider] = useState('sourceforge');
  const [customSvnServerUrl, setCustomSvnServerUrl] = useState('');
  const [showManualEndpoint, setShowManualEndpoint] = useState(false);
  const [hasFetchedRepos, setHasFetchedRepos] = useState(false);

  const selectedRepo = catalog.find((r) => r.id === selectedRepoId) || catalog[0] || null;

  const handleUpdateSvnCreds = (newU, newP) => {
    setSvnUsername(newU);
    setSvnPassword(newP);
    setCustomCreds(`${newU}:${newP}`);
  };

  const handleFetchAccountReposClick = async () => {
    setHasFetchedRepos(true);
    if (onFetchAccountRepos) {
      const u = svnUsername || (customCreds.includes(':') ? customCreds.split(':')[0] : customCreds);
      const p = svnPassword || (customCreds.includes(':') ? customCreds.split(':')[1] : '');
      await onFetchAccountRepos(customVcsType, u, p, customCreds, svnProvider === 'custom' ? customSvnServerUrl : '');
    }
  };

  const handleSelectAccountRepo = async (ar) => {
    setCustomEndpoint(ar.endpoint);
    const creds = `${svnUsername}:${svnPassword}`;
    setCustomCreds(creds);
    if (onConnectAndDiscover) {
      await onConnectAndDiscover(ar.source_type || customVcsType, ar.endpoint, creds, customTargetOrg);
    }
  };

  const handleApplyPreset = (preset) => {
    setCustomVcsType(preset.type);
    setCustomEndpoint(preset.endpoint);
    setCustomCreds(preset.creds);
    if (preset.creds.includes(':')) {
      const parts = preset.creds.split(':');
      setSvnUsername(parts[0]);
      setSvnPassword(parts[1] || '');
    }
  };

  const formatStopwatch = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}s`;
  };

  const calcProgressPct = () => {
    const stageIds = ['scout', 'curator', 'assessor', 'cartographer', 'gates', 'executor', 'prover'];
    let completedCount = 0;
    stageIds.forEach((id) => {
      if (stageStatuses[id] === 'completed') completedCount += 1;
      else if (stageStatuses[id] === 'running') completedCount += 0.5;
    });
    return Math.min(100, Math.round((completedCount / stageIds.length) * 100));
  };

  const handleStartEditing = (mapItem) => {
    setEditingMapping(mapItem.legacy_id);
    setEditLogin(mapItem.proposed_login || '');
    setEditEmail(mapItem.proposed_email || '');
  };

  const handleSaveMapping = async (repoId, legacyId) => {
    if (onUpdateMapping) {
      await onUpdateMapping(repoId, legacyId, editLogin, editEmail);
    }
    setEditingMapping(null);
  };

  const filteredEvents = events.filter((ev) => {
    if (eventFilter === 'ALL') return true;
    return ev.agent && ev.agent.toLowerCase().includes(eventFilter.toLowerCase());
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Hero Header */}
      <div className="panel" style={{ padding: '2rem 2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Live Migration Hub & Interactive Timeline
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '0.35rem', maxWidth: '780px' }}>
              Connect directly to your Version Control System (SVN, GitHub, GitLab, Bitbucket, Git, TFS), discover real repositories, select your target, and watch the autonomous migration pipeline advance live across all 7 verification stages.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              onClick={() => onRunFullPipeline(selectedRepo?.id)}
              disabled={!selectedRepo || isAutoRunning || !!loadingAction}
              className="btn btn-primary"
              style={{ padding: '0.7rem 1.4rem', fontSize: '0.88rem' }}
            >
              <Play style={{ width: '15px', height: '15px' }} />
              <span>{isAutoRunning ? 'Pipeline Running...' : 'Auto-Run Full Pipeline'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 1: Connect VCS Source & Discover Repositories */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">
            <Network style={{ width: '18px', height: '18px' }} />
            <span>Step 1: Select VCS & Credentials (Dynamic Connector)</span>
          </div>
          <span className="badge badge-t0">READ-ONLY AUDIT CONNECTOR</span>
        </div>
        <p className="panel-description">
          Provide your VCS endpoint and credentials below. The platform connects directly using read-only connectors, validates access scope, and indexes all available repositories dynamically.
        </p>

        {/* Quick Presets Bar */}
        <div style={{ marginBottom: '1.5rem', background: 'var(--canvas-bg)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.65rem' }}>
            Quick-Select Tested Presets:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
            {VCS_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleApplyPreset(preset)}
                className="btn-chip"
                style={{
                  border: customVcsType === preset.type && customEndpoint === preset.endpoint ? '1px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                  background: customVcsType === preset.type && customEndpoint === preset.endpoint ? 'var(--surface-secondary)' : 'var(--surface-primary)',
                  fontWeight: customVcsType === preset.type && customEndpoint === preset.endpoint ? 600 : 500
                }}
              >
                <span>{preset.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Credentials & Account Discovery Form */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
              VCS Provider Type
            </label>
            <select
              value={customVcsType}
              onChange={(e) => setCustomVcsType(e.target.value)}
              style={{
                width: '100%',
                padding: '0.6rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                background: 'var(--surface-primary)',
                fontFamily: 'var(--font-sans)',
                fontSize: '0.85rem',
                color: 'var(--text-primary)'
              }}
            >
              <option value="svn">Subversion (SVN Account Discovery)</option>
              <option value="github">GitHub (Cloud Organization or User)</option>
              <option value="gitlab">GitLab (Cloud or Self-Hosted Projects)</option>
              <option value="bitbucket">Bitbucket (Repositories in Workspace)</option>
              <option value="localgit">Local Git (Filesystem Directory)</option>
              <option value="tfs">Team Foundation Server (TFVC Changeset)</option>
            </select>
          </div>

          {customVcsType === 'svn' ? (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  SVN Username
                </label>
                <input
                  type="text"
                  value={svnUsername}
                  onChange={(e) => handleUpdateSvnCreds(e.target.value, svnPassword)}
                  placeholder="Enter SVN username"
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--surface-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.83rem',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  SVN Password / Auth Token
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showCreds ? 'text' : 'password'}
                    value={svnPassword}
                    onChange={(e) => handleUpdateSvnCreds(svnUsername, e.target.value)}
                    placeholder="Enter SVN password or token"
                    style={{
                      width: '100%',
                      padding: '0.6rem 2.5rem 0.6rem 0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--surface-primary)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.83rem',
                      color: 'var(--text-primary)'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreds(!showCreds)}
                    style={{
                      position: 'absolute',
                      right: '0.6rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-tertiary)'
                    }}
                  >
                    {showCreds ? <EyeOff style={{ width: '15px', height: '15px' }} /> : <Eye style={{ width: '15px', height: '15px' }} />}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  SVN Platform / Host
                </label>
                <select
                  value={svnProvider}
                  onChange={(e) => setSvnProvider(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--surface-primary)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '0.85rem',
                    color: 'var(--text-primary)'
                  }}
                >
                  <option value="sourceforge">SourceForge (sourceforge.net)</option>
                  <option value="custom">Self-Hosted / Custom SVN Server</option>
                </select>
              </div>

              {svnProvider === 'custom' && (
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                    Custom SVN Server URL
                  </label>
                  <input
                    type="text"
                    value={customSvnServerUrl}
                    onChange={(e) => setCustomSvnServerUrl(e.target.value)}
                    placeholder="https://svn.mycompany.com/svn"
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--surface-primary)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.83rem',
                      color: 'var(--text-primary)'
                    }}
                  />
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  Account / Organization / Path
                </label>
                <input
                  type="text"
                  value={customEndpoint}
                  onChange={(e) => setCustomEndpoint(e.target.value)}
                  placeholder="e.g. octocat or /app/samples/localgit"
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--surface-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.83rem',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  Personal Access Token / Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showCreds ? 'text' : 'password'}
                    value={customCreds}
                    onChange={(e) => setCustomCreds(e.target.value)}
                    placeholder="ghp_pat or glpat-..."
                    style={{
                      width: '100%',
                      padding: '0.6rem 2.5rem 0.6rem 0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--surface-primary)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.83rem',
                      color: 'var(--text-primary)'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreds(!showCreds)}
                    style={{
                      position: 'absolute',
                      right: '0.6rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-tertiary)'
                    }}
                  >
                    {showCreds ? <EyeOff style={{ width: '15px', height: '15px' }} /> : <Eye style={{ width: '15px', height: '15px' }} />}
                  </button>
                </div>
              </div>
            </>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
              Target GitHub Organization
            </label>
            <input
              type="text"
              value={customTargetOrg}
              onChange={(e) => setCustomTargetOrg(e.target.value)}
              placeholder="e.g. octathon-target"
              style={{
                width: '100%',
                padding: '0.6rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                background: 'var(--surface-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.83rem',
                color: 'var(--text-primary)'
              }}
            />
          </div>
        </div>

        {/* Manual URL entry toggle (for power users) */}
        {showManualEndpoint && (
          <div style={{ marginBottom: '1.25rem', padding: '1rem', background: 'var(--canvas-bg)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-subtle)' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
              Direct Repository Endpoint URL (Manual Override)
            </label>
            <input
              type="text"
              value={customEndpoint}
              onChange={(e) => setCustomEndpoint(e.target.value)}
              placeholder="e.g. https://svn.code.sf.net/p/demo-svn-repo/svn"
              style={{
                width: '100%',
                padding: '0.6rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                background: 'var(--surface-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.83rem',
                color: 'var(--text-primary)'
              }}
            />
          </div>
        )}

        {/* Action Buttons & Connection Feedback */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              onClick={handleFetchAccountReposClick}
              disabled={isFetchingAccountRepos || (customVcsType === 'svn' && !svnUsername)}
              className="btn btn-primary"
              style={{ padding: '0.65rem 1.4rem' }}
            >
              {isFetchingAccountRepos ? (
                <RotateCw style={{ width: '15px', height: '15px', animation: 'spin 1s linear infinite' }} />
              ) : (
                <Search style={{ width: '15px', height: '15px' }} />
              )}
              <span>{isFetchingAccountRepos ? 'Discovering Account Repositories...' : '🔍 Fetch Repositories in My Account'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowManualEndpoint(!showManualEndpoint)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                fontSize: '0.8rem',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              {showManualEndpoint ? '▲ Hide manual direct URL input' : '▼ Or enter manual repository URL'}
            </button>
          </div>

          {connectionReport && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.82rem' }}>
              {connectionReport.status === 'connected' ? (
                <span className="badge badge-connected" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <CheckCircle2 style={{ width: '13px', height: '13px' }} />
                  <span>CONNECTED: {connectionReport.readable_scope}</span>
                </span>
              ) : (
                <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <AlertCircle style={{ width: '13px', height: '13px' }} />
                  <span>FAILED: {connectionReport.issues?.[0] || 'Check credentials'}</span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Discovered Account Repositories Cards Showcase */}
        {isFetchingAccountRepos && (
          <div style={{ marginTop: '1.25rem', padding: '1.25rem', background: 'var(--surface-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <RotateCw className="animate-spin" style={{ width: '20px', height: '20px', color: 'var(--brand-primary)' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                Querying {customVcsType.toUpperCase()} Account for Repositories...
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Contacting account API for user &quot;{svnUsername || customCreds}&quot;, inspecting project tools, and indexing repository mount points.
              </div>
            </div>
          </div>
        )}

        {accountRepos && accountRepos.length > 0 && (
          <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FolderGit2 style={{ width: '18px', height: '18px', color: 'var(--brand-primary)' }} />
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                  Discovered Repositories in Account &quot;{svnUsername || customCreds}&quot; ({accountRepos.length})
                </span>
              </div>
              <span className="badge badge-connected" style={{ fontSize: '0.72rem' }}>
                1-CLICK MIGRATION TARGETING
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '1rem' }}>
              {accountRepos.map((ar, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '1.1rem',
                    borderRadius: 'var(--radius-md)',
                    border: customEndpoint === ar.endpoint ? '2px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                    background: customEndpoint === ar.endpoint ? 'var(--surface-secondary)' : 'var(--surface-primary)',
                    boxShadow: customEndpoint === ar.endpoint ? '0 0 0 1px var(--brand-primary)' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                        {ar.display_name || ar.name}
                      </div>
                      <span className="badge badge-t0" style={{ fontSize: '0.65rem' }}>
                        {ar.provider || 'SVN'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                      {ar.description || 'Subversion repository mount'}
                    </div>
                    <div style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', background: 'var(--canvas-bg)', padding: '0.35rem 0.5rem', borderRadius: '4px', wordBreak: 'break-all', marginBottom: '0.85rem' }}>
                      {ar.endpoint}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSelectAccountRepo(ar)}
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '0.55rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                  >
                    <Play style={{ width: '13px', height: '13px' }} />
                    <span>Select &amp; Migrate This Repository</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {hasFetchedRepos && !isFetchingAccountRepos && (!accountRepos || accountRepos.length === 0) && (
          <div style={{ marginTop: '1.25rem', padding: '1rem', background: 'var(--canvas-bg)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-subtle)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              No repositories found for account &quot;{svnUsername || customCreds}&quot;.
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
              Verify your username/password credentials or enter a direct repository URL manually.
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: Discovered Repositories Selection */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">
            <Database style={{ width: '18px', height: '18px' }} />
            <span>Step 2: Select Repository to Migrate ({catalog.length} Real Repos Discovered)</span>
          </div>
          <span className="badge badge-t0">INDEPENDENT REPOSITORY TARGETING</span>
        </div>
        <p className="panel-description">
          Select which repository you wish to migrate through the live timeline. Each repository runs through dedicated curation, assessment, mapping, and execution.
        </p>

        {catalog.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem', background: 'var(--canvas-bg)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-subtle)' }}>
            <Server style={{ width: '32px', height: '32px', color: 'var(--text-tertiary)', margin: '0 auto 0.75rem' }} />
            <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>No Repositories Discovered Yet</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
              Click <strong>&quot;Connect &amp; Discover Repositories&quot;</strong> above to scan your VCS and list real repositories.
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            {catalog.map((repo) => {
              const isSelected = selectedRepo?.id === repo.id;
              return (
                <div
                  key={repo.id}
                  onClick={() => onSelectRepo(repo.id)}
                  style={{
                    padding: '1.25rem',
                    borderRadius: 'var(--radius-md)',
                    border: isSelected ? '2px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                    background: isSelected ? 'var(--surface-primary)' : 'var(--surface-primary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: isSelected ? '0 0 0 1px var(--brand-primary)' : 'none',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.98rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <Database style={{ width: '15px', height: '15px', color: 'var(--text-tertiary)' }} />
                        <span>{repo.name}</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.15rem' }}>
                        Source: {repo.source_type?.toUpperCase() || 'VCS'}
                      </div>
                    </div>
                    {isSelected ? (
                      <span className="badge badge-connected" style={{ fontSize: '0.68rem', padding: '0.18rem 0.5rem' }}>
                        ACTIVE TARGET
                      </span>
                    ) : (
                      <span className="badge badge-t0" style={{ fontSize: '0.68rem', padding: '0.18rem 0.5rem' }}>
                        SELECT
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.85rem' }}>
                    <div>Commits: <strong>{repo.commit_count || 0}</strong></div>
                    <div>Branches: <strong>{repo.branch_count || 1}</strong></div>
                    <div>Tags: <strong>{repo.tag_count || 0}</strong></div>
                    <div>Size: <strong>{repo.size ? `${(repo.size / (1024 * 1024)).toFixed(1)} MB` : '1.0 MB'}</strong></div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.65rem' }}>
                    <span className={`badge ${repo.risk_tier === 'HIGH' ? 'badge-danger' : repo.risk_tier === 'MEDIUM' ? 'badge-t3' : 'badge-connected'}`}>
                      RISK: {repo.risk_tier || 'LOW'}
                    </span>
                    {repo.large_file_flag && (
                      <span className="badge badge-danger" style={{ fontSize: '0.68rem' }}>
                        &gt;100MB LFS
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Selected Repo Focus Banner */}
        {selectedRepo && (
          <div style={{ background: 'var(--surface-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '0.9rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--status-success)' }} />
              <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                Targeting Repository: <strong style={{ color: 'var(--brand-primary)' }}>{selectedRepo.name}</strong> ➔ Target GitHub Destination: <strong style={{ fontFamily: 'var(--font-mono)' }}>{customTargetOrg}/{selectedRepo.name}</strong>
              </div>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
              Effort Estimate: {selectedRepo.effort_estimate || '1-2 days'}
            </div>
          </div>
        )}
      </div>

      {/* SECTION 3: The Live Migration Timeline Stepper */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">
            <Layers style={{ width: '18px', height: '18px' }} />
            <span>Step 3: Live Verification &amp; Migration Timeline</span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              onClick={() => onRunFullPipeline(selectedRepo?.id)}
              disabled={!selectedRepo || isAutoRunning || !!loadingAction}
              className="btn btn-primary"
              style={{ padding: '0.45rem 0.95rem', fontSize: '0.78rem' }}
            >
              <Play style={{ width: '13px', height: '13px' }} />
              <span>Auto-Run Pipeline</span>
            </button>
          </div>
        </div>
        <p className="panel-description">
          Click on any milestone below to inspect its detailed live findings, author overrides, governance checks, or parity proof in real time.
        </p>

        {/* Dynamic Pipeline Running Animation & Telemetry HUD */}
        {(isAutoRunning || !!loadingAction || Object.values(stageStatuses).includes('running')) && (
          <div
            style={{
              marginBottom: '1.5rem',
              padding: '1.25rem 1.5rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid #38bdf8',
              background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
              boxShadow: '0 4px 16px rgba(2, 132, 199, 0.12)'
            }}
          >
            {/* Top row: Status radar, active stage title, and live stopwatch timer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.9rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span className="radar-ping" style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#0284c7' }} />
                <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0369a1', letterSpacing: '0.04em' }}>
                  PIPELINE ACTIVELY EXECUTING
                </span>
                <span className="badge badge-t2" style={{ fontSize: '0.7rem' }}>
                  AUTONOMOUS VERIFICATION
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.82rem', fontWeight: 600, color: '#0369a1' }}>
                  <Clock style={{ width: '15px', height: '15px', animation: 'spin 3s linear infinite' }} />
                  <span>Elapsed: <strong>{formatStopwatch(pipelineElapsedSeconds)}</strong></span>
                </div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0284c7' }}>
                  {calcProgressPct()}% COMPLETE
                </div>
              </div>
            </div>

            {/* Candy-Stripe Animated Progress Track */}
            <div
              style={{
                width: '100%',
                height: '8px',
                borderRadius: '4px',
                background: '#cbd5e1',
                overflow: 'hidden',
                marginBottom: '1rem',
                position: 'relative'
              }}
            >
              <div
                className="pipeline-progress-bar"
                style={{
                  height: '100%',
                  width: `${Math.max(12, calcProgressPct())}%`,
                  background: 'linear-gradient(90deg, #0284c7 0%, #38bdf8 100%)',
                  borderRadius: '4px',
                  transition: 'width 0.4s ease'
                }}
              />
            </div>

            {/* Real-time Ticker & Micro-Task Console */}
            <div
              style={{
                background: '#0f172a',
                color: '#f8fafc',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8rem',
                border: '1px solid #1e293b'
              }}
            >
              <Terminal style={{ width: '15px', height: '15px', color: '#38bdf8', flexShrink: 0 }} />
              <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <span style={{ color: '#38bdf8', fontWeight: 600 }}>[STREAM]</span>{' '}
                <span className="shimmer-active-stage" style={{ fontWeight: 600 }}>
                  {pipelineLiveStep || 'Autonomous pipeline orchestrator running stage verification...'}
                </span>
                <span className="terminal-caret" />
              </div>
              <span style={{ fontSize: '0.7rem', color: '#94a3b8', flexShrink: 0 }}>
                NON-BLOCKING ENGINE
              </span>
            </div>
          </div>
        )}

        {/* Horizontal Milestone Stepper */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.65rem', marginBottom: '1.75rem', overflowX: 'auto' }}>
          {TIMELINE_STAGES.map((stage) => {
            const Icon = stage.icon;
            const status = stageStatuses[stage.id] || 'pending';
            const isInspecting = activeInspectorStage === stage.id;
            const isRunning = status === 'running';

            let statusBg = 'var(--surface-primary)';
            let statusColor = 'var(--text-secondary)';
            let borderColor = 'var(--border-subtle)';

            if (status === 'completed') {
              statusBg = '#f0fdf4';
              statusColor = '#166534';
              borderColor = '#bbf7d0';
            } else if (isRunning) {
              statusBg = '#f0f9ff';
              statusColor = '#0369a1';
              borderColor = '#0284c7';
            } else if (status === 'failed') {
              statusBg = '#fff1f2';
              statusColor = '#9f1239';
              borderColor = '#fecdd3';
            }

            return (
              <div
                key={stage.id}
                onClick={() => setActiveInspectorStage(stage.id)}
                className={isRunning ? 'timeline-node-running' : ''}
                style={{
                  padding: '1rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  border: isInspecting ? '2px solid var(--brand-primary)' : `1px solid ${borderColor}`,
                  background: statusBg,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  gap: '0.45rem',
                  minWidth: '120px'
                }}
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: isInspecting ? 'var(--brand-primary)' : isRunning ? '#e0f2fe' : 'var(--surface-primary)',
                  color: isInspecting ? '#ffffff' : statusColor,
                  border: isRunning ? '1px solid #38bdf8' : '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {status === 'completed' ? (
                    <CheckCircle2 style={{ width: '16px', height: '16px', color: '#166534' }} />
                  ) : isRunning ? (
                    <RotateCw style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite', color: '#0284c7' }} />
                  ) : (
                    <Icon style={{ width: '16px', height: '16px' }} />
                  )}
                </div>

                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {stage.number}. {stage.title}
                </div>

                <span
                  className={`badge ${
                    status === 'completed' ? 'badge-connected' : isRunning ? 'badge-t2' : status === 'failed' ? 'badge-danger' : 'badge-t0'
                  }`}
                  style={{ fontSize: '0.62rem', padding: '0.15rem 0.45rem' }}
                >
                  {isRunning ? 'RUNNING NOW' : status.toUpperCase()}
                </span>
              </div>
            );
          })}
        </div>

        {/* Action Controls for Current Stage */}
        <div style={{ background: 'var(--canvas-bg)', padding: '0.9rem 1.25rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.75rem' }}>
          <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
            Current Inspector View: <strong style={{ color: 'var(--text-primary)' }}>{TIMELINE_STAGES.find(s => s.id === activeInspectorStage)?.title}</strong>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            {activeInspectorStage === 'curator' && (
              <button onClick={() => onRunCurator(selectedRepo?.id)} disabled={!selectedRepo || !!loadingAction} className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '0.4rem 0.85rem' }}>
                <ShieldAlert style={{ width: '13px', height: '13px' }} />
                <span>Run Curator Secret Scan</span>
              </button>
            )}
            {activeInspectorStage === 'assessor' && (
              <button onClick={() => onRunAssessor(selectedRepo?.id)} disabled={!selectedRepo || !!loadingAction} className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '0.4rem 0.85rem' }}>
                <Cpu style={{ width: '13px', height: '13px' }} />
                <span>Recalculate Risk &amp; Pre-Flight</span>
              </button>
            )}
            {activeInspectorStage === 'cartographer' && (
              <button onClick={() => onRunCartographer(selectedRepo?.id)} disabled={!selectedRepo || !!loadingAction} className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '0.4rem 0.85rem' }}>
                <Users style={{ width: '13px', height: '13px' }} />
                <span>Refresh Identity Mappings</span>
              </button>
            )}
            {activeInspectorStage === 'gates' && (
              <button onClick={() => onRunGates()} disabled={!selectedRepo || !!loadingAction} className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '0.4rem 0.85rem' }}>
                <Lock style={{ width: '13px', height: '13px' }} />
                <span>Approve All Governance Gates</span>
              </button>
            )}
            {activeInspectorStage === 'executor' && (
              <button onClick={() => onRunExecutor(selectedRepo?.id)} disabled={!selectedRepo || !!loadingAction} className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '0.4rem 0.85rem' }}>
                <Terminal style={{ width: '13px', height: '13px' }} />
                <span>Trigger Migration Push</span>
              </button>
            )}
            {activeInspectorStage === 'prover' && (
              <button onClick={() => onRunProver()} disabled={!selectedRepo || !!loadingAction} className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '0.4rem 0.85rem' }}>
                <FileCheck style={{ width: '13px', height: '13px' }} />
                <span>Verify Parity &amp; Certificate</span>
              </button>
            )}
          </div>
        </div>

        {/* Two-Column Split Layout: Stage Inspector (60%) + Live WebSocket Feed (40%) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
          {/* LEFT: Detailed Stage Inspector */}
          <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', background: 'var(--surface-primary)', padding: '1.5rem' }}>
            {/* 1. Scout Inspector */}
            {activeInspectorStage === 'scout' && (
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Network style={{ width: '16px', height: '16px' }} />
                  <span>Stage 1: Scout Source Discovery Inspector</span>
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', marginBottom: '1.25rem' }}>
                  Read-only metadata discovery completed with zero source pollution.
                </p>

                {selectedRepo ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
                    <div style={{ padding: '0.9rem', background: 'var(--canvas-bg)', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Repository Name</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>{selectedRepo.name}</div>
                    </div>
                    <div style={{ padding: '0.9rem', background: 'var(--canvas-bg)', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Source Type</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>{selectedRepo.source_type?.toUpperCase()}</div>
                    </div>
                    <div style={{ padding: '0.9rem', background: 'var(--canvas-bg)', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Total Commits</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>{selectedRepo.commit_count}</div>
                    </div>
                    <div style={{ padding: '0.9rem', background: 'var(--canvas-bg)', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Branches &amp; Tags</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>{selectedRepo.branch_count} branches · {selectedRepo.tag_count} tags</div>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>No repository currently selected.</div>
                )}
              </div>
            )}

            {/* 2. Curator Inspector */}
            {activeInspectorStage === 'curator' && (
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ShieldAlert style={{ width: '16px', height: '16px' }} />
                  <span>Stage 2: Curator Security &amp; Secrets Inspector (NFR-09)</span>
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', marginBottom: '1.25rem' }}>
                  Full-history scan for AWS keys, GitHub PATs, database credentials, and &gt;100MB files with strict redaction law.
                </p>

                {findings.length === 0 ? (
                  <div style={{ padding: '1.5rem', background: '#f0fdf4', borderRadius: 'var(--radius-sm)', border: '1px solid #bbf7d0', color: '#166534', fontSize: '0.85rem' }}>
                    <CheckCircle2 style={{ width: '16px', height: '16px', display: 'inline', marginRight: '0.5rem' }} />
                    Zero plain-text secrets detected in current scan. Clean bill of health.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-tertiary)' }}>
                          <th style={{ padding: '0.5rem' }}>Severity</th>
                          <th style={{ padding: '0.5rem' }}>Type</th>
                          <th style={{ padding: '0.5rem' }}>Redacted Fingerprint</th>
                          <th style={{ padding: '0.5rem' }}>Location</th>
                          <th style={{ padding: '0.5rem' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {findings.map((f) => (
                          <tr key={f.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '0.5rem' }}>
                              <span className={`badge ${f.severity === 'CRITICAL' || f.severity === 'HIGH' ? 'badge-danger' : 'badge-t3'}`}>
                                {f.severity}
                              </span>
                            </td>
                            <td style={{ padding: '0.5rem', fontWeight: 600 }}>{f.type}</td>
                            <td style={{ padding: '0.5rem', fontFamily: 'var(--font-mono)' }}>{f.fingerprint}</td>
                            <td style={{ padding: '0.5rem', color: 'var(--text-tertiary)' }}>{f.location}</td>
                            <td style={{ padding: '0.5rem' }}>
                              <span className="badge badge-t0">{f.status || 'redacted'}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* 3. Assessor Inspector */}
            {activeInspectorStage === 'assessor' && (
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Cpu style={{ width: '16px', height: '16px' }} />
                  <span>Stage 3: Assessor Risk Scoring &amp; AI Pre-Flight</span>
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', marginBottom: '1.25rem' }}>
                  Deterministic weighted risk formula (size, staleness, secrets, large files) and synthetic AI guidance.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.85rem', marginBottom: '1.25rem' }}>
                  <div style={{ padding: '1rem', background: 'var(--canvas-bg)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>Calculated Risk Tier</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '0.2rem', color: selectedRepo?.risk_tier === 'HIGH' ? 'var(--status-danger)' : 'var(--status-success)' }}>
                      {selectedRepo?.risk_tier || 'LOW'}
                    </div>
                  </div>
                  <div style={{ padding: '1rem', background: 'var(--canvas-bg)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>Estimated Duration</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '0.2rem', color: 'var(--text-primary)' }}>
                      {selectedRepo?.effort_estimate || '1-2 days'}
                    </div>
                  </div>
                  <div style={{ padding: '1rem', background: 'var(--canvas-bg)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>Large File Flag</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '0.2rem', color: selectedRepo?.large_file_flag ? 'var(--status-danger)' : 'var(--text-secondary)' }}>
                      {selectedRepo?.large_file_flag ? 'YES (>100MB)' : 'NONE'}
                    </div>
                  </div>
                </div>

                {insights && (
                  <div style={{ background: 'var(--surface-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '1rem' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Sparkles style={{ width: '14px', height: '14px' }} />
                      <span>AI Pre-Flight Recommendation</span>
                    </div>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {insights.ai_recommendations || 'Deterministic assessment complete. Topology clean for autonomous cutover.'}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* 4. Cartographer Inspector */}
            {activeInspectorStage === 'cartographer' && (
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Users style={{ width: '16px', height: '16px' }} />
                  <span>Stage 4: Cartographer Identity Mapping (Inline Overrides)</span>
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', marginBottom: '1.25rem' }}>
                  Commit author identities mapped via T0 exact directory match. Edit any row to save a human override directly.
                </p>

                {mappings.length === 0 ? (
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>No authors indexed for this repository yet.</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-tertiary)' }}>
                          <th style={{ padding: '0.5rem' }}>Legacy ID</th>
                          <th style={{ padding: '0.5rem' }}>Proposed GitHub User</th>
                          <th style={{ padding: '0.5rem' }}>Proposed Email</th>
                          <th style={{ padding: '0.5rem' }}>Confidence</th>
                          <th style={{ padding: '0.5rem' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mappings.map((m) => {
                          const isEditing = editingMapping === m.legacy_id;
                          return (
                            <tr key={m.legacy_id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              <td style={{ padding: '0.5rem', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{m.legacy_id}</td>
                              <td style={{ padding: '0.5rem' }}>
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={editLogin}
                                    onChange={(e) => setEditLogin(e.target.value)}
                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.78rem', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}
                                  />
                                ) : (
                                  <span style={{ fontFamily: 'var(--font-mono)' }}>@{m.proposed_login}</span>
                                )}
                              </td>
                              <td style={{ padding: '0.5rem' }}>
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={editEmail}
                                    onChange={(e) => setEditEmail(e.target.value)}
                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.78rem', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}
                                  />
                                ) : (
                                  <span style={{ color: 'var(--text-secondary)' }}>{m.proposed_email}</span>
                                )}
                              </td>
                              <td style={{ padding: '0.5rem' }}>
                                <span className="badge badge-connected">{Math.round((m.confidence || 1) * 100)}%</span>
                              </td>
                              <td style={{ padding: '0.5rem' }}>
                                {isEditing ? (
                                  <button
                                    onClick={() => handleSaveMapping(selectedRepo?.id, m.legacy_id)}
                                    className="btn btn-primary"
                                    style={{ padding: '0.25rem 0.6rem', fontSize: '0.72rem' }}
                                  >
                                    Save Override
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleStartEditing(m)}
                                    className="btn btn-secondary"
                                    style={{ padding: '0.25rem 0.6rem', fontSize: '0.72rem' }}
                                  >
                                    Edit
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* 5. Gates Inspector */}
            {activeInspectorStage === 'gates' && (
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Lock style={{ width: '16px', height: '16px' }} />
                  <span>Stage 5: Governance Hard Approval Gates (T3 Human In The Loop)</span>
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', marginBottom: '1.25rem' }}>
                  Mandatory sign-off gates. Migration push cannot occur until all 4 governance gates are verified.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                  {gates.map((g) => {
                    const isApproved = g.status === 'approved';
                    return (
                      <div
                        key={g.name}
                        style={{
                          padding: '1rem',
                          borderRadius: 'var(--radius-sm)',
                          border: isApproved ? '1px solid #bbf7d0' : '1px solid var(--border-subtle)',
                          background: isApproved ? '#f0fdf4' : 'var(--canvas-bg)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '0.75rem'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>GATE: {g.name}</div>
                            <span className={`badge ${isApproved ? 'badge-connected' : 'badge-t3'}`}>
                              {g.status?.toUpperCase()}
                            </span>
                          </div>
                          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            {g.name === 'PLAN' && 'Pre-flight wave grouping and dependencies approved'}
                            {g.name === 'SECRETS' && 'Secret scan and redaction law compliance signed off'}
                            {g.name === 'MAPPINGS' && 'Author email and GitHub login attribution verified'}
                            {g.name === 'CUTOVER' && 'Final execution and repository cutover authorization'}
                          </p>
                        </div>

                        {!isApproved && (
                          <button
                            onClick={() => onApproveGate(g.name)}
                            className="btn btn-primary"
                            style={{ padding: '0.35rem 0.8rem', fontSize: '0.75rem', alignSelf: 'flex-start' }}
                          >
                            Approve Gate
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 6. Executor Inspector */}
            {activeInspectorStage === 'executor' && (
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Terminal style={{ width: '16px', height: '16px' }} />
                  <span>Stage 6: Executor Live History Rewrite &amp; Migration Push</span>
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', marginBottom: '1.25rem' }}>
                  Executes git-svn / git-mirror clone, author history rewrite, Git LFS conversion for large files, and pushes to GitHub with autonomous Healer self-recovery.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
                  <div style={{ padding: '0.9rem', background: 'var(--canvas-bg)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>Target Destination</div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                      github.com/{customTargetOrg}/{selectedRepo?.name}
                    </div>
                  </div>
                  <div style={{ padding: '0.9rem', background: 'var(--canvas-bg)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>Automated Healer Status</div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--status-success)', marginTop: '0.2rem' }}>
                      ACTIVE (T0 Known-Fix Table)
                    </div>
                  </div>
                </div>

                <div style={{ background: 'var(--surface-secondary)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.4rem' }}>Self-Healing Fault Tolerance</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    If GitHub rejects pushes due to &gt;100MB files, Executor intercepts the error, runs <code>git lfs track</code> + <code>git lfs migrate</code>, and auto-retries push autonomously.
                  </div>
                </div>
              </div>
            )}

            {/* 7. Prover Inspector */}
            {activeInspectorStage === 'prover' && (
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileCheck style={{ width: '16px', height: '16px' }} />
                  <span>Stage 7: Prover Mathematical Parity &amp; Cryptographic Seal</span>
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', marginBottom: '1.25rem' }}>
                  FR-08 Deterministic Fidelity Verification. Tree hash comparison with exactly 0 LLM tokens used.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.85rem', marginBottom: '1.25rem' }}>
                  <div style={{ padding: '0.85rem', background: '#f0fdf4', borderRadius: 'var(--radius-sm)', textAlign: 'center', border: '1px solid #bbf7d0' }}>
                    <div style={{ fontSize: '0.7rem', color: '#166534' }}>Commit Parity</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#166534', marginTop: '0.2rem' }}>
                      {fidelity?.commit_parity || 100.0}%
                    </div>
                  </div>
                  <div style={{ padding: '0.85rem', background: '#f0fdf4', borderRadius: 'var(--radius-sm)', textAlign: 'center', border: '1px solid #bbf7d0' }}>
                    <div style={{ fontSize: '0.7rem', color: '#166534' }}>Branch Parity</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#166534', marginTop: '0.2rem' }}>
                      {fidelity?.branch_parity || 100.0}%
                    </div>
                  </div>
                  <div style={{ padding: '0.85rem', background: '#f0fdf4', borderRadius: 'var(--radius-sm)', textAlign: 'center', border: '1px solid #bbf7d0' }}>
                    <div style={{ fontSize: '0.7rem', color: '#166534' }}>Author Coverage</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#166534', marginTop: '0.2rem' }}>
                      {fidelity?.author_coverage || 100.0}%
                    </div>
                  </div>
                </div>

                {certificate && (
                  <div style={{ background: 'var(--surface-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                        {certificate.certificate?.certificate_id || 'CERT-PROV-RUN-0001'}
                      </div>
                      <span className="badge badge-connected">CRYPTOGRAPHICALLY SEALED</span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all', marginBottom: '0.75rem' }}>
                      SHA-256 Seal: {certificate.hash}
                    </div>
                    <button
                      onClick={onDownloadCertificate}
                      className="btn btn-primary"
                      style={{ padding: '0.45rem 0.95rem', fontSize: '0.78rem' }}
                    >
                      <Download style={{ width: '13px', height: '13px' }} />
                      <span>Download Signed Certificate (.json)</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT: Embedded Live WebSocket Feed (<1s Latency per G-13) */}
          <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', background: 'var(--surface-primary)', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.92rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Terminal style={{ width: '15px', height: '15px' }} />
                <span>Live WebSocket Agent Stream</span>
              </div>
              <span className="badge badge-connected" style={{ fontSize: '0.65rem' }}>
                &lt;1s LATENCY
              </span>
            </div>

            {/* Filter Chips */}
            <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', marginBottom: '0.75rem', paddingBottom: '0.25rem' }}>
              {['ALL', 'Scout', 'Curator', 'Assessor', 'Cartographer', 'Executor', 'Healer'].map((filterName) => (
                <button
                  key={filterName}
                  type="button"
                  onClick={() => setEventFilter(filterName)}
                  style={{
                    fontSize: '0.68rem',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px',
                    border: eventFilter === filterName ? '1px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                    background: eventFilter === filterName ? 'var(--brand-primary)' : 'var(--surface-primary)',
                    color: eventFilter === filterName ? '#ffffff' : 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  {filterName}
                </button>
              ))}
            </div>

            {/* Event List */}
            <div style={{ maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {filteredEvents.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)', fontSize: '0.78rem' }}>
                  Awaiting live agent events...
                </div>
              ) : (
                filteredEvents.slice(0, 30).map((ev) => (
                  <div
                    key={ev.id || Math.random()}
                    style={{
                      padding: '0.65rem 0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--canvas-bg)',
                      border: '1px solid var(--border-subtle)',
                      fontSize: '0.76rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{ev.agent}</span>
                      <span className={`badge ${ev.tier === 'T0' ? 'badge-t0' : ev.tier === 'T2' ? 'badge-t2' : 'badge-t3'}`} style={{ fontSize: '0.62rem' }}>
                        {ev.tier || 'T0'}
                      </span>
                    </div>
                    <div style={{ fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.15rem' }}>
                      {ev.action}
                    </div>
                    {ev.reason && (
                      <div style={{ color: 'var(--text-tertiary)', fontSize: '0.72rem', fontFamily: 'var(--font-mono)' }}>
                        {ev.reason}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

MigrationTimelineTab.propTypes = {
  catalog: PropTypes.array.isRequired,
  selectedRepoId: PropTypes.number,
  onSelectRepo: PropTypes.func.isRequired,
  customVcsType: PropTypes.string.isRequired,
  setCustomVcsType: PropTypes.func.isRequired,
  customEndpoint: PropTypes.string.isRequired,
  setCustomEndpoint: PropTypes.func.isRequired,
  customCreds: PropTypes.string.isRequired,
  setCustomCreds: PropTypes.func.isRequired,
  customTargetOrg: PropTypes.string.isRequired,
  setCustomTargetOrg: PropTypes.func.isRequired,
  loadingAction: PropTypes.string,
  stageStatuses: PropTypes.object.isRequired,
  activeInspectorStage: PropTypes.string.isRequired,
  setActiveInspectorStage: PropTypes.func.isRequired,
  connectionReport: PropTypes.object,
  isAutoRunning: PropTypes.bool.isRequired,
  onConnectAndDiscover: PropTypes.func.isRequired,
  onRunCurator: PropTypes.func.isRequired,
  onRunAssessor: PropTypes.func.isRequired,
  onRunCartographer: PropTypes.func.isRequired,
  onRunGates: PropTypes.func.isRequired,
  onRunExecutor: PropTypes.func.isRequired,
  onRunProver: PropTypes.func.isRequired,
  onRunFullPipeline: PropTypes.func.isRequired,
  findings: PropTypes.array.isRequired,
  mappings: PropTypes.array.isRequired,
  gates: PropTypes.array.isRequired,
  events: PropTypes.array.isRequired,
  fidelity: PropTypes.object,
  certificate: PropTypes.object,
  insights: PropTypes.object,
  onUpdateMapping: PropTypes.func.isRequired,
  onApproveGate: PropTypes.func.isRequired,
  onDownloadCertificate: PropTypes.func.isRequired,
  copyFeedback: PropTypes.bool,
  onCopyText: PropTypes.func.isRequired,
  API_BASE: PropTypes.string.isRequired
};
