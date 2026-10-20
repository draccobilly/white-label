import { NextResponse } from "next/server";
import { getPagnovoCardConfig, isPagnovoConfigured } from "@/lib/pagnovo";

export async function GET() {
  if (!isPagnovoConfigured()) {
    return NextResponse.json({ available: false, tokenizationKey: null });
  }
  try {
    const config = await getPagnovoCardConfig();
    return NextResponse.json(config);
  } catch (error) {
    console.error("pagnovo card-config failed", error);
    return NextResponse.json({ available: false, tokenizationKey: null });
  }
}
