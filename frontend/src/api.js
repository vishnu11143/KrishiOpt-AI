const API_BASE = '/api';

async function fetchApi(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  };
  const res = await fetch(url, config);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Health & Config
  health: () => fetchApi('/health'),
  config: () => fetchApi('/config'),
  
  // AI Assistant (Gemini)
  assistantChat: (data) => fetchApi('/assistant/chat', { method: 'POST', body: JSON.stringify(data) }),
  
  // Dashboard & Dataset
  dashboard: () => fetchApi('/dashboard'),
  datasetInfo: () => fetchApi('/dataset/info'),
  formOptions: () => fetchApi('/form-options'),
  
  // Analytics
  seasonalSummary: () => fetchApi('/analytics/seasonal-summary'),
  anova: () => fetchApi('/analytics/anova'),
  yieldProfit: () => fetchApi('/analytics/yield-profit'),
  revenueCost: () => fetchApi('/analytics/revenue-cost'),
  diseaseRainfall: () => fetchApi('/analytics/disease-rainfall'),
  waterEfficiency: () => fetchApi('/analytics/water-efficiency'),
  cropProfitability: () => fetchApi('/analytics/crop-profitability'),
  cropAnalytics: () => fetchApi('/analytics/crops'),
  stateAnalytics: () => fetchApi('/analytics/states'),
  riskAnalytics: () => fetchApi('/analytics/risk'),
  
  // ML
  yieldModelInfo: () => fetchApi('/ml/yield-model-info'),
  profitModelInfo: () => fetchApi('/ml/profit-model-info'),
  cropModelInfo: () => fetchApi('/ml/crop-model-info'),
  predictYield: (data) => fetchApi('/ml/predict-yield', { method: 'POST', body: JSON.stringify(data) }),
  predictProfit: (data) => fetchApi('/ml/predict-profit', { method: 'POST', body: JSON.stringify(data) }),
  recommendCrops: (data) => fetchApi('/ml/recommend-crops', { method: 'POST', body: JSON.stringify(data) }),
  predictRisk: (data) => fetchApi('/ml/predict-risk', { method: 'POST', body: JSON.stringify(data) }),
  
  // Optimization
  optimize: (data) => fetchApi('/optimize', { method: 'POST', body: JSON.stringify(data) }),
  whatIf: (data) => fetchApi('/what-if', { method: 'POST', body: JSON.stringify(data) }),
  
  // Combined
  farmIntelligence: (data) => fetchApi('/farm-intelligence', { method: 'POST', body: JSON.stringify(data) }),
};
