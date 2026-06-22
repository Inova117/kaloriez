// Supabase Edge Function: delete-account
//
// Permanently deletes the authenticated user's account and all their data.
// Required by App Store guideline 5.1.1(v) and Google Play for any app that
// lets users create an account. Uses the service-role key (server-side only) to
// remove the auth user, which the anon client cannot do.
//
// Deploy:
//   supabase functions deploy delete-account
// Requires SUPABASE_SERVICE_ROLE_KEY to be available to the function (it is part
// of the default Edge Function environment in Supabase projects).
//
// Deno runtime.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

        // Identify the caller from their JWT.
        const authHeader = req.headers.get("Authorization") ?? "";
        const userClient = createClient(supabaseUrl, anonKey, {
            global: { headers: { Authorization: authHeader } },
        });
        const { data: { user }, error: userErr } = await userClient.auth.getUser();
        if (userErr || !user) return jsonResponse({ error: "Unauthorized" }, 401);

        // Admin client to perform the destructive operations.
        const admin = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        // Delete the profile first. food_entries / quick_add_items / ai_suggestions
        // reference profiles(id) ON DELETE CASCADE, so they go with it.
        const { error: profileErr } = await admin
            .from("profiles")
            .delete()
            .eq("id", user.id);
        if (profileErr) {
            return jsonResponse({ error: "Failed to delete user data" }, 500);
        }

        // Finally remove the auth user itself.
        const { error: authErr } = await admin.auth.admin.deleteUser(user.id);
        if (authErr) {
            return jsonResponse({ error: "Failed to delete account" }, 500);
        }

        return jsonResponse({ success: true });
    } catch (_e) {
        return jsonResponse({ error: "internal" }, 500);
    }
});
