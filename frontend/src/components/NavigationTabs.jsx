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
          >
            <Icon style={{ width: '15px', height: '15px' }} />
            <span>{idx + 1}. {tab.label}</span>
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
