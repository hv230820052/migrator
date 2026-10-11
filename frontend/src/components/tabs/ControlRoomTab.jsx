import React from 'react';
import PropTypes from 'prop-types';
import { Terminal, Play, CheckCircle2 } from 'lucide-react';

const STAGES = [
  '1. Scout',
  '2. Curate',
  '3. Assess',
  '4. Map',
  '5. Gates',
  '6. Migrate & Prove'
];

export function ControlRoomTab({ runId, events, loadingAction, onExecuteMigration }) {
  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
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
          maxHeight: '440px',
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
    </div>
  );
}

ControlRoomTab.propTypes = {
  runId: PropTypes.number.isRequired,
  events: PropTypes.array.isRequired,
  loadingAction: PropTypes.string,
  onExecuteMigration: PropTypes.func.isRequired
};
