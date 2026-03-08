import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { action, user_id, payload } = body;

    // All operations use service role (no end-user auth required)
    const db = base44.asServiceRole.entities.AppUser;

    if (action === "create") {
      const created = await db.create(payload);
      return Response.json(created);
    }

    if (action === "update") {
      const updated = await db.update(user_id, payload);
      return Response.json(updated);
    }

    if (action === "delete") {
      await db.delete(user_id);
      return Response.json({ success: true });
    }

    if (action === "list") {
      const users = await db.list("-created_date");
      // Never return pin_hash to frontend
      return Response.json(users.map(u => {
        const { pin_hash, ...safe } = u;
        return safe;
      }));
    }

    return Response.json({ error: "Action inconnue." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});