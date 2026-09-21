# KJAPP AI Assistent

AI Assistent er en superadmin-funksjon i adminpanelet. Alle kall går gjennom FastAPI; nettleseren får aldri en leverandørnøkkel.

## Miljøvariabler

Sett disse i backend-miljøet (Render/Netlify/Vercel server-miljøet som kjører FastAPI), ikke i `admin-web`:

```env
KJAPP_AI_PROVIDER=byteplus
BYTEPLUS_API_KEY=<server-only key>
BYTEPLUS_MODEL=<BytePlus ModelArk endpoint/model>
BYTEPLUS_BASE_URL=https://ark.ap-southeast.bytepluses.com/api/v3

# Valgfrie fremtidige leverandører
OPENAI_API_KEY=<server-only key>
OPENAI_MODEL=gpt-4o
ANTHROPIC_API_KEY=<server-only key>
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# Vises når en samtale starter
KJAPP_PRODUCTION_VERSION=66d85b84
KJAPP_STAGING_VERSION=<staging build eller commit>

# Valgfritt ved lokal utvikling. Standard er prosjektroten over backend/
KJAPP_PROJECT_ROOT=C:\path\to\Emergent-kjapp-taxi
```

`KJAPP_AI_PROVIDER` velger standardleverandør. Superadmin kan bytte leverandør i chatten, men en leverandør uten servernøkkel svarer med en kontrollert konfigurasjonsfeil.

## API og lagring

Backend oppretter indeksene `admin_ai_conversations`, `admin_ai_messages`, `admin_ai_audit` og `admin_ai_change_requests` ved oppstart. Hver samtale er eid av den innloggede superadmin-kontoen. Alle andre adminroller får `403` fra alle AI-ruter, selv om de kjenner URL-en.

Prosjektfiler som legges ved velges fra en backend-generert filiste. Hemmelige kataloger, byggartefakter, avhengighetskataloger og nøkkelfiler blir blokkert, og vedlegg begrenses i størrelse før de sendes til leverandøren.

## Verifisering

```powershell
cd admin-web
npm ci
npm run build
npx tsc --noEmit
```

Backend må startes med de vanlige KJAPP-variablene (`MONGO_URL`, `DB_NAME`, `JWT_SECRET` osv.). Test med en konto med `role=superadmin`: åpne «AI Assistent», opprett en samtale og send en kort melding. Kontroller at svaret ligger i chatten og at dokumentene får nye rader i de fire AI-collectionene.
