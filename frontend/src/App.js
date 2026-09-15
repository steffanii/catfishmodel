// ════════════════════════════════════════════════════════════════
// CatfishIQ — React Frontend (White & Green Dashboard)
// ════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from "react";
import "./App.css";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

// ── Color maps (green theme) ─────────────────────────────────────
const WQI_COLOR = {
  Optimal: { hex: "#1a6b3a", track: "#1a6b3a" },
  Good: { hex: "#2d9e5f", track: "#2d9e5f" },
  Fair: { hex: "#d97706", track: "#d97706" },
  Poor: { hex: "#ea580c", track: "#ea580c" },
  Critical: { hex: "#dc2626", track: "#dc2626" },
};

const PRIORITY_BORDER = {
  URGENT: "#dc2626",
  HIGH: "#d97706",
  ROUTINE: "#1a6b3a",
  NONE: "#1a6b3a",
};

const SHAP_COLORS = {
  positive: "#1a6b3a",
  negative: "#dc2626",
};

function shortName(p) {
  return p
    .replace("Temperature (C)", "Temperature")
    .replace("Turbidity(NTU)", "Turbidity")
    .replace("DO(mg/L)", "Dissolved Oxygen")
    .replace("PH", "pH")
    .replace("Ammonia(mg/L)", "Ammonia")
    .replace("Nitrate(mg/L)", "Nitrate");
}

const FIELDS = [
  {
    name: "temperature",
    label: "Temperature",
    hint: "°C · Optimal: 24–30",
    placeholder: "e.g. 28.5",
  },
  {
    name: "do",
    label: "Dissolved Oxygen",
    hint: "mg/L · Min: ≥5.0",
    placeholder: "e.g. 5.2",
  },
  {
    name: "ph",
    label: "pH",
    hint: "Optimal: 6.5–8.5",
    placeholder: "e.g. 7.1",
  },
  {
    name: "ammonia",
    label: "Ammonia",
    hint: "mg/L · Max: 0.05",
    placeholder: "e.g. 0.04",
  },
  {
    name: "nitrate",
    label: "Nitrate",
    hint: "mg/L · Max: 10",
    placeholder: "e.g. 3.2",
  },
  {
    name: "turbidity",
    label: "Turbidity",
    hint: "NTU · Max: 50",
    placeholder: "e.g. 42",
  },
];

const WQI_CLASSES = ["Critical", "Poor", "Fair", "Good", "Optimal"];

// ════════════════════════════════════════════════════════════════
export default function App() {
  const [form, setForm] = useState({
    temperature: "",
    do: "",
    ph: "",
    ammonia: "",
    nitrate: "",
    turbidity: "",
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [backendOk, setBackendOk] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((r) => r.json())
      .then((d) => setBackendOk(d.status === "ok"))
      .catch(() => setBackendOk(false));
  }, []);

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handlePredict = async () => {
    for (const f of FIELDS) {
      if (form[f.name] === "" || isNaN(parseFloat(form[f.name]))) {
        setError(`Enter a valid number for "${f.label}"`);
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
        setTimeout(
          () =>
            document
              .getElementById("results")
              ?.scrollIntoView({ behavior: "smooth" }),
          100,
        );
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
    setForm({
      temperature: "",
      do: "",
      ph: "",
      ammonia: "",
      nitrate: "",
      turbidity: "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const wqiCol = result
    ? WQI_COLOR[result.wqi_class] || WQI_COLOR.Fair
    : WQI_COLOR.Fair;
  const trackPct = result ? Math.min(Math.max(result.wqi_score, 0), 100) : 0;
  const maxShap = result
    ? Math.max(...result.layer_a.map((d) => d.magnitude), 0.001)
    : 1;

  return (
    <div className="app">
      {/* ── NAV ─────────────────────────────────────────────── */}
      <nav className="nav">
        <div className="logo">
          Catfish<span>IQ</span>
        </div>
        <div className="nav-meta">
          <span>ANN Model</span>
          <span>R² = 0.9928</span>
          <span>AHP Weights</span>
          {backendOk !== null && (
            <span className={backendOk ? "status-ok" : "status-err"}>
              ● {backendOk ? "Backend connected" : "Backend offline"}
            </span>
          )}
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────── */}
      <div className="hero">
        <h1>
          Catfish Water Quality <span>Prediction System</span>
        </h1>
        <p>
          AHP-weighted Water Quality Index · ANN (R² = 0.9928) · Layers A & B
        </p>
        <div className="kpis">
          <div className="kpi">
            <div className="kpi-num">0.9928</div>
            <div className="kpi-lbl">R² Accuracy</div>
          </div>
          <div className="kpi">
            <div className="kpi-num">ANN</div>
            <div className="kpi-lbl">Best Model</div>
          </div>
          <div className="kpi">
            <div className="kpi-num">AHP</div>
            <div className="kpi-lbl">Weight Method</div>
          </div>
          <div className="kpi">
            <div className="kpi-num">6</div>
            <div className="kpi-lbl">Parameters</div>
          </div>
        </div>
      </div>

      {/* ── INPUT FORM ───────────────────────────────────────── */}
      <div className="section" style={{ marginTop: 24 }}>
        <div className="card full-width">
          <div className="card-title">🧪 Sensor Input Parameters</div>
          <div className="form-grid">
            {FIELDS.map((f) => (
              <div key={f.name} className="fg">
                <label>{f.label}</label>
                <input
                  type="number"
                  name={f.name}
                  value={form[f.name]}
                  onChange={handleChange}
                  placeholder={f.placeholder}
                  step="0.01"
                />
                <div className="hint">{f.hint}</div>
              </div>
            ))}
          </div>
          {error && <div className="error-msg">{error}</div>}
          <button className="btn" onClick={handlePredict} disabled={loading}>
            {loading ? "Predicting…" : "⚡ Predict Water Quality Index"}
          </button>
        </div>
      </div>

      {/* ── RESULTS ─────────────────────────────────────────── */}
      {result && (
        <div id="results" className="results-area">
          {/* ROW 1 — WQI Score + Parameter Status */}
          <div className="section grid-2">
            <div className="card">
              <div className="card-title">📊 Prediction Result</div>
              <div className="score-big">
                <div className="score-num" style={{ color: wqiCol.hex }}>
                  {result.wqi_score}
                </div>
                <div className="score-cls" style={{ color: wqiCol.hex }}>
                  {result.wqi_class.toUpperCase()}
                </div>
                <div className="score-desc">{result.wqi_status}</div>
              </div>
              <div className="track-wrap">
                <div
                  className="track-fill"
                  style={{ width: `${trackPct}%`, background: wqiCol.track }}
                />
              </div>
              <div className="track-labels">
                <span>0</span>
                <span>20</span>
                <span>40</span>
                <span>60</span>
                <span>80</span>
                <span>100</span>
              </div>
              <div className="badges">
                {WQI_CLASSES.map((cls) => (
                  <div
                    key={cls}
                    className={`badge ${cls === result.wqi_class ? "badge-act" : "badge-dim"}`}
                    style={
                      cls === result.wqi_class
                        ? {
                            color: wqiCol.hex,
                            borderColor: wqiCol.hex,
                            background: wqiCol.hex + "18",
                          }
                        : {}
                    }
                  >
                    {cls}
                    {cls === result.wqi_class ? " ←" : ""}
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-title">📋 Parameter Status</div>
              {result.layer_b.param_report.map((p) => {
                const pct = Math.min(
                  Math.max(((p.value - p.min) / (p.max - p.min)) * 100, 0),
                  100,
                );
                const col =
                  p.status === "Within Range"
                    ? "#1a6b3a"
                    : p.severity === "Severe"
                      ? "#dc2626"
                      : "#d97706";
                const arrow =
                  p.status === "Within Range"
                    ? "✓"
                    : p.status === "Below Optimal"
                      ? "↓"
                      : "↑";
                return (
                  <div key={p.parameter} className="p-row">
                    <span className="p-name">{shortName(p.parameter)}</span>
                    <div className="p-track">
                      <div
                        className="p-fill"
                        style={{ width: `${pct}%`, background: col }}
                      />
                    </div>
                    <span className="p-score" style={{ color: col }}>
                      {p.value} {p.unit} {arrow}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ROW 2 — Layer A + Layer B */}
          <div className="section grid-2">
            <div className="card">
              <div className="card-title">
                📈 Layer A — Parameter Impact (SHAP)
              </div>
              <p className="card-sub">
                Which parameter is affecting WQI most right now
              </p>
              {result.layer_a.map((d) => {
                const pct = (d.magnitude / maxShap) * 100;
                const col =
                  d.direction === "Negative"
                    ? SHAP_COLORS.negative
                    : SHAP_COLORS.positive;
                return (
                  <div key={d.parameter} className="shap-row">
                    <span className="shap-name">{shortName(d.parameter)}</span>
                    <div className="shap-outer">
                      <div
                        className="shap-bar"
                        style={{ width: `${pct}%`, background: col }}
                      >
                        <span className="shap-val">
                          {d.direction === "Negative" ? "" : "+"}
                          {d.shap.toFixed(3)}
                        </span>
                      </div>
                    </div>
                    <span className="shap-dir" style={{ color: col }}>
                      {d.direction === "Negative" ? "↓ hurting" : "↑ helping"}
                    </span>
                  </div>
                );
              })}
              <div className="shap-note">
                Primary issue:{" "}
                <strong>
                  {shortName(
                    result.layer_a.find((d) => d.direction === "Negative")
                      ?.parameter || result.layer_a[0].parameter,
                  )}
                </strong>{" "}
                is the biggest drag on WQI right now.
              </div>
            </div>

            <div className="card">
              <div className="card-title">
                💡 Layer B — Management Recommendations
              </div>
              <p className="card-sub">Physical actions the farmer can take</p>
              {result.layer_b.improvements.map((rec, i) => (
                <div
                  key={i}
                  className="rec"
                  style={{
                    borderLeftColor: PRIORITY_BORDER[rec.priority] || "#1a6b3a",
                  }}
                >
                  <div
                    className="rec-param"
                    style={{
                      color: PRIORITY_BORDER[rec.priority] || "#1a6b3a",
                    }}
                  >
                    {rec.priority === "URGENT"
                      ? "⚠️"
                      : rec.priority === "HIGH"
                        ? "⚠️"
                        : "✅"}{" "}
                    {rec.parameter}
                    <span className="rec-priority-badge">{rec.priority}</span>
                  </div>
                  <div className="rec-obs">{rec.observation}</div>
                  <div className="rec-action">→ {rec.action}</div>
                  <div className="rec-detail">{rec.detail}</div>
                </div>
              ))}
            </div>
          </div>

          <div
            className="section"
            style={{ textAlign: "center", paddingBottom: 32 }}
          >
            <button className="btn-reset" onClick={handleReset}>
              ↺ New Prediction
            </button>
          </div>
        </div>
      )}

      <footer className="footer">
        CatfishIQ v1.0 — AHP-weighted WQI · ANN Model · Layers A & B
      </footer>
    </div>
  );
}
