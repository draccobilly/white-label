import { NextResponse } from "next/server";
import { getReceiptAccess } from "@/lib/receipt-access";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token || token.length > 2000) {
    return new NextResponse("Receipt not found", { status: 404 });
  }

  const access = await getReceiptAccess(token);
  if (!access) {
    return new NextResponse("Receipt not found", { status: 404 });
  }

  const destination = access.available
    ? access.receiptPath
    : `/gerenating-receipt?token=${encodeURIComponent(access.token)}`;

  return NextResponse.redirect(new URL(destination, request.url));
}
