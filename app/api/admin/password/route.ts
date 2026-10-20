import { NextResponse } from "next/server";
import { z } from "zod";
import { mustChangePassword, MUST_CHANGE_PASSWORD } from "@/lib/must-change-password";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  password: z.string().min(8).max(200),
  confirm: z.string().min(8).max(200),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "A senha precisa ter pelo menos 8 caracteres." }, { status: 400 });
  }
  if (parsed.data.password !== parsed.data.confirm) {
    return NextResponse.json({ error: "As duas senhas não são iguais." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Entre de novo para trocar a senha." }, { status: 401 });
  }
  if (!mustChangePassword(user)) {
    return NextResponse.json({ error: "Esta conta já tem a senha atualizada." }, { status: 409 });
  }

  const admin = createServiceClient();
  const current = await admin.auth.admin.getUserById(user.id);
  if (current.error || !current.data.user) {
    return NextResponse.json({ error: "Não foi possível atualizar a senha." }, { status: 400 });
  }
  const updated = await admin.auth.admin.updateUserById(user.id, {
    password: parsed.data.password,
    app_metadata: {
      ...current.data.user.app_metadata,
      [MUST_CHANGE_PASSWORD]: false,
    },
  });
  if (updated.error) {
    return NextResponse.json({ error: "Não foi possível atualizar a senha." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
