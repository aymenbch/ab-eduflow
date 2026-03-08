import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const { login, pin_hash } = await req.json();

    if (!login || !pin_hash) {
      return Response.json({ error: "Identifiant et PIN requis." }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    // Use service role to search AppUser without requiring end-user auth
    const results = await base44.asServiceRole.entities.AppUser.filter({ login: login.trim().toLowerCase() });

    if (!results || results.length === 0) {
      return Response.json({ error: "Identifiant introuvable." }, { status: 401 });
    }

    const user = results[0];

    if (user.status === "suspended") {
      return Response.json({ error: "Ce compte est suspendu. Contactez l'administration." }, { status: 403 });
    }

    if (user.pin_hash !== pin_hash) {
      return Response.json({ error: "PIN incorrect." }, { status: 401 });
    }

    // Update last_login
    await base44.asServiceRole.entities.AppUser.update(user.id, { last_login: new Date().toISOString() });

    // Return user data (never return pin_hash to client)
    return Response.json({
      id: user.id,
      login: user.login,
      full_name: user.full_name,
      role: user.role,
      member_id: user.member_id,
      member_type: user.member_type,
      must_change_pin: user.must_change_pin,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});