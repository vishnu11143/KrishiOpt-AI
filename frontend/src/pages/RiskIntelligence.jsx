import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter, ZAxis } from 'recharts'
import { api } from '../api'

export default function RiskIntelligence() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.riskAnalytics()
      .then(d => setData(d))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading-container"><div className="spinner" /><p>Loading risk data...</p></div>
  if (error) return <div className="error-state">{error}</div>
  if (!data) return null

  const seasonData = ['Kharif', 'Rabi', 'Zaid'].map(s => ({
    season: s,
    mean: data.by_season[s]?.mean || 0,
    std: data.by_season[s]?.std || 0,
  }))

  const cropData = Object.entries(data.by_crop)
    .map(([crop, v]) => ({ crop, mean: v.mean, std: v.std }))
    .sort((a, b) => b.mean - a.mean)

  const corrData = Object.entries(data.environmental_correlations)
    .map(([factor, v]) => ({
      factor: factor.replace(/_/g, ' ').replace(' mm', '').replace(' pct', ' %').replace(' C', ' °C'),
      correlation: v.r,
      significant: v.p_value < 0.05,
    }))
    .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation))

  const riskLevel = (v) => v > 55 ? 'HIGH' : v > 35 ? 'MODERATE' : 'LOW'
  const riskClass = (v) => `risk-${riskLevel(v).toLowerCase()}`

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1>🛡️ Risk Intelligence</h1>
        <p className="page-subtitle">Disease and pest risk analysis from {data.overall_mean ? 'actual dataset patterns' : 'dataset'}</p>
      </div>

      {/* Overview */}
      <div className="stat-grid stagger mb-lg">
        <div className="stat-card">
          <div className="stat-label">Overall Risk</div>
          <div className={`stat-value ${riskClass(data.overall_mean)}`}>{data.overall_mean}%</div>
          <div className="stat-sub">σ = {data.overall_std}%</div>
        </div>
        {['Kharif', 'Rabi', 'Zaid'].map(s => (
          <div className="stat-card" key={s}>
            <div className="stat-label">{s} Risk</div>
            <div className={`stat-value ${riskClass(data.by_season[s]?.mean)}`}>{data.by_season[s]?.mean}%</div>
            <div className="stat-sub">{riskLevel(data.by_season[s]?.mean)}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="card-grid mb-lg">
        <div className="card">
          <div className="card-title">🌧️ Risk by Season</div>
          <div className="chart-container">
            <ResponsiveContainer>
              <BarChart data={seasonData} barSize={40}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="season" tick={{fill:'#8c97a5', fontSize:12}} />
                <YAxis tick={{fill:'#8c97a5', fontSize:11}} domain={[0, 70]} />
                <Tooltip contentStyle={{background:'#1c2431',border:'1px solid #2a3340',borderRadius:8,fontSize:13}} />
                <Bar dataKey="mean" name="Avg Risk %" radius={[4,4,0,0]}>
                  {seasonData.map((d, i) => {
                    const color = d.mean > 50 ? '#ef4444' : d.mean > 40 ? '#f59e0b' : '#22c55e'
                    return <rect key={i} fill={color} />
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-title">🌾 Risk by Crop</div>
          <div className="chart-container">
            <ResponsiveContainer>
              <BarChart data={cropData} layout="vertical" barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis type="number" domain={[0, 60]} tick={{fill:'#8c97a5', fontSize:11}} />
                <YAxis dataKey="crop" type="category" tick={{fill:'#8c97a5', fontSize:12}} width={90} />
                <Tooltip contentStyle={{background:'#1c2431',border:'1px solid #2a3340',borderRadius:8,fontSize:13}} />
                <Bar dataKey="mean" name="Avg Risk %" fill="#f59e0b" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Environmental correlations */}
      <div className="card mb-lg">
        <div className="card-title mb-md">🔬 Environmental Correlations with Risk</div>
        <div className="table-container">
          <table>
            <thead>
              <tr><th>Factor</th><th>Correlation (r)</th><th>Significant (p &lt; 0.05)</th><th>Interpretation</th></tr>
            </thead>
            <tbody>
              {corrData.map(c => (
                <tr key={c.factor}>
                  <td><strong>{c.factor}</strong></td>
                  <td style={{color: Math.abs(c.correlation) > 0.3 ? 'var(--accent-light)' : 'var(--text-secondary)'}}>
                    {c.correlation > 0 ? '+' : ''}{c.correlation.toFixed(4)}
                  </td>
                  <td>{c.significant ? <span className="badge badge-success">Yes</span> : <span className="badge badge-neutral">No</span>}</td>
                  <td className="text-sm text-muted">
                    {Math.abs(c.correlation) > 0.5 ? 'Strong' : Math.abs(c.correlation) > 0.3 ? 'Moderate' : 'Weak'}{' '}
                    {c.correlation > 0 ? 'positive' : 'negative'} relationship
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Risk by crop table */}
      <div className="card">
        <div className="card-title mb-md">📋 Detailed Crop Risk</div>
        <div className="table-container">
          <table>
            <thead><tr><th>Crop</th><th>Mean</th><th>Std Dev</th><th>Min</th><th>Max</th><th>Category</th></tr></thead>
            <tbody>
              {Object.entries(data.by_crop).sort((a,b) => b[1].mean - a[1].mean).map(([crop, v]) => (
                <tr key={crop}>
                  <td><strong>{crop}</strong></td>
                  <td>{v.mean}%</td>
                  <td>{v.std}%</td>
                  <td>{v.min}%</td>
                  <td>{v.max}%</td>
                  <td><span className={`badge badge-${v.mean > 55 ? 'danger' : v.mean > 35 ? 'warning' : 'success'}`}>{riskLevel(v.mean)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
