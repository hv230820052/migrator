import React, { useState } from 'react';
import { useProvenanceRun } from './hooks/useProvenanceRun';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
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
    accountRepos,
    setAccountRepos,
    accountReposErrors,
    setAccountReposErrors,
    isFetchingAccountRepos,
    handleFetchAccountRepos,
    pipelineElapsedSeconds,
    pipelineLiveStep,
    ticketsData,
    API_BASE
  } = useProvenanceRun(1);

  // Responsive Sidebar States
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('sidebar_collapsed') === 'true';
    } catch (e) {
      return false;
    }
  });
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('sidebar_collapsed', String(next));
      } catch (e) {}
      return next;
    });
  };

  const approvedGatesCount = gates.filter((g) => g.status === 'approved' || g.status === 'approve').length;

  return (
    <div className="app-shell">
      {/* UX4G 3.0 Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
        catalogCount={catalog.length}
        approvedGatesCount={approvedGatesCount}
        activeInspectorStage={activeInspectorStage}
        onSelectInspectorStage={setActiveInspectorStage}
        stageStatuses={stageStatuses}
        wsConnected={wsConnected}
        customTargetOrg={customTargetOrg}
      />

      {/* Main App Viewport */}
      <div className="app-main-viewport">
        {/* Global Mission Control Bar */}
        <Header
          wsConnected={wsConnected}
          customTargetOrg={customTargetOrg}
          runId={runId}
          approvedGatesCount={approvedGatesCount}
          cascadeStats={cascadeStats}
          loadingAction={loadingAction}
          onRunPipeline={() => handleRunFullPipeline(selectedRepoId)}
          onClearDatabase={handleClearDatabase}
          activeTab={activeTab}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={toggleSidebarCollapse}
          onOpenMobileMenu={() => setIsMobileOpen(true)}
        />

        {/* Content Viewport */}
        <main className="app-content">
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
              accountRepos={accountRepos}
              setAccountRepos={setAccountRepos}
              accountReposErrors={accountReposErrors}
              isFetchingAccountRepos={isFetchingAccountRepos}
              onFetchAccountRepos={handleFetchAccountRepos}
              pipelineElapsedSeconds={pipelineElapsedSeconds}
              pipelineLiveStep={pipelineLiveStep}
              ticketsData={ticketsData}
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

        {/* Clean UX4G Footer */}
        <footer className="app-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
              Provenance Migration Platform
            </span>
            <span style={{ color: 'var(--border-strong)' }}>|</span>
            <span>UX4G 3.0 Accessible Design Standard</span>
          </div>
          <div>
            ISO/IEC 27001 Cryptographic Parity Guaranteed
          </div>
        </footer>
      </div>
    </div>
  );
}