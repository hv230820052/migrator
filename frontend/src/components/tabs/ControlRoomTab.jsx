import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { 
  Terminal, 
  Play, 
  CheckCircle2, 
  ShieldAlert, 
  Sparkles, 
  Activity, 
  Zap, 
  HardDrive, 
  GitBranch, 
  Cpu,
  RefreshCw
} from 'lucide-react';

const STAGES = [
  '1. Scout',
  '2. Curate',
  '3. Assess',
  '4. Map',
  '5. Gates',
  '6. Migrate & Prove'
];

export function ControlRoomTab({ 
  runId, 
  events, 
  loadingAction, 
  onExecuteMigration,
  API_BASE 
}) {
  const [simulationState, setSimulationState] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const handleSimulateHealer = async (failureType) => {
    setIsSimulating(true);
    try {
      const res = await fetch(`${API_BASE}/api/runs/${runId}/healer/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          failure_type: failureType,
          repo_name: 'messy-svn-repo'
        })
      });
      const data = await res.json();
      setSimulationState(data);
    } catch (e) {
      console.error('Failed to run healer simulation:', e);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top Migration Control Panel */}
      <div className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">
              <Terminal style={{ width: '16px', height: '16px', color: 'var(--status-info)' }} />
              <span>Autonomous Control Room & Live Feed</span>
            </h2>
            <p className="panel-description">
              Real-time WebSocket event stream (`/api/runs/{runId}/events`) with sub-second latency.
            </p>
          </div>
          <button
            id="btn-migrate"
            type="button"
            onClick={onExecuteMigration}
            className="btn btn-primary"
            disabled={Boolean(loadingAction)}
          >
            <Play style={{ width: '13px', height: '13px' }} />
            <span>Execute Migration Push</span>
          </button>
        </div>

        {/* Stage Progress Pipeline */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: '0.5rem',
          padding: '1rem 1.25rem',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--surface-primary)',
          border: '1px solid var(--border-subtle)',
          marginBottom: '1.75rem',
          textAlign: 'center',
          fontSize: '0.78rem',
          fontFamily: 'var(--font-mono)'
        }}>
          {STAGES.map((stg) => (
            <div key={stg} style={{ color: 'var(--text-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
              <CheckCircle2 style={{ width: '14px', height: '14px' }} />
              <span>{stg}</span>
            </div>
          ))}
        </div>

        {/* Event Log Stream */}
        <div style={{ marginBottom: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Live Agent Activity Log ({events.length} events)
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
            ws://localhost:8100/api/runs/{runId}/events
          </span>
        </div>

        <div style={{
          maxHeight: '380px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          padding: '1rem',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--surface-primary)',
          border: '1px solid var(--border-subtle)'
        }}>
          {events.map((ev, idx) => (
            <div key={ev.id || idx} style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '0.85rem',
              padding: '0.65rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--surface-secondary)',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.8rem',
              fontFamily: 'var(--font-mono)',
              lineHeight: 1.5
            }}>
              <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', minWidth: '65px' }}>
                {ev.ts ? new Date(ev.ts).toLocaleTimeString() : '00:00:00'}
              </span>
              <span className={`badge ${ev.tier === 'T3' ? 'badge-t3' : ev.tier === 'T2' ? 'badge-t2' : 'badge-t0'}`}>
                {ev.tier || 'T0'}
              </span>
              <strong style={{ color: 'var(--text-primary)', minWidth: '75px' }}>
                {ev.agent || 'Executor'}:
              </strong>
              <span style={{ color: 'var(--text-primary)' }}>
                {ev.action}
              </span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginLeft: 'auto' }}>
                {ev.reason}
              </span>
            </div>
          ))}

          {events.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>
              Listening on WebSocket stream... Actions will appear here live.
            </div>
          )}
        </div>
      </div>

      {/* Autonomous Healer Lab & Simulation Panel (FR-07 / US-06) */}
      <div className="panel" style={{ borderTop: '2px solid rgba(56, 189, 248, 0.4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '15px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="agent-badge-circle" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                <Zap size={18} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
                Autonomous Healer Lab & Diagnosis Simulator (FR-07 / US-06)
              </h3>
            </div>
            <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '0.82rem' }}>
              Simulate injected runtime failures to demonstrate automated root-cause diagnosis, LFS conversion, and push retries.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              className="btn btn-secondary"
              onClick={() => handleSimulateHealer('oversized_lfs')}
              disabled={isSimulating}
              style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <HardDrive size={13} color="#f87171" />
              <span>1. Inject 112MB Blob (LFS Self-Heal)</span>
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => handleSimulateHealer('non_fast_forward')}
              disabled={isSimulating}
              style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <GitBranch size={13} color="#fbbf24" />
              <span>2. Inject Stale Ref (Auto-Rebase)</span>
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => handleSimulateHealer('novel_error')}
              disabled={isSimulating}
              style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <Cpu size={13} color="#a855f7" />
              <span>3. Inject Novel Error (T2 AI Diagnosis)</span>
            </button>
          </div>
        </div>

        {/* Live Simulation Card */}
        {simulationState && (
          <div style={{
            padding: '14px',
            background: 'rgba(15, 23, 42, 0.75)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            animation: 'fadeIn 0.3s ease'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className={`badge ${simulationState.result?.tier === 'T2' ? 'badge-t2' : 'badge-t0'}`}>
                  {simulationState.result?.tier || 'T0'}
                </span>
                <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.85rem' }}>
                  Signature: {simulationState.result?.failure_signature}
                </span>
              </div>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: simulationState.result?.auto_applied ? '#4ade80' : '#fbbf24',
                background: simulationState.result?.auto_applied ? 'rgba(74, 222, 128, 0.1)' : 'rgba(251, 191, 36, 0.1)',
                padding: '3px 8px',
                borderRadius: '4px'
              }}>
                {simulationState.result?.auto_applied ? '✓ AUTO-HEALED & RETRIED' : 'REQUIRES APPROVAL'}
              </span>
            </div>

            <div style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: '1.4' }}>
              <strong style={{ color: '#94a3b8' }}>Diagnosis: </strong>
              {simulationState.result?.diagnosis}
            </div>

            <div style={{ fontSize: '0.8rem', color: '#38bdf8', lineHeight: '1.4' }}>
              <strong style={{ color: '#94a3b8' }}>Remedy: </strong>
              {simulationState.result?.remedy}
            </div>

            <div style={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace', background: '#090d16', padding: '6px 10px', borderRadius: '4px' }}>
              Raw Error: {simulationState.simulated_error}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

ControlRoomTab.propTypes = {
  runId: PropTypes.number.isRequired,
  events: PropTypes.array.isRequired,
  loadingAction: PropTypes.string,
  onExecuteMigration: PropTypes.func.isRequired,
  API_BASE: PropTypes.string
};
