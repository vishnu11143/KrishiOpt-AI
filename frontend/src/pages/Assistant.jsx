import { useState, useRef, useEffect } from 'react'
import { api } from '../api'

const SUGGESTIONS = [
  "Why was this crop recommended?",
  "What does the dataset show about Kharif season?",
  "Which crop is most profitable?",
  "Why is Zaid season less profitable?",
  "What is the risk level for rice in Kharif?",
  "How does irrigation method affect water efficiency?",
  "Why did the resource allocation change?",
  "Explain the ANOVA results for seasonal profit",
]

export default function Assistant() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Welcome to **Krishi Assistant**! 🌾\n\nI can help you understand the agricultural analysis, crop recommendations, model predictions, and optimization results from KrishiOpt AI.\n\nI answer using actual data from the dataset (4,000 farm records across 8 Indian states). Ask me anything about:\n\n• Crop recommendations and why they were chosen\n• Seasonal performance differences\n• Risk factors and environmental correlations\n• Resource optimization results\n• Model accuracy and methodology\n• Statistical findings (ANOVA, correlations)\n\nTry asking one of the suggestions below!`
    }
  ])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [context, setContext] = useState(null)
  const endRef = useRef(null)

  const [geminiStatus, setGeminiStatus] = useState(null)

  useEffect(() => {
    // Check config status
    api.config().then(c => setGeminiStatus(c)).catch(() => {})

    // Load context data for the assistant
    Promise.all([
      api.dashboard().catch(() => null),
      api.anova().catch(() => null),
      api.yieldProfit().catch(() => null),
      api.cropProfitability().catch(() => null),
      api.waterEfficiency().catch(() => null),
      api.riskAnalytics().catch(() => null),
    ]).then(([dash, anova, yp, cp, we, risk]) => {
      setContext({ dashboard: dash, anova, yieldProfit: yp, cropProfitability: cp, waterEfficiency: we, risk })
    })
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking])

  const generateResponse = (question) => {
    const q = question.toLowerCase()
    const d = context?.dashboard
    const anova = context?.anova
    const yp = context?.yieldProfit
    const cp = context?.cropProfitability
    const we = context?.waterEfficiency
    const risk = context?.risk

    // Pattern-matched responses using actual data
    if (q.includes('kharif') || q.includes('season') && q.includes('profit')) {
      const kYield = yp?.yield?.[0] ?? 'N/A'
      const kProfit = yp?.profit?.[0] ?? 'N/A'
      const zProfit = yp?.profit?.[2] ?? 'N/A'
      const profitAnova = anova?.find(a => a.metric === 'Profit_INR')
      return `**Kharif Season Analysis** (from actual dataset)\n\n` +
        `Kharif is the most profitable season with:\n` +
        `- **Average yield**: ${kYield} t/ha\n` +
        `- **Average profit/ha**: ₹${Number(kProfit).toLocaleString('en-IN')}\n\n` +
        `In contrast, Zaid averages ₹${Number(zProfit).toLocaleString('en-IN')}/ha — often running at a loss.\n\n` +
        `**Statistical support**: ANOVA on profit across seasons shows F=${profitAnova?.f_statistic?.toFixed(2) ?? '?'}, ` +
        `p=${profitAnova?.p_value ? (profitAnova.p_value < 0.001 ? '< 0.001' : profitAnova.p_value.toFixed(4)) : '?'} — ` +
        `${profitAnova?.significant ? '**statistically significant**' : 'not significant'}.\n\n` +
        `The profit gap is driven by **revenue differences**, not cost — cost per hectare stays nearly flat (₹66K–67K) across all seasons.`
    }

    if (q.includes('zaid') || (q.includes('loss') && q.includes('season'))) {
      const zProfit = yp?.profit?.[2] ?? 'N/A'
      return `**Zaid Season Analysis** (from actual dataset)\n\n` +
        `Zaid runs at an average profit of ₹${Number(zProfit).toLocaleString('en-IN')}/ha, which is often a slight loss.\n\n` +
        `**Why?** The analysis shows:\n` +
        `- Cost per hectare is nearly the same across all seasons (~₹66K–67K)\n` +
        `- The difference comes from **revenue**, not cost\n` +
        `- Kharif revenue is ~38% higher than Zaid revenue\n\n` +
        `**Recommendation**: Focus revenue-side interventions (market access, pricing, crop insurance) on Zaid season.`
    }

    if (q.includes('crop') && (q.includes('recommend') || q.includes('why') || q.includes('suitable'))) {
      return `**Crop Recommendation Methodology**\n\n` +
        `Crops are recommended using a composite scoring system:\n\n` +
        `1. **ML Probability (40%)**: RandomForest classifier trained on the dataset predicts which crop best matches your environmental conditions\n` +
        `2. **Historical Profitability (30%)**: Average profit from the dataset for that crop in your season/state\n` +
        `3. **Historical Yield (30%)**: Average yield from similar conditions\n\n` +
        `The model accuracy is ${context?.dashboard ? 'shown on the Crop Intelligence page' : 'calculated from real test data'}.\n\n` +
        `**Key finding**: Sugarcane and Chilli are profitable in **every** season, while Rice, Wheat and Maize post losses in most seasons. Crop choice matters more than season for profitability.`
    }

    if (q.includes('profitable') || q.includes('best crop')) {
      return `**Most Profitable Crops** (from actual dataset)\n\n` +
        `Based on average profit across all records:\n` +
        `- **Most profitable**: ${d?.most_profitable_crop ?? 'Sugarcane'}\n` +
        `- Sugarcane and Chilli stay profitable in every season\n` +
        `- Rice, Wheat and Maize post losses in most seasons\n\n` +
        `**Key insight**: The biggest lever for profitability isn't which season you plant in — it's **which crop** you choose.`
    }

    if (q.includes('risk') || q.includes('disease') || q.includes('pest')) {
      const overallRisk = risk?.overall_mean ?? 'N/A'
      const kRisk = risk?.by_season?.Kharif?.mean ?? 'N/A'
      const zRisk = risk?.by_season?.Zaid?.mean ?? 'N/A'
      const rainCorr = risk?.environmental_correlations?.Rainfall_mm?.r ?? 'N/A'
      return `**Disease/Pest Risk Analysis** (from actual dataset)\n\n` +
        `- **Overall average risk**: ${overallRisk}%\n` +
        `- **Kharif risk**: ${kRisk}% (highest)\n` +
        `- **Zaid risk**: ${zRisk}% (lowest)\n\n` +
        `**Environmental correlations**:\n` +
        `- Rainfall → Risk correlation: r ≈ ${typeof rainCorr === 'number' ? rainCorr.toFixed(2) : rainCorr}\n` +
        `- Higher rainfall and humidity = higher pest/disease pressure\n\n` +
        `**Interpretation**: Wetter, more humid conditions (Kharif) create favorable environments for pests and disease. Budget for higher pest management costs in Kharif.`
    }

    if (q.includes('water') || q.includes('irrigation')) {
      const methods = we?.methods || []
      const effValues = we?.efficiency || []
      const effs = methods.map((m, i) => `- **${m}**: ${effValues[i]} t/1000m³`).join('\n')
      return `**Water Efficiency Analysis** (from actual dataset)\n\n` +
        `Water efficiency by irrigation method:\n${effs}\n\n` +
        `**Key finding**: Rainfed and drip irrigation are far more water-efficient than flood irrigation (roughly 2x). This holds regardless of season.\n\n` +
        `**Recommendation**: Encourage a shift from flood to drip/rainfed irrigation where feasible.`
    }

    if (q.includes('anova') || q.includes('statistic') || q.includes('significant')) {
      const results = anova?.map(a =>
        `- **${a.metric.replace(/_/g, ' ')}**: F=${a.f_statistic.toFixed(2)}, p=${a.p_value < 0.001 ? '< 0.001' : a.p_value.toFixed(4)} → ${a.significant ? '**Significant**' : 'Not significant'}`
      ).join('\n') || 'Data not loaded'
      return `**ANOVA Results** (One-Way ANOVA across 3 seasons)\n\n${results}\n\n` +
        `**Key finding**: Yield differences across seasons are NOT statistically significant (p ≈ 0.23), but profit and disease risk differences ARE highly significant (p < 0.001).`
    }

    if (q.includes('optimiz') || q.includes('allocation') || q.includes('resource')) {
      return `**Resource Optimization Methodology**\n\n` +
        `The optimizer uses **linear programming** (scipy.optimize.linprog, HiGHS solver) to:\n\n` +
        `**Objective**: Maximize total expected profit\n\n` +
        `**Subject to constraints**:\n` +
        `- Total land ≤ available land\n` +
        `- Total water ≤ available water\n` +
        `- Total fertilizer ≤ available fertilizer\n` +
        `- Total cost ≤ budget\n` +
        `- Each crop area ≥ 0\n\n` +
        `Per-crop resource profiles (yield/ha, profit/ha, water/ha, etc.) are computed from the **actual dataset** averages for the selected season and state.\n\n` +
        `Results are compared against a baseline of equal land distribution across all crops.`
    }

    if (q.includes('model') || q.includes('accuracy') || q.includes('r2') || q.includes('predict')) {
      return `**ML Model Information**\n\n` +
        `KrishiOpt AI trains real ML models on the dataset:\n\n` +
        `1. **Yield Prediction**: GradientBoosting / RandomForest / Ridge regression, evaluated with MAE, RMSE, R²\n` +
        `2. **Profit Prediction**: GradientBoosting with yield as input feature\n` +
        `3. **Crop Classification**: RandomForest for suitability scoring\n\n` +
        `All metrics are computed from actual test-set predictions (80/20 split). View exact numbers on the Analytics → ML Models tab.\n\n` +
        `⚠️ All predictions are MODEL ESTIMATES, not guaranteed outcomes.`
    }

    // General fallback
    return `Based on the dataset of ${d?.total_records ?? 4000} farm records across ${d?.states ?? 8} Indian states:\n\n` +
      `- **Average yield**: ${d?.avg_yield ?? 'N/A'} t/ha\n` +
      `- **Average profit**: ₹${d?.avg_profit ? Number(d.avg_profit).toLocaleString('en-IN') : 'N/A'}\n` +
      `- **Most profitable crop**: ${d?.most_profitable_crop ?? 'N/A'}\n` +
      `- **Best season**: ${d?.most_profitable_season ?? 'N/A'}\n` +
      `- **Disease risk**: ${d?.avg_disease_risk ?? 'N/A'}%\n\n` +
      `Could you be more specific? I can explain:\n` +
      `- Why a specific crop was recommended\n` +
      `- Seasonal performance differences\n` +
      `- Risk factors and correlations\n` +
      `- Optimization methodology\n` +
      `- Model accuracy and predictions\n` +
      `- Statistical test results (ANOVA)`
  }

  const send = async (text) => {
    const q = text || input
    if (!q.trim()) return
    setInput('')
    const newMsg = { role: 'user', content: q }
    const updatedMessages = [...messages, newMsg]
    setMessages(updatedMessages)
    setThinking(true)

    try {
      const res = await api.assistantChat({
        message: q,
        history: updatedMessages,
        context
      })

      setMessages(m => [
        ...m,
        {
          role: 'assistant',
          content: res.response || generateResponse(q),
          source: res.source,
          model: res.model,
          notice: res.notice
        }
      ])
    } catch {
      // Graceful fallback to client dataset response
      const fallbackResponse = generateResponse(q)
      setMessages(m => [
        ...m,
        {
          role: 'assistant',
          content: fallbackResponse,
          source: 'dataset_intelligence',
        }
      ])
    } finally {
      setThinking(false)
    }
  }

  return (
    <div className="fade-in">
      <div className="page-header" style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'var(--space-sm)'}}>
        <div>
          <h1>🤖 Krishi Assistant</h1>
          <p className="page-subtitle">AI-powered agricultural explanations using Google Gemini & empirical dataset analysis</p>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:8}}>
          {geminiStatus?.has_gemini_key ? (
            <span className="badge badge-success" style={{display:'inline-flex', alignItems:'center', gap:4}}>
              <span>✨</span> Gemini AI Active
            </span>
          ) : (
            <span className="badge badge-neutral" style={{display:'inline-flex', alignItems:'center', gap:4}} title="Add GEMINI_API_KEY to .env to enable generative AI">
              <span>🌾</span> Dataset Intelligence
            </span>
          )}
        </div>
      </div>

      <div className="chat-container">
        <div className="chat-messages">
          {messages.map((m, i) => (
            <div key={i} className={`chat-message ${m.role}`}>
              <div className="msg-avatar">{m.role === 'assistant' ? '🌾' : '👤'}</div>
              <div className="msg-bubble">
                {m.source && (
                  <div style={{fontSize:'0.7rem', opacity:0.75, marginBottom:6, display:'flex', alignItems:'center', gap:4}}>
                    {m.source === 'gemini' ? (
                      <span style={{color:'var(--accent)'}}>✨ Powered by Google Gemini ({m.model || '1.5 Flash'})</span>
                    ) : (
                      <span>🌾 Grounded Dataset Intelligence</span>
                    )}
                  </div>
                )}
                {m.content.split('\n').map((line, j) => {
                  // Render markdown headers and bolding
                  if (line.startsWith('### ')) {
                    return <h4 key={j} style={{margin:'8px 0 4px 0', fontSize:'0.95rem'}}>{line.replace('### ', '')}</h4>
                  }
                  if (line.startsWith('## ')) {
                    return <h3 key={j} style={{margin:'10px 0 6px 0', fontSize:'1.05rem'}}>{line.replace('## ', '')}</h3>
                  }
                  line = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                  return <div key={j} dangerouslySetInnerHTML={{__html: line || '&nbsp;'}} style={{marginBottom: line ? 3 : 8}} />
                })}
                {m.notice && (
                  <div className="text-xs text-muted" style={{marginTop:8, paddingTop:6, borderTop:'1px dashed rgba(255,255,255,0.1)'}}>
                    ℹ️ {m.notice}
                  </div>
                )}
              </div>
            </div>
          ))}
          {thinking && (
            <div className="chat-message assistant">
              <div className="msg-avatar">🌾</div>
              <div className="msg-bubble"><em>Analyzing agricultural data with AI...</em></div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Suggestions */}
        {messages.length <= 2 && (
          <div style={{padding:'0 var(--space-md)', display:'flex', gap:8, flexWrap:'wrap', paddingBottom:8}}>
            {SUGGESTIONS.slice(0, 4).map(s => (
              <button key={s} className="btn btn-secondary btn-sm" onClick={() => send(s)} style={{fontSize:'0.75rem'}}>
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="chat-input-area">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Ask about crops, seasons, risk, optimization, or farming practices..."
            disabled={thinking}
            id="assistant-input"
          />
          <button className="btn btn-primary" onClick={() => send()} disabled={thinking || !input.trim()} id="btn-send">
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
