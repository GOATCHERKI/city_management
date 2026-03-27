import React, { useEffect, useState } from "react";
import { ROLE_NAV_ITEMS } from "../../constants.js";

export default function SideNav({ role, activeTab, onTabChange }) {
  const items = ROLE_NAV_ITEMS[role] || [];
  const roleLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) : "User";
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 992px)");

    const syncState = () => {
      if (role === "admin") {
        setCollapsed(mediaQuery.matches);
      } else {
        setCollapsed(false);
      }
    };

    syncState();
    mediaQuery.addEventListener("change", syncState);
    return () => mediaQuery.removeEventListener("change", syncState);
  }, [role]);

  if (!items.length) return null;

  return (
    <aside
      className={`app-sidenav ${role === "admin" ? "app-sidenav--admin" : ""}`}
      aria-label="Section navigation"
      role="complementary"
    >
      <div className="app-sidenav__head">
        <div className="app-sidenav__label">Workspace</div>
        <span className="app-sidenav__role">{roleLabel}</span>
        {role === "admin" ? (
          <button
            type="button"
            className="app-sidenav__toggle"
            onClick={() => setCollapsed((prev) => !prev)}
            aria-expanded={!collapsed}
          >
            {collapsed ? "Menu" : "Hide Menu"}
          </button>
        ) : null}
      </div>
      <nav className={`app-sidenav__nav ${collapsed ? "app-sidenav__nav--collapsed" : ""}`}>
        {items.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`sidenav-item ${isActive ? "sidenav-item--active" : ""}`}
              onClick={() => {
                onTabChange(item.id);
                if (role === "admin" && window.matchMedia("(max-width: 992px)").matches) {
                  setCollapsed(true);
                }
              }}
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

