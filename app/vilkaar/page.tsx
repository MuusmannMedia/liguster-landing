'use client';

import SiteHeader from '../../components/SiteHeader';
import SiteFooter from '../../components/SiteFooter';

export default function VilkaarPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0F141A]">
      <SiteHeader />

      <main className="flex-1 w-full max-w-3xl mx-auto px-6 py-12">
        
        {/* Titel */}
        <h1 className="text-3xl md:text-4xl font-black text-white mb-2">Brugervilkår for Liguster</h1>
        <p className="text-[#C7CED6] text-sm mb-10 font-medium">Senest opdateret: 3. december 2025</p>

        {/* Indhold */}
        <div className="space-y-8 text-[#E3E8EF] leading-relaxed text-base md:text-lg">
          
          <p>
            Ved at bruge Liguster-appen ("Tjenesten") accepterer du nedenstående vilkår og betingelser. Hvis du ikke kan acceptere disse vilkår, bør du ikke bruge Tjenesten.
          </p>

          {/* Generelt */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-3">Generelt</h2>
            <p className="mb-3">
              Liguster stilles til rådighed som en platform, hvor brugere kan oprette og se opslag, fx om hjælp, udlån eller genbrug mellem naboer. Liguster er udelukkende formidler af kontakten og er ikke part i aftaler mellem brugere. Vi påtager os ikke ansvar for indhold, kommunikation eller aftaler, der indgås som følge af brugen af Tjenesten.
            </p>
            <p>
              For at bruge Tjenesten skal du være fyldt 18 år.
            </p>
          </section>

          {/* Brugerindhold */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-3">Brugerindhold og rettigheder</h2>
            <p className="mb-3">
              Alt indhold, som lægges op af brugerne (tekst, billeder m.v.) er udelukkende den enkelte brugers ansvar.
            </p>
            <p className="mb-3">
              Når du uploader indhold til Liguster, bevarer du din ophavsret, men du giver os en ikke-eksklusiv, vederlagsfri ret til at vise, opbevare og gengive dette indhold som en del af Tjenestens funktioner (fx for at vise dit opslag til andre brugere).
            </p>
            <p className="mb-3">
              Du må ikke uploade eller dele indhold, som er ulovligt, krænkende, truende, diskriminerende, injurierende, krænkende for andres ophavsret, varemærker eller andre rettigheder, eller på anden vis i strid med god skik.
            </p>
            <p>
              Vi forbeholder os retten til – men er ikke forpligtet til – at fjerne indhold, som efter vores vurdering er upassende eller i strid med gældende lovgivning eller disse vilkår.
            </p>
          </section>

          {/* Eget ansvar */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-3">Brug af Tjenesten på eget ansvar</h2>
            <p className="mb-3">
              Brug af Liguster sker på eget ansvar. Du er selv ansvarlig for vurderingen af, om du ønsker at mødes med andre brugere, udlåne eller modtage genstande, eller indgå aftaler som følge af et opslag.
            </p>
            <p>
              Vi anbefaler, at du udviser almindelig sund fornuft og forsigtighed, når du møder andre brugere, fx ved at mødes på offentlige steder og ikke dele følsomme personlige oplysninger.
            </p>
          </section>

          {/* Konto */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-3">Konto og ophør</h2>
            <p>
              Du er ansvarlig for at holde dine login-oplysninger hemmelige. Du kan til enhver tid slette din konto og dine data via funktionen "Slet konto" under indstillinger i appen.
            </p>
          </section>

          {/* Ingen garanti */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-3">Ingen garanti</h2>
            <p className="mb-3">
              Vi bestræber os på, at Tjenesten er tilgængelig og fungerer stabilt, men vi kan ikke garantere uafbrudt adgang, fejlfrie funktioner eller at appen til enhver tid er opdateret.
            </p>
            <p>
              Tjenesten stilles til rådighed "som den er" uden nogen form for garanti, hverken udtrykkelig eller underforstået, herunder – men ikke begrænset til – garantier for egnethed til et bestemt formål.
            </p>
          </section>

          {/* Ansvarsbegrænsning */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-3">Ansvarsbegrænsning</h2>
            <p className="mb-2">
              I det omfang loven tillader det, fraskriver Liguster sig ethvert ansvar for direkte og indirekte tab, der måtte opstå som følge af din brug af Tjenesten, herunder men ikke begrænset til:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-white/90">
              <li>Tab eller skade på genstande, der udlånes eller modtages</li>
              <li>Konflikter eller tvister mellem brugere</li>
              <li>Tab af data eller afbrydelser i adgang til Tjenesten</li>
              <li>Brug af informationer hentet fra andres opslag</li>
            </ul>
            <p className="mt-3">
              Intet i disse vilkår har til formål at begrænse ansvar i tilfælde, hvor dette ikke kan begrænses efter ufravigelig lovgivning.
            </p>
          </section>

          {/* Misbrug */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-3">Misbrug og blokering</h2>
            <p>
              Hvis du misbruger Tjenesten, fx ved at dele ulovligt eller groft krænkende indhold, forsøge svindel, chikanere andre brugere eller lignende, kan vi uden varsel begrænse eller lukke din adgang til Tjenesten.
            </p>
          </section>

          {/* Ændringer */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-3">Ændringer af vilkår</h2>
            <p>
              Vi kan til enhver tid opdatere disse vilkår for brugen af Tjenesten. Ved væsentlige ændringer vil vi, så vidt muligt, give besked i appen. Den seneste version vil altid være tilgængelig i appen.
            </p>
          </section>

          {/* Kontakt */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-3">Kontakt</h2>
            <p>
              Har du spørgsmål til disse vilkår eller til Tjenesten, er du velkommen til at kontakte os på:<br />
              <a href="mailto:kontakt@liguster-app.dk" className="text-blue-400 hover:underline font-bold mt-1 inline-block">kontakt@liguster-app.dk</a>
            </p>
          </section>

        </div>
      </main>

      <SiteFooter />
    </div>
  );
}