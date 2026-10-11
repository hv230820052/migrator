import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { 
  GitBranch, 
  Workflow, 
  Copy, 
  Check, 
  Download, 
  Play, 
  Sparkles, 
  ShieldAlert, 
  Cpu, 
  FileCode,
  ArrowRight
} from 'lucide-react';

export function CiTranslatorTab({
  API_BASE,
  copyToClipboard,
  copyFeedback
}) {
  const [gitlabInput, setGitlabInput] = useState('');
  const [githubOutput, setGithubOutput] = useState('');
  const [translationStats, setTranslationStats] = useState(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [repoName, setRepoName] = useState('billing-api');

  // Load initial sample
  useEffect(() => {
    fetchSample();
  }, []);

  const fetchSample = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/ci-translate/sample`);
      const data = await res.json();
      if (data.sample_gitlab_ci) {
        setGitlabInput(data.sample_gitlab_ci);
      }
    } catch (e) {
      console.error('Failed to fetch sample GitLab CI:', e);
    }
  };

  const handleTranslate = async () => {
    if (!gitlabInput.trim()) return;
    setIsTranslating(true);
    try {
      const res = await fetch(`${API_BASE}/api/ci-translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gitlab_ci_yaml: gitlabInput,
          repo_name: repoName
        })
      });
      const data = await res.json();
      setGithubOutput(data.github_actions_yaml || '');
      setTranslationStats(data);
    } catch (e) {
      console.error('Translation failed:', e);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleDownload = () => {
    if (!githubOutput) return;
    const blob = new Blob([githubOutput], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ci.yml';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="tab-pane active fade-in">
      {/* Top Header Card */}
      <div className="card glass-card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="agent-badge-circle" style={{ background: 'rgba(236, 72, 153, 0.15)', color: '#ec4899' }}>
                <Workflow size={20} />
              </div>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: '#f8fafc' }}>
                CI/CD Pipeline Translator (F-11)
              </h2>
            </div>
            <p style={{ margin: '6px 0 0 0', color: '#94a3b8', fontSize: '0.9rem' }}>
              Autonomous translation of legacy GitLab CI workflows (<code style={{ color: '#38bdf8' }}>.gitlab-ci.yml</code>) into modern GitHub Actions (<code style={{ color: '#4ade80' }}>.github/workflows/ci.yml</code>).
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              className="btn btn-secondary"
              onClick={fetchSample}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <FileCode size={14} />
              <span>Load Sample GitLab CI</span>
            </button>
            <button
              className="btn btn-primary"
              onClick={handleTranslate}
              disabled={isTranslating}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {isTranslating ? <Cpu size={14} className="spin" /> : <Sparkles size={14} />}
              <span>{isTranslating ? 'Translating...' : 'Translate Pipeline (T0 + T2)'}</span>
            </button>
          </div>
        </div>

        {/* Translation Metrics Badges */}
        {translationStats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="metric-pill">
              <span className="metric-label">Jobs Converted</span>
              <span className="metric-value" style={{ color: '#4ade80' }}>{translationStats.jobs_mapped}</span>
            </div>
            <div className="metric-pill">
              <span className="metric-label">Stages Mapped</span>
              <span className="metric-value" style={{ color: '#38bdf8' }}>{translationStats.stages_mapped}</span>
            </div>
            <div className="metric-pill">
              <span className="metric-label">Secrets Parameterized</span>
              <span className="metric-value" style={{ color: translationStats.secrets_flagged?.length ? '#f59e0b' : '#94a3b8' }}>
                {translationStats.secrets_flagged?.length || 0}
              </span>
            </div>
            <div className="metric-pill">
              <span className="metric-label">Decision Tier</span>
              <span className="metric-value" style={{ color: '#a855f7' }}>
                {translationStats.tier || 'T0'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Side-by-Side Comparative Split View */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
        {/* Left: GitLab CI Input */}
        <div className="card glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#fc6d26' }}></span>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#f8fafc' }}>
                Source: .gitlab-ci.yml
              </h3>
            </div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Editable Source</span>
          </div>

          <textarea
            value={gitlabInput}
            onChange={(e) => setGitlabInput(e.target.value)}
            placeholder="Paste your .gitlab-ci.yml here..."
            rows={22}
            style={{
              width: '100%',
              flex: 1,
              background: '#090d16',
              color: '#cbd5e1',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '6px',
              padding: '12px',
              fontFamily: 'monospace',
              fontSize: '0.85rem',
              lineHeight: '1.5',
              resize: 'vertical',
              boxSizing: 'border-box',
              outline: 'none'
            }}
          />
        </div>

        {/* Right: GitHub Actions Output */}
        <div className="card glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#4ade80' }}></span>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#f8fafc' }}>
                Target: .github/workflows/ci.yml
              </h3>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                className="btn-tiny"
                onClick={() => copyToClipboard(githubOutput)}
                disabled={!githubOutput}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1' }}
              >
                {copyFeedback ? <Check size={12} color="#4ade80" /> : <Copy size={12} />}
                <span>{copyFeedback ? 'Copied!' : 'Copy'}</span>
              </button>
              <button
                className="btn-tiny"
                onClick={handleDownload}
                disabled={!githubOutput}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#38bdf8' }}
              >
                <Download size={12} />
                <span>Download</span>
              </button>
            </div>
          </div>

          {githubOutput ? (
            <pre
              style={{
                margin: 0,
                flex: 1,
                background: '#090d16',
                color: '#a5f3fc',
                border: '1px solid rgba(56, 189, 248, 0.2)',
                borderRadius: '6px',
                padding: '12px',
                fontFamily: 'monospace',
                fontSize: '0.85rem',
                lineHeight: '1.5',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                minHeight: '440px'
              }}
            >
              {githubOutput}
            </pre>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '440px', background: '#090d16', borderRadius: '6px', border: '1px dashed rgba(255,255,255,0.1)', color: '#64748b', textAlign: 'center', padding: '20px' }}>
              <Workflow size={36} style={{ marginBottom: '12px', opacity: 0.5 }} />
              <p style={{ margin: 0, fontSize: '0.9rem' }}>
                Click <strong>"Translate Pipeline"</strong> above to synthesize the target GitHub Actions workflow.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Warnings & Notes Box */}
      {translationStats?.secrets_flagged && translationStats.secrets_flagged.length > 0 && (
        <div className="card glass-card" style={{ marginTop: '20px', borderLeft: '4px solid #f59e0b', background: 'rgba(245, 158, 11, 0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <ShieldAlert size={18} color="#f59e0b" style={{ marginTop: '2px' }} />
            <div>
              <strong style={{ color: '#fbbf24', fontSize: '0.92rem' }}>
                Required Target Organization Secrets:
              </strong>
              <p style={{ margin: '4px 0 0 0', color: '#cbd5e1', fontSize: '0.85rem' }}>
                The following variables were flagged as credentials in the source pipeline. Add them in GitHub under <strong>Repository Settings ➔ Secrets and Variables ➔ Actions</strong>:
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                {translationStats.secrets_flagged.map((s) => (
                  <span key={s} className="risk-pill-sm risk-medium" style={{ fontFamily: 'monospace' }}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

CiTranslatorTab.propTypes = {
  API_BASE: PropTypes.string.isRequired,
  copyToClipboard: PropTypes.func.isRequired,
  copyFeedback: PropTypes.bool
};
