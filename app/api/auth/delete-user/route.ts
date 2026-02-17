import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const defaultAllowedOrigins = [
  'https://www.liguster-app.dk',
  'https://liguster-app.dk',
];

const allowedOrigins = (
  process.env.ALLOWED_ORIGINS?.split(',').map((origin) => origin.trim()).filter(Boolean) ||
  defaultAllowedOrigins
);

const corsHeaders = (origin: string | null) => {
  const allowOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    Vary: 'Origin',
  };
};

// 2. Håndter "Preflight" (Appen spørger først: "Må jeg?")
export async function OPTIONS(request: Request) {
  return NextResponse.json({}, { headers: corsHeaders(request.headers.get('origin')) });
}

export async function DELETE(request: Request) {
  const responseHeaders = corsHeaders(request.headers.get('origin'));

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'Mangler server-konfiguration for Supabase' },
        { status: 500, headers: responseHeaders }
      );
    }

    // Hent "Adgangskortet" (Token) fra beskeden
    const authHeader = request.headers.get('Authorization');

    if (!authHeader) {
      return NextResponse.json(
        { error: 'Mangler adgangstoken' }, 
        { status: 401, headers: responseHeaders } // Husk headers ved fejl
      );
    }

    // Opret en Supabase-forbindelse som BRUGEREN (for at tjekke om token er ægte)
    const supabaseUser = createClient(
      supabaseUrl,
      supabaseAnonKey,
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
        { status: 401, headers: responseHeaders }
      );
    }

    // Nu ved vi hvem brugeren er -> Brug ADMIN-nøglen til at slette ham
    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
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
        { status: 500, headers: responseHeaders }
      );
    }

    // SUCCES!
    return NextResponse.json(
      { message: 'Bruger slettet' },
      { status: 200, headers: responseHeaders } // Vigtigt: Send headers med retur
    );

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Ukendt fejl';
    return NextResponse.json(
      { error: 'Server fejl: ' + message }, 
      { status: 500, headers: responseHeaders }
    );
  }
}
