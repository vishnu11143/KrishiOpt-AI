import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { api } from '../api'

const COLORS = ['#3b9e6e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#d4a76a', '#ec4899']
function fmtR(n) { return '₹' + Number(n).toLocaleString('en-IN', {maximumFractionDigits:0}) }

export default function ResourceOptimizer() {
  const [options, setOptions] = useState(null)
  const [loading, setLoading] = useState(true)
  const [computing, setComputing] = useState(false)
  const [result, setResult] = useState(null)
  const [form, setForm] = useState({
    season: 'Kharif', state: '', total_land: '10',
    total_water: '50000', total_fertilizer: '2000', total_budget: '500000',
  })

  useEffect(() => {
    api.formOptions().then(o => {
      setOptions(o)
      setForm(f => ({...f, state: o.states[0]}))
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const optimize = async () => {
    setComputing(true)
    try {
      const params = {}
      for (const [k, v] of Object.entries(form)) params[k] = isNaN(v) ? v : parseFloat(v)
      const r = await api.optimize(params)
      setResult(r)
    } catch {} finally { setComputing(false) }
  }

  if (loading) return <div className="loading-container"><div className="spinner" /><p>Loading...</p></div>

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1>⚡ Resource Optimizer</h1>
        <p className="page-subtitle">Maximize expected profit with constrained linear programming</p>
      </div>

      {/* Input form */}
      <div className="card mb-lg" style={{maxWidth:800}}>
        <div className="card-title mb-md">Resource Constraints</div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Season</label>
            <select className="form-select" value={form.season} onChange={e => setForm({...form, season: e.target.value})}>
              {options?.seasons?.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">State</label>
            <select className="form-select" value={form.state} onChange={e => setForm({...form, state: e.target.value})}>
              {options?.states?.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Total Land (ha)</label>
            <input className="form-input" type="number" value={form.total_land} onChange={e => setForm({...form, total_land: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Total Water (m³)</label>
            <input className="form-input" type="number" value={form.total_water} onChange={e => setForm({...form, total_water: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Total Fertilizer (kg)</label>
            <input className="form-input" type="number" value={form.total_fertilizer} onChange={e => setForm({...form, total_fertilizer: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Total Budget (₹)</label>
            <input className="form-input" type="number" value={form.total_budget} onChange={e => setForm({...form, total_budget: e.target.value})} />
          </div>
        </div>
        <button className="btn btn-primary btn-lg mt-md" onClick={optimize} disabled={computing} id="btn-optimize">
          {computing ? '⏳ Optimizing...' : '🚀 Optimize Allocation'}
        </button>
      </div>

      {result && !result.error && (
        <div className="fade-in">
          {/* Summary stats */}
          <div className="stat-grid stagger mb-lg">
            <div className="stat-card">
              <div className="stat-label">Optimized Profit</div>
              <div className="stat-value positive">{fmtR(result.summary.total_estimated_profit)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">vs Equal Split</div>
              <div className="stat-value" style={{color: result.comparison.improvement_inr >= 0 ? 'var(--success)' : 'var(--danger)', fontSize:'1.1rem'}}>
                {result.comparison.improvement_inr >= 0 ? '+' : ''}{fmtR(result.comparison.improvement_inr)}
              </div>
              <div className="stat-sub">{result.comparison.improvement_pct >= 0 ? '+' : ''}{result.comparison.improvement_pct}%</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Land Used</div>
              <div className="stat-value">{result.resource_utilization.land_pct}%</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Budget Used</div>
              <div className="stat-value">{result.resource_utilization.budget_pct}%</div>
            </div>
          </div>

          <div className="model-info mb-lg" style={{maxWidth:600}}>
            <div className="mi-label">Methodology</div>
            <div>{result.methodology}</div>
            <div className="mi-disclaimer">⚠️ {result.label}</div>
          </div>

          {/* Allocation chart */}
          <div className="card-grid mb-lg">
            <div className="card">
              <div className="card-title">Land Allocation</div>
              <div className="chart-container">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={result.allocations} dataKey="land_hectares" nameKey="crop" cx="50%" cy="50%"
                      outerRadius={100} label={({crop, land_hectares}) => `${crop}: ${land_hectares}ha`}
                      labelLine={{ stroke: '#5e6b7a' }}
                      style={{ fontSize: 12 }}>
                      {result.allocations.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{background:'#1c2431',border:'1px solid #2a3340',borderRadius:8,fontSize:13}} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card">
              <div className="card-title">Profit by Crop</div>
              <div className="chart-container">
                <ResponsiveContainer>
                  <BarChart data={result.allocations} barSize={24}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="crop" tick={{fill:'#8c97a5', fontSize:11}} />
                    <YAxis tick={{fill:'#8c97a5', fontSize:11}} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
                    <Tooltip contentStyle={{background:'#1c2431',border:'1px solid #2a3340',borderRadius:8,fontSize:13}} formatter={v => fmtR(v)} />
                    <Bar dataKey="estimated_profit_inr" name="Est. Profit" fill="#3b9e6e" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Allocation table */}
          <div className="card">
            <div className="card-title mb-md">Optimized Allocation</div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Crop</th><th>Land (ha)</th><th>Water (m³)</th><th>Fertilizer (kg)</th>
                    <th>Est. Yield (t)</th><th>Est. Revenue</th><th>Est. Cost</th><th>Est. Profit</th><th>Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {result.allocations.map(a => (
                    <tr key={a.crop}>
                      <td><strong>{a.crop}</strong></td>
                      <td>{a.land_hectares}</td>
                      <td>{Number(a.water_allocated_m3).toLocaleString('en-IN', {maximumFractionDigits:0})}</td>
                      <td>{Number(a.fertilizer_allocated_kg).toLocaleString('en-IN', {maximumFractionDigits:0})}</td>
                      <td>{a.estimated_yield_tonnes}</td>
                      <td>{fmtR(a.estimated_revenue_inr)}</td>
                      <td>{fmtR(a.estimated_cost_inr)}</td>
                      <td style={{color: a.estimated_profit_inr >= 0 ? 'var(--success)' : 'var(--danger)'}}>{fmtR(a.estimated_profit_inr)}</td>
                      <td><span className={`risk-${a.risk_pct > 55 ? 'high' : a.risk_pct > 35 ? 'moderate' : 'low'}`}>{a.risk_pct}%</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {result?.error && <div className="error-state">{result.error}</div>}
    </div>
  )
}
