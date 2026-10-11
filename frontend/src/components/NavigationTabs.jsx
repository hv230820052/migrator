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
  { id: 'overview', label: 'Overview & Heatmap', icon: LayoutDashboard },
  { id: 'sources', label: 'Sources & Scout', icon: Network },
  { id: 'catalog', label: 'Repos & Risk', icon: Database },
  { id: 'waves', label: 'Wave Planning', icon: Layers },
  { id: 'curator', label: 'Secrets & Findings', icon: ShieldAlert },
  { id: 'cartographer', label: 'Identity Mapping', icon: Users },
  { id: 'gates', label: 'Governance Gates', icon: Lock },
  { id: 'control-room', label: 'Control Room & Healer', icon: Terminal },
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
