"use client";

import { useEffect, useState } from "react";

export function AdminSplash() {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("admin-splash-seen")) return;
    setVisible(true);
    sessionStorage.setItem("admin-splash-seen", "1");
    const hide = window.setTimeout(() => setLeaving(true), 720);
    const remove = window.setTimeout(() => setVisible(false), 1180);
    return () => {
      window.clearTimeout(hide);
      window.clearTimeout(remove);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className={`admin-splash${leaving ? " is-leaving" : ""}`} aria-hidden>
      <div className="admin-splash-mark">
        <img src="/admin-icon-192.png" alt="" width={92} height={92} />
        <strong>Admin</strong>
      </div>
    </div>
  );
}
