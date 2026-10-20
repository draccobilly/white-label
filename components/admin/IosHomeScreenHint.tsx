"use client";

import { useEffect, useState } from "react";
import { Share } from "lucide-react";

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isIosChrome() {
  return isIosDevice() && /CriOS|GSA\//i.test(navigator.userAgent);
}

export function IosHomeScreenHint({ compact = false }: { compact?: boolean }) {
  const [show, setShow] = useState(false);
  const [chrome, setChrome] = useState(false);

  useEffect(() => {
    const ios = isIosDevice();
    setChrome(isIosChrome());
    setShow(ios);
  }, []);

  if (!show) return null;

  return (
    <aside className="admin-pwa-banner" role="note">
      <div>
        <h2>Atalho Admin</h2>
        {chrome ? (
          <p>
            Este é o Chrome. O iPhone não mostra essa opção aqui. Toque em{" "}
            <strong>Abrir no Safari</strong>, e no Safari toque no quadrado com a seta{" "}
            <span className="admin-pwa-share" aria-hidden>
              <Share size={14} />
            </span>
            , role a lista e toque em <strong>Adicionar à Tela de Início</strong>. Se não
            aparecer, toque em <strong>Editar Ações</strong> embaixo e ative essa ação.
          </p>
        ) : (
          <p>
            Tem que ser o <strong>Safari</strong> (não Chrome). Toque no quadrado com a
            seta{" "}
            <span className="admin-pwa-share" aria-hidden>
              <Share size={14} />
            </span>{" "}
            Compartilhar, role a lista até <strong>Adicionar à Tela de Início</strong>.
            Se não estiver na lista, toque em <strong>Editar Ações</strong> e ative.
          </p>
        )}
        {compact ? null : (
          <p>Alertas de venda só funcionam depois que você abrir o ícone da tela inicial.</p>
        )}
      </div>
    </aside>
  );
}
