import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function DELETE(request: Request) {
  try {
    // 1. Hent "Adgangskortet" (Token) fra beskeden
    const authHeader = request.headers.get('Authorization');

    if (!authHeader) {
      return NextResponse.json({ error: 'Mangler adgangstoken' }, { status: 401 });
    }

    // 2. Opret en Supabase-forbindelse som BRUGEREN (for at tjekke om token er ægte)
    const supabaseUser = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: authHeader }, // Vi sender kortet videre til Supabase
        },
      }
    );

    // Tjek hvem brugeren er
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Ugyldigt login (Ikke logget ind)' }, { status: 401 });
    }

    // 3. Nu ved vi hvem brugeren er -> Brug ADMIN-nøglen til at slette ham
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!, 
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
      user.id
    );

    if (deleteError) {
      console.error("Sletningsfejl:", deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Bruger slettet' });

  } catch (err: any) {
    return NextResponse.json({ error: 'Server fejl: ' + err.message }, { status: 500 });
  }
}