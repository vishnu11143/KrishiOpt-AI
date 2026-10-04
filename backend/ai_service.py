"""
KrishiOpt AI — Gemini AI Assistant Service
Integrates Google Gemini API using GEMINI_API_KEY with domain-grounded context
from the Seasonal Agriculture Performance Analysis dataset.
"""

import os
import json
import logging
import requests

logger = logging.getLogger(__name__)

GEMINI_MODELS = [
    'gemini-1.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-pro',
]

def get_system_prompt() -> str:
    return """You are "Krishi Assistant" 🌾, an expert agricultural scientist, agronomist, and decision-support AI for KrishiOpt AI.

You provide actionable, data-backed agricultural intelligence to farmers, researchers, and policymakers based on the comprehensive research project "Seasonal Agriculture Performance Analysis" (VOIS AICTE Batch 2026-27).

### GROUND TRUTH DATASET INSIGHTS:
- **Scope**: 4,000 empirical farm records (3,880 cleaned) across 8 Indian states:
  Andhra Pradesh, Gujarat, Karnataka, Madhya Pradesh, Maharashtra, Punjab, Tamil Nadu, Telangana.
- **Crops (8)**: Rice, Wheat, Maize, Cotton, Sugarcane, Soybean, Groundnut, Chilli.
- **Seasons (3)**:
  1. **Kharif (Monsoon)**: Highest average yield and profit (₹75K+ / ha). High rainfall and high humidity lead to highest disease/pest risk (~55%+).
  2. **Rabi (Winter)**: Moderate yield and steady profit (₹40K–₹50K / ha). Moderate pest risk (~42%).
  3. **Zaid (Summer)**: Low profit / slight loss on average (~₹-4K to ₹5K / ha). Lowest pest risk (~33%), but severe water stress.
- **Key Statistical Finding (ANOVA)**:
  - Yield difference across seasons is NOT statistically significant (p ≈ 0.17 to 0.23).
  - Profit and Disease Risk differences ARE highly statistically significant (p < 0.001, F > 30).
  - Total cost per hectare stays virtually flat across all seasons (~₹66,000–₹67,000 / ha). Therefore, **revenue variations (market price & volume) drive seasonal profit gaps, NOT input costs**.
- **Environmental & Disease Correlations**:
  - Disease/pest risk strongly correlates with rainfall (r ≈ +0.63) and humidity.
  - Kharif crops require proactive IPM (Integrated Pest Management) budget.
- **Water & Irrigation Efficiency**:
  - Water efficiency ranking: Rainfed (~1.8–2.0 t/1000m³) > Drip (~1.4–1.6 t/1000m³) > Sprinkler (~1.1–1.2 t/1000m³) > Flood (~0.8–0.9 t/1000m³).
  - Flood irrigation is the least efficient; transitioning to drip/sprinkler preserves groundwater and boosts yield per m³.
- **Crop Economics**:
  - Sugarcane and Chilli maintain positive profitability across all three seasons.
  - Rice, Wheat, and Maize have tighter margins and frequently post losses in unoptimized conditions.
  - Crop choice is a larger determinant of profit than season alone.
- **Machine Learning & Optimization Architecture**:
  - Yield Prediction: GradientBoosting regressor (R² ≈ 0.97, MAE ≈ 0.64 t/ha).
  - Profit Prediction: GradientBoosting regressor (R² ≈ 0.94).
  - Crop Recommendation: Composite scoring engine (40% ML RandomForest suitability + 30% historical profitability + 30% historical yield).
  - Resource Optimizer: Linear Programming via scipy.optimize.linprog (HiGHS solver) maximizing profit subject to land, water, fertilizer, and budget constraints.

### GUIDELINES FOR RESPONSES:
1. Always base your explanations on the facts, statistics, and domain logic above.
2. Structure your answers cleanly using Markdown (headers, bullet points, bold key metrics).
3. Express currency in Indian Rupees (₹) using Indian numbering format (e.g. ₹50,000 or ₹1.2 Lakh).
4. Provide practical, empathetic, and scientifically sound advice for Indian farming conditions.
5. If the user asks about crop recommendations or what-if scenarios, explain the rationale (composite scoring, constraints, risk mitigation).
"""

def generate_local_grounded_response(question: str, context: dict = None) -> str:
    """
    Fallback deterministic response generator using actual dataset context.
    Used when GEMINI_API_KEY is not configured or network request fails.
    """
    q = (question or '').lower()
    d = context.get('dashboard') if context else None
    anova = context.get('anova') if context else None
    yp = context.get('yieldProfit') if context else None
    risk = context.get('risk') if context else None
    we = context.get('waterEfficiency') if context else None

    if 'kharif' in q or ('season' in q and 'profit' in q):
        kYield = yp.get('yield', ['N/A'])[0] if yp and 'yield' in yp else '3.8'
        kProfit = yp.get('profit', ['N/A'])[0] if yp and 'profit' in yp else '76500'
        zProfit = yp.get('profit', ['N/A'])[2] if yp and 'profit' in yp and len(yp['profit']) > 2 else '-4200'
        return (
            "### 🌾 Kharif Season Analysis (Empirical Dataset Findings)\n\n"
            f"Kharif is the most productive and profitable agricultural season in the dataset:\n"
            f"- **Average Yield**: {kYield} tonnes/hectare\n"
            f"- **Average Profit**: ₹{float(kProfit):,.0f} / ha\n\n"
            f"In contrast, Zaid season averages ₹{float(zProfit):,.0f} / ha (often operating at breakeven or loss).\n\n"
            "**Key Statistical Insight (ANOVA)**:\n"
            "- ANOVA tests confirm seasonal profit differences are **statistically significant** (p < 0.001).\n"
            "- Input costs per hectare remain nearly identical across all three seasons (~₹66,000–₹67,000/ha).\n"
            "- Therefore, the profit gap is entirely driven by **market revenue and yield realization**, not operational expenditure."
        )

    if 'zaid' in q or ('loss' in q and 'season' in q):
        return (
            "### ☀️ Zaid Season Analysis\n\n"
            "In the dataset of 4,000 records, Zaid (summer) frequently shows marginal profits or net losses:\n"
            "- **Cost Factor**: Farm operational costs in Zaid (~₹66,500/ha) are just as high as Kharif and Rabi.\n"
            "- **Water Stress**: High evaporation rates increase irrigation requirements without proportionate yield gain.\n"
            "- **Revenue Deficit**: Kharif revenue is approximately 38% higher than Zaid revenue.\n\n"
            "**Strategic Recommendations**:\n"
            "1. Switch to short-duration, high-value pulses, vegetables, or water-efficient cash crops (e.g. Chilli, Groundnut).\n"
            "2. Utilize Drip or Sprinkler irrigation rather than flood irrigation to control water pumping expenses.\n"
            "3. Secure crop insurance and forward contracts before planting."
        )

    if 'water' in q or 'irrigation' in q:
        methods = we.get('methods', ['Rainfed', 'Drip', 'Sprinkler', 'Flood']) if we else ['Rainfed', 'Drip', 'Sprinkler', 'Flood']
        effs = we.get('efficiency', ['1.85', '1.52', '1.18', '0.84']) if we else ['1.85', '1.52', '1.18', '0.84']
        table = "\n".join([f"- **{m}**: {effs[i]} tonnes / 1,000 m³" for i, m in enumerate(methods[:len(effs)])])
        return (
            "### 💧 Water Efficiency & Irrigation Evaluation\n\n"
            "Analysis across all 4,000 farm records reveals substantial differences in water productivity:\n\n"
            f"{table}\n\n"
            "**Key Takeaways**:\n"
            "- **Rainfed and Drip** systems deliver roughly **2x higher efficiency** than traditional Flood irrigation.\n"
            "- Flood irrigation leads to excessive water loss via runoff and percolation without proportional yield gains.\n"
            "- Converting 20% of acreage from flood to drip irrigation preserves up to 35% of total farm water budget while maintaining profit margins."
        )

    if 'risk' in q or 'disease' in q or 'pest' in q:
        return (
            "### 🛡️ Disease and Pest Risk Dynamics\n\n"
            "Data analysis of environmental risk factors reveals:\n"
            "- **Kharif Risk**: ~55%–62% (Highest risk period due to sustained high humidity and monsoon rainfall).\n"
            "- **Rabi Risk**: ~40%–45% (Moderate risk).\n"
            "- **Zaid Risk**: ~30%–35% (Lowest disease pressure due to dry heat).\n"
            "- **Environmental Correlation**: Pearson correlation between Rainfall and Pest/Disease Risk is strong (r ≈ +0.63).\n\n"
            "**Mitigation Protocol**:\n"
            "Budget higher Integrated Pest Management (IPM) provisions in Kharif and schedule preventive bio-pesticide applications during peak humidity intervals."
        )

    if 'crop' in q and ('recommend' in q or 'why' in q or 'suitable' in q or 'score' in q):
        return (
            "### 🎯 Crop Recommendation Methodology\n\n"
            "KrishiOpt AI employs a robust **Composite Scoring Architecture** rather than relying solely on a single classifier:\n\n"
            "1. **ML Suitability Probability (40% weight)**: A trained RandomForest classifier estimates environmental fit based on temperature, rainfall, soil moisture, and soil N-P-K nutrients.\n"
            "2. **Historical Profitability (30% weight)**: Normalized average profit per hectare for that crop in the chosen state and season.\n"
            "3. **Historical Yield Index (30% weight)**: Normalized yield productivity benchmarked against regional peers.\n\n"
            "**Core Finding**: High-value crops like Sugarcane and Chilli maintain profitability in all seasons, while staple grains (Rice, Wheat) require strict cost management to remain profitable."
        )

    if 'optimiz' in q or 'resource' in q or 'budget' in q or 'land' in q:
        return (
            "### ⚙️ Constrained Resource Optimization Engine\n\n"
            "The Resource Optimizer uses **Linear Programming** (`scipy.optimize.linprog` with the HiGHS solver):\n\n"
            "- **Objective Function**: Maximize total expected farm profit (₹).\n"
            "- **Boundary Constraints**:\n"
            "  - Total Allocated Land ≤ Total Farm Area\n"
            "  - Total Water Consumption ≤ Available Water Supply (m³)\n"
            "  - Total Fertilizer Applied ≤ Fertilizer Stock (kg)\n"
            "  - Total Operating Cost ≤ Total Available Budget (INR)\n"
            "  - Non-negativity: Allocated area for each crop ≥ 0\n\n"
            "Empirical resource coefficients (water/ha, fertilizer/ha, profit/ha) are calculated directly from regional averages in the dataset."
        )

    # General fallback
    total_records = d.get('total_records', 4000) if d else 4000
    states_count = d.get('states', 8) if d else 8
    avg_yield = d.get('avg_yield', '3.5') if d else '3.5'
    avg_profit = d.get('avg_profit', '45000') if d else '45000'
    return (
        f"### 🌾 KrishiOpt AI Intelligence Summary\n\n"
        f"Grounded in **{total_records:,} farm records across {states_count} Indian agricultural states**:\n"
        f"- **Average Regional Yield**: {avg_yield} t/ha\n"
        f"- **Average Profit**: ₹{float(avg_profit):,.0f} / ha\n"
        f"- **Most Profitable Crops**: Sugarcane & Chilli (profitable in all 3 seasons)\n"
        f"- **Best Season for Profit**: Kharif (Monsoon)\n\n"
        "Feel free to ask about:\n"
        "1. Specific seasonal performance comparisons (Kharif vs Rabi vs Zaid)\n"
        "2. Water efficiency across irrigation types (Drip vs Flood vs Rainfed)\n"
        "3. Disease and pest risk correlations with rainfall\n"
        "4. How crop recommendations and linear programming optimization work\n"
        "5. ML model metrics and evaluation scores (GradientBoosting R² ~0.97)"
    )

def query_gemini_api(message: str, history: list = None, context: dict = None) -> dict:
    """
    Executes a real call to Google Gemini API using GEMINI_API_KEY.
    Gracefully falls back to domain-grounded local response if key is missing or fails.
    """
    api_key = os.environ.get('GEMINI_API_KEY', '').strip()

    if not api_key:
        logger.info("GEMINI_API_KEY not configured. Using grounded dataset response.")
        resp = generate_local_grounded_response(message, context)
        return {
            'response': resp,
            'source': 'dataset_intelligence',
            'configured': False,
            'notice': 'To activate full Google Gemini generative AI, set GEMINI_API_KEY in your .env file.'
        }

    # Prepare conversation history for Gemini API
    contents = []
    if history and isinstance(history, list):
        for turn in history[-8:]:  # keep last 8 turns for context
            role = turn.get('role')
            content = turn.get('content', '')
            if role in ['user', 'assistant'] and content:
                gemini_role = 'model' if role == 'assistant' else 'user'
                contents.append({
                    'role': gemini_role,
                    'parts': [{'text': content}]
                })

    # Add current user prompt
    contents.append({
        'role': 'user',
        'parts': [{'text': message}]
    })

    system_instruction = get_system_prompt()
    if context and isinstance(context, dict):
        system_instruction += f"\n\nCURRENT CLIENT DASHBOARD CONTEXT:\n{json.dumps(context, default=str)}"

    payload = {
        'contents': contents,
        'systemInstruction': {
            'parts': [{'text': system_instruction}]
        },
        'generationConfig': {
            'temperature': 0.4,
            'maxOutputTokens': 2048,
        }
    }

    headers = {'Content-Type': 'application/json'}
    last_error = None

    for model in GEMINI_MODELS:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        try:
            res = requests.post(url, json=payload, headers=headers, timeout=20)
            if res.status_code == 200:
                data = res.json()
                candidates = data.get('candidates', [])
                if candidates:
                    parts = candidates[0].get('content', {}).get('parts', [])
                    if parts and 'text' in parts[0]:
                        return {
                            'response': parts[0]['text'],
                            'source': 'gemini',
                            'model': model,
                            'configured': True
                        }
            else:
                last_error = f"Gemini API {model} returned status {res.status_code}: {res.text}"
                logger.warning(last_error)
        except Exception as e:
            last_error = str(e)
            logger.warning(f"Error querying Gemini model {model}: {e}")

    # If all models failed (e.g. invalid key or network issue), fall back gracefully
    logger.warning(f"Gemini API request failed ({last_error}). Falling back to dataset engine.")
    resp = generate_local_grounded_response(message, context)
    return {
        'response': resp,
        'source': 'dataset_intelligence',
        'configured': True,
        'fallback_reason': last_error or 'API request error',
        'notice': 'Grounded dataset intelligence active. (Gemini API temporarily unreachable or quota exceeded).'
    }
