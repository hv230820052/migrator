import React from 'react';
import PropTypes from 'prop-types';
import {
  LayoutDashboard,
  Network,
  Database,
  Layers,
  ShieldAlert,
  Users,
  Lock,
  Terminal,
  Workflow,
  FileCheck
} from 'lucide-react';

const TABS = [
  { id: 'timeline', label: 'Live Migration Timeline', icon: Network },
  { id: 'waves', label: 'Portfolio & Wave Planning', icon: Layers },
  { id: 'control-room', label: 'Control Room & Healer Lab', icon: Terminal },
  { id: 'ci-translator', label: 'CI/CD Translator', icon: Workflow },
  { id: 'proof', label: 'Proof & Certificate', icon: FileCheck },
];

export function NavigationTabs({ activeTab, onSelectTab }) {
  return (
    <nav className="tab-bar">
      {TABS.map((tab, idx) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            className={`tab-btn ${isActive ? 'active' : ''}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.55rem',
              borderBottom: isActive ? '3px solid var(--brand-primary)' : '3px solid transparent',
              color: isActive ? 'var(--brand-primary)' : 'var(--text-secondary)'
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                fontSize: '0.65rem',
                fontWeight: 700,
                background: isActive ? 'var(--brand-primary)' : 'var(--surface-secondary)',
                color: isActive ? '#ffffff' : 'var(--text-tertiary)',
                border: '1px solid var(--border-subtle)'
              }}
            >
              {idx + 1}
            </span>
            <Icon style={{ width: '15px', height: '15px', color: isActive ? 'var(--brand-primary)' : 'var(--text-tertiary)' }} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

NavigationTabs.propTypes = {
  activeTab: PropTypes.string.isRequired,
  onSelectTab: PropTypes.func.isRequired
};
