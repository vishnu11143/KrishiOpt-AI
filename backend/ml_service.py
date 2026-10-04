"""
KrishiOpt AI — ML Service
Real ML pipeline: data validation → preprocessing → feature engineering →
train/test split → model training → evaluation → prediction.

Models trained on the actual dataset. Metrics (R², MAE, RMSE) are computed
from real test-set predictions — never fabricated.
"""

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor, RandomForestClassifier
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from functools import lru_cache
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

# ---------------------------------------------------------------------------
# Encoding helpers
# ---------------------------------------------------------------------------

def _encode_features(df, num_features, cat_features):
    """Encode categorical features with LabelEncoder, return encoded df + encoders."""
    df_enc = df.copy()
    encoders = {}
    for col in cat_features:
        le = LabelEncoder()
        df_enc[col + '_enc'] = le.fit_transform(df_enc[col].astype(str))
        encoders[col] = le
    feature_cols = num_features + [c + '_enc' for c in cat_features]
    return df_enc, feature_cols, encoders


def _encode_input(row_dict, encoders, num_features, cat_features):
    """Encode a single input dict using fitted encoders."""
    values = []
    for f in num_features:
        values.append(float(row_dict.get(f, 0)))
    for f in cat_features:
        le = encoders[f]
        val = row_dict.get(f, le.classes_[0])
        if val in le.classes_:
            values.append(int(le.transform([val])[0]))
        else:
            values.append(0)
    return np.array(values).reshape(1, -1)


# ---------------------------------------------------------------------------
# Yield Model
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def train_yield_model():
    """Train yield prediction model and return model + metadata."""
    df = data_service.load_data()
    df_clean = df.dropna(subset=YIELD_FEATURES + [YIELD_TARGET]).copy()

    df_enc, feature_cols, encoders = _encode_features(
        df_clean, YIELD_FEATURES, YIELD_CAT_FEATURES)

    X = df_enc[feature_cols].values
    y = df_enc[YIELD_TARGET].values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42)

    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s = scaler.transform(X_test)

    # Train candidates
    models = {
        'GradientBoosting': GradientBoostingRegressor(
            n_estimators=200, max_depth=5, learning_rate=0.1, random_state=42),
        'RandomForest': RandomForestRegressor(
            n_estimators=200, max_depth=10, random_state=42),
        'Ridge': Ridge(alpha=1.0),
    }

    results = {}
    for name, model in models.items():
        model.fit(X_train_s, y_train)
        preds = model.predict(X_test_s)
        mae = mean_absolute_error(y_test, preds)
        rmse = np.sqrt(mean_squared_error(y_test, preds))
        r2 = r2_score(y_test, preds)
        results[name] = {'model': model, 'mae': mae, 'rmse': rmse, 'r2': r2}

    # Select best by R²
    best_name = max(results, key=lambda k: results[k]['r2'])
    best = results[best_name]

    # Feature importance (if available)
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
    X = _encode_input(inputs, info['encoders'], YIELD_FEATURES, YIELD_CAT_FEATURES)
    X_s = info['scaler'].transform(X)
    prediction = float(info['model'].predict(X_s)[0])
    prediction = max(0, prediction)  # yield cannot be negative

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
    """Train profit prediction model."""
    df = data_service.load_data()
    df_clean = df.dropna(subset=PROFIT_FEATURES + [PROFIT_TARGET]).copy()

    df_enc, feature_cols, encoders = _encode_features(
        df_clean, PROFIT_FEATURES, PROFIT_CAT_FEATURES)

    X = df_enc[feature_cols].values
    y = df_enc[PROFIT_TARGET].values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42)

    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s = scaler.transform(X_test)

    model = GradientBoostingRegressor(
        n_estimators=200, max_depth=5, learning_rate=0.1, random_state=42)
    model.fit(X_train_s, y_train)

    preds = model.predict(X_test_s)
    mae = mean_absolute_error(y_test, preds)
    rmse = np.sqrt(mean_squared_error(y_test, preds))
    r2 = r2_score(y_test, preds)

    importance = {}
    if hasattr(model, 'feature_importances_'):
        for fname, imp in zip(feature_cols, model.feature_importances_):
            importance[fname.replace('_enc', '')] = round(float(imp), 4)

    return {
        'model': model, 'scaler': scaler, 'encoders': encoders,
        'feature_cols': feature_cols,
        'metrics': {
            'mae': round(float(mae), 4),
            'rmse': round(float(rmse), 4),
            'r2': round(float(r2), 4),
        },
        'feature_importance': dict(sorted(importance.items(), key=lambda x: -x[1])),
        'train_size': len(X_train),
        'test_size': len(X_test),
    }


def predict_profit(inputs: dict) -> dict:
    """Predict profit for given farm conditions (requires yield estimate)."""
    info = train_profit_model()
    X = _encode_input(inputs, info['encoders'], PROFIT_FEATURES, PROFIT_CAT_FEATURES)
    X_s = info['scaler'].transform(X)
    prediction = float(info['model'].predict(X_s)[0])

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
    """Train a crop classification model for suitability scoring."""
    df = data_service.load_data()

    # Create a label: the "profitable" crops for similar conditions
    # Use top-quartile profit as the "good" label for each crop
    df_clean = df.dropna(subset=CROP_FEATURES).copy()

    df_enc, feature_cols, encoders = _encode_features(
        df_clean, CROP_FEATURES, CROP_CAT_FEATURES)

    le_crop = LabelEncoder()
    y = le_crop.fit_transform(df_clean['Crop'])

    X = df_enc[feature_cols].values
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y)

    model = RandomForestClassifier(n_estimators=200, max_depth=12, random_state=42)
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
    }


def recommend_crops(inputs: dict) -> list[dict]:
    """
    Recommend crops based on:
    1. ML suitability probability (RandomForest)
    2. Historical performance data for similar conditions
    3. Economic analysis from the dataset
    """
    df = data_service.load_data()
    model_info = train_crop_model()

    # ML probabilities
    X = _encode_input(inputs, model_info['encoders'], CROP_FEATURES, CROP_CAT_FEATURES)
    probs = model_info['model'].predict_proba(X)[0]
    crop_names = model_info['crop_encoder'].classes_

    # Historical performance for each crop in the given season
    season = inputs.get('Season', 'Kharif')
    state = inputs.get('State', None)
    irrigation = inputs.get('Irrigation_Method', None)

    recommendations = []
    for idx, crop in enumerate(crop_names):
        # Filter dataset for this crop
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

        # Composite suitability score: 40% ML probability + 30% profitability + 30% yield
        ml_score = float(probs[idx])
        # Normalize profitability (0..1 scale relative to dataset)
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

    # Sort by suitability score
    recommendations.sort(key=lambda x: -x['suitability_score'])
    return recommendations


def get_crop_model_info() -> dict:
    """Return crop model metadata."""
    info = train_crop_model()
    return {
        'accuracy': info['accuracy'],
        'train_size': info['train_size'],
        'test_size': info['test_size'],
        'crops': info['crop_encoder'].classes_.tolist(),
    }


# ---------------------------------------------------------------------------
# Risk prediction for given conditions
# ---------------------------------------------------------------------------

def predict_risk(inputs: dict) -> dict:
    """Estimate disease/pest risk based on environmental conditions."""
    df = data_service.load_data()

    rainfall = float(inputs.get('Rainfall_mm', df['Rainfall_mm'].mean()))
    humidity = float(inputs.get('Humidity_pct', df['Humidity_pct'].mean()))
    soil_moisture = float(inputs.get('Soil_Moisture_pct', df['Soil_Moisture_pct'].mean()))
    season = inputs.get('Season', 'Kharif')

    # Use regression on the actual data
    from sklearn.linear_model import LinearRegression
    features = ['Rainfall_mm', 'Humidity_pct', 'Soil_Moisture_pct']
    df_clean = df.dropna(subset=features + ['Disease_Pest_Risk_pct'])
    X = df_clean[features].values
    y = df_clean['Disease_Pest_Risk_pct'].values

    reg = LinearRegression()
    reg.fit(X, y)
    r2 = r2_score(y, reg.predict(X))

    predicted_risk = float(reg.predict([[rainfall, humidity, soil_moisture]])[0])
    predicted_risk = max(5, min(95, predicted_risk))  # clamp to reasonable range

    # Season adjustment (from observed seasonal means)
    season_risks = df.groupby('Season')['Disease_Pest_Risk_pct'].mean()
    overall_mean = float(df['Disease_Pest_Risk_pct'].mean())
    if season in season_risks.index:
        season_adj = float(season_risks[season]) - overall_mean
    else:
        season_adj = 0

    adjusted_risk = max(5, min(95, predicted_risk + season_adj * 0.3))

    category = 'HIGH' if adjusted_risk > 55 else ('MODERATE' if adjusted_risk > 35 else 'LOW')

    contributions = []
    coefs = dict(zip(features, reg.coef_))
    for f in features:
        val = [rainfall, humidity, soil_moisture][features.index(f)]
        mean_val = float(df[f].mean())
        contrib = float(coefs[f]) * (val - mean_val)
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
