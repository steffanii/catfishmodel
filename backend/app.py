# ════════════════════════════════════════════════════════════════════
# CatfishIQ — Flask Backend
# Serves predictions + Layer A, B, C results to the React frontend
#
# HOW TO RUN:
#   cd backend/
#   pip install -r requirements.txt
#   python app.py
#   → Runs on http://localhost:5000
# ════════════════════════════════════════════════════════════════════

from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import numpy as np
import json
import os

app = Flask(__name__)
CORS(app)   # allows React (port 3000) to call this API (port 5000)

# ── Load saved model artifacts ────────────────────────────────────
print('Loading model artifacts...')

model   = joblib.load('wqi_model.pkl')
scaler  = joblib.load('wqi_scaler.pkl')

# Training baseline — mean of scaled training features
# Used as SHAP reference point (= "average pond conditions")
if os.path.exists('wqi_train_baseline.npy'):
    train_baseline = np.load('wqi_train_baseline.npy')
    print('✅ Training baseline loaded')
else:
    train_baseline = np.zeros(6)
    print('⚠  wqi_train_baseline.npy not found — SHAP will use zero baseline')

# Layer C stats — pre-computed from notebook
if os.path.exists('layer_c_stats.json'):
    with open('layer_c_stats.json') as f:
        layer_c_stats = json.load(f)
    print('✅ Layer C stats loaded')
else:
    layer_c_stats = {
        'r_sgr': None, 'p_sgr': None,
        'r_k':   None, 'p_k':   None,
        'model_r2': None, 'best_model': 'Unknown'
    }
    print('⚠  layer_c_stats.json not found — run STEP1 notebook cell first')

MODEL_NAME = type(model).__name__
print(f'✅ Model loaded: {MODEL_NAME}')

FEATURE_COLS = [
    'Temperature (C)', 'Turbidity(NTU)', 'DO(mg/L)',
    'PH', 'Ammonia(mg/L)', 'Nitrate(mg/L)'
]


# ══════════════════════════════════════════════════════════════════
# LAYER A — SHAP-style parameter diagnosis
# ══════════════════════════════════════════════════════════════════

def compute_shap(x_scaled):
    """
    Exact SHAP for Linear Regression:
        SHAP_i = coefficient_i × (x_i_scaled − baseline_i)
    Permutation-based for tree/ANN models.
    """
    if MODEL_NAME == 'LinearRegression':
        return model.coef_ * (x_scaled - train_baseline)
    else:
        # For ANN, XGBoost, RF, Decision Tree, SVR
        base_pred = model.predict(x_scaled.reshape(1, -1))[0]
        shap_vals = np.zeros(len(FEATURE_COLS))
        for i in range(len(FEATURE_COLS)):
            x_perturbed    = x_scaled.copy()
            x_perturbed[i] = train_baseline[i]
            perturbed_pred = model.predict(x_perturbed.reshape(1, -1))[0]
            shap_vals[i]   = base_pred - perturbed_pred
        return shap_vals


# ══════════════════════════════════════════════════════════════════
# LAYER B — Improvement engine
# ══════════════════════════════════════════════════════════════════

OPTIMAL_RANGES = {
    'Temperature (C)': {'min': 24.0, 'max': 30.0, 'ideal': 27.0, 'unit': '°C'},
    'DO(mg/L)':        {'min':  5.0, 'max':  8.0, 'ideal':  6.5, 'unit': 'mg/L'},
    'PH':              {'min':  6.5, 'max':  8.5, 'ideal':  7.2, 'unit': ''},
    'Ammonia(mg/L)':   {'min':  0.0, 'max': 0.05, 'ideal': 0.02, 'unit': 'mg/L'},
    'Nitrate(mg/L)':   {'min':  0.0, 'max': 10.0, 'ideal':  5.0, 'unit': 'mg/L'},
    'Turbidity(NTU)':  {'min':  0.0, 'max': 50.0, 'ideal': 25.0, 'unit': 'NTU'},
}


def assess_parameters(sensor_dict):
    """Check each sensor reading against optimal range."""
    report = []
    for param, limits in OPTIMAL_RANGES.items():
        if param not in sensor_dict:
            continue
        value  = sensor_dict[param]
        p_min  = limits['min']
        p_max  = limits['max']

        if p_min <= value <= p_max:
            status, gap, severity = 'Within Range', 0.0, 'None'
        elif value < p_min:
            gap      = p_min - value
            pct      = gap / (p_max - p_min)
            status   = 'Below Optimal'
            severity = 'Mild' if pct < 0.2 else 'Moderate' if pct < 0.5 else 'Severe'
        else:
            gap      = value - p_max
            pct      = gap / (p_max - p_min)
            status   = 'Above Optimal'
            severity = 'Mild' if pct < 0.2 else 'Moderate' if pct < 0.5 else 'Severe'

        report.append({
            'parameter': param,
            'value':     round(value, 4),
            'unit':      limits['unit'],
            'min':       p_min,
            'max':       p_max,
            'ideal':     limits['ideal'],
            'status':    status,
            'gap':       round(gap, 4),
            'severity':  severity,
        })

    sev_order = {'Severe': 0, 'Moderate': 1, 'Mild': 2, 'None': 3}
    report.sort(key=lambda x: sev_order[x['severity']])
    return report


def generate_improvements(param_report):
    """Map parameter deficits to real physical farmer actions."""
    improvements = []
    deficits = [p for p in param_report if p['status'] != 'Within Range']

    if not deficits:
        return [{
            'priority':    'NONE',
            'parameter':   'All Parameters',
            'observation': 'All parameters are within optimal range',
            'action':      'Maintain current management practices',
            'detail':      'Conduct routine 10–15% water exchange weekly as preventive maintenance.'
        }]

    for p in deficits:
        param    = p['parameter']
        status   = p['status']
        severity = p['severity']
        current  = p['value']
        priority = ('URGENT'  if severity == 'Severe'   else
                    'HIGH'    if severity == 'Moderate' else 'ROUTINE')

        # ── Dissolved Oxygen ──────────────────────────────────────
        if param == 'DO(mg/L)' and status == 'Below Optimal':
            improvements.append({
                'priority':    priority,
                'parameter':   'Dissolved Oxygen',
                'observation': f'DO is {current:.2f} mg/L — below minimum of 5.0 mg/L',
                'action':      'Increase aeration in the pond immediately',
                'detail':      ('Run aerators continuously until DO recovers above 5 mg/L. '
                                'If unavailable, perform 30% water exchange with oxygenated source water. '
                                'Stop feeding temporarily to reduce oxygen demand.')
            })

        # ── Ammonia ───────────────────────────────────────────────
        elif param == 'Ammonia(mg/L)' and status == 'Above Optimal':
            exchange = (30 if severity == 'Mild' else
                        50 if severity == 'Moderate' else 70)
            improvements.append({
                'priority':    priority,
                'parameter':   'Ammonia',
                'observation': f'Ammonia is {current:.4f} mg/L — above safe limit of 0.05 mg/L',
                'action':      f'Perform a {exchange}% water exchange',
                'detail':      ('Replace with clean, fresh water. '
                                'Stop feeding 24 hours before and after exchange. '
                                'Uneaten feed is the primary driver of ammonia build-up.')
            })

        # ── pH ────────────────────────────────────────────────────
        elif param == 'PH':
            if status == 'Below Optimal':
                improvements.append({
                    'priority':    priority,
                    'parameter':   'pH',
                    'observation': f'pH is {current:.2f} — water is too acidic (optimum 6.5–8.5)',
                    'action':      'Apply agricultural lime to the pond',
                    'detail':      ('Dissolve 10–20 kg/hectare in water before applying. '
                                    'Retest pH after 24 hours. '
                                    'Do not apply dry powder directly into the pond.')
                })
            else:
                improvements.append({
                    'priority':    priority,
                    'parameter':   'pH',
                    'observation': f'pH is {current:.2f} — water is too alkaline',
                    'action':      'Perform 30% water exchange with neutral-pH source water',
                    'detail':      ('High pH dramatically increases ammonia toxicity. '
                                    'Check and address ammonia levels simultaneously. '
                                    'Algae photosynthesis is the most common cause of high pH.')
                })

        # ── Temperature ───────────────────────────────────────────
        elif param == 'Temperature (C)':
            if status == 'Above Optimal':
                improvements.append({
                    'priority':    priority,
                    'parameter':   'Temperature',
                    'observation': f'Temperature is {current:.1f}°C — above optimal range (24–30°C)',
                    'action':      'Partial water exchange with cooler source water (20–30%)',
                    'detail':      ('Conduct exchange during early morning when ambient temperature is lowest. '
                                    'Provide shade cover over the pond if high temperature persists.')
                })
            else:
                improvements.append({
                    'priority':    priority,
                    'parameter':   'Temperature',
                    'observation': f'Temperature is {current:.1f}°C — below optimal range (24–30°C)',
                    'action':      'Reduce water exchange — allow sunlight to warm pond naturally',
                    'detail':      ('Avoid water exchanges during cold periods. '
                                    'Consider polytunnel or greenhouse cover in persistently cold conditions.')
                })

        # ── Nitrate ───────────────────────────────────────────────
        elif param == 'Nitrate(mg/L)' and status == 'Above Optimal':
            improvements.append({
                'priority':    priority,
                'parameter':   'Nitrate',
                'observation': f'Nitrate is {current:.2f} mg/L — above optimal range (0–10 mg/L)',
                'action':      'Perform a 20–30% water exchange',
                'detail':      ('Nitrate accumulates gradually from the nitrogen cycle. '
                                'Regular weekly exchanges of 10–15% prevent build-up. '
                                'Reduce feeding rate to slow nitrogen input.')
            })

        # ── Turbidity ─────────────────────────────────────────────
        elif param == 'Turbidity(NTU)' and status == 'Above Optimal':
            improvements.append({
                'priority':    priority,
                'parameter':   'Turbidity',
                'observation': f'Turbidity is {current:.1f} NTU — pond is too cloudy (optimum 0–50 NTU)',
                'action':      'Perform a 20% water exchange',
                'detail':      ('Avoid disturbing pond bottom sediment during feeding. '
                                'If turbidity is from algae bloom, address pH and nutrient levels.')
            })

    return improvements


# ══════════════════════════════════════════════════════════════════
# API ENDPOINTS
# ══════════════════════════════════════════════════════════════════

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status':     'ok',
        'model':      MODEL_NAME,
        'layer_c_ok': os.path.exists('layer_c_stats.json')
    })


@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json()

        # Map frontend field names to model feature names
        sensor_dict = {
            'Temperature (C)': float(data['temperature']),
            'Turbidity(NTU)':  float(data['turbidity']),
            'DO(mg/L)':        float(data['do']),
            'PH':              float(data['ph']),
            'Ammonia(mg/L)':   float(data['ammonia']),
            'Nitrate(mg/L)':   float(data['nitrate']),
        }

        # ── Prediction ────────────────────────────────────────────
        x_raw    = np.array([sensor_dict[f] for f in FEATURE_COLS])
        x_scaled = scaler.transform(x_raw.reshape(1, -1))[0]
        wqi      = float(model.predict(x_scaled.reshape(1, -1))[0])
        wqi      = round(wqi, 2)

        if   wqi >= 80: wqi_class, wqi_status = 'Optimal',  'Suitable for catfish growth'
        elif wqi >= 60: wqi_class, wqi_status = 'Good',     'Acceptable but can be improved'
        elif wqi >= 40: wqi_class, wqi_status = 'Fair',     'Suboptimal for catfish growth'
        elif wqi >= 20: wqi_class, wqi_status = 'Poor',     'Harmful to catfish'
        else:           wqi_class, wqi_status = 'Critical', 'Immediate risk of mortality'

        # ── Layer A ───────────────────────────────────────────────
        shap_vals = compute_shap(x_scaled)
        layer_a   = []
        for fname, raw_val, sv in zip(FEATURE_COLS, x_raw, shap_vals):
            layer_a.append({
                'parameter': fname,
                'value':     round(float(raw_val), 4),
                'shap':      round(float(sv), 4),
                'direction': 'Positive' if sv >= 0 else 'Negative',
                'magnitude': round(abs(float(sv)), 4),
                'label':     (f'Pushing WQI UP by {abs(sv):.3f} pts'
                              if sv >= 0 else
                              f'Pulling WQI DOWN by {abs(sv):.3f} pts'),
            })
        layer_a.sort(key=lambda x: x['magnitude'], reverse=True)

        # ── Layer B ───────────────────────────────────────────────
        param_report = assess_parameters(sensor_dict)
        improvements = generate_improvements(param_report)

        return jsonify({
            'success':    True,
            'wqi_score':  wqi,
            'wqi_class':  wqi_class,
            'wqi_status': wqi_status,
            'layer_a':    layer_a,
            'layer_b': {
                'param_report': param_report,
                'improvements': improvements,
            },
            'layer_c': layer_c_stats,
        })

    except KeyError as e:
        return jsonify({'success': False, 'error': f'Missing field: {e}'}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


if __name__ == '__main__':
    print()
    print('═' * 50)
    print('  CatfishIQ Backend')
    print(f'  Model: {MODEL_NAME}')
    print('  Running on http://localhost:5000')
    print('═' * 50)
    app.run(debug=True, port=5000)
