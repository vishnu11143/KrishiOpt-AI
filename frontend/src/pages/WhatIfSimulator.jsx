import { useState, useEffect } from 'react'
import { api } from '../api'

function fmtR(n) { return '₹' + Number(n).toLocaleString('en-IN', {maximumFractionDigits:0}) }

export default function WhatIfSimulator() {
  const [options, setOptions] = useState(null)
  const [loading, setLoading] = useState(true)
  const [computing, setComputing] = useState(false)
  const [result, setResult] = useState(null)

  const [base, setBase] = useState({
    season: 'Kharif', state: '', total_land: '10',
    total_water: '50000', total_fertilizer: '2000', total_budget: '500000',
  })
  const [scenario, setScenario] = useState({
    season: 'Kharif', state: '', total_land: '10',
    total_water: '30000', total_fertilizer: '2000', total_budget: '500000',
  })

  useEffect(() => {
    api.formOptions().then(o => {
      setOptions(o)
      setBase(b => ({...b, state: o.states[0]}))
      setScenario(s => ({...s, state: o.states[0]}))
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const run = async () => {
    setComputing(true)
    try {
      const toNum = obj => {
        const r = {}
        for (const [k, v] of Object.entries(obj)) r[k] = isNaN(v) ? v : parseFloat(v)
        return r
      }
      const r = await api.whatIf({ base: toNum(base), scenario: toNum(scenario) })
      setResult(r)
    } catch {} finally { setComputing(false) }
  }

  if (loading) return <div className="loading-container"><div className="spinner" /><p>Loading...</p></div>

  const ParamPanel = ({ title, data, setData, color }) => (
    <div className="card" style={{borderColor: color || 'var(--border-secondary)'}}>
      <h3 style={{marginBottom:'var(--space-md)', color}}>{title}</h3>
      <div className="form-group">
        <label className="form-label">Season</label>
        <select className="form-select" value={data.season} onChange={e => setData({...data, season: e.target.value})}>
          {options?.seasons?.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">State</label>
        <select className="form-select" value={data.state} onChange={e => setData({...data, state: e.target.value})}>
          {options?.states?.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Land (ha)</label>
        <input className="form-input" type="number" value={data.total_land} onChange={e => setData({...data, total_land: e.target.value})} />
      </div>
      <div className="form-group">
        <label className="form-label">Water (m³)</label>
        <input className="form-input" type="number" value={data.total_water} onChange={e => setData({...data, total_water: e.target.value})} />
      </div>
      <div className="form-group">
        <label className="form-label">Fertilizer (kg)</label>
        <input className="form-input" type="number" value={data.total_fertilizer} onChange={e => setData({...data, total_fertilizer: e.target.value})} />
      </div>
      <div className="form-group">
        <label className="form-label">Budget (₹)</label>
        <input className="form-input" type="number" value={data.total_budget} onChange={e => setData({...data, total_budget: e.target.value})} />
      </div>
    </div>
  )

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1>🔄 What-If Simulator</h1>
        <p className="page-subtitle">Compare baseline and scenario — see how changing resources affects optimal allocation and profit</p>
      </div>

      <div className="comparison-grid mb-lg">
        <ParamPanel title="📋 Base Scenario" data={base} setData={setBase} color="var(--info)" />
        <div className="comparison-arrow">→</div>
        <ParamPanel title="🔄 What-If Scenario" data={scenario} setData={setScenario} color="var(--warning)" />
      </div>

      <div className="text-center mb-lg">
        <button className="btn btn-primary btn-lg" onClick={run} disabled={computing} id="btn-whatif">
          {computing ? '⏳ Simulating...' : '🔄 Run What-If Simulation'}
        </button>
      </div>

      {result && (
        <div className="fade-in">
          {/* Impact summary */}
          <div className="stat-grid stagger mb-lg">
            <div className="stat-card">
              <div className="stat-label">Base Profit</div>
              <div className="stat-value">{fmtR(result.profit_impact.base_profit)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Scenario Profit</div>
              <div className="stat-value">{fmtR(result.profit_impact.scenario_profit)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Profit Change</div>
              <div className={`stat-value ${result.profit_impact.change_inr >= 0 ? 'positive' : 'negative'}`}>
                {result.profit_impact.change_inr >= 0 ? '+' : ''}{fmtR(result.profit_impact.change_inr)}
              </div>
              <div className="stat-sub">{result.profit_impact.change_pct >= 0 ? '+' : ''}{result.profit_impact.change_pct}%</div>
            </div>
          </div>

          {/* Parameter changes */}
          {result.parameter_changes?.length > 0 && (
            <div className="card mb-lg">
              <div className="card-title mb-md">📊 What Changed</div>
              <div className="table-container">
                <table>
                  <thead><tr><th>Parameter</th><th>Base</th><th>Scenario</th><th>Change</th><th>% Change</th></tr></thead>
                  <tbody>
                    {result.parameter_changes.map(c => (
                      <tr key={c.parameter}>
                        <td><strong>{c.parameter}</strong></td>
                        <td>{Number(c.base_value).toLocaleString('en-IN')}</td>
                        <td>{Number(c.scenario_value).toLocaleString('en-IN')}</td>
                        <td className={c.change >= 0 ? 'change-positive' : 'change-negative'}>
                          {c.change >= 0 ? '+' : ''}{Number(c.change).toLocaleString('en-IN')}
                        </td>
                        <td className={c.change_pct >= 0 ? 'change-positive' : 'change-negative'}>
                          {c.change_pct >= 0 ? '+' : ''}{c.change_pct}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Side-by-side allocations */}
          <div className="card-grid mb-lg">
            <div className="card">
              <div className="card-title" style={{color:'var(--info)'}}>📋 Base Allocation</div>
              <div className="table-container mt-md">
                <table>
                  <thead><tr><th>Crop</th><th>Land</th><th>Est. Profit</th></tr></thead>
                  <tbody>
                    {(result.base?.allocations || []).map(a => (
                      <tr key={a.crop}><td>{a.crop}</td><td>{a.land_hectares} ha</td>
                        <td style={{color: a.estimated_profit_inr >= 0 ? 'var(--success)' : 'var(--danger)'}}>{fmtR(a.estimated_profit_inr)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card">
              <div className="card-title" style={{color:'var(--warning)'}}>🔄 Scenario Allocation</div>
              <div className="table-container mt-md">
                <table>
                  <thead><tr><th>Crop</th><th>Land</th><th>Est. Profit</th></tr></thead>
                  <tbody>
                    {(result.scenario?.allocations || []).map(a => (
                      <tr key={a.crop}><td>{a.crop}</td><td>{a.land_hectares} ha</td>
                        <td style={{color: a.estimated_profit_inr >= 0 ? 'var(--success)' : 'var(--danger)'}}>{fmtR(a.estimated_profit_inr)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="model-info">
            <div className="mi-disclaimer">⚠️ {result.label}</div>
          </div>
        </div>
      )}
    </div>
  )
}
