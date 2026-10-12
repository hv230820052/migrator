import React from 'react';
import PropTypes from 'prop-types';
import {
  Menu,
  ChevronRight,
  ShieldCheck,
  Cpu,
  Play,
  Loader2,
  RotateCcw,
  PanelLeftClose,
  PanelLeftOpen,
  Home
} from 'lucide-react';

const TAB_TITLES = {
  'timeline': 'Live Migration Hub',
  'waves': 'Portfolio & Wave Planning',
  'control-room': 'Control Room & Telemetry',
  'catalog': 'Repository Catalog & Risk',
  'ci-translator': 'CI/CD Pipeline Translator',
  'proof': 'Parity Proof & Certificate'
};

export function Header({
  wsConnected,
  customTargetOrg,
  runId,
  approvedGatesCount,
  cascadeStats,
  loadingAction,
  onRunPipeline,
  onClearDatabase,
  activeTab = 'timeline',
  isSidebarCollapsed = false,
  onToggleSidebar = () => {},
  onOpenMobileMenu = () => {}
}) {
  const currentTitle = TAB_TITLES[activeTab] || 'Mission Control';

  return (
    <header className="app-header">
      {/* Left: Mobile Menu, Sidebar Toggle, & Breadcrumbs */}
      <div className="header-left-zone">
        {/* Mobile Hamburger Menu Toggle */}
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="header-icon-btn mobile-menu-toggle"
          aria-label="Open navigation sidebar"
          title="Open menu"
        >
          <Menu style={{ width: '18px', height: '18px' }} />
        </button>

        {/* Desktop Sidebar Collapse Toggle */}
        <button
          type="button"
          onClick={onToggleSidebar}
          className="header-icon-btn desktop-sidebar-toggle"
          aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isSidebarCollapsed ? (
            <PanelLeftOpen style={{ width: '17px', height: '17px' }} />
          ) : (
            <PanelLeftClose style={{ width: '17px', height: '17px' }} />
          )}
        </button>

        {/* UX4G Breadcrumbs Navigation */}
        <nav aria-label="Breadcrumb" className="breadcrumbs-container">
          <div className="breadcrumb-item">
            <Home style={{ width: '13px', height: '13px', color: 'var(--text-tertiary)' }} />
            <span className="breadcrumb-root">Provenance</span>
          </div>
          <ChevronRight className="breadcrumb-separator" style={{ width: '13px', height: '13px' }} />
          <span className="breadcrumb-current" aria-current="page">
            {currentTitle}
          </span>
        </nav>
      </div>

      {/* Right: Telemetry Chips & Global Pipeline Actions */}
      <div className="header-right-zone">
        {/* Target Org Chip */}
        <span className="header-meta-chip">
          org: <strong style={{ color: 'var(--text-primary)' }}>{customTargetOrg}</strong>
        </span>

        {/* Run ID Chip */}
        <span className="header-meta-chip" style={{ fontFamily: 'var(--font-mono)' }}>
          Run #{runId}
        </span>

        {/* Gates KPI Pill */}
        <div className="header-kpi-chip">
          <ShieldCheck style={{ width: '14px', height: '14px', color: 'var(--text-primary)' }} />
          <span style={{ color: 'var(--text-tertiary)' }}>Gates:</span>
          <strong style={{ color: 'var(--text-primary)' }}>
            {approvedGatesCount}/4
          </strong>
        </div>

        {/* Cascade Budget Pill */}
        <div className="header-kpi-chip">
          <Cpu style={{ width: '14px', height: '14px', color: 'var(--text-primary)' }} />
          <span style={{ color: 'var(--text-tertiary)' }}>Cascade:</span>
          <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            {cascadeStats.budget_used || 0} / {cascadeStats.budget_limit || 100000}
          </strong>
        </div>

        {/* Database Reset */}
        <button
          onClick={onClearDatabase}
          disabled={Boolean(loadingAction)}
          className="btn btn-secondary header-action-btn"
          title="Clear database and start fresh"
        >
          <RotateCcw style={{ width: '13px', height: '13px' }} />
          <span>Reset DB</span>
        </button>

        {/* Autonomous Pipeline CTA */}
        <button
          id="btn-golden-path"
          onClick={onRunPipeline}
          disabled={Boolean(loadingAction)}
          className="btn btn-primary header-action-btn"
        >
          {loadingAction ? (
            <>
              <Loader2 className="animate-spin" style={{ width: '14px', height: '14px' }} />
              <span>{loadingAction}</span>
            </>
          ) : (
            <>
              <Play style={{ width: '14px', height: '14px' }} />
              <span>Execute Pipeline</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
}

Header.propTypes = {
  wsConnected: PropTypes.bool.isRequired,
  customTargetOrg: PropTypes.string.isRequired,
  runId: PropTypes.number.isRequired,
  approvedGatesCount: PropTypes.number.isRequired,
  cascadeStats: PropTypes.shape({
    budget_used: PropTypes.number,
    budget_limit: PropTypes.number,
    budget_tripped: PropTypes.bool
  }).isRequired,
  loadingAction: PropTypes.string,
  onRunPipeline: PropTypes.func.isRequired,
  onClearDatabase: PropTypes.func,
  activeTab: PropTypes.string,
  isSidebarCollapsed: PropTypes.bool,
  onToggleSidebar: PropTypes.func,
  onOpenMobileMenu: PropTypes.func
};
