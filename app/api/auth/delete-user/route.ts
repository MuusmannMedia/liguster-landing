import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// 1. Definer tilladelser (CORS) - så appen må snakke med serveren
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Tillad alle (nødvendigt for mobil apps)
  'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// 2. Håndter "Preflight" (Appen spørger først: "Må jeg?")
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function DELETE(request: Request) {
  try {
    // Hent "Adgangskortet" (Token) fra beskeden
    const authHeader = request.headers.get('Authorization');

    if (!authHeader) {
      return NextResponse.json(
        { error: 'Mangler adgangstoken' }, 
        { status: 401, headers: corsHeaders } // Husk headers ved fejl
      );
    }

    // Opret en Supabase-forbindelse som BRUGEREN (for at tjekke om token er ægte)
    const supabaseUser = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Tjek hvem brugeren er
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Ugyldigt login (Ikke logget ind)' }, 
        { status: 401, headers: corsHeaders }
      );
    }

    // Nu ved vi hvem brugeren er -> Brug ADMIN-nøglen til at slette ham
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
      return NextResponse.json(
        { error: deleteError.message }, 
        { status: 500, headers: corsHeaders }
      );
    }

    // SUCCES!
    return NextResponse.json(
      { message: 'Bruger slettet' },
      { status: 200, headers: corsHeaders } // Vigtigt: Send headers med retur
    );

  } catch (err: any) {
    return NextResponse.json(
      { error: 'Server fejl: ' + err.message }, 
      { status: 500, headers: corsHeaders }
    );
  }
}