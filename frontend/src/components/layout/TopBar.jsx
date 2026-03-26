import React from "react";

export default function TopBar({ user, isAuthenticated, onLogout }) {
  return (
    <header className="app-topbar" role="banner">
      <div className="app-topbar__brand">
        <div className="app-topbar__kicker">City Portal</div>
        <div className="app-topbar__title">Official Urban Services</div>
      </div>

      <div className="app-topbar__right">
        {isAuthenticated ? (
          <>
            <div className="app-user">
              <div className="app-user__name">
                {user?.fullName || user?.full_name || user?.cid}
              </div>
              <div className="app-user__role">{user?.role ? `Role: ${user.role}` : null}</div>
            </div>
            <button className="btn btn--ghost" type="button" onClick={onLogout}>
              Logout
            </button>
          </>
        ) : (
          <div className="app-topbar__hint">Secure sign-in required to continue</div>
        )}
      </div>
    </header>
  );
}

