"""
KrishiOpt AI — ML Service
Real ML pipeline: data validation -> preprocessing -> feature engineering ->
train/test split -> model training -> evaluation -> prediction.

Models are trained on the actual dataset. Predictions and metrics (R², MAE, RMSE)
are computed from real test-set predictions — never fabricated.
Trained model parameters and tree structures are cached in backend/model_cache.json
so inference and evaluation run at sub-millisecond latency on serverless runtimes
without requiring heavy C/Fortran libraries (scikit-learn / scipy).
"""

import json
import os
from functools import lru_cache
import numpy as np
import pandas as pd
from . import data_service

# ---------------------------------------------------------------------------
# Feature definitions (no target leakage)
# ---------------------------------------------------------------------------

# For yield prediction: features that a farmer would KNOW before harvest
YIELD_FEATURES = [
    'Farm_Area_Hectares', 'Rainfall_mm', 'Avg_Temperature_C', 'Humidity_pct',
    'Sunlight_Hours_Day', 'Soil_pH', 'Soil_Moisture_pct', 'Nitrogen_kg_ha',
    'Phosphorus_kg_ha', 'Potassium_kg_ha', 'Fertilizer_kg_ha',
    'Pesticide_Litre_ha', 'Seed_Quality_Score',
]
YIELD_CAT_FEATURES = ['State', 'Crop', 'Season', 'Irrigation_Method']
YIELD_TARGET = 'Yield_Tonnes_Ha'

# For profit prediction: includes yield as it's a known outcome pre-market
PROFIT_FEATURES = YIELD_FEATURES + ['Yield_Tonnes_Ha', 'Production_Tonnes']
PROFIT_CAT_FEATURES = YIELD_CAT_FEATURES
PROFIT_TARGET = 'Profit_INR'

# For crop suitability (classification): predict best crop given conditions
CROP_FEATURES = [
    'Farm_Area_Hectares', 'Rainfall_mm', 'Avg_Temperature_C', 'Humidity_pct',
    'Sunlight_Hours_Day', 'Soil_pH', 'Soil_Moisture_pct', 'Nitrogen_kg_ha',
    'Phosphorus_kg_ha', 'Potassium_kg_ha',
]
CROP_CAT_FEATURES = ['State', 'Season', 'Irrigation_Method']

MODEL_CACHE_PATH = os.path.join(os.path.dirname(__file__), 'model_cache.json')


@lru_cache(maxsize=1)
def load_model_cache():
    """Load serialized model cache (weights, trees, encoders, metrics)."""
    if os.path.exists(MODEL_CACHE_PATH):
        with open(MODEL_CACHE_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    return None


# ---------------------------------------------------------------------------
# Pure NumPy tree inference (fast, zero scikit-learn dependency at runtime)
# ---------------------------------------------------------------------------

def _predict_single_tree(tree: dict, x: np.ndarray) -> float:
    """Traverse a single regression decision tree."""
    left = tree['children_left']
    right = tree['children_right']
    feat = tree['feature']
    thresh = tree['threshold']
    val = tree['value']
    node = 0
    while left[node] != -1:
        if x[feat[node]] <= thresh[node]:
            node = left[node]
        else:
            node = right[node]
    return float(val[node])


def _predict_gbr(x: np.ndarray, trees_data: dict) -> float:
    """Predict via GradientBoostingRegressor tree ensemble."""
    pred = float(trees_data['init_value'])
    lr = float(trees_data['learning_rate'])
    for tree in trees_data['trees']:
        pred += lr * _predict_single_tree(tree, x)
    return pred


def _predict_rf_classifier(x: np.ndarray, trees: list, n_classes: int) -> np.ndarray:
    """Predict class probabilities via RandomForestClassifier tree ensemble."""
    total_probs = np.zeros(n_classes, dtype=float)
    for tree in trees:
        left = tree['children_left']
        right = tree['children_right']
        feat = tree['feature']
        thresh = tree['threshold']
        vals = tree['values']
        node = 0
        while left[node] != -1:
            if x[feat[node]] <= thresh[node]:
                node = left[node]
            else:
                node = right[node]
        total_probs += np.array(vals[node], dtype=float)
    return total_probs / len(trees)


# ---------------------------------------------------------------------------
# Encoding helpers
# ---------------------------------------------------------------------------

def _encode_input_with_dict(row_dict: dict, encoders: dict, num_features: list, cat_features: list) -> np.ndarray:
    """Encode input vector using dict-based categorical encoding."""
    values = []
    for f in num_features:
        values.append(float(row_dict.get(f, 0.0) or 0.0))
    for f in cat_features:
        enc_map = encoders.get(f, {})
        val = row_dict.get(f, '')
        if isinstance(enc_map, dict):
            values.append(float(enc_map.get(val, 0)))
        elif isinstance(enc_map, list):
            values.append(float(enc_map.index(val) if val in enc_map else 0))
        else:
            values.append(0.0)
    return np.array(values, dtype=float)


# ---------------------------------------------------------------------------
# Yield Model
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def train_yield_model():
    """Return yield prediction model metadata and predictor."""
    cache = load_model_cache()
    if cache and 'yield' in cache:
        y_cache = cache['yield']
        mean = np.array(y_cache['scaler_mean'], dtype=float)
        scale = np.array(y_cache['scaler_scale'], dtype=float)

        class CachedYieldModel:
            def predict(self, X_scaled):
                if X_scaled.ndim == 1:
                    return np.array([_predict_gbr(X_scaled, y_cache['trees'])])
                return np.array([_predict_gbr(row, y_cache['trees']) for row in X_scaled])

        class CachedScaler:
            def transform(self, X):
                return (X - mean) / scale

        return {
            'model': CachedYieldModel(),
            'scaler': CachedScaler(),
            'encoders': y_cache['encoders'],
            'feature_cols': y_cache['feature_cols'],
            'best_model_name': y_cache['best_model'],
            'metrics': y_cache['metrics'],
            'all_model_metrics': y_cache['all_models'],
            'feature_importance': y_cache['feature_importance'],
            'train_size': y_cache['train_size'],
            'test_size': y_cache['test_size'],
        }

    # Fallback to dynamic training if sklearn is available
    from sklearn.model_selection import train_test_split
    from sklearn.preprocessing import LabelEncoder, StandardScaler
    from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
    from sklearn.linear_model import Ridge
    from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

    df = data_service.load_data()
    df_clean = df.dropna(subset=YIELD_FEATURES + [YIELD_TARGET]).copy()

    df_enc = df_clean.copy()
    encoders = {}
    for col in YIELD_CAT_FEATURES:
        le = LabelEncoder()
        df_enc[col + '_enc'] = le.fit_transform(df_enc[col].astype(str))
        encoders[col] = {cls: idx for idx, cls in enumerate(le.classes_)}
    feature_cols = YIELD_FEATURES + [c + '_enc' for c in YIELD_CAT_FEATURES]

    X = df_enc[feature_cols].values
    y = df_enc[YIELD_TARGET].values
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s = scaler.transform(X_test)

    models = {
        'GradientBoosting': GradientBoostingRegressor(n_estimators=200, max_depth=5, learning_rate=0.1, random_state=42),
        'RandomForest': RandomForestRegressor(n_estimators=200, max_depth=10, random_state=42),
        'Ridge': Ridge(alpha=1.0),
    }
    results = {}
    for name, m in models.items():
        m.fit(X_train_s, y_train)
        preds = m.predict(X_test_s)
        results[name] = {
            'model': m,
            'mae': mean_absolute_error(y_test, preds),
            'rmse': np.sqrt(mean_squared_error(y_test, preds)),
            'r2': r2_score(y_test, preds),
        }

    best_name = max(results, key=lambda k: results[k]['r2'])
    best = results[best_name]

    importance = {}
    if hasattr(best['model'], 'feature_importances_'):
        for fname, imp in zip(feature_cols, best['model'].feature_importances_):
            importance[fname.replace('_enc', '')] = round(float(imp), 4)

    return {
        'model': best['model'],
        'scaler': scaler,
        'encoders': encoders,
        'feature_cols': feature_cols,
        'best_model_name': best_name,
        'metrics': {
            'mae': round(float(best['mae']), 4),
            'rmse': round(float(best['rmse']), 4),
            'r2': round(float(best['r2']), 4),
        },
        'all_model_metrics': {
            name: {
                'mae': round(float(r['mae']), 4),
                'rmse': round(float(r['rmse']), 4),
                'r2': round(float(r['r2']), 4),
            } for name, r in results.items()
        },
        'feature_importance': dict(sorted(importance.items(), key=lambda x: -x[1])),
        'train_size': len(X_train),
        'test_size': len(X_test),
    }


def predict_yield(inputs: dict) -> dict:
    """Predict yield for given farm conditions."""
    info = train_yield_model()
    x = _encode_input_with_dict(inputs, info['encoders'], YIELD_FEATURES, YIELD_CAT_FEATURES)
    x_s = info['scaler'].transform(x.reshape(1, -1))
    prediction = float(info['model'].predict(x_s)[0])
    prediction = max(0.0, prediction)  # yield cannot be negative

    return {
        'predicted_yield_tonnes_ha': round(prediction, 2),
        'model_used': info['best_model_name'],
        'model_r2': info['metrics']['r2'],
        'model_mae': info['metrics']['mae'],
        'label': 'MODEL ESTIMATE — not guaranteed yield',
    }


def get_yield_model_info() -> dict:
    """Return yield model metadata (no model object)."""
    info = train_yield_model()
    return {
        'best_model': info['best_model_name'],
        'metrics': info['metrics'],
        'all_models': info['all_model_metrics'],
        'feature_importance': info['feature_importance'],
        'train_size': info['train_size'],
        'test_size': info['test_size'],
    }


# ---------------------------------------------------------------------------
# Profit Model
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def train_profit_model():
    """Return profit prediction model metadata and predictor."""
    cache = load_model_cache()
    if cache and 'profit' in cache:
        p_cache = cache['profit']
        mean = np.array(p_cache['scaler_mean'], dtype=float)
        scale = np.array(p_cache['scaler_scale'], dtype=float)

        class CachedProfitModel:
            def predict(self, X_scaled):
                if X_scaled.ndim == 1:
                    return np.array([_predict_gbr(X_scaled, p_cache['trees'])])
                return np.array([_predict_gbr(row, p_cache['trees']) for row in X_scaled])

        class CachedScaler:
            def transform(self, X):
                return (X - mean) / scale

        return {
            'model': CachedProfitModel(),
            'scaler': CachedScaler(),
            'encoders': p_cache['encoders'],
            'feature_cols': p_cache['feature_cols'],
            'metrics': p_cache['metrics'],
            'feature_importance': p_cache['feature_importance'],
            'train_size': p_cache['train_size'],
            'test_size': p_cache['test_size'],
        }

    # Dynamic fallback
    from sklearn.model_selection import train_test_split
    from sklearn.preprocessing import LabelEncoder, StandardScaler
    from sklearn.ensemble import GradientBoostingRegressor
    from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

    df = data_service.load_data()
    df_clean = df.dropna(subset=PROFIT_FEATURES + [PROFIT_TARGET]).copy()

    df_enc = df_clean.copy()
    encoders = {}
    for col in PROFIT_CAT_FEATURES:
        le = LabelEncoder()
        df_enc[col + '_enc'] = le.fit_transform(df_enc[col].astype(str))
        encoders[col] = {cls: idx for idx, cls in enumerate(le.classes_)}
    feature_cols = PROFIT_FEATURES + [c + '_enc' for c in PROFIT_CAT_FEATURES]

    X = df_enc[feature_cols].values
    y = df_enc[PROFIT_TARGET].values
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s = scaler.transform(X_test)

    model = GradientBoostingRegressor(n_estimators=200, max_depth=5, learning_rate=0.1, random_state=42)
    model.fit(X_train_s, y_train)
    preds = model.predict(X_test_s)

    importance = {}
    if hasattr(model, 'feature_importances_'):
        for fname, imp in zip(feature_cols, model.feature_importances_):
            importance[fname.replace('_enc', '')] = round(float(imp), 4)

    return {
        'model': model,
        'scaler': scaler,
        'encoders': encoders,
        'feature_cols': feature_cols,
        'metrics': {
            'mae': round(float(mean_absolute_error(y_test, preds)), 4),
            'rmse': round(float(np.sqrt(mean_squared_error(y_test, preds))), 4),
            'r2': round(float(r2_score(y_test, preds)), 4),
        },
        'feature_importance': dict(sorted(importance.items(), key=lambda x: -x[1])),
        'train_size': len(X_train),
        'test_size': len(X_test),
    }


def predict_profit(inputs: dict) -> dict:
    """Predict profit for given farm conditions."""
    info = train_profit_model()
    x = _encode_input_with_dict(inputs, info['encoders'], PROFIT_FEATURES, PROFIT_CAT_FEATURES)
    x_s = info['scaler'].transform(x.reshape(1, -1))
    prediction = float(info['model'].predict(x_s)[0])

    return {
        'predicted_profit_inr': round(prediction, 2),
        'model_r2': info['metrics']['r2'],
        'model_mae': info['metrics']['mae'],
        'label': 'MODEL ESTIMATE — not guaranteed profit',
    }


def get_profit_model_info() -> dict:
    """Return profit model metadata."""
    info = train_profit_model()
    return {
        'metrics': info['metrics'],
        'feature_importance': info['feature_importance'],
        'train_size': info['train_size'],
        'test_size': info['test_size'],
    }


# ---------------------------------------------------------------------------
# Crop Recommendation (classification + data-driven scoring)
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def train_crop_model():
    """Return crop classification metadata and model."""
    cache = load_model_cache()
    if cache and 'crop' in cache:
        c_cache = cache['crop']
        crop_classes = c_cache['classes']

        class CachedCropModel:
            def predict_proba(self, X):
                trees = c_cache.get('trees')
                if trees:
                    if X.ndim == 1:
                        return np.array([_predict_rf_classifier(X, trees, len(crop_classes))])
                    return np.array([_predict_rf_classifier(row, trees, len(crop_classes)) for row in X])
                # Uniform/prior fallback if trees not present
                priors = c_cache.get('priors', {}).get('Kharif', {})
                probs = [priors.get(c, 1.0 / len(crop_classes)) for c in crop_classes]
                s = sum(probs)
                norm_p = [p / s for p in probs]
                return np.array([norm_p] * len(X))

        class CachedCropEncoder:
            classes_ = np.array(crop_classes)

        return {
            'model': CachedCropModel(),
            'encoders': c_cache['encoders'],
            'feature_cols': c_cache['feature_cols'],
            'crop_encoder': CachedCropEncoder(),
            'accuracy': c_cache['accuracy'],
            'train_size': c_cache['train_size'],
            'test_size': c_cache['test_size'],
            'crops': crop_classes,
        }

    # Dynamic fallback
    from sklearn.model_selection import train_test_split
    from sklearn.preprocessing import LabelEncoder
    from sklearn.ensemble import RandomForestClassifier

    df = data_service.load_data()
    df_clean = df.dropna(subset=CROP_FEATURES).copy()

    df_enc = df_clean.copy()
    encoders = {}
    for col in CROP_CAT_FEATURES:
        le = LabelEncoder()
        df_enc[col + '_enc'] = le.fit_transform(df_enc[col].astype(str))
        encoders[col] = {cls: idx for idx, cls in enumerate(le.classes_)}
    feature_cols = CROP_FEATURES + [c + '_enc' for c in CROP_CAT_FEATURES]

    le_crop = LabelEncoder()
    y = le_crop.fit_transform(df_clean['Crop'])
    X = df_enc[feature_cols].values
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    model = RandomForestClassifier(n_estimators=15, max_depth=7, random_state=42)
    model.fit(X_train, y_train)
    accuracy = float(model.score(X_test, y_test))

    return {
        'model': model,
        'encoders': encoders,
        'feature_cols': feature_cols,
        'crop_encoder': le_crop,
        'accuracy': round(accuracy, 4),
        'train_size': len(X_train),
        'test_size': len(X_test),
        'crops': le_crop.classes_.tolist(),
    }


def recommend_crops(inputs: dict) -> list:
    """
    Recommend crops based on:
    1. ML suitability probability (RandomForest / model cache)
    2. Historical performance data for similar conditions
    3. Economic analysis from the dataset
    """
    df = data_service.load_data()
    model_info = train_crop_model()

    # ML probabilities
    x = _encode_input_with_dict(inputs, model_info['encoders'], CROP_FEATURES, CROP_CAT_FEATURES)
    probs = model_info['model'].predict_proba(x.reshape(1, -1))[0]
    crop_names = list(model_info['crop_encoder'].classes_)

    season = inputs.get('Season', 'Kharif')
    state = inputs.get('State', None)

    recommendations = []
    for idx, crop in enumerate(crop_names):
        mask = df['Crop'] == crop
        if season:
            mask_season = mask & (df['Season'] == season)
            if mask_season.sum() > 5:
                mask = mask_season
        if state:
            mask_state = mask & (df['State'] == state)
            if mask_state.sum() > 3:
                mask = mask_state

        subset = df[mask]
        if len(subset) == 0:
            continue

        avg_yield = float(subset['Yield_Tonnes_Ha'].mean())
        avg_profit = float(subset['Profit_INR'].mean())
        avg_revenue = float(subset['Revenue_INR'].mean())
        avg_cost = float(subset['Total_Cost_INR'].mean())
        avg_risk = float(subset['Disease_Pest_Risk_pct'].mean())
        avg_water_eff = float(subset['Water_Efficiency_t_per_1000m3'].mean())

        ml_score = float(probs[idx])
        profit_norm = (avg_profit - df['Profit_INR'].min()) / (df['Profit_INR'].max() - df['Profit_INR'].min() + 1)
        yield_norm = (avg_yield - df['Yield_Tonnes_Ha'].min()) / (df['Yield_Tonnes_Ha'].max() - df['Yield_Tonnes_Ha'].min() + 1)

        suitability = round((0.4 * ml_score + 0.3 * float(profit_norm) + 0.3 * float(yield_norm)) * 100, 1)

        recommendations.append({
            'crop': crop,
            'suitability_score': suitability,
            'ml_probability': round(ml_score * 100, 1),
            'historical_performance': {
                'avg_yield': round(avg_yield, 2),
                'avg_profit': round(avg_profit, 2),
                'avg_revenue': round(avg_revenue, 2),
                'avg_cost': round(avg_cost, 2),
                'records': int(len(subset)),
            },
            'risk': {
                'avg_disease_pest_risk': round(avg_risk, 1),
                'category': 'HIGH' if avg_risk > 55 else ('MODERATE' if avg_risk > 35 else 'LOW'),
            },
            'water': {
                'avg_efficiency': round(avg_water_eff, 2),
            },
        })

    recommendations.sort(key=lambda item: -item['suitability_score'])
    return recommendations


def get_crop_model_info() -> dict:
    """Return crop model metadata."""
    info = train_crop_model()
    return {
        'accuracy': info['accuracy'],
        'train_size': info['train_size'],
        'test_size': info['test_size'],
        'crops': info['crops'] if isinstance(info['crops'], list) else list(info['crops']),
    }


# ---------------------------------------------------------------------------
# Risk prediction for given conditions
# ---------------------------------------------------------------------------

def predict_risk(inputs: dict) -> dict:
    """Estimate disease/pest risk based on environmental conditions."""
    df = data_service.load_data()
    cache = load_model_cache()

    rainfall = float(inputs.get('Rainfall_mm', df['Rainfall_mm'].mean()))
    humidity = float(inputs.get('Humidity_pct', df['Humidity_pct'].mean()))
    soil_moisture = float(inputs.get('Soil_Moisture_pct', df['Soil_Moisture_pct'].mean()))
    season = inputs.get('Season', 'Kharif')

    features = ['Rainfall_mm', 'Humidity_pct', 'Soil_Moisture_pct']
    val_map = {'Rainfall_mm': rainfall, 'Humidity_pct': humidity, 'Soil_Moisture_pct': soil_moisture}

    if cache and 'risk' in cache:
        r_cache = cache['risk']
        coef = r_cache['coef']
        intercept = r_cache['intercept']
        r2 = r_cache['r2']
        means = r_cache['means']
        season_risks = r_cache['season_risks']
        overall_mean = r_cache['overall_mean']

        predicted_risk = intercept + sum(c * val_map[f] for c, f in zip(coef, features))
    else:
        df_clean = df.dropna(subset=features + ['Disease_Pest_Risk_pct'])
        X = df_clean[features].values
        y = df_clean['Disease_Pest_Risk_pct'].values

        # Pure NumPy OLS
        X_design = np.column_stack([np.ones(len(X)), X])
        w, _, _, _ = np.linalg.lstsq(X_design, y, rcond=None)
        intercept = float(w[0])
        coef = [float(c) for c in w[1:]]

        y_pred = X_design @ w
        ss_res = np.sum((y - y_pred) ** 2)
        ss_tot = np.sum((y - np.mean(y)) ** 2)
        r2 = float(1 - ss_res / ss_tot) if ss_tot > 0 else 0.0

        means = {f: float(df[f].mean()) for f in features}
        season_risks = {s: float(m) for s, m in df.groupby('Season')['Disease_Pest_Risk_pct'].mean().items()}
        overall_mean = float(df['Disease_Pest_Risk_pct'].mean())

        predicted_risk = intercept + sum(c * val_map[f] for c, f in zip(coef, features))

    predicted_risk = max(5.0, min(95.0, float(predicted_risk)))

    if season in season_risks:
        season_adj = float(season_risks[season]) - overall_mean
    else:
        season_adj = 0.0

    adjusted_risk = max(5.0, min(95.0, predicted_risk + season_adj * 0.3))
    category = 'HIGH' if adjusted_risk > 55 else ('MODERATE' if adjusted_risk > 35 else 'LOW')

    contributions = []
    for f, c in zip(features, coef):
        val = val_map[f]
        mean_val = float(means.get(f, df[f].mean()))
        contrib = float(c) * (val - mean_val)
        contributions.append({
            'factor': f.replace('_', ' ').replace(' mm', '').replace(' pct', ' %'),
            'value': round(val, 1),
            'dataset_mean': round(mean_val, 1),
            'contribution': round(contrib, 2),
            'direction': 'increases risk' if contrib > 0 else 'decreases risk',
        })

    return {
        'predicted_risk': round(adjusted_risk, 1),
        'category': category,
        'model_r2': round(float(r2), 4),
        'season_effect': round(season_adj, 2),
        'contributing_factors': contributions,
        'label': 'MODEL ESTIMATE — actual risk depends on many factors not captured here',
    }
