import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { api } from '../api'

const CHART_COLORS = ['#3b9e6e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#d4a76a', '#ec4899']

function fmt(n) { return n != null ? Number(n).toLocaleString('en-IN') : '—' }
function fmtR(n) { return n != null ? '₹' + Number(n).toLocaleString('en-IN', {maximumFractionDigits:0}) : '—' }

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [yieldProfit, setYieldProfit] = useState(null)
  const [cropProf, setCropProf] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      api.dashboard(),
      api.yieldProfit(),
      api.cropProfitability(),
    ]).then(([d, yp, cp]) => {
      setData(d)
      setYieldProfit(yp)
      setCropProf(cp)
    }).catch(e => setError(e.message)).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading-container"><div className="spinner" /><p>Loading dashboard...</p></div>
  if (error) return <div className="error-state">Error: {error}</div>
  if (!data) return null

  const seasonData = yieldProfit ? yieldProfit.seasons.map((s, i) => ({
    season: s, yield: yieldProfit.yield[i], profit: yieldProfit.profit[i]
  })) : []

  const cropData = cropProf ? cropProf.crops.map((c, i) => ({
    crop: c, 
    kharif: cropProf.values[i][0],
    rabi: cropProf.values[i][1],
    zaid: cropProf.values[i][2],
  })) : []

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1>Overview Dashboard <span className="header-badge badge-live">● Live Data</span></h1>
        <p className="page-subtitle">Agricultural intelligence from {fmt(data.total_records)} farm records across {data.states} states</p>
      </div>

      {/* Stats grid */}
      <div className="stat-grid stagger">
        <div className="stat-card">
          <div className="stat-label">Farm Records</div>
          <div className="stat-value accent">{fmt(data.cleaned_records)}</div>
          <div className="stat-sub">of {fmt(data.total_records)} total</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">States Covered</div>
          <div className="stat-value">{data.states}</div>
          <div className="stat-sub">{data.districts} districts</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Crops Analyzed</div>
          <div className="stat-value">{data.crops}</div>
          <div className="stat-sub">{data.seasons} seasons</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Yield</div>
          <div className="stat-value">{data.avg_yield} <span className="text-xs text-muted">t/ha</span></div>
          <div className="stat-sub">Best: {data.highest_yield_crop}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Profit</div>
          <div className="stat-value" style={{color: data.avg_profit >= 0 ? 'var(--success)' : 'var(--danger)'}}>
            {fmtR(data.avg_profit)}
          </div>
          <div className="stat-sub">Best season: {data.most_profitable_season}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Water Efficiency</div>
          <div className="stat-value">{data.avg_water_efficiency}</div>
          <div className="stat-sub">t/1000m³ · Best: {data.best_irrigation}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Disease Risk</div>
          <div className="stat-value" style={{color: data.avg_disease_risk > 50 ? 'var(--danger)' : data.avg_disease_risk > 35 ? 'var(--warning)' : 'var(--success)'}}>
            {data.avg_disease_risk}%
          </div>
          <div className="stat-sub">Average across all records</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Top Crop</div>
          <div className="stat-value" style={{fontSize:'1.1rem'}}>{data.most_profitable_crop}</div>
          <div className="stat-sub">Most profitable on average</div>
        </div>
      </div>

      {/* Charts */}
      <div className="card-grid" style={{marginBottom:'var(--space-xl)'}}>
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">📊 Seasonal Performance</div>
              <div className="card-subtitle">Average yield and profit per hectare by season</div>
            </div>
            <span className="badge badge-data">Dataset</span>
          </div>
          <div className="chart-container">
            <ResponsiveContainer>
              <BarChart data={seasonData} barGap={8}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="season" tick={{fill:'#8c97a5', fontSize:12}} />
                <YAxis yAxisId="yield" tick={{fill:'#8c97a5', fontSize:11}} />
                <YAxis yAxisId="profit" orientation="right" tick={{fill:'#8c97a5', fontSize:11}} />
                <Tooltip contentStyle={{background:'#1c2431',border:'1px solid #2a3340',borderRadius:8,fontSize:13}} />
                <Bar yAxisId="yield" dataKey="yield" name="Yield (t/ha)" fill="#3b82f6" radius={[4,4,0,0]} />
                <Bar yAxisId="profit" dataKey="profit" name="Profit (₹/ha)" fill="#3b9e6e" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">🌾 Crop Profitability (Kharif)</div>
              <div className="card-subtitle">Average profit per farm by crop</div>
            </div>
            <span className="badge badge-data">Dataset</span>
          </div>
          <div className="chart-container">
            <ResponsiveContainer>
              <BarChart data={cropData} layout="vertical" barSize={16}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis type="number" tick={{fill:'#8c97a5', fontSize:11}} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
                <YAxis dataKey="crop" type="category" tick={{fill:'#8c97a5', fontSize:12}} width={80} />
                <Tooltip contentStyle={{background:'#1c2431',border:'1px solid #2a3340',borderRadius:8,fontSize:13}} formatter={v => fmtR(v)} />
                <Bar dataKey="kharif" name="Kharif Profit" fill="#3b9e6e" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <h3 style={{marginBottom:'var(--space-md)'}}>Quick Actions</h3>
      <div className="card-grid stagger">
        <div className="quick-action" onClick={() => navigate('/farm-planner')} role="button" tabIndex={0} id="qa-analyze">
          <div className="qa-icon">🌾</div>
          <div className="qa-title">Analyze My Farm</div>
          <div className="qa-desc">Enter farm conditions for personalized intelligence</div>
        </div>
        <div className="quick-action" onClick={() => navigate('/crop-intelligence')} role="button" tabIndex={0} id="qa-crops">
          <div className="qa-icon">🌱</div>
          <div className="qa-title">Recommend Crops</div>
          <div className="qa-desc">Get data-driven crop recommendations</div>
        </div>
        <div className="quick-action" onClick={() => navigate('/resource-optimizer')} role="button" tabIndex={0} id="qa-optimize">
          <div className="qa-icon">⚡</div>
          <div className="qa-title">Optimize Resources</div>
          <div className="qa-desc">Maximize profit with constrained optimization</div>
        </div>
        <div className="quick-action" onClick={() => navigate('/what-if')} role="button" tabIndex={0} id="qa-whatif">
          <div className="qa-icon">🔄</div>
          <div className="qa-title">What-If Scenario</div>
          <div className="qa-desc">Simulate changes and see projected impact</div>
        </div>
        <div className="quick-action" onClick={() => navigate('/map')} role="button" tabIndex={0} id="qa-map">
          <div className="qa-icon">🗺️</div>
          <div className="qa-title">Explore Map</div>
          <div className="qa-desc">View agricultural regions on the map</div>
        </div>
        <div className="quick-action" onClick={() => navigate('/assistant')} role="button" tabIndex={0} id="qa-assistant">
          <div className="qa-icon">🤖</div>
          <div className="qa-title">Ask Krishi Assistant</div>
          <div className="qa-desc">Get AI-powered explanations of results</div>
        </div>
      </div>
    </div>
  )
}
