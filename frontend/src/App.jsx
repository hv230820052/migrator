import React from 'react';
import { useProvenanceRun } from './hooks/useProvenanceRun';
import { Header } from './components/Header';
import { NavigationTabs } from './components/NavigationTabs';
import { MigrationTimelineTab } from './components/tabs/MigrationTimelineTab';
import { WavePlanningTab } from './components/tabs/WavePlanningTab';
import { ControlRoomTab } from './components/tabs/ControlRoomTab';
import { CiTranslatorTab } from './components/tabs/CiTranslatorTab';
import { CertificateTab } from './components/tabs/CertificateTab';
import { CatalogTab } from './components/tabs/CatalogTab';

export default function App() {
  const {
    activeTab,
    setActiveTab,
    runId,
    catalog,
    selectedRepoId,
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
    wavesData,
    handleRefreshWaves,
    handleMoveRepoWave,
    loadingAction,
    copyFeedback,
    wsConnected,
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
    handleConnectAndDiscover,
    stageStatuses,
    activeInspectorStage,
    setActiveInspectorStage,
    connectionReport,
    isAutoRunning,
    handleRunCurator,
    handleRunAssessor,
    handleRunCartographer,
    handleRunGates,
    handleRunExecutor,
    handleRunProver,
    handleRunFullPipeline,
    handleRunFullGoldenPath,
    approveGate,
    downloadCertificate,
    copyToClipboard,
    handleClearDatabase,
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
        onRunPipeline={() => handleRunFullPipeline(selectedRepoId)}
        onClearDatabase={handleClearDatabase}
      />

      {/* Navigation Tabs Bar */}
      <NavigationTabs
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />

      {/* Main Workspace Viewport */}
      <main className="main-content">
        {activeTab === 'timeline' && (
          <MigrationTimelineTab
            catalog={catalog}
            selectedRepoId={selectedRepoId}
            onSelectRepo={setSelectedRepoId}
            customVcsType={customVcsType}
            setCustomVcsType={setCustomVcsType}
            customEndpoint={customEndpoint}
            setCustomEndpoint={setCustomEndpoint}
            customCreds={customCreds}
            setCustomCreds={setCustomCreds}
            customTargetOrg={customTargetOrg}
            setCustomTargetOrg={setCustomTargetOrg}
            loadingAction={loadingAction}
            stageStatuses={stageStatuses}
            activeInspectorStage={activeInspectorStage}
            setActiveInspectorStage={setActiveInspectorStage}
            connectionReport={connectionReport}
            isAutoRunning={isAutoRunning}
            onConnectAndDiscover={handleConnectAndDiscover}
            onRunCurator={handleRunCurator}
            onRunAssessor={handleRunAssessor}
            onRunCartographer={handleRunCartographer}
            onRunGates={handleRunGates}
            onRunExecutor={handleRunExecutor}
            onRunProver={handleRunProver}
            onRunFullPipeline={handleRunFullPipeline}
            findings={findings}
            mappings={mappings}
            gates={gates}
            events={events}
            fidelity={fidelity}
            certificate={certificate}
            insights={insights}
            onUpdateMapping={updateAuthorMapping}
            onApproveGate={approveGate}
            onDownloadCertificate={downloadCertificate}
            copyFeedback={copyFeedback}
            onCopyText={copyToClipboard}
            API_BASE={API_BASE}
          />
        )}

        {activeTab === 'waves' && (
          <WavePlanningTab
            wavesData={wavesData}
            loadingAction={loadingAction}
            onRefreshWaves={handleRefreshWaves}
            onMoveRepo={handleMoveRepoWave}
            onApprovePlanGate={() => approveGate('PLAN')}
            onNavigate={setActiveTab}
          />
        )}

        {activeTab === 'control-room' && (
          <ControlRoomTab
            runId={runId}
            events={events}
            loadingAction={loadingAction}
            onExecuteMigration={() => handleRunExecutor(selectedRepoId)}
            API_BASE={API_BASE}
          />
        )}

        {activeTab === 'ci-translator' && (
          <CiTranslatorTab
            API_BASE={API_BASE}
            copyToClipboard={copyToClipboard}
            copyFeedback={copyFeedback}
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

        {activeTab === 'catalog' && (
          <CatalogTab
            catalog={catalog}
            loadingAction={loadingAction}
            onReassess={handleGenerateInsights}
            onNavigateToOverview={() => setActiveTab('timeline')}
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