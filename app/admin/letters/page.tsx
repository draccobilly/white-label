import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { DonationLetterTool } from "@/components/admin/DonationLetterTool";
import { requireOwnerPage } from "@/lib/admin-access";
import { reportingIsoDate } from "@/lib/date-range";
import { DONATION_LETTER } from "@/lib/donation-letter-config";
import { formatMoney } from "@/lib/utils";

/**
 * Owner-only desk for the donation acknowledgment letters: catch up on gifts
 * paid before the letter existed, and send or resend one on request. New
 * qualifying gifts do not pass through here; their letter goes attached to
 * the thank-you e-mail.
 */
export default async function AdminLettersPage() {
  await requireOwnerPage();
  const automaticLabel = formatMoney(DONATION_LETTER.automaticFromCents, DONATION_LETTER.currency);
  return (
    <>
      <AdminPageHeader
        eyebrow="Suporte"
        title="Cartas de doação"
        description={`Carta de reconhecimento para o imposto do doador (tax letter). Doações de ${automaticLabel} ou mais recebem a carta em PDF sozinhas, no e-mail de agradecimento. Aqui você envia as antigas, baixa a cópia de cada carta enviada e cancela a que não deve mais valer.`}
      />
      <div className="admin-card">
        <DonationLetterTool
          automaticLabel={automaticLabel}
          defaultSince={`${reportingIsoDate().slice(0, 4)}-01-01`}
        />
      </div>
    </>
  );
}
