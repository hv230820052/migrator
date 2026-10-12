import React, { useState, useEffect } from 'react';
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
  FolderGit2,
  GitPullRequest,
  Tag,
  FileText,
  Info
} from 'lucide-react';

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
  accountReposErrors = [],
  isFetchingAccountRepos = false,
  onFetchAccountRepos,
  pipelineElapsedSeconds = 0,
  pipelineLiveStep = '',
  ticketsData = { total_items: 0, tickets_migrated: 0, merge_requests_migrated: 0, items: [] },
  API_BASE
}) {
  const [showCreds, setShowCreds] = useState(false);
  const [editingMapping, setEditingMapping] = useState(null);
  const [editLogin, setEditLogin] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [eventFilter, setEventFilter] = useState('ALL');

  // Dedicated SVN credential inputs
  const initialUser = customCreds && customCreds.includes(':') ? customCreds.split(':')[0] : (customCreds || '');
  const initialPass = customCreds && customCreds.includes(':') ? customCreds.split(':')[1] : '';
  const [svnUsername, setSvnUsername] = useState(initialUser);
  const [svnPassword, setSvnPassword] = useState(initialPass);
  const [svnProvider, setSvnProvider] = useState('sourceforge');
  const [customSvnServerUrl, setCustomSvnServerUrl] = useState('');

  // Multi-VCS state variables
  const [githubToken, setGithubToken] = useState('');
  const [githubUserOrg, setGithubUserOrg] = useState('');
  const [gitlabToken, setGitlabToken] = useState('');
  const [gitlabServerUrl, setGitlabServerUrl] = useState('https://gitlab.com');
  const [bitbucketWorkspace, setBitbucketWorkspace] = useState('');
  const [bitbucketUsername, setBitbucketUsername] = useState('');
  const [bitbucketAppPassword, setBitbucketAppPassword] = useState('');
  const [azureOrg, setAzureOrg] = useState('');
  const [azurePat, setAzurePat] = useState('');
  const [localGitPath, setLocalGitPath] = useState('/app/samples/localgit');

  const [showManualEndpoint, setShowManualEndpoint] = useState(false);
  const [hasFetchedRepos, setHasFetchedRepos] = useState(false);

  // Contributor / Author Mapping State (Requirement 1, 2, 3)
  const [authorRows, setAuthorRows] = useState([]);
  const [authorWarnings, setAuthorWarnings] = useState([]);
  const [allMapped, setAllMapped] = useState(true);
  const [unmappedAuthors, setUnmappedAuthors] = useState([]);
  const [isFetchingAuthors, setIsFetchingAuthors] = useState(false);
  const [isSavingAuthors, setIsSavingAuthors] = useState(false);
  const [authorFeedback, setAuthorFeedback] = useState(null);
  const [noreplyLoading, setNoreplyLoading] = useState({});
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportText, setExportText] = useState('');
  const [verificationData, setVerificationData] = useState(null);
  const [isFetchingVerification, setIsFetchingVerification] = useState(false);

  const selectedRepo = catalog.find((r) => r.id === selectedRepoId) || catalog[0] || null;

  // Fetch contributor verification data
  const fetchVerificationData = async () => {
    if (!selectedRepo?.id) return;
    setIsFetchingVerification(true);
    try {
      const res = await fetch(`${API_BASE || 'http://localhost:8100'}/api/repos/${selectedRepo.id}/contributors-verification`);
      if (res.ok) {
        const data = await res.json();
        setVerificationData(data);
      }
    } catch (e) {
      console.error('Failed to fetch contributor verification:', e);
    } finally {
      setIsFetchingVerification(false);
    }
  };

  useEffect(() => {
    fetchVerificationData();
  }, [selectedRepo?.id, API_BASE, stageStatuses?.executor]);

  // Fetch author mapping when selectedRepo changes
  useEffect(() => {
    if (!selectedRepo?.id) return;
    let isMounted = true;
    const fetchAuthors = async () => {
      setIsFetchingAuthors(true);
      try {
        const res = await fetch(`${API_BASE || 'http://localhost:8100'}/api/repos/${selectedRepo.id}/authors`);
        if (res.ok && isMounted) {
          const data = await res.json();
          setAuthorRows(data.authors || []);
          setAuthorWarnings(data.warnings || []);
          setAllMapped(data.all_mapped ?? true);
          setUnmappedAuthors(data.unmapped_authors || []);
        }
      } catch (err) {
        console.error('Failed to load authors:', err);
      } finally {
        if (isMounted) setIsFetchingAuthors(false);
      }
    };
    fetchAuthors();
    return () => { isMounted = false; };
  }, [selectedRepo?.id, API_BASE]);

  const handleAuthorFieldChange = (index, field, value) => {
    setAuthorRows((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleLookupNoreply = async (index, username, ghUsername) => {
    const target = (ghUsername || username || '').trim();
    if (!target) return;
    setNoreplyLoading((prev) => ({ ...prev, [username]: true }));
    setAuthorFeedback(null);
    try {
      const res = await fetch(`${API_BASE || 'http://localhost:8100'}/api/github/user/${target}/noreply`);
      if (res.ok) {
        const data = await res.json();
        setAuthorRows((prev) => {
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            email: data.noreply_email,
            github_username: data.username,
            name: updated[index].name || data.name || data.username
          };
          return updated;
        });
        setAuthorFeedback({
          type: 'success',
          message: `Linked @${data.username} noreply address: ${data.noreply_email}`
        });
      } else {
        const err = await res.json();
        setAuthorFeedback({
          type: 'error',
          message: err.detail || `GitHub user @${target} not found.`
        });
      }
    } catch (e) {
      setAuthorFeedback({ type: 'error', message: `Lookup error: ${e.message}` });
    } finally {
      setNoreplyLoading((prev) => ({ ...prev, [username]: false }));
    }
  };

  const handleSaveAllAuthors = async () => {
    if (!selectedRepo?.id) return;
    setIsSavingAuthors(true);
    setAuthorFeedback(null);
    try {
      const payload = {
        mappings: authorRows.map((a) => ({
          username: a.username,
          name: a.name || a.username,
          email: a.email || '',
          github_username: a.github_username || ''
        }))
      };
      const res = await fetch(`${API_BASE || 'http://localhost:8100'}/api/repos/${selectedRepo.id}/authors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to save author mappings');
      }
      setAuthorWarnings(data.warnings || []);
      setAllMapped(data.all_mapped ?? true);
      setUnmappedAuthors(data.unmapped_authors || []);
      setAuthorFeedback({
        type: data.all_mapped ? 'success' : 'warning',
        message: data.all_mapped
          ? `All ${data.count} contributors verified and saved successfully!`
          : `Saved. Note: ${data.unmapped_authors?.length || 0} author(s) still unmapped.`
      });
      const ref = await fetch(`${API_BASE || 'http://localhost:8100'}/api/repos/${selectedRepo.id}/authors`);
      if (ref.ok) {
        const refData = await ref.json();
        setAuthorRows(refData.authors || []);
      }
    } catch (err) {
      setAuthorFeedback({ type: 'error', message: err.message });
    } finally {
      setIsSavingAuthors(false);
    }
  };

  const handleExportAuthors = async () => {
    if (!selectedRepo?.id) return;
    try {
      const res = await fetch(`${API_BASE || 'http://localhost:8100'}/api/repos/${selectedRepo.id}/authors/export`);
      if (res.ok) {
        const text = await res.text();
        setExportText(text);
        setIsExportModalOpen(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleImportAuthors = async () => {
    if (!importText.trim()) return;
    try {
      const res = await fetch(`${API_BASE || 'http://localhost:8100'}/api/authors/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: importText })
      });
      if (res.ok) {
        const data = await res.json();
        const mapByU = {};
        (data.mappings || []).forEach((m) => {
          mapByU[m.username] = m;
        });
        setAuthorRows((prev) =>
          prev.map((r) => {
            if (mapByU[r.username]) {
              return {
                ...r,
                name: mapByU[r.username].name || r.name,
                email: mapByU[r.username].email || r.email,
                github_username: mapByU[r.username].github_username || r.github_username
              };
            }
            return r;
          })
        );
        setIsImportModalOpen(false);
        setImportText('');
        setAuthorFeedback({
          type: 'success',
          message: `Imported ${data.count} mapping entries. Remember to click "Save Contributor Mappings" to persist.`
        });
      }
    } catch (err) {
      setAuthorFeedback({ type: 'error', message: `Import failed: ${err.message}` });
    }
  };

  const handleUpdateSvnCreds = (newU, newP) => {
    setSvnUsername(newU);
    setSvnPassword(newP);
    setCustomCreds(`${newU}:${newP}`);
  };

  const handleFetchAccountReposClick = async () => {
    setHasFetchedRepos(true);
    if (!onFetchAccountRepos) return;

    if (customVcsType === 'svn') {
      const u = svnUsername;
      const p = svnPassword;
      const srv = svnProvider === 'custom' ? customSvnServerUrl : '';
      await onFetchAccountRepos('svn', u, p, `${u}:${p}`, srv, '');
    } else if (customVcsType === 'github') {
      await onFetchAccountRepos('github', githubUserOrg, '', githubToken, '', githubUserOrg);
    } else if (customVcsType === 'gitlab') {
      await onFetchAccountRepos('gitlab', '', '', gitlabToken, gitlabServerUrl || 'https://gitlab.com', '');
    } else if (customVcsType === 'bitbucket') {
      await onFetchAccountRepos('bitbucket', bitbucketUsername, bitbucketAppPassword, bitbucketAppPassword, '', bitbucketWorkspace);
    } else if (customVcsType === 'azure_devops') {
      await onFetchAccountRepos('azure_devops', azureOrg, '', azurePat, '', azureOrg);
    } else if (customVcsType === 'localgit') {
      await onFetchAccountRepos('localgit', '', '', '', localGitPath, '');
    } else if (customVcsType === 'tfs') {
      await onFetchAccountRepos('tfs', '', '', '', customEndpoint || '/app/samples/tfs/tfs-sample', '');
    }
  };

  const handleSelectAccountRepo = async (ar) => {
    setCustomEndpoint(ar.endpoint);
    let creds = '';
    const vcs = ar.source_type || customVcsType;

    if (vcs === 'svn') {
      creds = svnUsername && svnPassword ? `${svnUsername}:${svnPassword}` : (svnUsername || '');
    } else if (vcs === 'github') {
      creds = githubToken;
    } else if (vcs === 'gitlab') {
      creds = gitlabToken;
    } else if (vcs === 'bitbucket') {
      creds = bitbucketUsername && bitbucketAppPassword ? `${bitbucketUsername}:${bitbucketAppPassword}` : (bitbucketAppPassword || '');
    } else if (vcs === 'azure_devops') {
      creds = azurePat;
    }

    setCustomCreds(creds);
    if (onConnectAndDiscover) {
      await onConnectAndDiscover(vcs, ar.endpoint, creds, customTargetOrg);
    }
  };

  const getAccountIdentifier = () => {
    switch (customVcsType) {
      case 'github': return githubUserOrg || (githubToken ? 'Authenticated GitHub Account' : 'GitHub Account');
      case 'gitlab': return gitlabToken ? 'GitLab Workspace' : 'GitLab';
      case 'bitbucket': return bitbucketWorkspace || bitbucketUsername || 'Bitbucket Workspace';
      case 'azure_devops': return azureOrg || 'Azure DevOps Org';
      case 'localgit': return localGitPath || 'Local Directory';
      default: return svnUsername || (customCreds ? customCreds.split(':')[0] : 'SVN Account');
    }
  };

  const isFetchDisabled = isFetchingAccountRepos || (() => {
    if (customVcsType === 'svn') {
      return svnProvider === 'custom' ? !customSvnServerUrl.trim() : !svnUsername.trim();
    }
    if (customVcsType === 'github') {
      return !githubToken.trim() && !githubUserOrg.trim();
    }
    if (customVcsType === 'gitlab') {
      return !gitlabToken.trim();
    }
    if (customVcsType === 'bitbucket') {
      return !bitbucketWorkspace.trim();
    }
    if (customVcsType === 'azure_devops') {
      return !azureOrg.trim() || !azurePat.trim();
    }
    if (customVcsType === 'localgit') {
      return !localGitPath.trim();
    }
    return false;
  })();

  const getFetchButtonLabel = () => {
    if (isFetchingAccountRepos) return 'Discovering Repositories...';
    switch (customVcsType) {
      case 'github': return '🔍 Discover GitHub Repositories';
      case 'gitlab': return '🔍 Discover GitLab Projects';
      case 'bitbucket': return '🔍 Discover Bitbucket Repositories';
      case 'azure_devops': return '🔍 Discover Azure DevOps Repositories';
      case 'localgit': return '🔍 Scan Local Git Repositories';
      case 'tfs': return '🔍 Scan TFS Repositories';
      default: return '🔍 Fetch SVN Repositories in My Account';
    }
  };

  const getProviderBadgeStyle = (provider, sourceType) => {
    const p = (provider || sourceType || '').toLowerCase();
    if (p.includes('github')) {
      return { background: '#6e40c9', color: '#ffffff', border: '1px solid #8957e5' };
    }
    if (p.includes('gitlab')) {
      return { background: '#e24329', color: '#ffffff', border: '1px solid #fc6d26' };
    }
    if (p.includes('bitbucket')) {
      return { background: '#0052cc', color: '#ffffff', border: '1px solid #2684ff' };
    }
    if (p.includes('azure')) {
      return { background: '#0078d4', color: '#ffffff', border: '1px solid #2899f5' };
    }
    if (p.includes('local')) {
      return { background: '#059669', color: '#ffffff', border: '1px solid #10b981' };
    }
    return { background: '#d97706', color: '#ffffff', border: '1px solid #f59e0b' };
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

  const renderContributorMappingTable = (isInsideStage = false) => (
    <div className={isInsideStage ? '' : 'panel'} id={isInsideStage ? undefined : 'map-contributors-section'}>
      <div className={isInsideStage ? '' : 'panel-header'} style={isInsideStage ? { marginBottom: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' } : undefined}>
        <div className={isInsideStage ? '' : 'panel-title'} style={isInsideStage ? { fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' } : undefined}>
          <Users style={{ width: '18px', height: '18px', color: 'var(--brand-primary)' }} />
          <span>{isInsideStage ? 'Stage 4: Map Contributors & Identity Attribution' : `Step 2.5: Map Contributors (${authorRows.length} Discovered Authors)`}</span>
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
            onClick={handleExportAuthors}
            className="btn btn-secondary"
            style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <FileText style={{ width: '13px', height: '13px' }} />
            <span>Export authors.txt</span>
          </button>
          <button
            type="button"
            onClick={handleSaveAllAuthors}
            disabled={isSavingAuthors || isFetchingAuthors}
            className="btn btn-primary"
            style={{ fontSize: '0.75rem', padding: '0.35rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            {isSavingAuthors ? (
              <RotateCw style={{ width: '13px', height: '13px', animation: 'spin 1s linear infinite' }} />
            ) : (
              <CheckCircle2 style={{ width: '13px', height: '13px' }} />
            )}
            <span>{isSavingAuthors ? 'Saving...' : 'Save Contributor Mappings'}</span>
          </button>
        </div>
      </div>

      {/* Short Hint per Requirement 3 */}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.82rem', color: '#334155' }}>
        <Sparkles style={{ width: '16px', height: '16px', color: '#0284c7', flexShrink: 0 }} />
        <div>
          <strong>Attribution Hint:</strong> Use the email verified on the person&apos;s GitHub account or their official noreply address, otherwise commits won&apos;t be linked to their profile.
        </div>
      </div>

      {/* Feedback Message */}
      {authorFeedback && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '1rem',
            fontSize: '0.82rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: authorFeedback.type === 'error' ? '#fff1f2' : authorFeedback.type === 'warning' ? '#fffbeb' : '#f0fdf4',
            color: authorFeedback.type === 'error' ? '#9f1239' : authorFeedback.type === 'warning' ? '#92400e' : '#166534',
            border: `1px solid ${authorFeedback.type === 'error' ? '#fecdd3' : authorFeedback.type === 'warning' ? '#fde68a' : '#bbf7d0'}`
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {authorFeedback.type === 'error' ? <AlertCircle style={{ width: '15px', height: '15px' }} /> : <CheckCircle2 style={{ width: '15px', height: '15px' }} />}
            <span>{authorFeedback.message}</span>
          </div>
          <button
            onClick={() => setAuthorFeedback(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', color: 'inherit' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Warning Banner (Duplicate emails or unverifiable domains) */}
      {authorWarnings.length > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 'var(--radius-sm)', padding: '0.85rem 1.15rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#92400e', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
            <AlertTriangle style={{ width: '16px', height: '16px' }} />
            <span>Contributor Attribution Warnings (Non-Blocking)</span>
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.78rem', color: '#78350f', lineHeight: 1.5 }}>
            {authorWarnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Blocking Incomplete Mapping Banner */}
      {!allMapped && unmappedAuthors.length > 0 && (
        <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 'var(--radius-sm)', padding: '0.85rem 1.15rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <AlertCircle style={{ width: '20px', height: '20px', color: '#e11d48', flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#9f1239' }}>
              Migration Blocked: Incomplete Contributor Mapping
            </div>
            <div style={{ fontSize: '0.78rem', color: '#be123c', marginTop: '0.2rem' }}>
              The following authors must be mapped before execution can run: <strong>{unmappedAuthors.join(', ')}</strong>.
            </div>
          </div>
        </div>
      )}

      {/* Author Table */}
      {isFetchingAuthors ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem' }}>
          <RotateCw style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} />
          <span>Discovering unique authors from repository history...</span>
        </div>
      ) : authorRows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', background: 'var(--canvas-bg)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-subtle)', color: 'var(--text-tertiary)', fontSize: '0.84rem' }}>
          No authors discovered in the active repository yet.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ background: 'var(--canvas-bg)', textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
                <th style={{ padding: '0.6rem 0.75rem' }}>SVN USERNAME</th>
                <th style={{ padding: '0.6rem 0.75rem' }}>COMMITS</th>
                <th style={{ padding: '0.6rem 0.75rem' }}>NAME</th>
                <th style={{ padding: '0.6rem 0.75rem' }}>EMAIL (REQUIRED)</th>
                <th style={{ padding: '0.6rem 0.75rem' }}>OPTIONAL GITHUB USERNAME</th>
                <th style={{ padding: '0.6rem 0.75rem' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {authorRows.map((row, idx) => {
                const hasEmail = !!(row.email && row.email.trim());
                const isLoadingNoreply = !!noreplyLoading[row.username];
                return (
                  <tr key={row.username || idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '0.65rem 0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <span>{row.username}</span>
                        <span className={`badge ${hasEmail ? 'badge-connected' : 'badge-danger'}`} style={{ fontSize: '0.62rem', padding: '0.12rem 0.4rem' }}>
                          {hasEmail ? 'MAPPED' : 'UNMAPPED'}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem' }}>
                      <span className="badge badge-t0" style={{ fontWeight: 600 }}>
                        {row.commits || 0} commits
                      </span>
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem' }}>
                      <input
                        type="text"
                        value={row.name || ''}
                        onChange={(e) => handleAuthorFieldChange(idx, 'name', e.target.value)}
                        placeholder={row.username}
                        style={{
                          width: '100%',
                          minWidth: '130px',
                          padding: '0.4rem 0.6rem',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-subtle)',
                          background: 'var(--surface-primary)',
                          fontSize: '0.8rem',
                          color: 'var(--text-primary)'
                        }}
                      />
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem' }}>
                      <input
                        type="email"
                        value={row.email || ''}
                        onChange={(e) => handleAuthorFieldChange(idx, 'email', e.target.value)}
                        placeholder="e.g. name@company.com"
                        style={{
                          width: '100%',
                          minWidth: '220px',
                          padding: '0.4rem 0.6rem',
                          borderRadius: 'var(--radius-sm)',
                          border: hasEmail ? '1px solid var(--border-subtle)' : '1px solid #f43f5e',
                          background: hasEmail ? 'var(--surface-primary)' : '#fff1f2',
                          fontSize: '0.8rem',
                          color: 'var(--text-primary)',
                          fontFamily: 'var(--font-mono)'
                        }}
                      />
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem' }}>
                      <input
                        type="text"
                        value={row.github_username || ''}
                        onChange={(e) => handleAuthorFieldChange(idx, 'github_username', e.target.value)}
                        placeholder="e.g. octocat"
                        style={{
                          width: '100%',
                          minWidth: '140px',
                          padding: '0.4rem 0.6rem',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-subtle)',
                          background: 'var(--surface-primary)',
                          fontSize: '0.8rem',
                          color: 'var(--text-primary)',
                          fontFamily: 'var(--font-mono)'
                        }}
                      />
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem' }}>
                      <button
                        type="button"
                        onClick={() => handleLookupNoreply(idx, row.username, row.github_username)}
                        disabled={isLoadingNoreply}
                        className="btn btn-secondary"
                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}
                        title="Fetch official GitHub noreply email address"
                      >
                        {isLoadingNoreply ? (
                          <RotateCw style={{ width: '12px', height: '12px', animation: 'spin 1s linear infinite' }} />
                        ) : (
                          <Users style={{ width: '12px', height: '12px' }} />
                        )}
                        <span>Lookup Noreply</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

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
              <option value="github">GitHub (Cloud / Organization / User)</option>
              <option value="gitlab">GitLab (Cloud / Self-Hosted)</option>
              <option value="bitbucket">Bitbucket (Workspace / Cloud)</option>
              <option value="azure_devops">Azure DevOps (Repos)</option>
              <option value="localgit">Local Git (Filesystem Directory)</option>
              <option value="tfs">Team Foundation Server (TFVC Changeset)</option>
            </select>
          </div>

          {/* SVN Specific Credential Fields */}
          {customVcsType === 'svn' && (
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
          )}

          {/* GitHub Specific Credential Fields */}
          {customVcsType === 'github' && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  Personal Access Token (PAT)
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showCreds ? 'text' : 'password'}
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxx (needs 'repo' scope)"
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
                  Target User or Organization (Optional)
                </label>
                <input
                  type="text"
                  value={githubUserOrg}
                  onChange={(e) => setGithubUserOrg(e.target.value)}
                  placeholder="e.g. octocat or my-org (leave blank for own repos)"
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
            </>
          )}

          {/* GitLab Specific Credential Fields */}
          {customVcsType === 'gitlab' && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  GitLab Personal Access Token (PAT)
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showCreds ? 'text' : 'password'}
                    value={gitlabToken}
                    onChange={(e) => setGitlabToken(e.target.value)}
                    placeholder="glpat-xxxxxxxxxxxx (needs 'read_api')"
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
                  GitLab Host / Server URL
                </label>
                <input
                  type="text"
                  value={gitlabServerUrl}
                  onChange={(e) => setGitlabServerUrl(e.target.value)}
                  placeholder="https://gitlab.com or https://gitlab.mycorp.com"
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
            </>
          )}

          {/* Bitbucket Specific Credential Fields */}
          {customVcsType === 'bitbucket' && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  Bitbucket Workspace Name
                </label>
                <input
                  type="text"
                  value={bitbucketWorkspace}
                  onChange={(e) => setBitbucketWorkspace(e.target.value)}
                  placeholder="e.g. acme-workspace or username"
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
                  Bitbucket Username
                </label>
                <input
                  type="text"
                  value={bitbucketUsername}
                  onChange={(e) => setBitbucketUsername(e.target.value)}
                  placeholder="Your Bitbucket username"
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
                  Bitbucket App Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showCreds ? 'text' : 'password'}
                    value={bitbucketAppPassword}
                    onChange={(e) => setBitbucketAppPassword(e.target.value)}
                    placeholder="App password with 'Repositories: Read'"
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

          {/* Azure DevOps Specific Credential Fields */}
          {customVcsType === 'azure_devops' && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  Azure DevOps Organization
                </label>
                <input
                  type="text"
                  value={azureOrg}
                  onChange={(e) => setAzureOrg(e.target.value)}
                  placeholder="e.g. contoso (from dev.azure.com/contoso)"
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
                  Personal Access Token (PAT)
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showCreds ? 'text' : 'password'}
                    value={azurePat}
                    onChange={(e) => setAzurePat(e.target.value)}
                    placeholder="PAT with 'Code: Read' scope"
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

          {/* Local Git Specific Credential Fields */}
          {customVcsType === 'localgit' && (
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                Filesystem Directory Path
              </label>
              <input
                type="text"
                value={localGitPath}
                onChange={(e) => setLocalGitPath(e.target.value)}
                placeholder="e.g. /app/samples/localgit or C:\projects\my-repo"
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

          {/* TFS Specific Credential Fields */}
          {customVcsType === 'tfs' && (
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                TFS Workspace / Sample Path
              </label>
              <input
                type="text"
                value={customEndpoint}
                onChange={(e) => setCustomEndpoint(e.target.value)}
                placeholder="/app/samples/tfs/tfs-sample"
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

          {/* Target GitHub Organization (Destination) */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
              Target GitHub Organization (Destination)
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
              placeholder="e.g. https://github.com/owner/repo.git or https://gitlab.com/owner/repo.git"
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
              disabled={isFetchDisabled}
              className="btn btn-primary"
              style={{ padding: '0.65rem 1.4rem' }}
            >
              {isFetchingAccountRepos ? (
                <RotateCw style={{ width: '15px', height: '15px', animation: 'spin 1s linear infinite' }} />
              ) : (
                <Search style={{ width: '15px', height: '15px' }} />
              )}
              <span>{getFetchButtonLabel()}</span>
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
              {showManualEndpoint ? '▲ Hide manual direct URL input' : '▼ Or enter manual repository URL directly'}
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

        {/* Discovery Errors / Feedback Notice */}
        {accountReposErrors && accountReposErrors.length > 0 && (
          <div style={{
            marginTop: '1.25rem',
            padding: '1rem 1.25rem',
            background: 'rgba(239, 68, 68, 0.08)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem'
          }}>
            <AlertCircle style={{ width: '18px', height: '18px', color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.86rem', color: '#ef4444', marginBottom: '0.25rem' }}>
                Account Discovery Notice
              </div>
              {accountReposErrors.map((err, i) => (
                <div key={i} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  • {err}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* While Fetching Repos Telemetry */}
        {isFetchingAccountRepos && (
          <div style={{ marginTop: '1.25rem', padding: '1.25rem', background: 'var(--surface-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <RotateCw className="animate-spin" style={{ width: '20px', height: '20px', color: 'var(--brand-primary)' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                Querying {customVcsType.toUpperCase()} Account for Repositories...
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Connecting to {customVcsType.toUpperCase()} API for &quot;{getAccountIdentifier()}&quot;, validating access scope, and indexing repository mount points.
              </div>
            </div>
          </div>
        )}

        {/* Discovered Account Repositories Cards Showcase */}
        {accountRepos && accountRepos.length > 0 && (
          <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FolderGit2 style={{ width: '18px', height: '18px', color: 'var(--brand-primary)' }} />
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                  Discovered Repositories in &quot;{getAccountIdentifier()}&quot; ({accountRepos.length})
                </span>
              </div>
              <span className="badge badge-connected" style={{ fontSize: '0.72rem' }}>
                1-CLICK TARGETING & MIGRATION
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
              {accountRepos.map((ar, idx) => {
                const isSelected = customEndpoint === ar.endpoint;
                const badgeStyle = getProviderBadgeStyle(ar.provider, ar.source_type);
                return (
                  <div
                    key={idx}
                    style={{
                      padding: '1.2rem',
                      borderRadius: 'var(--radius-md)',
                      border: isSelected ? '2px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                      background: isSelected ? 'var(--surface-secondary)' : 'var(--surface-primary)',
                      boxShadow: isSelected ? '0 0 0 1px var(--brand-primary)' : 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.45rem', gap: '0.5rem' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                          {ar.display_name || ar.name}
                        </div>
                        <span style={{
                          fontSize: '0.66rem',
                          fontWeight: 700,
                          padding: '0.2rem 0.55rem',
                          borderRadius: '10px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.03em',
                          flexShrink: 0,
                          ...badgeStyle
                        }}>
                          {ar.provider || ar.source_type?.toUpperCase() || 'VCS'}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.65rem', minHeight: '1.8rem', lineHeight: 1.4 }}>
                        {ar.description || `${ar.provider || 'VCS'} repository ready for migration`}
                      </div>

                      {/* Rich Metadata Pills */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem', fontSize: '0.72rem' }}>
                        {ar.visibility && (
                          <span style={{ background: 'var(--canvas-bg)', padding: '0.15rem 0.45rem', borderRadius: '4px', color: 'var(--text-tertiary)', border: '1px solid var(--border-subtle)' }}>
                            {ar.visibility === 'private' ? '🔒 Private' : '🌐 Public'}
                          </span>
                        )}
                        {ar.language && (
                          <span style={{ background: 'var(--canvas-bg)', padding: '0.15rem 0.45rem', borderRadius: '4px', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', fontWeight: 600 }}>
                            🔤 {ar.language}
                          </span>
                        )}
                        {ar.default_branch && (
                          <span style={{ background: 'var(--canvas-bg)', padding: '0.15rem 0.45rem', borderRadius: '4px', color: 'var(--text-tertiary)', border: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)' }}>
                            🌿 {ar.default_branch}
                          </span>
                        )}
                        {ar.stars !== undefined && ar.stars > 0 && (
                          <span style={{ background: 'var(--canvas-bg)', padding: '0.15rem 0.45rem', borderRadius: '4px', color: 'var(--text-tertiary)', border: '1px solid var(--border-subtle)' }}>
                            ⭐ {ar.stars}
                          </span>
                        )}
                        {ar.forks !== undefined && ar.forks > 0 && (
                          <span style={{ background: 'var(--canvas-bg)', padding: '0.15rem 0.45rem', borderRadius: '4px', color: 'var(--text-tertiary)', border: '1px solid var(--border-subtle)' }}>
                            🍴 {ar.forks}
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '0.71rem', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', background: 'var(--canvas-bg)', padding: '0.35rem 0.5rem', borderRadius: '4px', wordBreak: 'break-all', marginBottom: '0.9rem' }}>
                        {ar.endpoint}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSelectAccountRepo(ar)}
                      className={isSelected ? "btn btn-secondary" : "btn btn-primary"}
                      style={{ width: '100%', padding: '0.55rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                    >
                      {isSelected ? (
                        <>
                          <CheckCircle2 style={{ width: '14px', height: '14px', color: 'var(--status-success)' }} />
                          <span>✓ Active Migration Target</span>
                        </>
                      ) : (
                        <>
                          <Play style={{ width: '13px', height: '13px' }} />
                          <span>Select &amp; Target This Repository</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {hasFetchedRepos && !isFetchingAccountRepos && (!accountRepos || accountRepos.length === 0) && (
          <div style={{ marginTop: '1.25rem', padding: '1.25rem', background: 'var(--canvas-bg)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-subtle)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              No repositories found for &quot;{getAccountIdentifier()}&quot;.
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: '0.35rem' }}>
              Ensure your credentials/tokens are valid and have sufficient read scopes, or enter a direct clone URL manually.
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

      {/* SECTION 2.5: Map Contributors (Step between Select Repository and Execute) */}
      {renderContributorMappingTable(false)}

      {/* SECTION 3: The Live Migration Timeline Stepper */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">
            <Layers style={{ width: '18px', height: '18px' }} />
            <span>Step 3: Live Verification &amp; Migration Timeline</span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              onClick={() => {
                if (!allMapped) {
                  setAuthorFeedback({
                    type: 'error',
                    message: `Migration blocked: All authors (${unmappedAuthors.join(', ')}) must be mapped to valid emails before executing.`
                  });
                  return;
                }
                onRunFullPipeline(selectedRepo?.id);
              }}
              disabled={!selectedRepo || isAutoRunning || !!loadingAction || !allMapped}
              className="btn btn-primary"
              style={{ padding: '0.45rem 0.95rem', fontSize: '0.78rem', opacity: !allMapped ? 0.6 : 1 }}
              title={!allMapped ? 'Migration blocked until all authors are mapped' : 'Run entire pipeline'}
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

            {/* 4. Cartographer Inspector - Map Contributors */}
            {activeInspectorStage === 'cartographer' && (
              <div>
                {renderContributorMappingTable(true)}
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

                {/* Dedicated SVN Tickets & Merge Requests Migration Panel (FR-08) */}
                <div style={{ marginTop: '1.25rem', padding: '1.15rem', background: 'var(--surface-primary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Tag style={{ width: '16px', height: '16px', color: 'var(--brand-primary)' }} />
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        Migrated SVN Tickets &amp; Merge Requests (FR-08 Provenance)
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                      <span className="badge badge-connected" style={{ fontSize: '0.72rem' }}>
                        Tickets: {ticketsData?.tickets_migrated ?? (ticketsData?.items?.filter(i => i.item_type === 'ticket').length || 0)}
                      </span>
                      <span className="badge badge-t2" style={{ fontSize: '0.72rem' }}>
                        Merge Requests: {ticketsData?.merge_requests_migrated ?? (ticketsData?.items?.filter(i => i.item_type === 'merge_request').length || 0)}
                      </span>
                      <span className="badge badge-connected" style={{ fontSize: '0.72rem' }}>
                        100% AUDIT PRESERVED
                      </span>
                    </div>
                  </div>

                  {ticketsData?.items && ticketsData.items.length > 0 ? (
                    <div style={{ overflowX: 'auto', marginTop: '0.75rem' }}>
                      <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: 'var(--canvas-bg)', color: 'var(--text-secondary)', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)' }}>
                            <th style={{ padding: '0.55rem' }}>TYPE</th>
                            <th style={{ padding: '0.55rem' }}>LEGACY ID</th>
                            <th style={{ padding: '0.55rem' }}>TITLE / SUMMARY</th>
                            <th style={{ padding: '0.55rem' }}>ORIGINAL REPORTER</th>
                            <th style={{ padding: '0.55rem' }}>STATUS</th>
                            <th style={{ padding: '0.55rem' }}>TARGET DESTINATION</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ticketsData.items.map((item, idx) => {
                            const isMr = item.item_type === 'merge_request';
                            return (
                              <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                <td style={{ padding: '0.55rem' }}>
                                  {isMr ? (
                                    <span className="badge badge-t2" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.68rem' }}>
                                      <GitPullRequest style={{ width: '11px', height: '11px' }} />
                                      <span>MERGE REQUEST</span>
                                    </span>
                                  ) : (
                                    <span className="badge badge-connected" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.68rem' }}>
                                      <Tag style={{ width: '11px', height: '11px' }} />
                                      <span>TICKET / ISSUE</span>
                                    </span>
                                  )}
                                </td>
                                <td style={{ padding: '0.55rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                                  #{item.legacy_id}
                                </td>
                                <td style={{ padding: '0.55rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                  <div>{item.title}</div>
                                  {item.description && (
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 400, marginTop: '0.15rem' }}>
                                      {item.description.slice(0, 80)}{item.description.length > 80 ? '...' : ''}
                                    </div>
                                  )}
                                </td>
                                <td style={{ padding: '0.55rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                                  @{item.author || 'abhaypundora17'}
                                </td>
                                <td style={{ padding: '0.55rem' }}>
                                  <span className={`badge ${item.status?.toLowerCase() === 'open' ? 'badge-connected' : 'badge-t2'}`} style={{ fontSize: '0.68rem' }}>
                                    {(item.status || 'open').toUpperCase()}
                                  </span>
                                </td>
                                <td style={{ padding: '0.55rem' }}>
                                  {item.github_url ? (
                                    <a
                                      href={item.github_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="btn btn-secondary"
                                      style={{ padding: '0.25rem 0.55rem', fontSize: '0.72rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                                    >
                                      <span>GitHub #{item.github_number}</span>
                                      <ExternalLink style={{ width: '11px', height: '11px' }} />
                                    </a>
                                  ) : (
                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                                      📄 In-Repo Dossier (MIGRATION_TICKETS_AND_MERGE_REQUESTS.md)
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ padding: '0.85rem', background: 'var(--canvas-bg)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-subtle)', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                        📋 Automated Issue &amp; Merge Request Synchronizer Ready
                      </div>
                      <div style={{ color: 'var(--text-tertiary)', lineHeight: 1.45 }}>
                        During migration execution, SVN / SourceForge Tickets and Merge Requests are automatically extracted, migrated to GitHub Issues and PRs via API, and permanently archived in <code>MIGRATION_TICKETS_AND_MERGE_REQUESTS.md</code> and <code>tickets_manifest.json</code> committed to the repository root.
                      </div>
                    </div>
                  )}
                </div>

                {/* Dedicated Post-Migration Contributor & Author Verification Panel (Requirement 6) */}
                <div style={{ marginTop: '1.25rem', padding: '1.15rem', background: 'var(--surface-primary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Users style={{ width: '16px', height: '16px', color: 'var(--brand-primary)' }} />
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        Post-Migration Contributor &amp; Author Verification (Requirement 6)
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={fetchVerificationData}
                      disabled={isFetchingVerification}
                      className="btn btn-secondary"
                      style={{ padding: '0.25rem 0.6rem', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      <RotateCw style={{ width: '11px', height: '11px', animation: isFetchingVerification ? 'spin 1s linear infinite' : 'none' }} />
                      <span>Refresh Contributors</span>
                    </button>
                  </div>

                  {/* Summary Dual Cards Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                    {/* Pre-Push Git Author Audit */}
                    <div style={{ background: 'var(--canvas-bg)', padding: '0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                          1. PRE-PUSH GIT LOG AUDIT (<code>git log --format=&quot;%an &lt;%ae&gt;&quot;</code>)
                        </span>
                        <span className="badge badge-connected" style={{ fontSize: '0.65rem' }}>
                          {verificationData?.pre_push_authors?.length || 0} Authors
                        </span>
                      </div>
                      {(!verificationData?.pre_push_authors || verificationData.pre_push_authors.length === 0) ? (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', padding: '0.5rem 0' }}>
                          Awaiting conversion execution to run git log author audit...
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          {verificationData.pre_push_authors.map((auth, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', padding: '0.35rem 0.5rem', background: 'var(--surface-primary)', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                              <div>
                                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>{auth.author}</span>
                                <span style={{ marginLeft: '0.5rem', color: 'var(--text-tertiary)' }}>({auth.commits} commits)</span>
                              </div>
                              <span className={`badge ${auth.is_linked ? 'badge-connected' : 'badge-t3'}`} style={{ fontSize: '0.62rem' }}>
                                {auth.status || (auth.is_linked ? 'Linked' : 'Unlinked')}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Post-Push GitHub Contributors */}
                    <div style={{ background: 'var(--canvas-bg)', padding: '0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                          2. GITHUB CONTRIBUTORS API (<code>GET /repos/&#123;owner&#125;/&#123;repo&#125;/contributors</code>)
                        </span>
                        <span className="badge badge-t0" style={{ fontSize: '0.65rem' }}>
                          Default: {verificationData?.default_branch || 'main'}
                        </span>
                      </div>
                      {(!verificationData?.github_contributors || verificationData.github_contributors.length === 0) ? (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', padding: '0.5rem 0' }}>
                          Contributors graph updating. GitHub calculates contributions asynchronously for commits on default branch (<code>main</code>).
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          {verificationData.github_contributors.map((c, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', padding: '0.35rem 0.5rem', background: 'var(--surface-primary)', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                {c.avatar_url && (
                                  <img src={c.avatar_url} alt={c.login} style={{ width: '18px', height: '18px', borderRadius: '50%' }} />
                                )}
                                <a href={c.html_url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, color: 'var(--brand-primary)', textDecoration: 'none' }}>
                                  @{c.login}
                                </a>
                              </div>
                              <span className="badge badge-connected" style={{ fontSize: '0.62rem' }}>
                                {c.contributions} contributions
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Informational Guidance Note per Req 6 */}
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', background: 'var(--surface-secondary)', padding: '0.6rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Info style={{ width: '14px', height: '14px', color: 'var(--brand-primary)', flexShrink: 0 }} />
                    <div>
                      {verificationData?.note || 'Note: GitHub may take a few minutes to recalculate the Insights -> Contributors graph. Only commits on the default branch count as contributions.'}
                    </div>
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

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.85rem', marginBottom: '1.25rem' }}>
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
                  <div style={{ padding: '0.85rem', background: '#f0fdf4', borderRadius: 'var(--radius-sm)', textAlign: 'center', border: '1px solid #bbf7d0' }}>
                    <div style={{ fontSize: '0.7rem', color: '#166534' }}>Ticket &amp; MR Parity</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#166534', marginTop: '0.2rem' }}>
                      {fidelity?.ticket_parity || 100.0}%
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#15803d', marginTop: '0.15rem' }}>
                      {ticketsData?.tickets_migrated ?? fidelity?.tickets_migrated ?? 0} Tickets · {ticketsData?.merge_requests_migrated ?? fidelity?.merge_requests_migrated ?? 0} MRs
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

      {/* Import authors.txt Modal (Req 3) */}
      {isImportModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          backdropFilter: 'blur(3px)'
        }}>
          <div style={{
            background: 'var(--surface-primary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            padding: '1.5rem',
            width: '90%',
            maxWidth: '560px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Download style={{ width: '16px', height: '16px', color: 'var(--brand-primary)' }} />
                <span>Import authors.txt File</span>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: 'var(--text-tertiary)' }}
              >
                ✕
              </button>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.85rem' }}>
              Paste standard git-svn authors format (one entry per line: <code>username = Full Name &lt;email@example.com&gt;</code>).
            </p>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="abhaypundora17 = Abhay Pundora <abhaypundora17@gmail.com>&#10;abhaypundora = Abhay Pundora <abhaypundora@gmail.com>"
              rows={8}
              style={{
                width: '100%',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.78rem',
                padding: '0.65rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                background: 'var(--canvas-bg)',
                color: 'var(--text-primary)',
                resize: 'vertical',
                marginBottom: '1rem'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImportAuthors}
                disabled={!importText.trim()}
                className="btn btn-primary"
                style={{ fontSize: '0.8rem', padding: '0.4rem 1rem' }}
              >
                Import &amp; Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export authors.txt Modal (Req 3) */}
      {isExportModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          backdropFilter: 'blur(3px)'
        }}>
          <div style={{
            background: 'var(--surface-primary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            padding: '1.5rem',
            width: '90%',
            maxWidth: '560px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText style={{ width: '16px', height: '16px', color: 'var(--brand-primary)' }} />
                <span>Export authors.txt Mapping</span>
              </div>
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: 'var(--text-tertiary)' }}
              >
                ✕
              </button>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.85rem' }}>
              Standard git-svn format generated from confirmed author mappings:
            </p>
            <textarea
              readOnly
              value={exportText}
              rows={8}
              style={{
                width: '100%',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.78rem',
                padding: '0.65rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                background: 'var(--canvas-bg)',
                color: 'var(--text-primary)',
                resize: 'vertical',
                marginBottom: '1rem'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(exportText);
                  if (onCopyText) onCopyText(exportText);
                }}
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem' }}
              >
                Copy to Clipboard
              </button>
              <button
                type="button"
                onClick={() => {
                  const blob = new Blob([exportText], { type: 'text/plain;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `authors-${selectedRepo?.name || 'repo'}.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="btn btn-primary"
                style={{ fontSize: '0.8rem', padding: '0.4rem 1rem' }}
              >
                Download .txt File
              </button>
            </div>
          </div>
        </div>
      )}
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
  accountRepos: PropTypes.array,
  accountReposErrors: PropTypes.array,
  isFetchingAccountRepos: PropTypes.bool,
  onFetchAccountRepos: PropTypes.func,
  ticketsData: PropTypes.object,
  API_BASE: PropTypes.string.isRequired
};
