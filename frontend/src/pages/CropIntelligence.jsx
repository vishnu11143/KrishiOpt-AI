import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { api } from '../api'

export default function CropIntelligence() {
  const [options, setOptions] = useState(null)
  const [recs, setRecs] = useState(null)
  const [modelInfo, setModelInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [computing, setComputing] = useState(false)
  const [state, setState] = useState('')
  const [season, setSeason] = useState('Kharif')
  const [irrigation, setIrrigation] = useState('')

  useEffect(() => {
    Promise.all([api.formOptions(), api.cropModelInfo()]).then(([o, m]) => {
      setOptions(o)
      setModelInfo(m)
      setState(o.states[0])
      setIrrigation(o.irrigation_methods[0])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const compute = async () => {
    setComputing(true)
    try {
      const r = await api.recommendCrops({
        State: state, Season: season, Irrigation_Method: irrigation,
        Farm_Area_Hectares: 5, Rainfall_mm: 600, Avg_Temperature_C: 27,
        Humidity_pct: 63, Sunlight_Hours_Day: 7, Soil_pH: 6.7,
        Soil_Moisture_pct: 27, Nitrogen_kg_ha: 120, Phosphorus_kg_ha: 58,
        Potassium_kg_ha: 105,
      })
      setRecs(r)
    } catch {} finally { setComputing(false) }
  }

  useEffect(() => { if (options) compute() }, [state, season, irrigation])

  if (loading) return <div className="loading-container"><div className="spinner" /><p>Loading...</p></div>

  const chartData = recs?.map(r => ({
    crop: r.crop, score: r.suitability_score, ml: r.ml_probability,
    profit: r.historical_performance.avg_profit
  })) || []

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1>🌱 Crop Intelligence</h1>
        <p className="page-subtitle">Data-driven crop recommendations powered by ML + historical performance</p>
      </div>

      {/* Filters */}
      <div className="card mb-lg" style={{maxWidth:700}}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">State</label>
            <select className="form-select" value={state} onChange={e => setState(e.target.value)}>
              {options?.states?.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Season</label>
            <select className="form-select" value={season} onChange={e => setSeason(e.target.value)}>
              {options?.seasons?.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Irrigation</label>
            <select className="form-select" value={irrigation} onChange={e => setIrrigation(e.target.value)}>
              {options?.irrigation_methods?.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
        </div>
      </div>

      {computing && <div className="loading-container"><div className="spinner" /><p>Computing recommendations...</p></div>}

      {recs && !computing && (
        <>
          {/* Model info */}
          <div className="model-info mb-lg" style={{maxWidth:500}}>
            <div className="mi-label">Classification Model</div>
            <div>Accuracy: <strong>{modelInfo?.accuracy ? (modelInfo.accuracy * 100).toFixed(1) + '%' : '—'}</strong> · Train: {modelInfo?.train_size} · Test: {modelInfo?.test_size}</div>
            <div className="mi-label mt-sm">Scoring Method</div>
            <div>40% ML probability + 30% profitability + 30% yield (normalized)</div>
            <div className="mi-disclaimer">⚠️ Recommendations are based on historical data patterns, not guaranteed outcomes</div>
          </div>

          {/* Chart */}
          <div className="card mb-lg">
            <div className="card-title">Suitability Scores</div>
            <div className="chart-container">
              <ResponsiveContainer>
                <BarChart data={chartData} layout="vertical" barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis type="number" domain={[0, 100]} tick={{fill:'#8c97a5', fontSize:11}} />
                  <YAxis dataKey="crop" type="category" tick={{fill:'#8c97a5', fontSize:12}} width={90} />
                  <Tooltip contentStyle={{background:'#1c2431',border:'1px solid #2a3340',borderRadius:8,fontSize:13}} />
                  <Bar dataKey="score" name="Suitability %" fill="#3b9e6e" radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Cards */}
          <div className="card-grid-3 stagger">
            {recs.map((rec, i) => (
              <div className={`rec-card ${i === 0 ? 'top-pick' : ''}`} key={rec.crop}>
                <div className="rec-rank">{i + 1}</div>
                <div className="rec-crop">{rec.crop}</div>
                <div className="rec-score">Suitability <strong>{rec.suitability_score}%</strong></div>
                <div className="rec-details">
                  <div className="rec-detail-item"><span className="rdl">ML Score</span><br /><span className="rdv">{rec.ml_probability}%</span></div>
                  <div className="rec-detail-item"><span className="rdl">Avg Yield</span><br /><span className="rdv">{rec.historical_performance.avg_yield} t/ha</span></div>
                  <div className="rec-detail-item"><span className="rdl">Avg Profit</span><br /><span className="rdv">₹{Number(rec.historical_performance.avg_profit).toLocaleString('en-IN', {maximumFractionDigits:0})}</span></div>
                  <div className="rec-detail-item"><span className="rdl">Risk</span><br /><span className={`rdv risk-${rec.risk.category.toLowerCase()}`}>{rec.risk.category}</span></div>
                  <div className="rec-detail-item"><span className="rdl">Water Eff.</span><br /><span className="rdv">{rec.water.avg_efficiency} t/1000m³</span></div>
                  <div className="rec-detail-item"><span className="rdl">Records</span><br /><span className="rdv">{rec.historical_performance.records}</span></div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
