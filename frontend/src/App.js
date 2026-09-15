// ════════════════════════════════════════════════════════════════
// CatfishIQ — React Frontend (Dark Professional Dashboard)
// Connects to Flask backend on http://localhost:5000
// ════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from "react";
import "./App.css";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

// ── Color maps ───────────────────────────────────────────────────
const WQI_COLORS = {
  Optimal: "#1D9E75",
  Good: "#5DCAA5",
  Fair: "#EF9F27",
  Poor: "#E24B4A",
  Critical: "#A32D2D",
};

const PRIORITY_CLASS = {
  URGENT: {
    card: "rec-card-urgent",
    badge: "badge-urgent",
    param: "rec-param-urgent",
  },
  HIGH: { card: "rec-card-high", badge: "badge-high", param: "rec-param-high" },
  ROUTINE: {
    card: "rec-card-routine",
    badge: "badge-routine",
    param: "rec-param-routine",
  },
  NONE: { card: "rec-card-none", badge: "badge-none", param: "rec-param-none" },
};

// Shorten parameter names for display
function shortName(param) {
  return param
    .replace("Temperature (C)", "Temp")
    .replace("Turbidity(NTU)", "Turbidity")
    .replace("DO(mg/L)", "DO")
    .replace("PH", "pH")
    .replace("Ammonia(mg/L)", "Ammonia")
    .replace("Nitrate(mg/L)", "Nitrate");
}

// ── FORM FIELDS CONFIG ────────────────────────────────────────────
const FIELDS = [
  {
    name: "temperature",
    label: "Temperature (°C)",
    placeholder: "e.g. 28.5",
    min: 20,
    max: 35,
  },
  {
    name: "turbidity",
    label: "Turbidity (NTU)",
    placeholder: "e.g. 55.0",
    min: 0,
    max: 100,
  },
  { name: "do", label: "DO (mg/L)", placeholder: "e.g. 3.8", min: 0, max: 15 },
  { name: "ph", label: "pH", placeholder: "e.g. 7.9", min: 4, max: 12 },
  {
    name: "ammonia",
    label: "Ammonia (mg/L)",
    placeholder: "e.g. 0.09",
    min: 0,
    max: 8,
  },
  {
    name: "nitrate",
    label: "Nitrate (mg/L)",
    placeholder: "e.g. 14.0",
    min: 0,
    max: 20,
  },
];

// ════════════════════════════════════════════════════════════════
// MAIN APP COMPONENT
// ════════════════════════════════════════════════════════════════
export default function App() {
  const [form, setForm] = useState({
    temperature: "",
    turbidity: "",
    do: "",
    ph: "",
    ammonia: "",
    nitrate: "",
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(true);
  const [backendOk, setBackendOk] = useState(null);

  // Health check on mount
  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((r) => r.json())
      .then((d) => setBackendOk(d.status === "ok"))
      .catch(() => setBackendOk(false));
  }, []);

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handlePredict = async () => {
    // Validate all fields
    for (const field of FIELDS) {
      const val = form[field.name];
      if (val === "" || isNaN(parseFloat(val))) {
        setError(`Please enter a valid number for "${field.label}"`);
        return;
      }
    }
    setError(null);
    setLoading(true);

    try {
      const payload = Object.fromEntries(
        FIELDS.map((f) => [f.name, parseFloat(form[f.name])]),
      );
      const res = await fetch(`${API_URL}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data);
        setShowForm(false);
      } else {
        setError(data.error || "Prediction failed");
      }
    } catch {
      setError(
        "Cannot reach backend. Make sure app.py is running on port 5000.",
      );
    }
    setLoading(false);
  };

  const handleReset = () => {
    setResult(null);
    setShowForm(true);
  };

  // Derived values
  const wqiColor = result
    ? WQI_COLORS[result.wqi_class] || "#94a3b8"
    : "#378ADD";
  const maxShap = result
    ? Math.max(...result.layer_a.map((d) => d.magnitude), 0.001)
    : 1;

  return (
    <div className="app">
      {/* ═══════════════════════════════════════════════════════
          HEADER
          ═══════════════════════════════════════════════════════ */}
      <header className="header">
        <div className="header-left">
          <span className="header-fish">🐟</span>
          <div>
            <div className="header-title">
              CatfishIQ — Water Quality Monitor
            </div>
            <div className="header-sub">
              ANN model · R² 0.9928 · Layers A & B active
              {backendOk !== null && (
                <span
                  style={{
                    marginLeft: 10,
                    color: backendOk ? "#1D9E75" : "#E24B4A",
                  }}
                >
                  · backend {backendOk ? "connected" : "offline"}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="header-right">
          <div className="live-dot"></div>
          <span className="live-text">Live monitoring</span>
        </div>
      </header>

      <main className="main">
        {/* ═══════════════════════════════════════════════════
            INPUT FORM
            ═══════════════════════════════════════════════════ */}
        <div className="card">
          <div className="card-header">
            <span className="card-label">Sensor readings</span>
            <span
              className="collapse-toggle"
              onClick={() => setShowForm((s) => !s)}
              role="button"
              aria-label="Toggle form"
            >
              {showForm ? "▲ collapse" : "▼ expand"}
            </span>
          </div>

          {showForm && (
            <div className="form-body">
              <div className="form-grid">
                {FIELDS.map((field) => (
                  <div key={field.name} className="form-field">
                    <label className="form-label" htmlFor={field.name}>
                      {field.label}
                    </label>
                    <input
                      id={field.name}
                      type="number"
                      name={field.name}
                      value={form[field.name]}
                      onChange={handleChange}
                      placeholder={field.placeholder}
                      step="0.01"
                      className="form-input"
                    />
                  </div>
                ))}
              </div>

              {error && (
                <div className="error-msg" role="alert">
                  {error}
                </div>
              )}

              <button
                onClick={handlePredict}
                disabled={loading}
                className="predict-btn"
              >
                {loading ? "Predicting…" : "⚡ Run Prediction"}
              </button>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════
            RESULTS
            ═══════════════════════════════════════════════════ */}
        {result && (
          <>
            {/* ── ROW 1: WQI Score + Layer A ─────────────────── */}
            <div className="row-2col">
              {/* WQI Score card */}
              <div className="card">
                <div className="card-label" style={{ marginBottom: 12 }}>
                  Predicted WQI
                </div>

                <div style={{ textAlign: "center", padding: "10px 0" }}>
                  <div className="wqi-score-number" style={{ color: wqiColor }}>
                    {result.wqi_score}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <span
                      className="wqi-badge"
                      style={{
                        color: wqiColor,
                        borderColor: wqiColor + "44",
                        backgroundColor: wqiColor + "22",
                      }}
                    >
                      {result.wqi_class}
                    </span>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>
                    {result.wqi_status}
                  </div>
                </div>

                <div className="card-divider" />

                <div className="card-label" style={{ marginBottom: 8 }}>
                  All parameters
                </div>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  {result.layer_b.param_report.map((p) => {
                    const cls =
                      p.status === "Within Range"
                        ? "param-good"
                        : p.severity === "Severe"
                          ? "param-bad"
                          : "param-warn";
                    const arrow =
                      p.status === "Within Range"
                        ? " ✓"
                        : p.status === "Below Optimal"
                          ? " ↓"
                          : " ↑";
                    return (
                      <div key={p.parameter} className="param-row">
                        <span className="param-name">
                          {shortName(p.parameter)}
                        </span>
                        <span className={`param-value ${cls}`}>
                          {p.value} {p.unit}
                          {arrow}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Layer A card */}
              <div className="card">
                <div className="card-label" style={{ marginBottom: 12 }}>
                  Layer A — parameter impact
                  <span
                    style={{
                      color: "#475569",
                      fontWeight: 400,
                      marginLeft: 8,
                      fontSize: 10,
                    }}
                  >
                    SHAP values
                  </span>
                </div>

                <div
                  style={{ display: "flex", flexDirection: "column", gap: 9 }}
                >
                  {result.layer_a.map((d) => {
                    const pct = (d.magnitude / maxShap) * 50; // max 50% of track width per side
                    return (
                      <div key={d.parameter} className="shap-row">
                        <span className="shap-name">
                          {shortName(d.parameter)}
                        </span>
                        <div className="shap-track">
                          <div className="shap-midline" />
                          {d.direction === "Negative" ? (
                            <div
                              className="shap-bar-neg"
                              style={{ width: `${pct}%` }}
                            >
                              <span className="shap-label-neg">
                                {d.shap.toFixed(3)}
                              </span>
                            </div>
                          ) : (
                            <div
                              className="shap-bar-pos"
                              style={{ width: `${pct}%` }}
                            >
                              <span className="shap-label-pos">
                                +{d.shap.toFixed(3)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="shap-legend">
                  <div className="legend-item">
                    <div
                      className="legend-dot"
                      style={{ background: "#7F1D1D" }}
                    />
                    <span className="legend-text">Hurting WQI</span>
                  </div>
                  <div className="legend-item">
                    <div
                      className="legend-dot"
                      style={{ background: "#166534" }}
                    />
                    <span className="legend-text">Helping WQI</span>
                  </div>
                </div>
              </div>
            </div>

            <div
              className={`card ${
                result.layer_b.improvements[0]?.priority === "URGENT"
                  ? "card-alert-red"
                  : result.layer_b.improvements[0]?.priority === "HIGH"
                    ? "card-alert-amber"
                    : ""
              }`}
            >
              <div
                className="card-label card-label-danger"
                style={{ marginBottom: 12 }}
              >
                ⚠ Layer B — recommended actions
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {result.layer_b.improvements.map((rec, i) => {
                  const pClass =
                    PRIORITY_CLASS[rec.priority] || PRIORITY_CLASS["ROUTINE"];
                  return (
                    <div key={i} className={`rec-card ${pClass.card}`}>
                      <div className="rec-header">
                        <span className={`rec-badge ${pClass.badge}`}>
                          {rec.priority}
                        </span>
                        <span className={`rec-param ${pClass.param}`}>
                          {rec.parameter}
                        </span>
                      </div>
                      <div className="rec-observation">{rec.observation}</div>
                      <div className="rec-action">→ {rec.action}</div>
                      <div className="rec-detail">{rec.detail}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <button onClick={handleReset} className="reset-btn">
              ← New prediction
            </button>
          </>
        )}
      </main>
    </div>
  );
}
