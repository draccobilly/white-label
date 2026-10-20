"use client";

import { useEffect } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";

export default function AdminError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="admin-error-state" role="alert">
      <span className="admin-error-icon" aria-hidden>
        <TriangleAlert size={22} />
      </span>
      <p className="admin-kicker">Admin</p>
      <h1>Esta tela não carregou</h1>
      <p>
        Nada foi gravado. Tente de novo; se continuar, abra outra página do painel
        e volte aqui.
        {error.digest ? (
          <>
            {" "}
            Referência: <code>{error.digest}</code>
          </>
        ) : null}
      </p>
      <div className="admin-inline-actions">
        <button type="button" className="primary-button" onClick={() => retry()}>
          Tentar de novo
        </button>
        <Link className="secondary-button" href="/admin">
          Admin home
        </Link>
      </div>
    </div>
  );
}
