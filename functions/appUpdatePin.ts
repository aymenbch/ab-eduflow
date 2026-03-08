import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const { user_id, pin_hash } = await req.json();

    if (!user_id || !pin_hash) {
      return Response.json({ error: "Données manquantes." }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    await base44.asServiceRole.entities.AppUser.update(user_id, {
      pin_hash,
      must_change_pin: false,
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});