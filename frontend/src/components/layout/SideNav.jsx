import React from "react";
import { ROLE_NAV_ITEMS } from "../../constants.js";

export default function SideNav({ role, activeTab, onTabChange }) {
  const items = ROLE_NAV_ITEMS[role] || [];
  if (!items.length) return null;
  const roleLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) : "User";

  return (
    <aside className="app-sidenav" aria-label="Section navigation" role="complementary">
      <div className="app-sidenav__head">
        <div className="app-sidenav__label">Workspace</div>
        <span className="app-sidenav__role">{roleLabel}</span>
      </div>
      <nav className="app-sidenav__nav">
        {items.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`sidenav-item ${isActive ? "sidenav-item--active" : ""}`}
              onClick={() => onTabChange(item.id)}
              aria-current={isActive ? "page" : undefined}
            >
              <span className="sidenav-item__text">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

