import React, { useState } from "react";
import { apiRequest } from "../../api.js";
import { TOKEN_KEY, USER_KEY } from "../../constants.js";

export default function AuthCard({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");

  const [cid, setCid] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");

  const submitLabel = mode === "login" ? "Login" : "Register";

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setMessageType("info");
    setLoading(true);

    try {
      if (mode === "register") {
        await apiRequest({
          path: "/auth/register",
          method: "POST",
          body: { cid, fullName, email, password },
        });
        setMode("login");
        setMessageType("success");
        setMessage("Registered. Verify email from backend log, then login.");
      } else {
        const result = await apiRequest({
          path: "/auth/login",
          method: "POST",
          body: { cid, password },
        });

        localStorage.setItem(TOKEN_KEY, result.token);
        localStorage.setItem(USER_KEY, JSON.stringify(result.user));
        onAuthenticated({ nextToken: result.token, nextUser: result.user });
      }
    } catch (error) {
      setMessageType("error");
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="auth-shell auth-shell--minimal" id="auth-card" aria-label="Authentication">
      <div className="auth-minimal-card">
        <div className="auth-minimal-main">
          <div className="auth-minimal-brand">City Management Portal</div>
          <h2 className="auth-minimal-title">
            {mode === "login" ? "Welcome back" : "Create an account"}
          </h2>
          <p className="auth-minimal-subtitle">
            {mode === "login"
              ? "Sign in to report and track city issues in one place."
              : "Use your citizen details to access public digital services."}
          </p>

          <div className="auth-minimal-toggle" role="tablist" aria-label="Authentication mode">
            <button
              className={
                mode === "login"
                  ? "auth-minimal-toggle__btn auth-minimal-toggle__btn--active"
                  : "auth-minimal-toggle__btn"
              }
              onClick={() => setMode("login")}
              type="button"
              role="tab"
              aria-selected={mode === "login"}
            >
              Login
            </button>
            <button
              className={
                mode === "register"
                  ? "auth-minimal-toggle__btn auth-minimal-toggle__btn--active"
                  : "auth-minimal-toggle__btn"
              }
              onClick={() => setMode("register")}
              type="button"
              role="tab"
              aria-selected={mode === "register"}
            >
              Sign Up
            </button>
          </div>

          <form className="form-grid auth-form auth-minimal-form" onSubmit={handleSubmit}>
            {mode === "register" ? (
              <label>
                Full Name
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  autoComplete="name"
                  placeholder="Your full name"
                />
              </label>
            ) : null}

            <label>
              CID
              <input
                value={cid}
                onChange={(e) => setCid(e.target.value)}
                required
                autoComplete="username"
                inputMode="text"
                placeholder="Citizen ID"
              />
            </label>

            {mode === "register" ? (
              <label>
                Email
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                />
              </label>
            ) : null}

            <label>
              Password
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                placeholder={mode === "login" ? "Enter your password" : "Create a password"}
              />
            </label>

            <button className="btn btn--primary auth-minimal-submit" disabled={loading}>
              {loading ? "Please wait..." : submitLabel}
            </button>
          </form>

          {message ? (
            <p
              className={`auth-feedback auth-feedback--${messageType}`}
              role="status"
              aria-live="polite"
            >
              {message}
            </p>
          ) : null}
        </div>

        <aside className="auth-minimal-side" aria-label="Portal information">
          <div className="auth-minimal-side__label">Public Service Access</div>
          <h3 className="auth-minimal-side__title">Simple digital civic workflow</h3>
          <p className="auth-minimal-side__text">
            File reports, monitor progress, and receive official responses without visiting offices.
          </p>

          <ul className="auth-minimal-side__list">
            <li>Submit and track service requests</li>
            <li>Role-based workflow and audit logs</li>
            <li>Clear updates from report to resolution</li>
          </ul>

          <div className="auth-minimal-side__stats">
            <div className="auth-minimal-side__stat">
              <strong>24/7</strong>
              <span>Service Access</span>
            </div>
            <div className="auth-minimal-side__stat">
              <strong>100%</strong>
              <span>Traceable Updates</span>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

