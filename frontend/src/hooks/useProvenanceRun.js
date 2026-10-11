import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const API_BASE = 'http://localhost:8100';
const WS_BASE = 'ws://localhost:8100';

const fetchJson = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.json();
};

export function useProvenanceRun(initialRunId = 1) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [runId, setRunId] = useState(initialRunId);
  const [events, setEvents] = useState([]);
  const [loadingAction, setLoadingAction] = useState('');
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);

  // Dynamic VCS source connection form states
  const [customVcsType, setCustomVcsType] = useState('svn');
  const [customEndpoint, setCustomEndpoint] = useState('https://svn.code.sf.net/p/demo-svn-repo/svn');
  const [customCreds, setCustomCreds] = useState('abhaypundora17:i@mdeveloperpro');
  const [customTargetOrg, setCustomTargetOrg] = useState('octathon-target');

  const wsRef = useRef(null);

  // TanStack Query: 1. Connected Sources
  const { data: sourcesList = [] } = useQuery({
    queryKey: ['sources'],
    queryFn: () => fetchJson(`${API_BASE}/api/sources`),
  });

  const [selectedRepoId, setSelectedRepoId] = useState(null);

  // TanStack Query: 2. Discovered Repos Catalog
  const { data: catalog = [] } = useQuery({
    queryKey: ['catalog'],
    queryFn: () => fetchJson(`${API_BASE}/api/catalog`),
  });

  // Default to the latest discovered repository in catalog if no repo explicitly selected
  const activeRepoId = selectedRepoId || (catalog.length > 0 ? catalog[catalog.length - 1].id : 1);

  // TanStack Query: 3. Author Mappings
  const { data: mappings = [] } = useQuery({
    queryKey: ['mappings', activeRepoId],
    queryFn: () => fetchJson(`${API_BASE}/api/repos/${activeRepoId}/mappings`),
    enabled: !!activeRepoId,
  });

  // TanStack Query: 4. Security Findings & Secrets
  const { data: findings = [] } = useQuery({
    queryKey: ['findings', activeRepoId],
    queryFn: () => fetchJson(`${API_BASE}/api/repos/${activeRepoId}/findings`),
    enabled: !!activeRepoId,
  });

  // TanStack Query: 5. Governance Hard Approval Gates
  const { data: gates = [] } = useQuery({
    queryKey: ['gates', runId],
    queryFn: () => fetchJson(`${API_BASE}/api/runs/${runId}/gates`),
  });

  // TanStack Query: 6. Cascade Governance Stats
  const { data: cascadeStats = { budget_limit: 100000, budget_used: 0, budget_tripped: false } } = useQuery({
    queryKey: ['cascadeStats', runId],
    queryFn: () => fetchJson(`${API_BASE}/api/runs/${runId}/cascade/stats`),
  });

  // TanStack Query: 7. Mathematical Fidelity Parity
  const { data: fidelity = null } = useQuery({
    queryKey: ['fidelity', runId],
    queryFn: () => fetchJson(`${API_BASE}/api/runs/${runId}/fidelity`),
  });

  // TanStack Query: 8. Cryptographic Proof Certificate
  const { data: certificate = null } = useQuery({
    queryKey: ['certificate', runId],
    queryFn: () => fetchJson(`${API_BASE}/api/runs/${runId}/certificate`),
  });

  // TanStack Query: 9. Before vs After Comparison
  const { data: beforeAfter = null } = useQuery({
    queryKey: ['beforeAfter', runId],
    queryFn: () => fetchJson(`${API_BASE}/api/runs/${runId}/beforeafter`),
  });

  // TanStack Query: 10. AI Pre-Flight Migration Insights
  const { data: insights = null } = useQuery({
    queryKey: ['insights', runId],
    queryFn: () => fetchJson(`${API_BASE}/api/runs/${runId}/insights`),
    staleTime: 60 * 1000,
  });

  // WebSocket Connection for streaming real-time event logs
  useEffect(() => {
    const wsUrl = `${WS_BASE}/api/runs/${runId}/events`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
    };

    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        setEvents(prev => [data, ...prev].slice(0, 50));

        // Intelligent cache invalidation on relevant live events:
        if (data.tier) {
          queryClient.invalidateQueries({ queryKey: ['cascadeStats', runId] });
        }
        if (data.action && data.action.toLowerCase().includes('gate')) {
          queryClient.invalidateQueries({ queryKey: ['gates', runId] });
        }
      } catch (e) {
        console.warn('WS Parse error:', e);
      }
    };

    ws.onclose = () => setWsConnected(false);
    ws.onerror = () => setWsConnected(false);

    return () => {
      if (ws.readyState === WebSocket.OPEN) ws.close();
    };
  }, [runId, queryClient]);

  // Targeted Invalidation Helper
  const invalidateRunQueries = async (targetRunId = runId) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['sources'] }),
      queryClient.invalidateQueries({ queryKey: ['catalog'] }),
      queryClient.invalidateQueries({ queryKey: ['mappings'] }),
      queryClient.invalidateQueries({ queryKey: ['findings'] }),
      queryClient.invalidateQueries({ queryKey: ['gates', targetRunId] }),
      queryClient.invalidateQueries({ queryKey: ['cascadeStats', targetRunId] }),
      queryClient.invalidateQueries({ queryKey: ['fidelity', targetRunId] }),
      queryClient.invalidateQueries({ queryKey: ['certificate', targetRunId] }),
      queryClient.invalidateQueries({ queryKey: ['beforeAfter', targetRunId] }),
    ]);
  };

  // Generic action trigger with targeted invalidation
  const triggerAction = async (actionName, apiCall, queriesToInvalidate = []) => {
    setLoadingAction(actionName);
    try {
      await apiCall();
      if (queriesToInvalidate.length > 0) {
        await Promise.all(queriesToInvalidate.map(key => queryClient.invalidateQueries({ queryKey: key })));
      } else {
        await invalidateRunQueries(runId);
      }
    } catch (e) {
      alert(`Action failed: ${e.message}`);
    } finally {
      setLoadingAction('');
    }
  };

  // Author Mapping Update
  const updateAuthorMapping = async (repoId, legacyId, proposedLogin, proposedEmail) => {
    const res = await fetch(`${API_BASE}/api/repos/${repoId}/mappings/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        legacy_id: legacyId,
        proposed_login: proposedLogin,
        proposed_email: proposedEmail
      })
    });
    if (!res.ok) throw new Error('Failed to update author mapping');
    await queryClient.invalidateQueries({ queryKey: ['mappings'] });
    return res.json();
  };

  // Connect custom VCS source
  const handleConnectSource = async () => {
    setLoadingAction('Connecting VCS Source...');
    try {
      const res = await fetch(`${API_BASE}/api/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: customVcsType,
          endpoint: customEndpoint,
          credentials_ref: customCreds || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Connection failed');
      }
      await queryClient.invalidateQueries({ queryKey: ['sources'] });
      alert(`Connected successfully: ${data.status} (${data.readable_scope})`);
    } catch (err) {
      alert(`Source connection failed: ${err.message}`);
    } finally {
      setLoadingAction('');
    }
  };

  // Launch Autonomous End-to-End Migration Pipeline
  const handleRunFullGoldenPath = async (overrideType, overrideEndpoint, overrideCreds, overrideOrg) => {
    const srcType = overrideType || customVcsType;
    const srcEndpoint = overrideEndpoint || customEndpoint;
    const srcCreds = overrideCreds !== undefined ? overrideCreds : customCreds;
    const targetOrg = overrideOrg || customTargetOrg;

    setLoadingAction('Executing Autonomous Migration...');
    try {
      // 1. Connect source dynamically
      await fetch(`${API_BASE}/api/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: srcType,
          endpoint: srcEndpoint,
          credentials_ref: srcCreds || undefined
        })
      });

      // 2. Obtain newly created source ID
      const sources = await fetch(`${API_BASE}/api/sources`).then(r => r.json());
      const activeSourceId = sources.length > 0 ? sources[sources.length - 1].id : 1;

      // 3. Create Migration Run
      const runRes = await fetch(`${API_BASE}/api/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_ids: [activeSourceId], target_org: targetOrg })
      }).then(r => r.json());
      const newRunId = runRes.run_id || runId;
      setRunId(newRunId);

      // 4. Discovery Phase (Scout)
      await fetch(`${API_BASE}/api/runs/${newRunId}/discover`, { method: 'POST' });

      // 5. Curation Phase (Curator)
      await fetch(`${API_BASE}/api/runs/${newRunId}/curate`, { method: 'POST' });

      // 6. Assessment Phase (Assessor)
      await fetch(`${API_BASE}/api/runs/${newRunId}/assess`, { method: 'POST' });

      // 7. Governance Approval Gates
      for (const gate of ['PLAN', 'MAPPINGS', 'SECRETS', 'CUTOVER']) {
        await fetch(`${API_BASE}/api/runs/${newRunId}/gates/${gate}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gate, actor: 'auditor_lead', decision: 'approve', reason: 'Autonomous Lead Approval' })
        });
      }

      // 8. Execution Phase (Executor git-svn + LFS + push)
      await fetch(`${API_BASE}/api/runs/${newRunId}/migrate`, { method: 'POST' });

      setActiveTab('control-room');
      await invalidateRunQueries(newRunId);
    } catch (err) {
      alert('Autonomous migration failed: ' + err.message);
    } finally {
      setLoadingAction('');
    }
  };

  // Human auditor governance gate approval with targeted cache invalidation
  const approveGate = async (gateName) => {
    await triggerAction(
      `Approving ${gateName}`,
      () =>
        fetch(`${API_BASE}/api/runs/${runId}/gates/${gateName}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gate: gateName, actor: 'auditor_console', decision: 'approve', reason: 'Card Approved in UI' })
        }),
      [['gates', runId], ['cascadeStats', runId]]
    );
  };

  // Download official JSON audit certificate
  const downloadCertificate = () => {
    if (!certificate || !certificate.certificate) return;
    const blob = new Blob([JSON.stringify(certificate.certificate, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = certificate.download_filename || `provenance-run-${runId}-certificate.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleGenerateInsights = async () => {
    return triggerAction(
      'Generating AI Pre-Flight Insights',
      () => fetch(`${API_BASE}/api/runs/${runId}/insights`, { method: 'POST' }),
      [['insights', runId], ['catalog'], ['cascadeStats', runId], ['events', runId]]
    );
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  return {
    API_BASE,
    activeTab,
    setActiveTab,
    runId,
    setRunId,
    catalog,
    selectedRepoId: activeRepoId,
    setSelectedRepoId,
    findings,
    mappings,
    gates,
    cascadeStats,
    events,
    fidelity,
    certificate,
    beforeAfter,
    insights,
    handleGenerateInsights,
    loadingAction,
    copyFeedback,
    wsConnected,
    sourcesList,
    customVcsType,
    setCustomVcsType,
    customEndpoint,
    setCustomEndpoint,
    customCreds,
    setCustomCreds,
    customTargetOrg,
    setCustomTargetOrg,
    triggerAction,
    updateAuthorMapping,
    handleConnectSource,
    handleRunFullGoldenPath,
    approveGate,
    downloadCertificate,
    copyToClipboard
  };
}
