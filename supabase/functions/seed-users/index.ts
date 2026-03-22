import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const users = [
    { email: 'adil@codpakistan.com', password: 'codpakistan#123', full_name: 'Adil', role: 'admin' },
    { email: 'bader@codpakistan.com', password: 'codpakistan#123', full_name: 'Bader', role: 'editor' },
    { email: 'anwar@codpakistan.com', password: 'codpakistan#123', full_name: 'Anwar', role: 'editor' },
  ];

  const results = [];

  for (const u of users) {
    // Check if user exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existing = existingUsers?.users?.find(x => x.email === u.email);
    
    if (existing) {
      // Update password
      await supabaseAdmin.auth.admin.updateUserById(existing.id, { password: u.password });
      // Ensure role exists
      await supabaseAdmin.from('user_roles').upsert(
        { user_id: existing.id, role: u.role },
        { onConflict: 'user_id,role' }
      );
      results.push({ email: u.email, status: 'updated password', id: existing.id });
      continue;
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { full_name: u.full_name },
    });

    if (error) {
      results.push({ email: u.email, status: 'error', error: error.message });
      continue;
    }

    // Assign role
    await supabaseAdmin.from('user_roles').insert({ user_id: data.user.id, role: u.role });
    results.push({ email: u.email, status: 'created', id: data.user.id });
  }

  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
