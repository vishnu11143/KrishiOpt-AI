# Seasonal Agriculture Performance Analysis

**VOIS AICTE Batch 2026-27 — Major Project**

**Student:** Vishnu Koukuntla
**College:** N.K. Orchid College of Engineering
**AICTE STU ID:** STU6a6a2e387406a1785343544

## Problem Statement

Agricultural performance is shaped by seasonal shifts in rainfall, temperature, humidity, soil
moisture and resource use. Raw farm-level data doesn't, by itself, reveal how performance actually
changes from Kharif to Rabi to Zaid. This project analyzes a seasonal agriculture performance dataset
of 4,000 farm records across 8 Indian states, 8 crops and 3 seasons to uncover meaningful seasonal
patterns, trends and relationships — and to test whether the differences seen are statistically real
or just noise.

## Repository Contents

```
├── Seasonal_Agriculture_Performance_Analysis.ipynb   # Full analysis notebook (run top to bottom)
├── data/
│   └── seasonal_agriculture_performance_dataset.csv  # Source dataset (4,000 records)
├── images/                                           # Charts exported from the notebook
├── requirements.txt                                  # Python dependencies
└── README.md
```

## Key Findings

- **Kharif** has the highest yield and profit; **Zaid** runs at a slight loss on average
  (ANOVA on profit across seasons: p < 0.001).
- **Yield itself does not differ significantly by season** (ANOVA p ≈ 0.23) — the profit gap is
  driven by **revenue**, not cost. Cost per hectare stays nearly flat (₹66K–67K) in every season.
- **Disease/pest risk is significantly higher in Kharif** and closely tracks rainfall and humidity
  (r ≈ 0.6), explaining the season's higher input costs despite being the most profitable.
- **Rainfed and drip irrigation are far more water-efficient than flood irrigation** (7.56 vs
  3.44 tonnes per 1000 m³), and this holds regardless of season.
- **Crop choice matters more than season for profitability** — Sugarcane and Chilli stay profitable
  in every season, while Rice, Wheat and Maize post losses in most seasons regardless of timing.

## How to Run

1. Clone this repository:
   ```
   git clone <this-repo-url>
   cd <repo-folder>
   ```
2. Install dependencies:
   ```
   pip install -r requirements.txt
   ```
3. Launch Jupyter and run the notebook top to bottom:
   ```
   jupyter notebook Seasonal_Agriculture_Performance_Analysis.ipynb
   ```

## Tools & Technologies

- Python (Pandas, NumPy) — data cleaning and analysis
- Matplotlib — statistical and comparative visualization
- SciPy — significance testing (one-way ANOVA)
- Jupyter Notebook — end-to-end documented analysis

## Future Scope

- Machine-learning model to predict yield/profit from seasonal & environmental features
- Crop-and-season recommendation engine tailored to local soil and weather conditions
- Real-time weather / IoT soil-sensor integration for dynamic seasonal advisories
- Extended regional coverage for finer-grained recommendations
- Seasonal risk scoring feeding into crop-insurance and lending decisions
