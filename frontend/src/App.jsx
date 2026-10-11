import React from 'react';
import { useProvenanceRun } from './hooks/useProvenanceRun';
import { Header } from './components/Header';
import { NavigationTabs } from './components/NavigationTabs';
import { OverviewTab } from './components/tabs/OverviewTab';
import { SourcesTab } from './components/tabs/SourcesTab';
import { CatalogTab } from './components/tabs/CatalogTab';
import { FindingsTab } from './components/tabs/FindingsTab';
import { MappingsTab } from './components/tabs/MappingsTab';
import { GatesTab } from './components/tabs/GatesTab';
import { ControlRoomTab } from './components/tabs/ControlRoomTab';
import { CertificateTab } from './components/tabs/CertificateTab';

export default function App() {
  const {
    activeTab,
    setActiveTab,
    runId,
    catalog,
    findings,
    mappings,
    gates,
    cascadeStats,
    events,
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
    handleConnectSource,
    handleRunFullGoldenPath,
    approveGate,
    downloadCertificate,
    copyToClipboard,
    API_BASE
  } = useProvenanceRun(1);

  const approvedGatesCount = gates.filter((g) => g.status === 'approved').length;

  return (
    <div className="app-container">
      {/* Top Mission Control Bar */}
      <Header
        wsConnected={wsConnected}
        customTargetOrg={customTargetOrg}
        runId={runId}
        approvedGatesCount={approvedGatesCount}
        cascadeStats={cascadeStats}
        loadingAction={loadingAction}
        onRunPipeline={() => handleRunFullGoldenPath()}
      />

      {/* Tab Switcher */}
      <NavigationTabs
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />

      {/* Main Workspace Viewport */}
      <main className="main-content">
        {activeTab === 'overview' && (
          <OverviewTab
            catalog={catalog}
            insights={insights}
            loadingAction={loadingAction}
            onGenerateInsights={handleGenerateInsights}
            onNavigate={setActiveTab}
          />
        )}

        {activeTab === 'sources' && (
          <SourcesTab
            customVcsType={customVcsType}
            setCustomVcsType={setCustomVcsType}
            customEndpoint={customEndpoint}
            setCustomEndpoint={setCustomEndpoint}
            customCreds={customCreds}
            setCustomCreds={setCustomCreds}
            customTargetOrg={customTargetOrg}
            setCustomTargetOrg={setCustomTargetOrg}
            sourcesList={sourcesList}
            loadingAction={loadingAction}
            onConnectSource={handleConnectSource}
            onLaunchMigration={handleRunFullGoldenPath}
            onRunDiscovery={() =>
              triggerAction(
                'Discovering Repositories',
                () => fetch(`${API_BASE}/api/runs/${runId}/discover`, { method: 'POST' }),
                [['catalog'], ['cascadeStats', runId]]
              )
            }
          />
        )}

        {activeTab === 'catalog' && (
          <CatalogTab
            catalog={catalog}
            loadingAction={loadingAction}
            onReassess={handleGenerateInsights}
            onNavigateToOverview={() => setActiveTab('overview')}
          />
        )}

        {activeTab === 'curator' && (
          <FindingsTab
            findings={findings}
            loadingAction={loadingAction}
            onRescan={() =>
              triggerAction(
                'Curating Findings',
                () => fetch(`${API_BASE}/api/runs/${runId}/curate`, { method: 'POST' }),
                [['findings'], ['cascadeStats', runId]]
              )
            }
          />
        )}

        {activeTab === 'cartographer' && (
          <MappingsTab
            mappings={mappings}
          />
        )}

        {activeTab === 'gates' && (
          <GatesTab
            gates={gates}
            loadingAction={loadingAction}
            onApproveGate={approveGate}
          />
        )}

        {activeTab === 'control-room' && (
          <ControlRoomTab
            runId={runId}
            events={events}
            loadingAction={loadingAction}
            onExecuteMigration={() =>
              triggerAction('Starting Migration', () =>
                fetch(`${API_BASE}/api/runs/${runId}/migrate`, { method: 'POST' })
              )
            }
          />
        )}

        {activeTab === 'proof' && (
          <CertificateTab
            beforeAfter={beforeAfter}
            copyFeedback={copyFeedback}
            onCopyCommand={copyToClipboard}
            onDownloadCert={downloadCertificate}
          />
        )}
      </main>

      {/* Production Engineering Footer */}
      <footer style={{
        borderTop: '1px solid var(--border-subtle)',
        backgroundColor: 'var(--surface-primary)',
        padding: '0.85rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '0.72rem',
        color: 'var(--text-tertiary)',
        fontFamily: 'var(--font-mono)'
      }}>
        <div>Provenance Migration Platform · AIDLC Architecture · D-08 / D-09 Compliant</div>
        <div>Strict Cascade Routing (T0 → T2 → T3) · 0 LLM Tokens in Verification</div>
      </footer>
    </div>
  );
}