'use client';

import SiteHeader from '../../components/SiteHeader';
import SiteFooter from '../../components/SiteFooter';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0F141A]">
      <SiteHeader />

      <main className="flex-1 w-full max-w-3xl mx-auto px-6 py-12">
        
        {/* Titel Sektion */}
        <h1 className="text-3xl md:text-4xl font-black text-white mb-2">Privatlivspolitik for Liguster</h1>
        <p className="text-[#C7CED6] text-sm mb-10 font-medium">Senest opdateret: 3. december 2025</p>

        {/* Indhold */}
        <div className="space-y-6 text-[#E3E8EF] leading-relaxed text-base md:text-lg">
          <p>
            Denne privatlivspolitik beskriver, hvordan Liguster ("vi", "os" eller "vores") behandler personoplysninger i forbindelse med din brug af Liguster-appen og tilhørende tjenester (samlet kaldet "Tjenesten").
          </p>

          <p>
            Vi går op i at beskytte dit privatliv og behandler kun personoplysninger i overensstemmelse med gældende databeskyttelseslovgivning, herunder databeskyttelsesforordningen (GDPR).
          </p>

          {/* Dataansvarlig */}
          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">Dataansvarlig</h2>
            <p>Dataansvarlig for behandlingen af dine personoplysninger er:</p>
            <p className="mt-2 pl-4 border-l-4 border-gray-600">
              Liguster (udvikler: Morten Muusmann)<br />
              E-mail: <a href="mailto:kontakt@liguster-app.dk" className="text-blue-400 hover:underline">kontakt@liguster-app.dk</a>
            </p>
          </section>

          {/* Hvilke oplysninger */}
          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">Hvilke oplysninger vi indsamler</h2>
            <p>Når du bruger Liguster, kan vi behandle følgende kategorier af personoplysninger om dig:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li><strong className="text-white">Kontodata:</strong> navn, e-mailadresse og adgangskode (krypteret) i forbindelse med oprettelse og brug af konto.</li>
              <li><strong className="text-white">Profil- og indholdsdata:</strong> oplysninger og tekst, du selv vælger at skrive i dine opslag.</li>
              <li><strong className="text-white">Billeder og medier:</strong> vi indsamler og gemmer de billeder, du uploader (fx fotos af genstande), når du giver appen adgang til dit kamera eller fotobibliotek.</li>
              <li><strong className="text-white">Lokationsdata:</strong> ca.-position (fx by/område) eller mere præcis placering, når du aktivt giver appen lov til at bruge din lokation. Lokation bruges til at vise opslag i nærheden. Du kan til enhver tid slå lokation fra i dine enhedsindstillinger.</li>
              <li><strong className="text-white">Tekniske data:</strong> enhedstype, operativsystem, app-version, anonymiserede logdata og fejlrapporter. Dette bruges til drift, fejlfinding og forbedring af Tjenesten.</li>
              <li><strong className="text-white">Kommunikation:</strong> beskeder, du sender via appens beskedfunktion, samt support-henvendelser, som du sender til os via e-mail.</li>
            </ul>
          </section>

          {/* Formål */}
          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">Formål og behandlingsgrundlag</h2>
            <p>Vi behandler dine personoplysninger til følgende formål:</p>
            
            <div className="space-y-4 mt-4">
              <div>
                <strong className="text-white block mb-1">a) Oprettelse og drift af din brugerprofil</strong>
                For at du kan oprette en konto, logge ind og bruge appens funktioner.<br />
                <em className="text-gray-400 text-sm">Behandlingsgrundlag: GDPR art. 6, stk. 1, litra b (opfyldelse af kontrakt).</em>
              </div>

              <div>
                <strong className="text-white block mb-1">b) Visning af opslag og kontakt mellem brugere</strong>
                For at kunne vise dine og andre brugeres opslag (inklusiv billeder), håndtere beskeder og gøre det muligt at komme i kontakt lokalt.<br />
                <em className="text-gray-400 text-sm">Behandlingsgrundlag: GDPR art. 6, stk. 1, litra b.</em>
              </div>

              <div>
                <strong className="text-white block mb-1">c) Lokationsbaserede funktioner</strong>
                For at vise relevante opslag i nærheden af dig, når du har givet tilladelse til brug af lokation.<br />
                <em className="text-gray-400 text-sm">Behandlingsgrundlag: GDPR art. 6, stk. 1, litra b og f (legitim interesse i at levere relevant indhold).</em>
              </div>

              <div>
                <strong className="text-white block mb-1">d) Drift, sikkerhed og forbedring</strong>
                For at sikre stabil drift, forebygge misbrug og forbedre appen, fx ved brug af logdata og fejlrapporter.<br />
                <em className="text-gray-400 text-sm">Behandlingsgrundlag: GDPR art. 6, stk. 1, litra f (legitim interesse).</em>
              </div>

              <div>
                <strong className="text-white block mb-1">e) Kommunikation og support</strong>
                For at kunne besvare henvendelser fra dig og give dig besked om vigtige ændringer, fx opdatering af vilkår.<br />
                <em className="text-gray-400 text-sm">Behandlingsgrundlag: GDPR art. 6, stk. 1, litra b og f.</em>
              </div>
            </div>
          </section>

          {/* Modtagere */}
          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">Modtagere og brug af databehandlere</h2>
            <p>Vi deler ikke dine personoplysninger med andre virksomheder til deres egen markedsføring.</p>
            <p className="mt-2">Vi benytter udvalgte databehandlere til drift af appen, fx:</p>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li>Hosting- og databaseleverandør</li>
              <li>Tjenester til udsendelse af push-beskeder</li>
              <li>Fejllogning og performance-overvågning</li>
            </ul>
            <p className="mt-2">Disse databehandlere behandler kun oplysninger på vores vegne og efter instruks og må ikke bruge dem til egne formål.</p>
          </section>

          {/* Tredjelande */}
          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">Overførsel til tredjelande</h2>
            <p>Nogle databehandlere kan være placeret uden for EU/EØS. I sådanne tilfælde sikrer vi, at der foreligger et gyldigt overførselsgrundlag, fx EU-Kommissionens standardkontraktbestemmelser (SCC).</p>
          </section>

          {/* Opbevaring */}
          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">Opbevaringsperiode</h2>
            <p>Vi opbevarer dine personoplysninger, så længe det er nødvendigt i forhold til de formål, de er indsamlet til, eller så længe vi er retligt forpligtet hertil.</p>
            <p className="mt-2">Hvis du sletter din konto, vil vi slette eller anonymisere dine persondata inden for 30 dage, medmindre vi er retligt forpligtet til at gemme dem længere (fx pga. bogføringsregler).</p>
          </section>

          {/* Rettigheder */}
          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">Dine rettigheder</h2>
            <p>Du har efter databeskyttelsesreglerne en række rettigheder i forhold til vores behandling af oplysninger om dig:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Ret til indsigt i de oplysninger, vi behandler om dig</li>
              <li>Ret til berigtigelse (rettelse) af urigtige oplysninger</li>
              <li>Ret til sletning ("retten til at blive glemt")</li>
              <li>Ret til begrænsning af behandling</li>
              <li>Ret til indsigelse mod behandling</li>
              <li>Ret til dataportabilitet (udlevering af data i et struktureret format)</li>
            </ul>
            <p className="mt-4">
              Hvis du vil gøre brug af dine rettigheder, kan du kontakte os på: <a href="mailto:kontakt@liguster-app.dk" className="text-blue-400 hover:underline">kontakt@liguster-app.dk</a>
            </p>
            <p className="mt-2">
              Du har også ret til at klage til Datatilsynet, hvis du er utilfreds med den måde, vi behandler dine oplysninger på. Se <a href="https://www.datatilsynet.dk" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">www.datatilsynet.dk</a> for kontaktinfo.
            </p>
          </section>

          {/* Børn */}
          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">Børns brug af Tjenesten</h2>
            <p>Liguster er målrettet brugere over 18 år. Hvis vi bliver opmærksomme på, at vi har indsamlet personoplysninger om et barn, vil vi slette oplysningerne hurtigst muligt.</p>
          </section>

          {/* Ændringer */}
          <section>
            <h2 className="text-2xl font-bold text-white mt-8 mb-4">Ændringer i denne privatlivspolitik</h2>
            <p>Vi kan opdatere denne privatlivspolitik fra tid til anden. Den seneste version vil altid være tilgængelig i appen. Ved væsentlige ændringer vil vi, så vidt muligt, give dig tydelig besked i appen.</p>
          </section>

        </div>
      </main>

      <SiteFooter />
    </div>
  );
}