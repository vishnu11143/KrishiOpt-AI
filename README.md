# KrishiOpt AI — Intelligent Agricultural Decision & Resource Optimization Platform

> Built on the **Seasonal Agriculture Performance Analysis** research project (VOIS AICTE Batch 2026-27)

## Overview

KrishiOpt AI transforms a Jupyter notebook analysis of 4,000 Indian farm records into a production-quality agricultural intelligence platform with ML-powered crop recommendations, yield prediction, constrained resource optimization, what-if simulation, risk analysis, and interactive analytics.

**Every value, prediction, and chart is derived from the actual dataset — nothing is fabricated.**

## Features

| Module | Description |
|--------|-------------|
| **Overview Dashboard** | Executive metrics from 4,000 farm records across 8 states, 8 crops, 3 seasons |
| **Farm Planner** | Guided input workflow → crop recommendations, yield/profit predictions, risk assessment |
| **Crop Intelligence** | ML-powered crop recommendation engine (RandomForest + historical data scoring) |
| **Resource Optimizer** | Linear programming (scipy.optimize.linprog) to maximize profit under land/water/fertilizer/budget constraints |
| **What-If Simulator** | Compare base vs. scenario: change water, budget, land → see reallocated crops and profit impact |
| **Risk Intelligence** | Disease/pest risk analysis by season, crop, and environmental correlations |
| **Agricultural Map** | OpenStreetMap integration with state-level agricultural profiles |
| **Analytics & Evidence** | 8-tab interactive analytics mirroring and extending the original notebook analysis |
| **Krishi Assistant** | Context-aware AI assistant explaining results using actual data |
| **Settings** | System status, dataset schema, ML model metrics, project attribution |

## Architecture

```
KrishiOpt-AI/
├── backend/                    # Python Flask API
│   ├── app.py                  # Flask routes & API endpoints
│   ├── data_service.py         # Dataset loading, cleaning, analytics
│   ├── ml_service.py           # ML pipelines (yield, profit, crop, risk)
│   └── optimization_service.py # Linear programming optimizer
├── frontend/                   # React (Vite) application
│   └── src/
│       ├── api.js              # API client
│       ├── App.jsx             # Router + sidebar navigation
│       ├── index.css           # Complete design system
│       └── pages/              # 10 page components
├── data/
│   └── seasonal_agriculture_performance_dataset.csv  # Source dataset (4,000 records)
├── images/                     # Original notebook chart exports (preserved)
├── research/                   # (reference) Original notebook
├── Seasonal_Agriculture_Performance_Analysis.ipynb   # Original research notebook
├── requirements.txt            # Python dependencies
└── README.md
```

## Dataset

- **4,000 farm records** across **8 Indian states**, **8 crops**, **3 seasons** (Kharif, Rabi, Zaid)
- **28 columns** including farm area, environmental conditions, soil nutrients, resource usage, economics
- **3,880 records** after cleaning (120 dropped for missing values in key columns)
- Source: `data/seasonal_agriculture_performance_dataset.csv`

## Machine Learning

| Model | Task | Best Algorithm | R² | MAE | RMSE |
|-------|------|----------------|-----|-----|------|
| Yield Prediction | Regression | GradientBoosting | ~0.97 | ~0.64 | ~1.93 |
| Profit Prediction | Regression | GradientBoosting | ~0.94 | — | — |
| Crop Suitability | Classification | RandomForest | Accuracy ~16% | — | — |

> Crop classification accuracy is low because predicting a specific crop from environmental features alone is inherently a difficult 8-class problem. The recommendation system uses a **composite score** (40% ML + 30% profitability + 30% yield) for robust results.

> All metrics are computed from actual test-set predictions (80/20 split). Never fabricated.

## Optimization

- **Method**: Linear programming via `scipy.optimize.linprog` (HiGHS solver)
- **Objective**: Maximize total expected profit
- **Constraints**: Land, water, fertilizer, budget
- **Profiles**: Per-crop resource averages computed from actual dataset

## Analytics (from original notebook)

1. Kharif has highest yield and profit; Zaid runs at a slight loss (ANOVA: p < 0.001)
2. Yield does NOT differ significantly by season (ANOVA: p ≈ 0.17)
3. Cost stays flat (~₹66K–67K/ha); revenue drives the profit gap
4. Disease/pest risk tracks rainfall (r ≈ 0.63) — Kharif is highest risk
5. Rainfed > Drip > Sprinkler > Flood in water efficiency
6. Sugarcane & Chilli profitable in every season; Rice & Wheat lag

## Installation

```bash
# Clone and enter the project
cd KrishiOpt-AI

# Install Python dependencies
pip install -r requirements.txt

# Install frontend dependencies
cd frontend
npm install
cd ..
```

## Running Locally

**Terminal 1 — Backend (Flask API on port 5000):**
```bash
python -m backend.app
```

**Terminal 2 — Frontend (Vite dev server on port 3000):**
```bash
cd frontend
npm run dev
```

Open **http://localhost:3000** in your browser.

## Deployment on Vercel

KrishiOpt AI is configured for seamless zero-config deployment on Vercel combining the Vite React frontend and the Python Flask backend serverless function:

1. Push this repository to GitHub: `https://github.com/vishnu11143/KrishiOpt-AI`
2. Go to **[vercel.com/new](https://vercel.com/new)** and import your `KrishiOpt-AI` repository.
3. Configure **Environment Variables** in the Vercel project settings:
   - `GEMINI_API_KEY`: Your Google Gemini API Key
   - `GOOGLE_MAPS_API_KEY`: Your Google Maps API Key
   - `VITE_GOOGLE_MAPS_API_KEY`: Your Google Maps API Key (optional, for direct client-side loading)
4. Click **Deploy**. Vercel will:
   - Build the React Vite frontend into `frontend/dist`
   - Deploy Python serverless function at `api/index.py`
   - Automatically route `/api/*` to the Flask backend and `/*` to the React single-page app!

## Environment Variables


KrishiOpt AI integrates with Google Maps and Google Gemini APIs. Core analytics and ML continue to run locally, while external APIs enhance mapping and conversational intelligence.

Create a `.env` file in the project root based on `.env.example`:
```env
# Google Gemini API Key for Krishi AI Assistant
GEMINI_API_KEY=your_gemini_api_key_here

# Google Maps API Key for Interactive Agricultural Map
# Required APIs: Maps JavaScript API, Places API, Geocoding API
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here

# Server Configuration
PORT=5000
FLASK_DEBUG=false
```

For frontend deployment (optional):
```env
# frontend/.env
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

## Demo Workflow (~3 minutes)

1. **Overview Dashboard** — See executive metrics from 4,000 records
2. **Farm Planner** — Click "Analyze My Farm" → enter conditions → "Generate Farm Intelligence"
3. **Crop Intelligence** — View ranked crop recommendations with suitability scores
4. **Resource Optimizer** — Set constraints → "Optimize Allocation" → view optimal crop mix
5. **What-If Simulator** — Reduce water from 50,000 to 30,000 m³ → "Run Simulation" → see impact
6. **Risk Intelligence** — View seasonal/crop risk patterns and environmental correlations
7. **Agricultural Map** — Real Google Map with state pins, InfoWindows, and Places search
8. **AI Assistant** — Powered by Google Gemini with domain-grounded context from 4,000 farm records
9. **Analytics** — Browse all 8 tabs with charts identical to notebook analysis
10. **Settings** — Verify API integration status, ML model metrics, and dataset schema

## Original Research

The original Jupyter notebook (`Seasonal_Agriculture_Performance_Analysis.ipynb`) is preserved as the research foundation. All interactive analytics in the web application are independently computed from the same dataset and produce identical results.

## Technologies

- **Frontend**: React 19, Vite, Recharts, React Router, `@googlemaps/js-api-loader`
- **Backend**: Python, Flask, Flask-CORS, python-dotenv, requests
- **ML**: scikit-learn (GradientBoosting, RandomForest, Ridge, LinearRegression)
- **Optimization**: scipy.optimize.linprog (HiGHS solver)
- **Data**: pandas, numpy, scipy.stats
- **Mapping**: Google Maps JavaScript API (Places API, Geocoding API, custom markers & InfoWindows)
- **Generative AI**: Google Gemini API (gemini-1.5-flash / gemini-2.0-flash with agricultural domain system prompt)
- **Design**: Custom CSS design system (Manrope + Space Grotesk typography)

