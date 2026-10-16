import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Network,
  Layers,
  Terminal,
  Workflow,
  FileCheck,
  Database,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Loader2,
  Building2,
  GitBranch,
  ShieldAlert,
  Cpu,
  Users,
  Lock
} from 'lucide-react';

const STAGES = [
  { id: 'scout', number: 1, title: 'Scout Discovery', icon: Network },
  { id: 'curator', number: 2, title: 'Secret & Binaries', icon: ShieldAlert },
  { id: 'assessor', number: 3, title: 'Risk & Complexity', icon: Cpu },
  { id: 'cartographer', number: 4, title: 'Identity Mapping', icon: Users },
  { id: 'gates', number: 5, title: 'Governance Gates', icon: Lock },
  { id: 'executor', number: 6, title: 'Migration Push', icon: Terminal },
  { id: 'prover', number: 7, title: 'Parity Proof', icon: FileCheck },
];

export function Sidebar({
  activeTab,
  onSelectTab,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
  catalogCount = 0,
  approvedGatesCount = 0,
  activeInspectorStage = 'scout',
  onSelectInspectorStage = () => {},
  stageStatuses = {},
  wsConnected = false,
  customTargetOrg = 'octathon-target'
}) {
  const [stagesMenuOpen, setStagesMenuOpen] = useState(true);

  // Close mobile drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isMobileOpen) {
        onCloseMobile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileOpen, onCloseMobile]);

  const handleNavClick = (tabId) => {
    onSelectTab(tabId);
    if (isMobileOpen) {
      onCloseMobile();
    }
  };

  const handleStageClick = (stageId) => {
    onSelectTab('timeline');
    onSelectInspectorStage(stageId);
    if (isMobileOpen) {
      onCloseMobile();
    }
    setTimeout(() => {
      document.getElementById('timeline-stage-inspector')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  };

  const getStageStatusIcon = (status) => {
    if (status === 'done' || status === 'completed') {
      return <CheckCircle2 style={{ width: '12px', height: '12px', color: 'var(--status-success)', flexShrink: 0 }} />;
    }
    if (status === 'running') {
      return <Loader2 className="animate-spin" style={{ width: '12px', height: '12px', color: 'var(--brand-primary)', flexShrink: 0 }} />;
    }
    return <Clock style={{ width: '12px', height: '12px', color: 'var(--text-disabled)', flexShrink: 0 }} />;
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          className="sidebar-overlay"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Main Semantic Sidebar */}
      <aside
        id="app-sidebar"
        className={`sidebar ${isCollapsed ? 'sidebar-collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}
        aria-label="Main Navigation"
      >
        {/* Brand Header */}
        <div className="sidebar-header">
          <div className="sidebar-brand-container">
            <div className="sidebar-brand-icon">
              <ShieldCheck style={{ width: '22px', height: '22px', color: '#ffffff' }} />
            </div>
            {!isCollapsed && (
              <div className="sidebar-brand-text">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span className="sidebar-brand-title">PROVENANCE</span>
                  <span className="badge badge-t2" style={{ fontSize: '0.58rem', padding: '0.05rem 0.35rem' }}>
                    UX4G 3.0
                  </span>
                </div>
                <span className="sidebar-brand-sub">Autonomous Migration Engine</span>
              </div>
            )}
          </div>

          {/* Mobile Close Button */}
          {isMobileOpen && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="sidebar-close-btn"
              aria-label="Close navigation drawer"
            >
              <X style={{ width: '18px', height: '18px' }} />
            </button>
          )}
        </div>

        {/* Navigation Content */}
        <nav className="sidebar-nav" aria-label="Primary sections">
          {/* GROUP 1: MIGRATION PIPELINE */}
          <div className="sidebar-group">
            {!isCollapsed && (
              <div className="sidebar-group-title">
                MIGRATION PIPELINE
              </div>
            )}

            {/* Item 1: Live Migration Hub */}
            <div className="sidebar-nav-item-wrapper">
              <button
                type="button"
                onClick={() => handleNavClick('timeline')}
                className={`sidebar-nav-btn ${activeTab === 'timeline' ? 'active' : ''}`}
                aria-current={activeTab === 'timeline' ? 'page' : undefined}
                title="Live Migration Hub (7-Stage Autonomous Engine)"
              >
                <div className="sidebar-nav-btn-main">
                  <Network className="sidebar-nav-icon" />
                  {!isCollapsed && <span className="sidebar-nav-label">Live Migration Hub</span>}
                </div>
                {!isCollapsed && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        backgroundColor: wsConnected ? 'var(--status-success)' : 'var(--text-disabled)'
                      }}
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setStagesMenuOpen(!stagesMenuOpen);
                      }}
                      className="sidebar-chevron-btn"
                      aria-label="Toggle pipeline stages menu"
                      title="Toggle stages"
                    >
                      <ChevronDown
                        style={{
                          width: '13px',
                          height: '13px',
                          transform: stagesMenuOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                          transition: 'transform 0.15s ease'
                        }}
                      />
                    </button>
                  </div>
                )}
              </button>

              {/* Nested Stages Navigation (when not collapsed and open) */}
              {!isCollapsed && stagesMenuOpen && (
                <div className="sidebar-sub-nav">
                  {STAGES.map((stg) => {
                    const isSelectedStage = activeTab === 'timeline' && activeInspectorStage === stg.id;
                    const status = stageStatuses[stg.id] || 'pending';
                    return (
                      <button
                        key={stg.id}
                        type="button"
                        onClick={() => handleStageClick(stg.id)}
                        className={`sidebar-sub-btn ${isSelectedStage ? 'active' : ''}`}
                        title={`${stg.number}. ${stg.title}`}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                          <span className="sidebar-sub-step">{stg.number}</span>
                          <span className="sidebar-sub-label">{stg.title}</span>
                        </div>
                        {getStageStatusIcon(status)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Item 2: Portfolio & Waves */}
            <button
              type="button"
              onClick={() => handleNavClick('waves')}
              className={`sidebar-nav-btn ${activeTab === 'waves' ? 'active' : ''}`}
              aria-current={activeTab === 'waves' ? 'page' : undefined}
              title="Portfolio & Wave Planning"
            >
              <div className="sidebar-nav-btn-main">
                <Layers className="sidebar-nav-icon" />
                {!isCollapsed && <span className="sidebar-nav-label">Portfolio & Waves</span>}
              </div>
              {!isCollapsed && (
                <span className="sidebar-badge-count">
                  Wave Plan
                </span>
              )}
            </button>

            {/* Item 3: Control Room & Telemetry */}
            <button
              type="button"
              onClick={() => handleNavClick('control-room')}
              className={`sidebar-nav-btn ${activeTab === 'control-room' ? 'active' : ''}`}
              aria-current={activeTab === 'control-room' ? 'page' : undefined}
              title="Control Room & Telemetry"
            >
              <div className="sidebar-nav-btn-main">
                <Terminal className="sidebar-nav-icon" />
                {!isCollapsed && <span className="sidebar-nav-label">Control Room</span>}
              </div>
              {!isCollapsed && (
                <span className="sidebar-badge-count" style={{ fontFamily: 'var(--font-mono)' }}>
                  Live Bus
                </span>
              )}
            </button>
          </div>

          {/* GROUP 2: GOVERNANCE & TOOLS */}
          <div className="sidebar-group" style={{ marginTop: '1.25rem' }}>
            {!isCollapsed && (
              <div className="sidebar-group-title">
                GOVERNANCE & TOOLS
              </div>
            )}

            {/* Item 4: Repository Catalog */}
            <button
              type="button"
              onClick={() => handleNavClick('catalog')}
              className={`sidebar-nav-btn ${activeTab === 'catalog' ? 'active' : ''}`}
              aria-current={activeTab === 'catalog' ? 'page' : undefined}
              title="Discovered Repository Catalog & Risk Scoring"
            >
              <div className="sidebar-nav-btn-main">
                <Database className="sidebar-nav-icon" />
                {!isCollapsed && <span className="sidebar-nav-label">Repository Catalog</span>}
              </div>
              {!isCollapsed && (
                <span className="sidebar-badge-count">
                  {catalogCount} Repos
                </span>
              )}
            </button>

            {/* Item 5: CI/CD Translator */}
            <button
              type="button"
              onClick={() => handleNavClick('ci-translator')}
              className={`sidebar-nav-btn ${activeTab === 'ci-translator' ? 'active' : ''}`}
              aria-current={activeTab === 'ci-translator' ? 'page' : undefined}
              title="CI/CD Autonomous Pipeline Translator"
            >
              <div className="sidebar-nav-btn-main">
                <Workflow className="sidebar-nav-icon" />
                {!isCollapsed && <span className="sidebar-nav-label">CI/CD Translator</span>}
              </div>
              {!isCollapsed && (
                <span className="sidebar-badge-count">
                  Actions
                </span>
              )}
            </button>

            {/* Item 6: Parity Certificate */}
            <button
              type="button"
              onClick={() => handleNavClick('proof')}
              className={`sidebar-nav-btn ${activeTab === 'proof' ? 'active' : ''}`}
              aria-current={activeTab === 'proof' ? 'page' : undefined}
              title="Cryptographic Proof & Parity Certificate"
            >
              <div className="sidebar-nav-btn-main">
                <FileCheck className="sidebar-nav-icon" />
                {!isCollapsed && <span className="sidebar-nav-label">Parity Certificate</span>}
              </div>
              {!isCollapsed && (
                <span className="sidebar-badge-count">
                  SHA-256
                </span>
              )}
            </button>
          </div>
        </nav>

        {/* Sidebar Footer / System Context */}
        <div className="sidebar-footer">
          {!isCollapsed ? (
            <div className="sidebar-footer-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.25rem' }}>
                <Building2 style={{ width: '13px', height: '13px', color: 'var(--brand-primary)' }} />
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  TARGET ORG
                </span>
              </div>
              <div style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {customTargetOrg}
              </div>
              <div style={{
                fontSize: '0.68rem',
                color: 'var(--text-tertiary)',
                marginTop: '0.2rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}>
                <span style={{
                  display: 'inline-block',
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: wsConnected ? 'var(--status-success)' : 'var(--status-danger)'
                }} />
                <span>{wsConnected ? 'WebSocket Online' : 'System Offline'}</span>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '0.5rem 0' }}>
              <span
                style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: wsConnected ? 'var(--status-success)' : 'var(--status-danger)'
                }}
                title={wsConnected ? 'System Online' : 'System Offline'}
              />
            </div>
          )}

          {/* Desktop Collapse Toggle */}
          <div className="sidebar-collapse-wrapper">
            <button
              type="button"
              onClick={onToggleCollapse}
              className="sidebar-collapse-toggle-btn"
              aria-label={isCollapsed ? 'Expand sidebar navigation' : 'Collapse sidebar navigation'}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? (
                <ChevronRight style={{ width: '15px', height: '15px' }} />
              ) : (
                <>
                  <ChevronLeft style={{ width: '15px', height: '15px' }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>Collapse Sidebar</span>
                </>
              )}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

Sidebar.propTypes = {
  activeTab: PropTypes.string.isRequired,
  onSelectTab: PropTypes.func.isRequired,
  isCollapsed: PropTypes.bool.isRequired,
  onToggleCollapse: PropTypes.func.isRequired,
  isMobileOpen: PropTypes.bool.isRequired,
  onCloseMobile: PropTypes.func.isRequired,
  catalogCount: PropTypes.number,
  approvedGatesCount: PropTypes.number,
  activeInspectorStage: PropTypes.string,
  onSelectInspectorStage: PropTypes.func,
  stageStatuses: PropTypes.object,
  wsConnected: PropTypes.bool,
  customTargetOrg: PropTypes.string
};
