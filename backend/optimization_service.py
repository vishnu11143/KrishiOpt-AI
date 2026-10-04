"""
KrishiOpt AI — Optimization Service
Constrained resource optimization using scipy.optimize.linprog (linear programming).
Allocates land, water, fertilizer, and budget across crops to maximize expected profit.
"""

import numpy as np
import pandas as pd
from . import data_service

# ---------------------------------------------------------------------------
# Linear Programming Solver (Standalone NumPy Simplex + SciPy fallback)
# Keeps serverless deployment bundle lightweight (<150 MB) without bulky SciPy
# ---------------------------------------------------------------------------

def _simplex_linprog(c, A_ub, b_ub, bounds=None):
    """
    Pure NumPy implementation of the Simplex linear programming algorithm.
    Solves: minimize c @ x  subject to  A_ub @ x <= b_ub, 0 <= x_i <= upper_bound.
    """
    m, n = A_ub.shape
    A_rows = list(A_ub)
    b_rows = list(b_ub)

    if bounds:
        for i, bnd in enumerate(bounds):
            if bnd is not None and len(bnd) > 1 and bnd[1] is not None and np.isfinite(bnd[1]):
                row = np.zeros(n)
                row[i] = 1.0
                A_rows.append(row)
                b_rows.append(float(bnd[1]))

    A_all = np.array(A_rows, dtype=float)
    b_all = np.array(b_rows, dtype=float)
    m_all, n_all = A_all.shape

    # Standard Tableau: [A | I | b]
    #                   [c | 0 | 0]
    tableau = np.zeros((m_all + 1, n_all + m_all + 1), dtype=float)
    tableau[:m_all, :n_all] = A_all
    tableau[:m_all, n_all:n_all + m_all] = np.eye(m_all)
    tableau[:m_all, -1] = b_all
    tableau[-1, :n_all] = c

    MAX_ITER = 2000
    basis = list(range(n_all, n_all + m_all))

    for _ in range(MAX_ITER):
        pivot_col = int(np.argmin(tableau[-1, :-1]))
        if tableau[-1, pivot_col] >= -1e-9:
            break

        ratios = []
        for i in range(m_all):
            if tableau[i, pivot_col] > 1e-9:
                ratios.append(tableau[i, -1] / tableau[i, pivot_col])
            else:
                ratios.append(np.inf)

        pivot_row = int(np.argmin(ratios))
        if ratios[pivot_row] == np.inf:
            class UnboundedResult:
                success = False
                message = "Problem is unbounded"
                x = np.zeros(n)
            return UnboundedResult()

        pivot_val = tableau[pivot_row, pivot_col]
        tableau[pivot_row, :] /= pivot_val
        for i in range(m_all + 1):
            if i != pivot_row:
                tableau[i, :] -= tableau[i, pivot_col] * tableau[pivot_row, :]
        basis[pivot_row] = pivot_col

    x = np.zeros(n_all)
    for i, b_var in enumerate(basis):
        if b_var < n_all:
            x[b_var] = tableau[i, -1]

    class SimplexResult:
        def __init__(self, sol, obj):
            self.success = True
            self.message = "Optimization terminated successfully"
            self.x = sol
            self.fun = obj

    x_sol = x[:n]
    return SimplexResult(x_sol, float(np.dot(c, x_sol)))



def _linprog(c, A_ub, b_ub, bounds=None, method='highs'):
    """Solve linear program via SciPy if available, else native Simplex."""
    try:
        from scipy.optimize import linprog
        return linprog(c, A_ub=A_ub, b_ub=b_ub, bounds=bounds, method=method)
    except ImportError:
        return _simplex_linprog(c, A_ub=A_ub, b_ub=b_ub, bounds=bounds)


# ---------------------------------------------------------------------------
# Build per-crop profiles from actual data
# ---------------------------------------------------------------------------

def _crop_profiles(season: str = 'Kharif', state: str = None) -> pd.DataFrame:
    """
    For each crop, compute average resource-use and economic metrics
    from the actual dataset, filtered by season (and optionally state).
    """
    df = data_service.load_data()
    mask = df['Season'] == season
    if state and state in df['State'].values:
        mask_s = mask & (df['State'] == state)
        if mask_s.sum() > 10:
            mask = mask_s

    subset = df[mask]

    profiles = []
    for crop in sorted(subset['Crop'].unique()):
        cdf = subset[subset['Crop'] == crop]
        if len(cdf) < 3:
            continue
        profiles.append({
            'crop': crop,
            'count': int(len(cdf)),
            'avg_yield_per_ha': float(cdf['Yield_Tonnes_Ha'].mean()),
            'avg_profit_per_ha': float(cdf['Profit_per_Ha'].mean()),
            'avg_revenue_per_ha': float(cdf['Revenue_per_Ha'].mean()),
            'avg_cost_per_ha': float(cdf['Cost_per_Ha'].mean()),
            'avg_water_per_ha': float(cdf['Water_Used_m3'].mean() / cdf['Farm_Area_Hectares'].mean()),
            'avg_fertilizer_per_ha': float(cdf['Fertilizer_kg_ha'].mean()),
            'avg_risk': float(cdf['Disease_Pest_Risk_pct'].mean()),
        })
    return pd.DataFrame(profiles)


def optimize_resources(params: dict) -> dict:
    """
    Linear programming optimization:
    Maximize total expected profit subject to:
      - total land <= available land
      - total water <= available water
      - total fertilizer <= available fertilizer
      - total cost <= budget
      - each crop allocation >= 0 (min_area per crop can be set)

    params:
        season, state (optional),
        total_land, total_water, total_fertilizer, total_budget,
        min_area_per_crop (optional, default 0)
    """
    season = params.get('season', 'Kharif')
    state = params.get('state', None)
    total_land = float(params.get('total_land', 10))
    total_water = float(params.get('total_water', 50000))
    total_fertilizer = float(params.get('total_fertilizer', 2000))
    total_budget = float(params.get('total_budget', 500000))
    min_area = float(params.get('min_area_per_crop', 0))

    profiles = _crop_profiles(season, state)
    if profiles.empty:
        return {'error': 'No crop data available for given season/state', 'allocations': []}

    n = len(profiles)
    crops = profiles['crop'].tolist()

    # Objective: maximize profit => minimize negative profit
    profit_per_ha = profiles['avg_profit_per_ha'].values
    c = -profit_per_ha  # negate for minimization

    # Constraint coefficients
    water_per_ha = profiles['avg_water_per_ha'].values
    fert_per_ha = profiles['avg_fertilizer_per_ha'].values
    cost_per_ha = profiles['avg_cost_per_ha'].values

    # Inequality constraints: A_ub @ x <= b_ub
    A_ub = np.array([
        np.ones(n),           # land
        water_per_ha,         # water
        fert_per_ha,          # fertilizer
        cost_per_ha,          # budget (cost)
    ])
    b_ub = np.array([total_land, total_water, total_fertilizer, total_budget])

    # Bounds: each crop area >= min_area and <= total_land
    bounds = [(min_area, total_land) for _ in range(n)]

    result = _linprog(c, A_ub=A_ub, b_ub=b_ub, bounds=bounds, method='highs')

    if not result.success:
        return {
            'error': f'Optimization did not converge: {result.message}',
            'allocations': [],
        }

    allocations = []
    total_profit = 0
    total_revenue = 0
    total_cost = 0
    total_water_used = 0
    total_fert_used = 0
    total_land_used = 0

    for i, crop in enumerate(crops):
        area = float(result.x[i])
        if area < 0.01:
            continue

        est_yield = float(profiles.iloc[i]['avg_yield_per_ha'] * area)
        est_profit = float(profiles.iloc[i]['avg_profit_per_ha'] * area)
        est_revenue = float(profiles.iloc[i]['avg_revenue_per_ha'] * area)
        est_cost = float(profiles.iloc[i]['avg_cost_per_ha'] * area)
        est_water = float(profiles.iloc[i]['avg_water_per_ha'] * area)
        est_fert = float(profiles.iloc[i]['avg_fertilizer_per_ha'] * area)

        allocations.append({
            'crop': crop,
            'land_hectares': round(area, 2),
            'estimated_yield_tonnes': round(est_yield, 2),
            'estimated_profit_inr': round(est_profit, 2),
            'estimated_revenue_inr': round(est_revenue, 2),
            'estimated_cost_inr': round(est_cost, 2),
            'water_allocated_m3': round(est_water, 2),
            'fertilizer_allocated_kg': round(est_fert, 2),
            'risk_pct': round(float(profiles.iloc[i]['avg_risk']), 1),
        })

        total_profit += est_profit
        total_revenue += est_revenue
        total_cost += est_cost
        total_water_used += est_water
        total_fert_used += est_fert
        total_land_used += area

    # Baseline: equal distribution
    equal_area = total_land / n
    baseline_profit = sum(float(profiles.iloc[i]['avg_profit_per_ha'] * equal_area) for i in range(n))

    return {
        'allocations': allocations,
        'summary': {
            'total_land_used': round(total_land_used, 2),
            'total_water_used': round(total_water_used, 2),
            'total_fertilizer_used': round(total_fert_used, 2),
            'total_estimated_profit': round(total_profit, 2),
            'total_estimated_revenue': round(total_revenue, 2),
            'total_estimated_cost': round(total_cost, 2),
        },
        'resource_utilization': {
            'land_pct': round(total_land_used / total_land * 100, 1) if total_land > 0 else 0,
            'water_pct': round(total_water_used / total_water * 100, 1) if total_water > 0 else 0,
            'fertilizer_pct': round(total_fert_used / total_fertilizer * 100, 1) if total_fertilizer > 0 else 0,
            'budget_pct': round(total_cost / total_budget * 100, 1) if total_budget > 0 else 0,
        },
        'comparison': {
            'baseline_equal_profit': round(baseline_profit, 2),
            'optimized_profit': round(total_profit, 2),
            'improvement_inr': round(total_profit - baseline_profit, 2),
            'improvement_pct': round((total_profit - baseline_profit) / abs(baseline_profit) * 100, 1)
                               if abs(baseline_profit) > 1 else 0,
        },
        'constraints': {
            'total_land': total_land,
            'total_water': total_water,
            'total_fertilizer': total_fertilizer,
            'total_budget': total_budget,
        },
        'season': season,
        'state': state,
        'methodology': 'Linear programming (scipy.optimize.linprog, HiGHS solver)',
        'label': 'OPTIMIZATION RESULT — based on historical averages from dataset',
    }


def what_if_scenario(base_params: dict, scenario_params: dict) -> dict:
    """
    Run optimization with base params and scenario params,
    then compare the two results.
    """
    base_result = optimize_resources(base_params)
    scenario_result = optimize_resources(scenario_params)

    # Calculate changes
    changes = []
    for key in ['total_land', 'total_water', 'total_fertilizer', 'total_budget']:
        base_val = float(base_params.get(key, 0))
        scen_val = float(scenario_params.get(key, 0))
        if base_val != scen_val:
            changes.append({
                'parameter': key.replace('total_', '').replace('_', ' ').title(),
                'base_value': base_val,
                'scenario_value': scen_val,
                'change': round(scen_val - base_val, 2),
                'change_pct': round((scen_val - base_val) / base_val * 100, 1) if base_val > 0 else 0,
            })

    base_profit = base_result.get('summary', {}).get('total_estimated_profit', 0)
    scen_profit = scenario_result.get('summary', {}).get('total_estimated_profit', 0)

    return {
        'base': base_result,
        'scenario': scenario_result,
        'parameter_changes': changes,
        'profit_impact': {
            'base_profit': round(base_profit, 2),
            'scenario_profit': round(scen_profit, 2),
            'change_inr': round(scen_profit - base_profit, 2),
            'change_pct': round((scen_profit - base_profit) / abs(base_profit) * 100, 1)
                          if abs(base_profit) > 1 else 0,
        },
        'label': 'WHAT-IF ANALYSIS — model estimates, not guaranteed outcomes',
    }
