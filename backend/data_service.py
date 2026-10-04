"""
KrishiOpt AI — Data Service
Loads, cleans, validates and provides analytics from the agricultural dataset.
All calculations are derived from the actual CSV, mirroring the original notebook logic.
"""

import os
import pandas as pd
import numpy as np
import math
from functools import lru_cache

# ---------------------------------------------------------------------------
# Numerical Statistics Utilities (Independent of SciPy for lightweight serverless)
# ---------------------------------------------------------------------------

def _betacf(a, b, x):
    MAXIT = 100
    EPS = 3.0e-7
    FPMIN = 1.0e-30
    qab = a + b
    qap = a + 1.0
    qam = a - 1.0
    c = 1.0
    d = 1.0 - qab * x / qap
    if abs(d) < FPMIN: d = FPMIN
    d = 1.0 / d
    h = d
    for m in range(1, MAXIT + 1):
        m2 = 2 * m
        aa = m * (b - m) * x / ((qam + m2) * (a + m2))
        d = 1.0 + aa * d
        if abs(d) < FPMIN: d = FPMIN
        c = 1.0 + aa / c
        if abs(c) < FPMIN: c = FPMIN
        d = 1.0 / d
        h *= d * c
        aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
        d = 1.0 + aa * d
        if abs(d) < FPMIN: d = FPMIN
        c = 1.0 + aa / c
        if abs(c) < FPMIN: c = FPMIN
        d = 1.0 / d
        del_h = d * c
        h *= del_h
        if abs(del_h - 1.0) < EPS:
            break
    return h

def _ibeta(a, b, x):
    if x <= 0.0: return 0.0
    if x >= 1.0: return 1.0
    bt = math.exp(math.lgamma(a + b) - math.lgamma(a) - math.lgamma(b) + a * math.log(x) + b * math.log(1.0 - x))
    if x < (a + 1.0) / (a + b + 2.0):
        return bt * _betacf(a, b, x) / a
    else:
        return 1.0 - bt * _betacf(b, a, 1.0 - x) / b

def _f_oneway(*groups):
    groups = [np.asarray(g, dtype=float) for g in groups if len(g) > 0]
    k = len(groups)
    if k < 2: return 0.0, 1.0
    n_total = sum(len(g) for g in groups)
    grand_mean = np.mean(np.concatenate(groups))
    ssb = sum(len(g) * (np.mean(g) - grand_mean) ** 2 for g in groups)
    ssw = sum(np.sum((g - np.mean(g)) ** 2) for g in groups)
    df1 = k - 1
    df2 = n_total - k
    msb = ssb / df1 if df1 > 0 else 0.0
    msw = ssw / df2 if df2 > 0 else 1.0
    f_stat = msb / msw if msw > 0 else 0.0
    if f_stat <= 0.0:
        p_val = 1.0
    else:
        x = df2 / (df2 + df1 * f_stat)
        p_val = float(_ibeta(df2 / 2.0, df1 / 2.0, x))
    return f_stat, p_val

def _pearsonr(x, y):
    x = np.asarray(x, dtype=float)
    y = np.asarray(y, dtype=float)
    n = len(x)
    if n < 3: return 0.0, 1.0
    r = float(np.corrcoef(x, y)[0, 1])
    r = max(min(r, 1.0), -1.0)
    if abs(r) >= 1.0: return r, 0.0
    df = n - 2
    t = abs(r) * math.sqrt(df / (1.0 - r * r))
    x_t = df / (df + t * t)
    p_val = float(_ibeta(df / 2.0, 0.5, x_t))
    return r, p_val


DATA_PATH = os.path.join(os.path.dirname(__file__), '..', 'data',
                         'seasonal_agriculture_performance_dataset.csv')

SEASONS = ['Kharif', 'Rabi', 'Zaid']
KEY_COLS_FOR_CLEANING = ['Yield_Tonnes_Ha', 'Rainfall_mm', 'Soil_Moisture_pct']

# ---------------------------------------------------------------------------
# Loading & Cleaning (mirrors notebook cells 4-10)
# ---------------------------------------------------------------------------

def _load_raw() -> pd.DataFrame:
    """Load the raw CSV exactly as-is."""
    return pd.read_csv(DATA_PATH)


def _clean(df: pd.DataFrame) -> pd.DataFrame:
    """
    Drop rows with missing values in key analytical columns and add
    derived per-hectare economic metrics — identical to notebook cell 9-10.
    """
    df = df.dropna(subset=[c for c in KEY_COLS_FOR_CLEANING if c in df.columns]).reset_index(drop=True)
    df['Profit_per_Ha'] = df['Profit_INR'] / df['Farm_Area_Hectares']
    df['Revenue_per_Ha'] = df['Revenue_INR'] / df['Farm_Area_Hectares']
    df['Cost_per_Ha'] = df['Total_Cost_INR'] / df['Farm_Area_Hectares']
    return df


@lru_cache(maxsize=1)
def load_data() -> pd.DataFrame:
    """Return the cleaned dataset (cached)."""
    return _clean(_load_raw())


def get_dataset_info() -> dict:
    """Schema, shape, missing-value summary for the raw dataset."""
    raw = _load_raw()
    df = load_data()
    missing = raw.isnull().sum()
    missing = missing[missing > 0].to_dict()
    return {
        'raw_rows': int(raw.shape[0]),
        'raw_cols': int(raw.shape[1]),
        'cleaned_rows': int(df.shape[0]),
        'columns': list(raw.columns),
        'dtypes': {c: str(raw[c].dtype) for c in raw.columns},
        'missing': missing,
        'states': sorted(df['State'].unique().tolist()),
        'crops': sorted(df['Crop'].unique().tolist()),
        'seasons': SEASONS,
        'districts': sorted(df['District'].unique().tolist()),
        'irrigation_methods': sorted(df['Irrigation_Method'].unique().tolist()),
    }


# ---------------------------------------------------------------------------
# Seasonal Analytics (mirrors notebook cells 14, 16, 19, 22, 25-26, 29, 33)
# ---------------------------------------------------------------------------

PERF_METRICS = [
    'Yield_Tonnes_Ha', 'Production_Tonnes', 'Profit_INR', 'Revenue_INR',
    'Total_Cost_INR', 'Water_Used_m3', 'Water_Efficiency_t_per_1000m3',
    'Fertilizer_kg_ha', 'Pesticide_Litre_ha', 'Disease_Pest_Risk_pct',
    'Rainfall_mm', 'Avg_Temperature_C', 'Humidity_pct', 'Soil_Moisture_pct',
]


def seasonal_summary() -> dict:
    """Average of key metrics grouped by season (notebook cell 14)."""
    df = load_data()
    summary = df.groupby('Season')[PERF_METRICS].mean().reindex(SEASONS).round(2)
    return summary.to_dict(orient='index')


def seasonal_anova() -> list[dict]:
    """One-way ANOVA for key metrics across seasons (notebook cell 16)."""
    df = load_data()
    results = []
    for col in ['Yield_Tonnes_Ha', 'Profit_INR', 'Revenue_INR', 'Total_Cost_INR',
                'Disease_Pest_Risk_pct', 'Water_Efficiency_t_per_1000m3',
                'Rainfall_mm', 'Humidity_pct']:
        groups = [df[df['Season'] == s][col].dropna() for s in SEASONS]
        f_stat, p_val = _f_oneway(*groups)
        results.append({
            'metric': col,
            'f_statistic': round(float(f_stat), 4),
            'p_value': float(p_val),
            'significant': bool(p_val < 0.05),
        })
    return results


def yield_profit_by_season() -> dict:
    """Yield and Profit per Ha by season (notebook cell 19)."""
    df = load_data()
    yield_m = df.groupby('Season')['Yield_Tonnes_Ha'].mean().reindex(SEASONS).round(2)
    profit_m = df.groupby('Season')['Profit_per_Ha'].mean().reindex(SEASONS).round(2)
    return {
        'seasons': SEASONS,
        'yield': yield_m.tolist(),
        'profit': profit_m.tolist(),
    }


def revenue_cost_by_season() -> dict:
    """Revenue and Cost per Ha by season (notebook cell 22)."""
    df = load_data()
    rev = df.groupby('Season')['Revenue_per_Ha'].mean().reindex(SEASONS).round(2)
    cost = df.groupby('Season')['Cost_per_Ha'].mean().reindex(SEASONS).round(2)
    return {
        'seasons': SEASONS,
        'revenue': rev.tolist(),
        'cost': cost.tolist(),
    }


def disease_rainfall_by_season() -> dict:
    """Disease/pest risk and rainfall by season (notebook cells 25-26)."""
    df = load_data()
    disease = df.groupby('Season')['Disease_Pest_Risk_pct'].mean().reindex(SEASONS).round(2)
    rain = df.groupby('Season')['Rainfall_mm'].mean().reindex(SEASONS).round(2)
    # Correlation matrix
    cols = ['Rainfall_mm', 'Humidity_pct', 'Soil_Moisture_pct', 'Disease_Pest_Risk_pct']
    corr = df[cols].corr().round(4)
    return {
        'seasons': SEASONS,
        'disease_risk': disease.tolist(),
        'rainfall': rain.tolist(),
        'correlation_matrix': corr.to_dict(),
    }


def water_efficiency_by_irrigation() -> dict:
    """Water efficiency by irrigation method (notebook cell 29)."""
    df = load_data()
    eff = df.groupby('Irrigation_Method')['Water_Efficiency_t_per_1000m3'].mean().sort_values(ascending=False).round(2)
    return {
        'methods': eff.index.tolist(),
        'efficiency': eff.values.tolist(),
    }


def crop_season_profitability() -> dict:
    """Crop × Season profit heatmap data (notebook cell 33)."""
    df = load_data()
    pivot = df.pivot_table(index='Crop', columns='Season', values='Profit_INR',
                           aggfunc='mean')[SEASONS].round(2)
    pivot = pivot.sort_values('Kharif', ascending=False)
    return {
        'crops': pivot.index.tolist(),
        'seasons': SEASONS,
        'values': pivot.values.tolist(),
    }


# ---------------------------------------------------------------------------
# Crop analytics
# ---------------------------------------------------------------------------

def crop_analytics() -> list[dict]:
    """Per-crop performance summary."""
    df = load_data()
    metrics = ['Yield_Tonnes_Ha', 'Profit_INR', 'Revenue_INR', 'Total_Cost_INR',
               'Production_Tonnes', 'Water_Efficiency_t_per_1000m3',
               'Disease_Pest_Risk_pct', 'Rainfall_mm', 'Fertilizer_kg_ha']
    grouped = df.groupby('Crop')[metrics].agg(['mean', 'std', 'min', 'max', 'count'])
    result = []
    for crop in sorted(df['Crop'].unique()):
        row = {}
        row['crop'] = crop
        row['count'] = int(grouped.loc[crop, ('Yield_Tonnes_Ha', 'count')])
        for m in metrics:
            row[m] = {
                'mean': round(float(grouped.loc[crop, (m, 'mean')]), 2),
                'std': round(float(grouped.loc[crop, (m, 'std')]), 2),
                'min': round(float(grouped.loc[crop, (m, 'min')]), 2),
                'max': round(float(grouped.loc[crop, (m, 'max')]), 2),
            }
        result.append(row)
    return result


# ---------------------------------------------------------------------------
# State / Regional analytics
# ---------------------------------------------------------------------------

def state_analytics() -> list[dict]:
    """Per-state performance summary."""
    df = load_data()
    metrics = ['Yield_Tonnes_Ha', 'Profit_INR', 'Revenue_INR', 'Total_Cost_INR',
               'Production_Tonnes', 'Disease_Pest_Risk_pct']
    grouped = df.groupby('State')[metrics].mean().round(2)
    result = []
    for state in sorted(df['State'].unique()):
        row = {'state': state}
        for m in metrics:
            row[m] = float(grouped.loc[state, m])
        row['count'] = int((df['State'] == state).sum())
        row['crops'] = sorted(df[df['State'] == state]['Crop'].unique().tolist())
        result.append(row)
    return result


# ---------------------------------------------------------------------------
# Risk analytics
# ---------------------------------------------------------------------------

def risk_analytics() -> dict:
    """Disease/pest risk analysis by season, crop, and environmental factors."""
    df = load_data()
    risk_by_season = df.groupby('Season')['Disease_Pest_Risk_pct'].agg(
        ['mean', 'std', 'min', 'max']).reindex(SEASONS).round(2).to_dict(orient='index')
    risk_by_crop = df.groupby('Crop')['Disease_Pest_Risk_pct'].agg(
        ['mean', 'std', 'min', 'max']).round(2).to_dict(orient='index')

    # Environmental correlations with risk
    env_cols = ['Rainfall_mm', 'Humidity_pct', 'Soil_Moisture_pct',
                'Avg_Temperature_C', 'Sunlight_Hours_Day']
    correlations = {}
    for col in env_cols:
        r, p = _pearsonr(df[col].dropna(), df.loc[df[col].notna(), 'Disease_Pest_Risk_pct'])
        correlations[col] = {'r': round(float(r), 4), 'p_value': float(p)}

    return {
        'by_season': risk_by_season,
        'by_crop': risk_by_crop,
        'environmental_correlations': correlations,
        'overall_mean': round(float(df['Disease_Pest_Risk_pct'].mean()), 2),
        'overall_std': round(float(df['Disease_Pest_Risk_pct'].std()), 2),
    }


# ---------------------------------------------------------------------------
# Overview / Dashboard metrics
# ---------------------------------------------------------------------------

def dashboard_metrics() -> dict:
    """Aggregate metrics for the overview dashboard."""
    df = load_data()
    raw = _load_raw()
    return {
        'total_records': int(raw.shape[0]),
        'cleaned_records': int(df.shape[0]),
        'states': int(df['State'].nunique()),
        'crops': int(df['Crop'].nunique()),
        'seasons': int(df['Season'].nunique()),
        'districts': int(df['District'].nunique()),
        'avg_yield': round(float(df['Yield_Tonnes_Ha'].mean()), 2),
        'avg_profit': round(float(df['Profit_INR'].mean()), 2),
        'avg_profit_per_ha': round(float(df['Profit_per_Ha'].mean()), 2),
        'avg_revenue': round(float(df['Revenue_INR'].mean()), 2),
        'avg_cost': round(float(df['Total_Cost_INR'].mean()), 2),
        'avg_water_efficiency': round(float(df['Water_Efficiency_t_per_1000m3'].mean()), 2),
        'avg_disease_risk': round(float(df['Disease_Pest_Risk_pct'].mean()), 2),
        'median_farm_area': round(float(df['Farm_Area_Hectares'].median()), 2),
        'most_profitable_crop': df.groupby('Crop')['Profit_INR'].mean().idxmax(),
        'most_profitable_season': df.groupby('Season')['Profit_INR'].mean().idxmax(),
        'highest_yield_crop': df.groupby('Crop')['Yield_Tonnes_Ha'].mean().idxmax(),
        'best_irrigation': df.groupby('Irrigation_Method')['Water_Efficiency_t_per_1000m3'].mean().idxmax(),
    }


# ---------------------------------------------------------------------------
# Data for farm planner dropdowns
# ---------------------------------------------------------------------------

def get_form_options() -> dict:
    """Options for the farm planner forms."""
    df = load_data()
    return {
        'states': sorted(df['State'].unique().tolist()),
        'districts_by_state': {
            state: sorted(df[df['State'] == state]['District'].unique().tolist())
            for state in df['State'].unique()
        },
        'crops': sorted(df['Crop'].unique().tolist()),
        'seasons': SEASONS,
        'irrigation_methods': sorted(df['Irrigation_Method'].unique().tolist()),
        'numeric_ranges': {
            'farm_area': {'min': 0.5, 'max': 15.0, 'mean': round(float(df['Farm_Area_Hectares'].mean()), 1)},
            'rainfall': {'min': 80, 'max': 1400, 'mean': round(float(df['Rainfall_mm'].mean()), 0)},
            'temperature': {'min': 16, 'max': 40, 'mean': round(float(df['Avg_Temperature_C'].mean()), 1)},
            'humidity': {'min': 25, 'max': 95, 'mean': round(float(df['Humidity_pct'].mean()), 0)},
            'soil_ph': {'min': 5.2, 'max': 8.4, 'mean': round(float(df['Soil_pH'].mean()), 1)},
            'soil_moisture': {'min': 8, 'max': 47, 'mean': round(float(df['Soil_Moisture_pct'].mean()), 0)},
            'nitrogen': {'min': 40, 'max': 220, 'mean': round(float(df['Nitrogen_kg_ha'].mean()), 0)},
            'phosphorus': {'min': 15, 'max': 120, 'mean': round(float(df['Phosphorus_kg_ha'].mean()), 0)},
            'potassium': {'min': 30, 'max': 200, 'mean': round(float(df['Potassium_kg_ha'].mean()), 0)},
            'sunlight': {'min': 3.5, 'max': 11, 'mean': round(float(df['Sunlight_Hours_Day'].mean()), 1)},
            'water_available': {'min': 128, 'max': 40902, 'mean': round(float(df['Water_Used_m3'].mean()), 0)},
            'budget': {'min': 26826, 'max': 1349990, 'mean': round(float(df['Total_Cost_INR'].mean()), 0)},
        }
    }
