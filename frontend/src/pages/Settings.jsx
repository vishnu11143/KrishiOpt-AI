import { useState, useEffect } from 'react'
import { api } from '../api'

export default function Settings() {
  const [dataset, setDataset] = useState(null)
  const [yieldModel, setYieldModel] = useState(null)
  const [profitModel, setProfitModel] = useState(null)
  const [cropModel, setCropModel] = useState(null)
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)

  const [config, setConfig] = useState(null)

  useEffect(() => {
    Promise.all([
      api.datasetInfo().catch(() => null),
      api.yieldModelInfo().catch(() => null),
      api.profitModelInfo().catch(() => null),
      api.cropModelInfo().catch(() => null),
      api.health().catch(() => null),
      api.config().catch(() => null),
    ]).then(([d, ym, pm, cm, h, c]) => {
      setDataset(d); setYieldModel(ym); setProfitModel(pm); setCropModel(cm); setHealth(h); setConfig(c)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading-container"><div className="spinner" /><p>Loading system info...</p></div>

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1>⚙️ Settings & System Information</h1>
        <p className="page-subtitle">Platform configuration, dataset schema, API integrations, and model details</p>
      </div>

      {/* System status */}
      <div className="card mb-lg">
        <div className="card-title mb-md">System Status</div>
        <div className="settings-row">
          <span>API Server</span>
          <span className={`badge ${health?.status === 'ok' ? 'badge-success' : 'badge-danger'}`}>
            {health?.status === 'ok' ? '● Connected' : '● Disconnected'}
          </span>
        </div>
        <div className="settings-row">
          <span>Service</span>
          <span>{health?.service || 'KrishiOpt AI'}</span>
        </div>
      </div>

      {/* API Integrations */}
      <div className="card mb-lg">
        <div className="card-title mb-md">🔌 API & External Integrations</div>
        <div className="settings-row">
          <div>
            <div style={{fontWeight:600}}>Google Maps JavaScript API</div>
            <div className="text-xs text-muted">Powers interactive maps, agricultural pins, and Places search</div>
          </div>
          <span className={`badge ${config?.has_google_maps_key ? 'badge-success' : 'badge-warning'}`}>
            {config?.has_google_maps_key ? '● Active (GOOGLE_MAPS_API_KEY)' : '○ Key Not Set (Using Fallback)'}
          </span>
        </div>
        <div className="settings-row">
          <div>
            <div style={{fontWeight:600}}>Google Gemini AI</div>
            <div className="text-xs text-muted">Powers conversational reasoning in Krishi Assistant</div>
          </div>
          <span className={`badge ${config?.has_gemini_key ? 'badge-success' : 'badge-neutral'}`}>
            {config?.has_gemini_key ? '● Active (GEMINI_API_KEY)' : '○ Dataset Intelligence Active'}
          </span>
        </div>
        <div className="mt-md p-sm" style={{background:'rgba(255,255,255,0.03)', borderRadius:'var(--radius-md)', fontSize:'0.78rem', color:'var(--text-muted)'}}>
          💡 To configure your API keys, copy <code>.env.example</code> to <code>.env</code> in the project root and define <code>GEMINI_API_KEY</code> and <code>GOOGLE_MAPS_API_KEY</code>.
        </div>
      </div>


      {/* Dataset info */}
      {dataset && (
        <div className="card mb-lg">
          <div className="card-title mb-md">📊 Dataset Information</div>
          <div className="settings-row"><span>Raw Records</span><span>{dataset.raw_rows?.toLocaleString()}</span></div>
          <div className="settings-row"><span>Cleaned Records</span><span>{dataset.cleaned_rows?.toLocaleString()}</span></div>
          <div className="settings-row"><span>Columns</span><span>{dataset.raw_cols}</span></div>
          <div className="settings-row"><span>States</span><span>{dataset.states?.join(', ')}</span></div>
          <div className="settings-row"><span>Crops</span><span>{dataset.crops?.join(', ')}</span></div>
          <div className="settings-row"><span>Seasons</span><span>{dataset.seasons?.join(', ')}</span></div>
          <div className="settings-row"><span>Irrigation Methods</span><span>{dataset.irrigation_methods?.join(', ')}</span></div>

          {dataset.missing && Object.keys(dataset.missing).length > 0 && (
            <>
              <div className="card-title mt-lg mb-md">Missing Values (Raw)</div>
              {Object.entries(dataset.missing).map(([col, cnt]) => (
                <div className="settings-row" key={col}><span>{col}</span><span>{cnt} rows</span></div>
              ))}
            </>
          )}

          <div className="card-title mt-lg mb-md">Column Schema</div>
          <div className="table-container">
            <table>
              <thead><tr><th>Column</th><th>Type</th></tr></thead>
              <tbody>
                {dataset.columns?.map(c => (
                  <tr key={c}><td>{c}</td><td className="font-mono text-xs">{dataset.dtypes?.[c]}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ML Models */}
      <div className="card mb-lg">
        <div className="card-title mb-md">🤖 ML Models</div>
        
        {yieldModel && (
          <div className="settings-section">
            <h4>Yield Prediction</h4>
            <div className="settings-row"><span>Best Model</span><span>{yieldModel.best_model}</span></div>
            <div className="settings-row"><span>R²</span><span className="font-mono">{yieldModel.metrics?.r2}</span></div>
            <div className="settings-row"><span>MAE</span><span className="font-mono">{yieldModel.metrics?.mae}</span></div>
            <div className="settings-row"><span>RMSE</span><span className="font-mono">{yieldModel.metrics?.rmse}</span></div>
            <div className="settings-row"><span>Train / Test</span><span>{yieldModel.train_size} / {yieldModel.test_size}</span></div>
          </div>
        )}

        {profitModel && (
          <div className="settings-section">
            <h4>Profit Prediction</h4>
            <div className="settings-row"><span>R²</span><span className="font-mono">{profitModel.metrics?.r2}</span></div>
            <div className="settings-row"><span>MAE</span><span className="font-mono">{profitModel.metrics?.mae}</span></div>
            <div className="settings-row"><span>RMSE</span><span className="font-mono">{profitModel.metrics?.rmse}</span></div>
          </div>
        )}

        {cropModel && (
          <div className="settings-section">
            <h4>Crop Classification</h4>
            <div className="settings-row"><span>Accuracy</span><span className="font-mono">{(cropModel.accuracy * 100).toFixed(1)}%</span></div>
            <div className="settings-row"><span>Crops</span><span>{cropModel.crops?.join(', ')}</span></div>
          </div>
        )}
      </div>

      {/* About */}
      <div className="card">
        <div className="card-title mb-md">About KrishiOpt AI</div>
        <p className="text-sm text-muted mb-md">
          KrishiOpt AI is an Intelligent Agricultural Decision & Resource Optimization Platform 
          built on top of the Seasonal Agriculture Performance Analysis project.
        </p>
        <div className="settings-row"><span>Original Project</span><span>Seasonal Agriculture Performance Analysis</span></div>
        <div className="settings-row"><span>Original Author</span><span>Vishnu Koukuntla</span></div>
        <div className="settings-row"><span>Program</span><span>VOIS AICTE Batch 2026-27</span></div>
        <div className="settings-row"><span>Data Source</span><span>4,000 farm records across 8 Indian states</span></div>
        <div className="settings-row"><span>Optimization</span><span>Linear Programming (scipy.optimize.linprog)</span></div>
        <div className="settings-row"><span>ML Framework</span><span>scikit-learn (GBR, RF, Ridge)</span></div>
      </div>
    </div>
  )
}
