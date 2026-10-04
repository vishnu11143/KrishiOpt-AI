import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { api } from '../api'

function fmtR(n) { return '₹' + Number(n).toLocaleString('en-IN', {maximumFractionDigits:0}) }

export default function Analytics() {
  const [tab, setTab] = useState('seasonal')
  const [seasonalData, setSeasonalData] = useState(null)
  const [anovaData, setAnovaData] = useState(null)
  const [yieldProfit, setYieldProfit] = useState(null)
  const [revCost, setRevCost] = useState(null)
  const [diseaseRain, setDiseaseRain] = useState(null)
  const [waterEff, setWaterEff] = useState(null)
  const [cropProf, setCropProf] = useState(null)
  const [cropData, setCropData] = useState(null)
  const [stateData, setStateData] = useState(null)
  const [modelInfo, setModelInfo] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.seasonalSummary(), api.anova(), api.yieldProfit(), api.revenueCost(),
      api.diseaseRainfall(), api.waterEfficiency(), api.cropProfitability(),
      api.cropAnalytics(), api.stateAnalytics(), api.yieldModelInfo(),
    ]).then(([ss, an, yp, rc, dr, we, cp, ca, sa, mi]) => {
      setSeasonalData(ss); setAnovaData(an); setYieldProfit(yp); setRevCost(rc)
      setDiseaseRain(dr); setWaterEff(we); setCropProf(cp); setCropData(ca)
      setStateData(sa); setModelInfo(mi)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading-container"><div className="spinner" /><p>Loading analytics...</p></div>

  const TABS = [
    { id: 'seasonal', label: 'Seasonal' },
    { id: 'economics', label: 'Economics' },
    { id: 'risk', label: 'Risk' },
    { id: 'water', label: 'Water' },
    { id: 'crops', label: 'Crops' },
    { id: 'statistical', label: 'Statistical' },
    { id: 'model', label: 'ML Models' },
    { id: 'regional', label: 'Regional' },
  ]

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1>📈 Analytics & Evidence</h1>
        <p className="page-subtitle">Interactive analytics computed from the actual dataset — mirrors and extends original notebook analysis</p>
      </div>

      <div className="tabs">
        {TABS.map(t => (
          <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {tab === 'seasonal' && yieldProfit && (
        <div className="fade-in">
          <h3 className="mb-md">Yield & Profit Across Seasons</h3>
          <div className="card-grid mb-lg">
            <div className="card">
              <div className="card-title">Yield & Profit per Ha by Season</div>
              <div className="card-subtitle">Notebook Section 10 — Kharif leads on both yield and profit</div>
              <div className="chart-container-lg">
                <ResponsiveContainer>
                  <BarChart data={yieldProfit.seasons.map((s, i) => ({season:s, yield:yieldProfit.yield[i], profit:yieldProfit.profit[i]}))} barGap={8}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="season" tick={{fill:'#8c97a5'}} />
                    <YAxis yAxisId="y" tick={{fill:'#8c97a5', fontSize:11}} />
                    <YAxis yAxisId="p" orientation="right" tick={{fill:'#8c97a5', fontSize:11}} />
                    <Tooltip contentStyle={{background:'#1c2431',border:'1px solid #2a3340',borderRadius:8}} />
                    <Bar yAxisId="y" dataKey="yield" name="Yield (t/ha)" fill="#3b82f6" radius={[4,4,0,0]} />
                    <Bar yAxisId="p" dataKey="profit" name="Profit (₹/ha)" fill="#3b9e6e" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <div className="card-title">Seasonal Summary Table</div>
              {seasonalData && (
                <div className="table-container mt-md" style={{maxHeight:400,overflowY:'auto'}}>
                  <table>
                    <thead><tr><th>Metric</th>{['Kharif','Rabi','Zaid'].map(s => <th key={s}>{s}</th>)}</tr></thead>
                    <tbody>
                      {Object.keys(seasonalData.Kharif || {}).map(m => (
                        <tr key={m}>
                          <td style={{fontSize:'0.75rem'}}>{m.replace(/_/g, ' ')}</td>
                          {['Kharif','Rabi','Zaid'].map(s => (
                            <td key={s}>{Number(seasonalData[s]?.[m] || 0).toLocaleString('en-IN', {maximumFractionDigits:2})}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'economics' && revCost && (
        <div className="fade-in">
          <h3 className="mb-md">Revenue & Cost Analysis</h3>
          <div className="card mb-lg">
            <div className="card-title">Revenue vs Cost per Hectare by Season</div>
            <div className="card-subtitle">Notebook Section 11 — Cost stays flat; revenue drives the profit drop</div>
            <div className="chart-container-lg">
              <ResponsiveContainer>
                <BarChart data={revCost.seasons.map((s, i) => ({season:s, revenue:revCost.revenue[i], cost:revCost.cost[i]}))} barGap={8}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="season" tick={{fill:'#8c97a5'}} />
                  <YAxis tick={{fill:'#8c97a5', fontSize:11}} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
                  <Tooltip contentStyle={{background:'#1c2431',border:'1px solid #2a3340',borderRadius:8}} formatter={v => fmtR(v)} />
                  <Bar dataKey="revenue" name="Revenue/Ha" fill="#5FCBEF" radius={[4,4,0,0]} />
                  <Bar dataKey="cost" name="Cost/Ha" fill="#2C3C43" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {cropProf && (
            <div className="card">
              <div className="card-title">Crop × Season Profitability</div>
              <div className="card-subtitle">Notebook Section 14 — Sugarcane & Chilli stay profitable; Rice & Wheat lag</div>
              <div className="table-container mt-md">
                <table>
                  <thead><tr><th>Crop</th>{cropProf.seasons.map(s => <th key={s}>{s}</th>)}</tr></thead>
                  <tbody>
                    {cropProf.crops.map((c, i) => (
                      <tr key={c}>
                        <td><strong>{c}</strong></td>
                        {cropProf.values[i].map((v, j) => (
                          <td key={j} style={{
                            color: v >= 0 ? 'var(--success)' : 'var(--danger)',
                            fontWeight: 600,
                            background: v > 200000 ? 'rgba(34,197,94,0.08)' : v < -100000 ? 'rgba(239,68,68,0.08)' : 'transparent',
                          }}>
                            {fmtR(v)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'risk' && diseaseRain && (
        <div className="fade-in">
          <h3 className="mb-md">Disease/Pest Risk vs Environmental Factors</h3>
          <div className="card-grid mb-lg">
            <div className="card">
              <div className="card-title">Risk & Rainfall by Season</div>
              <div className="card-subtitle">Notebook Section 12 — Risk tracks rainfall; Kharif is highest risk</div>
              <div className="chart-container-lg">
                <ResponsiveContainer>
                  <BarChart data={diseaseRain.seasons.map((s, i) => ({season:s, risk:diseaseRain.disease_risk[i], rainfall:diseaseRain.rainfall[i]}))} barGap={8}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="season" tick={{fill:'#8c97a5'}} />
                    <YAxis yAxisId="r" tick={{fill:'#8c97a5', fontSize:11}} />
                    <YAxis yAxisId="rain" orientation="right" tick={{fill:'#8c97a5', fontSize:11}} />
                    <Tooltip contentStyle={{background:'#1c2431',border:'1px solid #2a3340',borderRadius:8}} />
                    <Bar yAxisId="r" dataKey="risk" name="Risk %" fill="#ef4444" radius={[4,4,0,0]} />
                    <Bar yAxisId="rain" dataKey="rainfall" name="Rainfall (mm)" fill="#3b82f6" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <div className="card-title">Correlation Matrix</div>
              <div className="table-container mt-md">
                <table>
                  <thead>
                    <tr><th></th>{Object.keys(diseaseRain.correlation_matrix).map(k => <th key={k} style={{fontSize:'0.7rem'}}>{k.replace(/_/g,' ').slice(0,15)}</th>)}</tr>
                  </thead>
                  <tbody>
                    {Object.entries(diseaseRain.correlation_matrix).map(([row, vals]) => (
                      <tr key={row}>
                        <td style={{fontSize:'0.72rem', fontWeight:600}}>{row.replace(/_/g,' ').slice(0,15)}</td>
                        {Object.values(vals).map((v, i) => (
                          <td key={i} style={{
                            color: Math.abs(v) > 0.5 ? 'var(--accent-light)' : 'var(--text-secondary)',
                            fontWeight: Math.abs(v) > 0.5 ? 700 : 400,
                          }}>{v?.toFixed(2)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'water' && waterEff && (
        <div className="fade-in">
          <h3 className="mb-md">Water Efficiency by Irrigation Method</h3>
          <div className="card" style={{maxWidth:700}}>
            <div className="card-subtitle">Notebook Section 13 — Rainfed and drip far more efficient than flood</div>
            <div className="chart-container-lg">
              <ResponsiveContainer>
                <BarChart data={waterEff.methods.map((m, i) => ({method:m, efficiency:waterEff.efficiency[i]}))} layout="vertical" barSize={30}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis type="number" tick={{fill:'#8c97a5', fontSize:11}} />
                  <YAxis dataKey="method" type="category" tick={{fill:'#8c97a5', fontSize:12}} width={80} />
                  <Tooltip contentStyle={{background:'#1c2431',border:'1px solid #2a3340',borderRadius:8}} />
                  <Bar dataKey="efficiency" name="t/1000m³" fill="#06b6d4" radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {tab === 'crops' && cropData && (
        <div className="fade-in">
          <h3 className="mb-md">Crop Performance Summary</h3>
          <div className="card">
            <div className="table-container">
              <table>
                <thead>
                  <tr><th>Crop</th><th>Records</th><th>Avg Yield</th><th>Avg Profit</th><th>Avg Revenue</th><th>Avg Cost</th><th>Water Eff.</th><th>Risk</th></tr>
                </thead>
                <tbody>
                  {cropData.map(c => (
                    <tr key={c.crop}>
                      <td><strong>{c.crop}</strong></td>
                      <td>{c.count}</td>
                      <td>{c.Yield_Tonnes_Ha.mean} t/ha</td>
                      <td style={{color: c.Profit_INR.mean >= 0 ? 'var(--success)' : 'var(--danger)'}}>{fmtR(c.Profit_INR.mean)}</td>
                      <td>{fmtR(c.Revenue_INR.mean)}</td>
                      <td>{fmtR(c.Total_Cost_INR.mean)}</td>
                      <td>{c.Water_Efficiency_t_per_1000m3.mean}</td>
                      <td className={`risk-${c.Disease_Pest_Risk_pct.mean > 55 ? 'high' : c.Disease_Pest_Risk_pct.mean > 35 ? 'moderate' : 'low'}`}>{c.Disease_Pest_Risk_pct.mean}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'statistical' && anovaData && (
        <div className="fade-in">
          <h3 className="mb-md">Statistical Significance (One-Way ANOVA)</h3>
          <p className="text-sm text-muted mb-md">Testing whether seasonal differences are statistically significant (p &lt; 0.05) — identical to notebook Section 9</p>
          <div className="card">
            <div className="table-container">
              <table>
                <thead><tr><th>Metric</th><th>F-Statistic</th><th>p-Value</th><th>Significant?</th></tr></thead>
                <tbody>
                  {anovaData.map(a => (
                    <tr key={a.metric}>
                      <td><strong>{a.metric.replace(/_/g, ' ')}</strong></td>
                      <td className="font-mono">{a.f_statistic.toFixed(4)}</td>
                      <td className="font-mono">{a.p_value < 0.001 ? '< 0.001' : a.p_value.toFixed(4)}</td>
                      <td>{a.significant 
                        ? <span className="badge badge-success">Yes (p &lt; 0.05)</span>
                        : <span className="badge badge-neutral">No</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'model' && modelInfo && (
        <div className="fade-in">
          <h3 className="mb-md">ML Model Performance</h3>
          <div className="card-grid mb-lg">
            <div className="card">
              <div className="card-title">Yield Prediction Model</div>
              <div className="mt-md">
                <div className="stat-label">Best Model</div>
                <div style={{fontSize:'1.1rem', fontWeight:700, marginBottom:12}}>{modelInfo.best_model}</div>
                <div className="stat-grid" style={{marginBottom:12}}>
                  <div><div className="stat-label">R²</div><div className="stat-value accent">{modelInfo.metrics.r2}</div></div>
                  <div><div className="stat-label">MAE</div><div className="stat-value">{modelInfo.metrics.mae}</div></div>
                  <div><div className="stat-label">RMSE</div><div className="stat-value">{modelInfo.metrics.rmse}</div></div>
                </div>
                <div className="stat-label">Train/Test Split</div>
                <div className="text-sm">{modelInfo.train_size} / {modelInfo.test_size}</div>
              </div>
            </div>

            <div className="card">
              <div className="card-title">Model Comparison</div>
              <div className="table-container mt-md">
                <table>
                  <thead><tr><th>Model</th><th>R²</th><th>MAE</th><th>RMSE</th></tr></thead>
                  <tbody>
                    {Object.entries(modelInfo.all_models).map(([name, m]) => (
                      <tr key={name} style={{background: name === modelInfo.best_model ? 'var(--accent-bg)' : 'transparent'}}>
                        <td><strong>{name}</strong>{name === modelInfo.best_model && <span className="badge badge-success ml-sm" style={{marginLeft:8}}>Selected</span>}</td>
                        <td>{m.r2}</td><td>{m.mae}</td><td>{m.rmse}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {modelInfo.feature_importance && Object.keys(modelInfo.feature_importance).length > 0 && (
            <div className="card">
              <div className="card-title mb-md">Feature Importance</div>
              <div className="chart-container-lg">
                <ResponsiveContainer>
                  <BarChart data={Object.entries(modelInfo.feature_importance).slice(0,12).map(([f, v]) => ({feature: f.replace(/_/g,' '), importance: v}))} layout="vertical" barSize={18}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis type="number" tick={{fill:'#8c97a5', fontSize:11}} />
                    <YAxis dataKey="feature" type="category" tick={{fill:'#8c97a5', fontSize:11}} width={140} />
                    <Tooltip contentStyle={{background:'#1c2431',border:'1px solid #2a3340',borderRadius:8}} />
                    <Bar dataKey="importance" name="Importance" fill="#8b5cf6" radius={[0,4,4,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'regional' && stateData && (
        <div className="fade-in">
          <h3 className="mb-md">State-Level Performance</h3>
          <div className="card">
            <div className="table-container">
              <table>
                <thead><tr><th>State</th><th>Records</th><th>Avg Yield</th><th>Avg Profit</th><th>Avg Revenue</th><th>Risk</th><th>Crops</th></tr></thead>
                <tbody>
                  {stateData.map(s => (
                    <tr key={s.state}>
                      <td><strong>{s.state}</strong></td>
                      <td>{s.count}</td>
                      <td>{s.Yield_Tonnes_Ha} t/ha</td>
                      <td style={{color: s.Profit_INR >= 0 ? 'var(--success)' : 'var(--danger)'}}>{fmtR(s.Profit_INR)}</td>
                      <td>{fmtR(s.Revenue_INR)}</td>
                      <td className={`risk-${s.Disease_Pest_Risk_pct > 55 ? 'high' : s.Disease_Pest_Risk_pct > 35 ? 'moderate' : 'low'}`}>{s.Disease_Pest_Risk_pct}%</td>
                      <td className="text-xs">{s.crops?.join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
