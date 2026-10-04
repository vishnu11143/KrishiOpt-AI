import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

function fmt(n) { return n != null ? Number(n).toLocaleString('en-IN') : '—' }
function fmtR(n) { return n != null ? '₹' + Number(n).toLocaleString('en-IN', {maximumFractionDigits:0}) : '—' }

export default function FarmPlanner() {
  const [options, setOptions] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [errors, setErrors] = useState({})
  const [form, setForm] = useState({
    State: '', Season: 'Kharif', Farm_Area_Hectares: '5',
    Rainfall_mm: '600', Avg_Temperature_C: '27', Humidity_pct: '63',
    Sunlight_Hours_Day: '7', Soil_pH: '6.7', Soil_Moisture_pct: '27',
    Nitrogen_kg_ha: '120', Phosphorus_kg_ha: '58', Potassium_kg_ha: '105',
    Irrigation_Method: '', Fertilizer_kg_ha: '186', Pesticide_Litre_ha: '5',
    Seed_Quality_Score: '0.83', Water_Used_m3: '6000', Total_Cost_INR: '500000',
  })
  const navigate = useNavigate()

  useEffect(() => {
    api.formOptions().then(o => {
      setOptions(o)
      setForm(f => ({...f, State: o.states[0], Irrigation_Method: o.irrigation_methods[0]}))
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const set = (k, v) => { setForm(f => ({...f, [k]: v})); setErrors(e => ({...e, [k]: null})) }

  const validate = () => {
    const e = {}
    if (!form.State) e.State = 'Required'
    if (!form.Season) e.Season = 'Required'
    const area = parseFloat(form.Farm_Area_Hectares)
    if (isNaN(area) || area < 0.5 || area > 15) e.Farm_Area_Hectares = '0.5–15 ha'
    const rain = parseFloat(form.Rainfall_mm)
    if (isNaN(rain) || rain < 0 || rain > 2000) e.Rainfall_mm = '0–2000 mm'
    const temp = parseFloat(form.Avg_Temperature_C)
    if (isNaN(temp) || temp < 5 || temp > 50) e.Avg_Temperature_C = '5–50 °C'
    const ph = parseFloat(form.Soil_pH)
    if (isNaN(ph) || ph < 3 || ph > 10) e.Soil_pH = '3–10'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const submit = async () => {
    if (!validate()) return
    setSubmitting(true)
    try {
      const inputs = {}
      for (const [k, v] of Object.entries(form)) {
        inputs[k] = isNaN(v) || v === '' ? v : parseFloat(v)
      }
      const res = await api.farmIntelligence(inputs)
      setResult(res)
    } catch (e) {
      setErrors({submit: e.message})
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="loading-container"><div className="spinner" /><p>Loading form options...</p></div>

  const r = options?.numeric_ranges || {}

  const Field = ({ label, name, type='number', step, required, hint }) => (
    <div className="form-group">
      <label className="form-label" htmlFor={`fp-${name}`}>{label}{required && <span className="required">*</span>}</label>
      <input className={`form-input ${errors[name] ? 'error' : ''}`} type={type} step={step||'any'} id={`fp-${name}`}
        value={form[name]} onChange={e => set(name, e.target.value)} />
      {hint && <div className="form-hint">{hint}</div>}
      {errors[name] && <div className="form-error">{errors[name]}</div>}
    </div>
  )

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1>🌾 Farm Planner</h1>
        <p className="page-subtitle">Enter your farm conditions for personalized agricultural intelligence</p>
      </div>

      {!result ? (
        <div className="card" style={{maxWidth:900}}>
          <div className="form-section">
            <div className="form-section-title">📍 Location & Season</div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="fp-state">State<span className="required">*</span></label>
                <select className="form-select" id="fp-state" value={form.State} onChange={e => set('State', e.target.value)}>
                  {options?.states?.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="fp-season">Season<span className="required">*</span></label>
                <select className="form-select" id="fp-season" value={form.Season} onChange={e => set('Season', e.target.value)}>
                  {options?.seasons?.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <Field label="Farm Area (ha)" name="Farm_Area_Hectares" required hint={r.farm_area ? `Range: ${r.farm_area.min}–${r.farm_area.max}` : ''} />
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-title">🌧️ Climate</div>
            <div className="form-row">
              <Field label="Rainfall (mm)" name="Rainfall_mm" hint={r.rainfall ? `Avg: ${r.rainfall.mean}` : ''} />
              <Field label="Temperature (°C)" name="Avg_Temperature_C" hint={r.temperature ? `Avg: ${r.temperature.mean}` : ''} />
              <Field label="Humidity (%)" name="Humidity_pct" hint={r.humidity ? `Avg: ${r.humidity.mean}` : ''} />
              <Field label="Sunlight (hrs/day)" name="Sunlight_Hours_Day" hint={r.sunlight ? `Avg: ${r.sunlight.mean}` : ''} />
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-title">🧪 Soil</div>
            <div className="form-row">
              <Field label="Soil pH" name="Soil_pH" step="0.1" hint={r.soil_ph ? `Avg: ${r.soil_ph.mean}` : ''} />
              <Field label="Soil Moisture (%)" name="Soil_Moisture_pct" hint={r.soil_moisture ? `Avg: ${r.soil_moisture.mean}` : ''} />
              <Field label="Nitrogen (kg/ha)" name="Nitrogen_kg_ha" hint={r.nitrogen ? `Avg: ${r.nitrogen.mean}` : ''} />
              <Field label="Phosphorus (kg/ha)" name="Phosphorus_kg_ha" />
              <Field label="Potassium (kg/ha)" name="Potassium_kg_ha" />
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-title">💧 Resources</div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="fp-irr">Irrigation Method</label>
                <select className="form-select" id="fp-irr" value={form.Irrigation_Method} onChange={e => set('Irrigation_Method', e.target.value)}>
                  {options?.irrigation_methods?.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <Field label="Fertilizer (kg/ha)" name="Fertilizer_kg_ha" />
              <Field label="Pesticide (L/ha)" name="Pesticide_Litre_ha" />
              <Field label="Seed Quality (0–1)" name="Seed_Quality_Score" step="0.01" />
              <Field label="Water Available (m³)" name="Water_Used_m3" hint={r.water_available ? `Avg: ${fmt(r.water_available.mean)}` : ''} />
              <Field label="Budget (₹)" name="Total_Cost_INR" hint={r.budget ? `Avg: ${fmtR(r.budget.mean)}` : ''} />
            </div>
          </div>

          {errors.submit && <div className="error-state mb-md">{errors.submit}</div>}

          <button className="btn btn-primary btn-lg" onClick={submit} disabled={submitting} id="btn-generate">
            {submitting ? '⏳ Generating Intelligence...' : '🚀 Generate Farm Intelligence'}
          </button>
        </div>
      ) : (
        <FarmResults result={result} onReset={() => setResult(null)} navigate={navigate} />
      )}
    </div>
  )
}

function FarmResults({ result, onReset, navigate }) {
  const recs = result.recommendations || []
  const yp = result.yield_prediction || {}
  const pp = result.profit_prediction || {}
  const risk = result.risk_assessment || {}

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-lg">
        <h2>Farm Intelligence Results</h2>
        <div className="flex gap-sm">
          <button className="btn btn-secondary" onClick={onReset}>← New Analysis</button>
          <button className="btn btn-secondary" onClick={() => navigate('/resource-optimizer')}>Optimize Resources →</button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="stat-grid stagger">
        <div className="stat-card">
          <div className="stat-label">Top Crop</div>
          <div className="stat-value accent">{recs[0]?.crop || '—'}</div>
          <div className="stat-sub">Suitability: {recs[0]?.suitability_score}%</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Predicted Yield</div>
          <div className="stat-value">{yp.predicted_yield_tonnes_ha} <span className="text-xs text-muted">t/ha</span></div>
          <div className="stat-sub">Model R²: {yp.model_r2}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Predicted Profit</div>
          <div className="stat-value" style={{color: pp.predicted_profit_inr >= 0 ? 'var(--success)' : 'var(--danger)', fontSize:'1.2rem'}}>
            ₹{Number(pp.predicted_profit_inr).toLocaleString('en-IN', {maximumFractionDigits:0})}
          </div>
          <div className="stat-sub">Model R²: {pp.model_r2}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Risk Level</div>
          <div className={`stat-value risk-${risk.category?.toLowerCase()}`}>{risk.category}</div>
          <div className="stat-sub">{risk.predicted_risk}%</div>
        </div>
      </div>

      <div className="model-info mb-lg">
        <div className="mi-disclaimer">⚠️ {yp.label || 'MODEL ESTIMATE — not guaranteed outcomes'}</div>
      </div>

      {/* Crop recommendations */}
      <h3 style={{marginBottom:'var(--space-md)'}}>🌱 Crop Recommendations</h3>
      <div className="card-grid-3 stagger" style={{marginBottom:'var(--space-xl)'}}>
        {recs.slice(0, 6).map((rec, i) => (
          <div className={`rec-card ${i === 0 ? 'top-pick' : ''}`} key={rec.crop}>
            <div className="rec-rank">{i + 1}</div>
            <div className="rec-crop">{rec.crop}</div>
            <div className="rec-score">Suitability <strong>{rec.suitability_score}%</strong></div>
            <div className="rec-details">
              <div className="rec-detail-item"><span className="rdl">ML Score</span><br /><span className="rdv">{rec.ml_probability}%</span></div>
              <div className="rec-detail-item"><span className="rdl">Avg Yield</span><br /><span className="rdv">{rec.historical_performance.avg_yield} t/ha</span></div>
              <div className="rec-detail-item"><span className="rdl">Avg Profit</span><br /><span className="rdv">₹{Number(rec.historical_performance.avg_profit).toLocaleString('en-IN', {maximumFractionDigits:0})}</span></div>
              <div className="rec-detail-item"><span className="rdl">Risk</span><br /><span className={`rdv risk-${rec.risk.category.toLowerCase()}`}>{rec.risk.category} ({rec.risk.avg_disease_pest_risk}%)</span></div>
              <div className="rec-detail-item"><span className="rdl">Water Eff.</span><br /><span className="rdv">{rec.water.avg_efficiency} t/1000m³</span></div>
              <div className="rec-detail-item"><span className="rdl">Records</span><br /><span className="rdv">{rec.historical_performance.records}</span></div>
            </div>
          </div>
        ))}
      </div>

      {/* Risk factors */}
      {risk.contributing_factors && (
        <>
          <h3 style={{marginBottom:'var(--space-md)'}}>🛡️ Risk Factors</h3>
          <div className="card mb-lg">
            <div className="table-container">
              <table>
                <thead>
                  <tr><th>Factor</th><th>Your Value</th><th>Dataset Mean</th><th>Impact</th><th>Direction</th></tr>
                </thead>
                <tbody>
                  {risk.contributing_factors.map(f => (
                    <tr key={f.factor}>
                      <td>{f.factor}</td>
                      <td>{f.value}</td>
                      <td>{f.dataset_mean}</td>
                      <td style={{color: f.contribution > 0 ? 'var(--danger)' : 'var(--success)'}}>{f.contribution > 0 ? '+' : ''}{f.contribution}</td>
                      <td>{f.direction}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
