import type { AnalyticsData, EntityMetrics, TimelineCell } from "@/lib/analytics";
import { formatCount, formatMultiple, formatRate } from "@/lib/analytics";
import { formatReportingChartDay, formatReportingHour, formatReportingWeekday } from "@/lib/date-range";
import { formatMoney } from "@/lib/utils";

export type InsightTone = "success" | "warning" | "danger" | "info";

export type Insight = {
  id: string;
  tone: InsightTone;
  /** Short headline, e.g. "Troque o criativo de Maria". */
  title: string;
  /** The numbers behind it. */
  detail: string;
  /** What to do next. */
  action: string;
  href?: string;
  /** Steps shown when the card is opened. */
  guide?: string[];
  /** The campaign this insight belongs to, when it has one. */
  campaignHref?: string;
};

const MIN_CLICKS = 120;
const MIN_GIFTS = 8;

function hourLabel(hour: number) {
  return formatReportingHour(hour).replace(" ", "").toLowerCase();
}

function hourSpan(start: number, end: number) {
  return `${hourLabel(start)}–${hourLabel((end + 1) % 24)}`;
}

function dayLabel(iso: string) {
  return `${formatReportingWeekday(iso)} ${formatReportingChartDay(iso)}`;
}

function contiguous(hours: number[]) {
  const sorted = [...new Set(hours)].sort((a, b) => a - b);
  const groups: Array<[number, number]> = [];
  for (const hour of sorted) {
    const last = groups[groups.length - 1];
    if (last && hour === last[1] + 1) last[1] = hour;
    else groups.push([hour, hour]);
  }
  return groups;
}

/**
 * Rule-based reading of one period against the one before it. Every rule
 * states its own numbers so the owner can check the reasoning.
 */
export function buildInsights(current: AnalyticsData, previous: AnalyticsData | null): Insight[] {
  const out: Insight[] = [];
  const money = (value: number) => formatMoney(value, current.currency);
  const totals = current.totals;
  const avgConversion = totals.conversion ?? 0;

  /* Overall budget signal (only when ad spend was typed in) ------------------ */
  if (totals.spend > 0 && totals.roas !== null) {
    if (totals.roas >= 3 && totals.gifts >= MIN_GIFTS) {
      out.push({
        id: "roas-scale",
        tone: "success",
        title: `ROAS geral ${formatMultiple(totals.roas)}: há espaço para escalar`,
        detail: `${money(totals.revenue)} de receita para ${money(totals.spend)} investidos (CPA ${
          totals.cpa === null ? "—" : money(totals.cpa)
        }).`,
        action: "Suba o orçamento das campanhas com ROAS acima de 3 em passos de 20% e acompanhe o CPA por dois dias.",
      });
    } else if (totals.roas < 1) {
      out.push({
        id: "roas-cut",
        tone: "danger",
        title: `ROAS geral ${formatMultiple(totals.roas)}: o investimento não se paga`,
        detail: `${money(totals.revenue)} de receita para ${money(totals.spend)} investidos. ROI ${
          totals.roi === null ? "—" : `${(totals.roi * 100).toFixed(0)}%`
        } depois das taxas.`,
        action: "Corte os conjuntos com ROAS abaixo de 1 e mova a verba para a campanha com melhor conversão.",
      });
    }
  }

  /* Per campaign: fatigue, scale, cut --------------------------------------- */
  const previousCampaigns = new Map((previous?.campaigns ?? []).map((row) => [row.key, row]));
  for (const campaign of current.campaigns) {
    const before = previousCampaigns.get(campaign.key);
    const conv = campaign.conversion;
    if (before && conv !== null && before.conversion !== null && campaign.clicks >= MIN_CLICKS && before.clicks >= MIN_CLICKS) {
      const drop = before.conversion > 0 ? (conv - before.conversion) / before.conversion : 0;
      const trafficHeld = campaign.clicks >= before.clicks * 0.7;
      if (drop <= -0.3 && trafficHeld) {
        out.push({
          id: `fatigue-${campaign.key}`,
          tone: "warning",
          title: `Troque o criativo de ${campaign.label}`,
          detail: `Conversão caiu de ${formatRate(before.conversion)} para ${formatRate(conv)} com tráfego parecido (${formatCount(
            before.clicks,
          )} → ${formatCount(campaign.clicks)} cliques).`,
          action: "O público já viu o anúncio: suba um criativo novo ou troque o gancho antes de mexer no orçamento.",
          href: campaign.href,
        });
      } else if (drop <= -0.3 && !trafficHeld) {
        out.push({
          id: `delivery-${campaign.key}`,
          tone: "warning",
          title: `${campaign.label} perdeu entrega e conversão`,
          detail: `Cliques ${formatCount(before.clicks)} → ${formatCount(campaign.clicks)}; conversão ${formatRate(
            before.conversion,
          )} → ${formatRate(conv)}.`,
          action: "Confira se o conjunto foi pausado ou rejeitado e se a página ainda abre no celular.",
          href: campaign.href,
        });
      } else if (drop >= 0.3 && campaign.gifts >= MIN_GIFTS) {
        out.push({
          id: `rising-${campaign.key}`,
          tone: "success",
          title: `${campaign.label} está convertendo melhor`,
          detail: `Conversão ${formatRate(before.conversion)} → ${formatRate(conv)} com ${formatCount(campaign.gifts)} doações.`,
          action: "Bom momento para aumentar o orçamento desta campanha.",
          href: campaign.href,
        });
      }
    }
    if (campaign.spend > 0 && campaign.roas !== null) {
      if (campaign.roas >= 3 && campaign.gifts >= MIN_GIFTS) {
        out.push({
          id: `scale-${campaign.key}`,
          tone: "success",
          title: `Aumente o orçamento de ${campaign.label}`,
          detail: `ROAS ${formatMultiple(campaign.roas)}, CPA ${campaign.cpa === null ? "—" : money(campaign.cpa)}, ${formatCount(
            campaign.gifts,
          )} doações.`,
          action: "Escale em passos de 20% por dia enquanto o CPA se mantiver.",
          href: campaign.href,
        });
      } else if (campaign.roas < 1 && campaign.spend >= 5000) {
        out.push({
          id: `cut-${campaign.key}`,
          tone: "danger",
          title: `Reduza ${campaign.label}`,
          detail: `ROAS ${formatMultiple(campaign.roas)}: ${money(campaign.spend)} investidos para ${money(campaign.revenue)} de receita.`,
          action: "Pause os piores conjuntos ou troque o criativo antes de investir mais.",
          href: campaign.href,
        });
      }
    } else if (
      conv !== null &&
      avgConversion > 0 &&
      conv >= avgConversion * 1.5 &&
      campaign.gifts >= MIN_GIFTS &&
      totals.clicks > 0 &&
      campaign.clicks / totals.clicks < 0.2
    ) {
      out.push({
        id: `underfed-${campaign.key}`,
        tone: "success",
        title: `${campaign.label} converte acima da média com pouco tráfego`,
        detail: `${formatRate(conv)} contra ${formatRate(avgConversion)} da operação, com só ${Math.round(
          (campaign.clicks / totals.clicks) * 100,
        )}% dos cliques.`,
        action: "Vale mandar mais verba para cá: cada clique rende mais do que nas outras campanhas.",
        href: campaign.href,
      });
    }
  }

  /* Affiliates: who carries the operation ------------------------------------ */
  const strongAffiliate = current.affiliates.find(
    (row) => row.conversion !== null && avgConversion > 0 && row.conversion >= avgConversion * 1.4 && row.gifts >= MIN_GIFTS,
  );
  const weakAffiliate = current.affiliates.find(
    (row) =>
      row.conversion !== null &&
      avgConversion > 0 &&
      row.conversion <= avgConversion * 0.5 &&
      row.clicks >= MIN_CLICKS &&
      totals.clicks > 0 &&
      row.clicks / totals.clicks >= 0.15,
  );
  if (weakAffiliate) {
    out.push({
      id: `affiliate-weak-${weakAffiliate.key}`,
      tone: "warning",
      title: `${weakAffiliate.label} traz tráfego que converte pouco`,
      detail: `${formatRate(weakAffiliate.conversion)} contra ${formatRate(avgConversion)} da operação, com ${Math.round(
        (weakAffiliate.clicks / totals.clicks) * 100,
      )}% dos cliques.`,
      action: "Confira o público e o criativo desse afiliado antes de renovar a verba.",
      href: weakAffiliate.href,
    });
  }
  if (strongAffiliate && current.affiliates.length > 1) {
    out.push({
      id: `affiliate-strong-${strongAffiliate.key}`,
      tone: "success",
      title: `${strongAffiliate.label} é quem mais converte`,
      detail: `${formatRate(strongAffiliate.conversion)} de conversão e ${money(strongAffiliate.revenue)} no período.`,
      action: "Replique o criativo e o público dele nos outros afiliados.",
      href: strongAffiliate.href,
    });
  }

  /* Hours of the day ------------------------------------------------------- */
  const byHour = new Map<number, { gifts: number; clicks: number; revenue: number }>();
  for (const cell of current.heatmap) {
    const slot = byHour.get(cell.hour) ?? { gifts: 0, clicks: 0, revenue: 0 };
    slot.gifts += cell.gifts;
    slot.clicks += cell.clicks;
    slot.revenue += cell.revenue;
    byHour.set(cell.hour, slot);
  }
  if (totals.gifts >= 20 && totals.clicks >= 300) {
    const golden: number[] = [];
    const weak: number[] = [];
    for (const [hour, slot] of byHour) {
      const giftShare = slot.gifts / totals.gifts;
      const clickShare = slot.clicks / totals.clicks;
      if (giftShare >= 0.05 && clickShare > 0 && giftShare / clickShare >= 1.4) golden.push(hour);
      if (clickShare >= 0.07 && slot.clicks >= 40 && slot.gifts / slot.clicks <= avgConversion * 0.5) weak.push(hour);
    }
    for (const [start, end] of contiguous(golden).slice(0, 2)) {
      let gifts = 0;
      let clicks = 0;
      for (let hour = start; hour <= end; hour += 1) {
        gifts += byHour.get(hour)?.gifts ?? 0;
        clicks += byHour.get(hour)?.clicks ?? 0;
      }
      out.push({
        id: `golden-${start}`,
        tone: "success",
        title: `Horário de ouro: ${hourSpan(start, end)}`,
        detail: `${Math.round((gifts / totals.gifts) * 100)}% das doações com ${Math.round(
          (clicks / totals.clicks) * 100,
        )}% dos cliques (${formatRate(clicks ? gifts / clicks : null)} de conversão).`,
        action: "Concentre orçamento nessa faixa (dayparting) e evite pausar as campanhas nela.",
      });
    }
    for (const [start, end] of contiguous(weak).slice(0, 1)) {
      let gifts = 0;
      let clicks = 0;
      for (let hour = start; hour <= end; hour += 1) {
        gifts += byHour.get(hour)?.gifts ?? 0;
        clicks += byHour.get(hour)?.clicks ?? 0;
      }
      out.push({
        id: `weak-${start}`,
        tone: "warning",
        title: `Tráfego mal aproveitado: ${hourSpan(start, end)}`,
        detail: `${Math.round((clicks / totals.clicks) * 100)}% dos cliques, ${formatRate(
          clicks ? gifts / clicks : null,
        )} de conversão (média ${formatRate(avgConversion)}).`,
        action: "Reduza o lance nessa faixa ou teste outro criativo só nela.",
      });
    }
  }

  /* Gaps: hours with traffic and no sale ------------------------------------ */
  // Expectation per hour of day: a quiet night is not a gap.
  const hourConversion = new Map<number, number>();
  for (const [hour, slot] of byHour) {
    if (slot.clicks >= 10) hourConversion.set(hour, slot.gifts / slot.clicks);
  }
  const namedGaps: Insight[] = [];
  for (const campaign of current.campaignTimelines) {
    for (const gap of findSalesGaps(campaign.timeline, avgConversion, hourConversion).slice(0, 2)) {
      namedGaps.push(salesGapInsight(current, campaign, gap));
    }
  }
  namedGaps.sort((a, b) => (a.tone === "danger" ? -1 : 1) - (b.tone === "danger" ? -1 : 1));
  out.push(...namedGaps.slice(0, 3));

  /* Missed scaling moments --------------------------------------------------- */
  const hot = current.timeline
    .filter((cell) => cell.gifts >= 3 && cell.clicks > 0 && avgConversion > 0 && cell.gifts / cell.clicks >= avgConversion * 2)
    .sort((a, b) => b.gifts - a.gifts)
    .slice(0, 2);
  for (const cell of hot) {
    out.push({
      id: `hot-${cell.day}-${cell.hour}`,
      tone: "info",
      title: `Oportunidade perdida: ${dayLabel(cell.day)} às ${hourLabel(cell.hour)}`,
      detail: `${cell.gifts} doações em ${formatCount(cell.clicks)} cliques (${formatRate(
        cell.gifts / cell.clicks,
      )}, ${(cell.gifts / cell.clicks / avgConversion).toFixed(1)}× a média).`,
      action: "Quando a conversão disparar assim, aumente o orçamento na hora; vale criar uma regra automática de escala.",
    });
  }

  /* Checkout health ------------------------------------------------------------ */
  if (totals.checkouts >= 30 && totals.checkoutConversion !== null && totals.checkoutConversion < 0.25) {
    out.push({
      id: "checkout-leak",
      tone: "warning",
      title: "Muita gente abre o checkout e não paga",
      detail: `${formatCount(totals.checkouts)} checkouts, ${formatCount(totals.gifts)} pagamentos (${formatRate(
        totals.checkoutConversion,
      )}).`,
      action: "Teste valores sugeridos menores e confira cartão recusado e Apple/Google Pay no celular.",
    });
  }

  return dedupe(out);
}

function salesGapInsight(
  _current: AnalyticsData,
  campaign: { key: string; label: string; href: string },
  gap: SalesGap,
): Insight {
  const id = `gap-${campaign.key}-${gap.day}-${gap.start}`;
  const paidNone = gap.checkouts > 0;
  return {
    id,
    tone: gap.expected >= 3 ? "danger" : "warning",
    title: `Buraco de vendas em ${campaign.label}: ${dayLabel(gap.day)}, ${hourSpan(gap.start, gap.end)}`,
    detail: `${formatCount(gap.clicks)} cliques e ${formatCount(gap.checkouts)} checkouts em ${campaign.label}, sem nenhuma doação (esperado ~${gap.expected.toFixed(1)}).`,
    action: paidNone
      ? "As pessoas abriram o checkout e não pagaram. Confira o botão de pagamento e os valores dessa campanha nesse horário."
      : "Os cliques não viraram checkout. Confira se a página dessa campanha abriu no celular e se o botão de doar respondeu.",
    campaignHref: campaign.href,
    guide: paidNone
      ? [
          `Abra a campanha ${campaign.label} e veja a página no celular, no mesmo horário em que o buraco aconteceu (${dayLabel(gap.day)}, ${hourSpan(gap.start, gap.end)}).`,
          `${formatCount(gap.checkouts)} pessoas chegaram ao checkout e nenhuma pagou. O clique no anúncio funcionou; a saída foi no pagamento.`,
          "Toque em doar, escolha um valor e confirme que o cartão, Apple Pay ou Google Pay abre sem erro.",
          "Se o pagamento abre e recusa, teste um valor menor. Se não abre, troque o criativo que manda para essa página até o checkout voltar a concluir.",
          "Quando uma venda entrar de novo nessa faixa, o buraco fecha. Não pause o anúncio nesse horário se ele ainda traz cliques.",
        ]
      : [
          `Abra a campanha ${campaign.label} no celular. O buraco foi ${dayLabel(gap.day)}, ${hourSpan(gap.start, gap.end)}.`,
          `${formatCount(gap.clicks)} pessoas clicaram e nenhuma abriu o checkout. O anúncio trouxe visita, mas a página não levou ao pagamento.`,
          "Confira se a página carrega, se o botão de doar aparece sem rolar demais e se o valor sugerido está visível.",
          "Se a página abre e o botão não responde, publique a página de novo. Se abre devagar, troque a imagem de capa.",
          "Suba um criativo novo apontando para a mesma campanha e compare o próximo período: o buraco some quando os cliques voltam a abrir o checkout.",
        ],
  };
}

export type SalesGap = {
  day: string;
  start: number;
  end: number;
  clicks: number;
  checkouts: number;
  expected: number;
};

/**
 * Stretches of consecutive hours with enough traffic for a sale and none.
 * "Enough" follows the conversion that hour of the day usually has, so a
 * quiet night with a handful of clicks is not reported.
 */
export function findSalesGaps(
  timeline: TimelineCell[],
  avgConversion: number,
  hourConversion: Map<number, number> = new Map(),
): SalesGap[] {
  if (avgConversion <= 0) return [];
  const gaps: SalesGap[] = [];
  let open: Array<TimelineCell & { expected: number }> = [];
  const close = () => {
    // Quiet hours at either end (a late night, an early morning) are not the gap.
    let cells = [...open];
    open = [];
    while (cells.length && cells[0].expected < 0.25) cells = cells.slice(1);
    while (cells.length && cells[cells.length - 1].expected < 0.25) cells = cells.slice(0, -1);
    if (cells.length < 2) return;
    const expected = cells.reduce((sum, cell) => sum + cell.expected, 0);
    if (expected < 2) return;
    gaps.push({
      day: cells[0].day,
      start: cells[0].hour,
      end: cells[cells.length - 1].hour,
      clicks: cells.reduce((sum, cell) => sum + cell.clicks, 0),
      checkouts: cells.reduce((sum, cell) => sum + cell.checkouts, 0),
      expected,
    });
  };
  let previous: TimelineCell | null = null;
  for (const cell of timeline) {
    const adjacent =
      previous !== null && previous.day === cell.day && cell.hour === previous.hour + 1;
    if (cell.gifts > 0 || !adjacent) close();
    if (cell.gifts === 0 && cell.clicks > 0) {
      open.push({ ...cell, expected: cell.clicks * (hourConversion.get(cell.hour) ?? avgConversion) });
    } else if (cell.gifts === 0) {
      close();
    }
    previous = cell;
  }
  close();
  return gaps.sort((a, b) => b.expected - a.expected);
}

function dedupe(items: Insight[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

/** Top entities for the "what to do" cards: best, worst and biggest. */
export function rankEntities(rows: EntityMetrics[]) {
  const withTraffic = rows.filter((row) => row.clicks >= MIN_CLICKS && row.conversion !== null);
  const best = [...withTraffic].sort((a, b) => (b.conversion ?? 0) - (a.conversion ?? 0))[0] ?? null;
  const worst = [...withTraffic].sort((a, b) => (a.conversion ?? 0) - (b.conversion ?? 0))[0] ?? null;
  return { best, worst: worst && worst !== best ? worst : null, biggest: rows[0] ?? null };
}
