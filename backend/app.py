"""
KrishiOpt AI — Flask API Server
Serves all backend endpoints for the React frontend.
"""

import os
import traceback
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

# Load environment variables from .env if present
load_dotenv()

app = Flask(__name__, static_folder='../frontend/dist', static_url_path='')
CORS(app, resources={r"/api/*": {"origins": "*"}})


# ---------------------------------------------------------------------------
# Lazy-import services (avoids circular imports and speeds up startup)
# ---------------------------------------------------------------------------

def _ai():
    from .ai_service import query_gemini_api
    return {
        'query_gemini_api': query_gemini_api,
    }


def _data():
    from .data_service import (
        get_dataset_info, dashboard_metrics, get_form_options,
        seasonal_summary, seasonal_anova, yield_profit_by_season,
        revenue_cost_by_season, disease_rainfall_by_season,
        water_efficiency_by_irrigation, crop_season_profitability,
        crop_analytics, state_analytics, risk_analytics,
    )
    return {
        'get_dataset_info': get_dataset_info,
        'dashboard_metrics': dashboard_metrics,
        'get_form_options': get_form_options,
        'seasonal_summary': seasonal_summary,
        'seasonal_anova': seasonal_anova,
        'yield_profit_by_season': yield_profit_by_season,
        'revenue_cost_by_season': revenue_cost_by_season,
        'disease_rainfall_by_season': disease_rainfall_by_season,
        'water_efficiency_by_irrigation': water_efficiency_by_irrigation,
        'crop_season_profitability': crop_season_profitability,
        'crop_analytics': crop_analytics,
        'state_analytics': state_analytics,
        'risk_analytics': risk_analytics,
    }


def _ml():
    from .ml_service import (
        predict_yield, predict_profit, recommend_crops, predict_risk,
        get_yield_model_info, get_profit_model_info, get_crop_model_info,
    )
    return {
        'predict_yield': predict_yield,
        'predict_profit': predict_profit,
        'recommend_crops': recommend_crops,
        'predict_risk': predict_risk,
        'get_yield_model_info': get_yield_model_info,
        'get_profit_model_info': get_profit_model_info,
        'get_crop_model_info': get_crop_model_info,
    }


def _opt():
    from .optimization_service import optimize_resources, what_if_scenario
    return {
        'optimize_resources': optimize_resources,
        'what_if_scenario': what_if_scenario,
    }


# ---------------------------------------------------------------------------
# Error handler
# ---------------------------------------------------------------------------

@app.errorhandler(Exception)
def handle_error(e):
    tb = traceback.format_exc()
    app.logger.error(f"Error: {e}\n{tb}")
    return jsonify({'error': str(e)}), 500


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.route('/api/health')
def health():
    return jsonify({'status': 'ok', 'service': 'KrishiOpt AI'})


# ---------------------------------------------------------------------------
# Configuration & Environment Status
# ---------------------------------------------------------------------------

@app.route('/api/config')
def api_config():
    """Expose non-secret public keys and integration status."""
    maps_key = os.environ.get('GOOGLE_MAPS_API_KEY', '').strip()
    gemini_key = os.environ.get('GEMINI_API_KEY', '').strip()
    return jsonify({
        'google_maps_api_key': maps_key,
        'has_google_maps_key': bool(maps_key),
        'has_gemini_key': bool(gemini_key),
    })


# ---------------------------------------------------------------------------
# AI Assistant (Google Gemini integration)
# ---------------------------------------------------------------------------

@app.route('/api/assistant/chat', methods=['POST'])
def api_assistant_chat():
    """Chat with Krishi Assistant powered by Gemini with grounded dataset fallback."""
    payload = request.get_json() or {}
    message = payload.get('message', '').strip()
    history = payload.get('history', [])
    context = payload.get('context', {})

    if not message:
        return jsonify({'error': 'Message cannot be empty'}), 400

    result = _ai()['query_gemini_api'](message=message, history=history, context=context)
    return jsonify(result)



# ---------------------------------------------------------------------------
# Dataset & Dashboard
# ---------------------------------------------------------------------------

@app.route('/api/dataset/info')
def dataset_info():
    return jsonify(_data()['get_dataset_info']())


@app.route('/api/dashboard')
def dashboard():
    return jsonify(_data()['dashboard_metrics']())


@app.route('/api/form-options')
def form_options():
    return jsonify(_data()['get_form_options']())


# ---------------------------------------------------------------------------
# Analytics endpoints (mirrors notebook sections)
# ---------------------------------------------------------------------------

@app.route('/api/analytics/seasonal-summary')
def analytics_seasonal_summary():
    return jsonify(_data()['seasonal_summary']())


@app.route('/api/analytics/anova')
def analytics_anova():
    return jsonify(_data()['seasonal_anova']())


@app.route('/api/analytics/yield-profit')
def analytics_yield_profit():
    return jsonify(_data()['yield_profit_by_season']())


@app.route('/api/analytics/revenue-cost')
def analytics_revenue_cost():
    return jsonify(_data()['revenue_cost_by_season']())


@app.route('/api/analytics/disease-rainfall')
def analytics_disease_rainfall():
    return jsonify(_data()['disease_rainfall_by_season']())


@app.route('/api/analytics/water-efficiency')
def analytics_water_efficiency():
    return jsonify(_data()['water_efficiency_by_irrigation']())


@app.route('/api/analytics/crop-profitability')
def analytics_crop_profitability():
    return jsonify(_data()['crop_season_profitability']())


@app.route('/api/analytics/crops')
def analytics_crops():
    return jsonify(_data()['crop_analytics']())


@app.route('/api/analytics/states')
def analytics_states():
    return jsonify(_data()['state_analytics']())


@app.route('/api/analytics/risk')
def analytics_risk():
    return jsonify(_data()['risk_analytics']())


# ---------------------------------------------------------------------------
# ML endpoints
# ---------------------------------------------------------------------------

@app.route('/api/ml/yield-model-info')
def yield_model_info():
    return jsonify(_ml()['get_yield_model_info']())


@app.route('/api/ml/profit-model-info')
def profit_model_info():
    return jsonify(_ml()['get_profit_model_info']())


@app.route('/api/ml/crop-model-info')
def crop_model_info():
    return jsonify(_ml()['get_crop_model_info']())


@app.route('/api/ml/predict-yield', methods=['POST'])
def api_predict_yield():
    inputs = request.get_json()
    if not inputs:
        return jsonify({'error': 'No input data provided'}), 400
    return jsonify(_ml()['predict_yield'](inputs))


@app.route('/api/ml/predict-profit', methods=['POST'])
def api_predict_profit():
    inputs = request.get_json()
    if not inputs:
        return jsonify({'error': 'No input data provided'}), 400
    return jsonify(_ml()['predict_profit'](inputs))


@app.route('/api/ml/recommend-crops', methods=['POST'])
def api_recommend_crops():
    inputs = request.get_json()
    if not inputs:
        return jsonify({'error': 'No input data provided'}), 400
    return jsonify(_ml()['recommend_crops'](inputs))


@app.route('/api/ml/predict-risk', methods=['POST'])
def api_predict_risk():
    inputs = request.get_json()
    if not inputs:
        return jsonify({'error': 'No input data provided'}), 400
    return jsonify(_ml()['predict_risk'](inputs))


# ---------------------------------------------------------------------------
# Optimization endpoints
# ---------------------------------------------------------------------------

@app.route('/api/optimize', methods=['POST'])
def api_optimize():
    params = request.get_json()
    if not params:
        return jsonify({'error': 'No parameters provided'}), 400
    return jsonify(_opt()['optimize_resources'](params))


@app.route('/api/what-if', methods=['POST'])
def api_what_if():
    data = request.get_json()
    if not data or 'base' not in data or 'scenario' not in data:
        return jsonify({'error': 'Both base and scenario parameters required'}), 400
    return jsonify(_opt()['what_if_scenario'](data['base'], data['scenario']))


# ---------------------------------------------------------------------------
# Farm Intelligence (combined pipeline)
# ---------------------------------------------------------------------------

@app.route('/api/farm-intelligence', methods=['POST'])
def api_farm_intelligence():
    """
    Combined endpoint: takes farm conditions and returns:
    - crop recommendations
    - yield prediction (for top recommended crop)
    - profit prediction
    - risk assessment
    - resource optimization suggestion
    """
    inputs = request.get_json()
    if not inputs:
        return jsonify({'error': 'No input data provided'}), 400

    ml = _ml()
    opt_svc = _opt()

    # 1. Crop recommendations
    recommendations = ml['recommend_crops'](inputs)

    # 2. Yield prediction for top crop
    top_crop = recommendations[0]['crop'] if recommendations else inputs.get('Crop', 'Rice')
    yield_inputs = {**inputs, 'Crop': top_crop}
    yield_pred = ml['predict_yield'](yield_inputs)

    # 3. Profit prediction (add yield to inputs)
    profit_inputs = {**yield_inputs,
                     'Yield_Tonnes_Ha': yield_pred['predicted_yield_tonnes_ha'],
                     'Production_Tonnes': yield_pred['predicted_yield_tonnes_ha'] * float(inputs.get('Farm_Area_Hectares', 5))}
    profit_pred = ml['predict_profit'](profit_inputs)

    # 4. Risk assessment
    risk_pred = ml['predict_risk'](inputs)

    # 5. Quick optimization
    opt_result = opt_svc['optimize_resources']({
        'season': inputs.get('Season', 'Kharif'),
        'state': inputs.get('State', None),
        'total_land': float(inputs.get('Farm_Area_Hectares', 5)),
        'total_water': float(inputs.get('Water_Used_m3', 50000)),
        'total_fertilizer': float(inputs.get('Fertilizer_kg_ha', 200)) * float(inputs.get('Farm_Area_Hectares', 5)),
        'total_budget': float(inputs.get('Total_Cost_INR', 500000)),
    })

    return jsonify({
        'recommendations': recommendations,
        'yield_prediction': yield_pred,
        'profit_prediction': profit_pred,
        'risk_assessment': risk_pred,
        'optimization': opt_result,
        'farm_inputs': {k: v for k, v in inputs.items()
                        if not any(s in k.lower() for s in ['key', 'secret', 'password', 'token'])},
    })


# ---------------------------------------------------------------------------
# Serve React frontend (production)
# ---------------------------------------------------------------------------

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    if path and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', 'true').lower() == 'true'
    app.run(host='0.0.0.0', port=port, debug=debug)
