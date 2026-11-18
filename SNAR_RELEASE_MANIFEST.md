# SNAR – release-manifest, 18. november 2026

Dette dokumenterer observerte kilder og arbeid; det erklærer ikke en produksjonsrelease.

## 1. Kilder og deploy

| Komponent | SHA / identitet | Tilstand |
| --- | --- | --- |
| Backend QA-gren og live Render | afd2bfaf5a5afe6f706a4ed3488a19fdc759cf6a | Live, ingen ny deploy |
| Render service / deploy | srv-db61otlckfvc73bqp480 / dep-dblu4lt9fdbs73b756fg | Ikke suspendert, autoDeploy=no |
| Mobil QA / PR149 merge | 9e5aef948a2cba928d827267d1de7f0a6d5b8791 | Nyere enn siste bygg |
| PR150 opprinnelig head | 25e5b9b6c3430de9102594c53e40638edb0d46fe | Testet build/unit lokalt |
| PR150 ny testgate-commit | f989d9cd6a19c5eaccc36f142b2ce55921c5eb68 | Fast-forward, originalt arbeid bevart; ikke QA-merget |
| PR145 opprinnelig head | 8dc14f87249290241b3d09787ea24056095aa849 | Fokuserte baseline-/finansprober |
| PR151 sikkerhet/test-rettelse | 7f9f6c36480a6b32439e89b600925648683e831e | 107 lokale tester består |
| PR151 feature-merge | c6b19060477a2525409345f81dfd617163e234b8 | Til feature/snar-beta-launch-20261105, ikke QA |
| qa-bootstrap | c1203c73dff87910d3c6186e0bddd253e603129b | Historikk |
| launch/snar-v1-final-20261026 | 7cd4981aee6b95ed6777397d6e5e8f19147032b8 | Separat historisk gren |

## 2. Siste ferdige bygg – 17. november

Alle fire ble ferskt observert som Succeeded i Expo, med kilde `78a263c57d5c2e40af9f68b4b3271f4cb4a026c3`. De inneholder ikke PR149.

| App | Versjon | Build og lenke |
| --- | --- | --- |
| Customer Android | 1.0.1 (9), qa | [283d843c-f11a-45ff-a69e-e800b5d0526f](https://expo.dev/accounts/elitetransport/projects/kjapp/builds/283d843c-f11a-45ff-a69e-e800b5d0526f) |
| Driver Android | 1.0.2 (1), qa | [2b363a67-7709-4dcd-b1e6-807672b8a92a](https://expo.dev/accounts/elitetransport/projects/kjapp-driver/builds/2b363a67-7709-4dcd-b1e6-807672b8a92a) |
| Customer iOS | 1.0.1 (36), testflight-qa | [dcabf3fb-25d2-45b0-8fe7-46038a6cc48b](https://expo.dev/accounts/elitetransport/projects/kjapp/builds/dcabf3fb-25d2-45b0-8fe7-46038a6cc48b) |
| Driver iOS | 1.0.2 (17), testflight-qa | [7c01268a-ba7f-450a-9916-a6b01040b1a1](https://expo.dev/accounts/elitetransport/projects/kjapp-driver/builds/7c01268a-ba7f-450a-9916-a6b01040b1a1) |

Dette er build-detalj-/installasjonsoversikter, ikke påståtte direkte APK/IPA-lenker eller bevis for installasjon. Ingen ny APK/IPA er startet i denne økten fordi native preflight ennå ikke er bestått.

## 3. Jobber og innsendinger

1. [Ny native preflight](https://expo.dev/accounts/elitetransport/projects/kjapp/workflows/01a1f004-a489-755d-a0ef-e46cc98f6d93), kilde 9e5aef9, startet 18. november; står i Free Tier-kø. Ikke en build og ikke et testpass.
2. [Panel-CI 44375318630](https://github.com/foziakahero-dot/Emergent-kjapp-taxi/actions/runs/44375318630), commit f989d9c: begge jobber feilet før oppstart på kontoens fakturering.
3. Customer iOS submission `82aac091-de9a-45ba-8b1d-050d7e78127b` og Driver `b0ca5cb7-3f5e-4b3f-8874-cf28b06be1eb`: siste innsendingslogger oppgir manglende/utløpt Apple-avtale. Ingen avtale er akseptert og ingen ny innsending foretatt her.

## 4. Releasevakter

1. QA bruker Stripe TEST; live-belastning er ikke aktivert av arbeidet. QA/produksjon har separate godkjenninger.
2. Ny runner krever separerte backend-/mobil-SHA-er, riktig prosjekt/profil og faktisk APK-checksum. Et ferdig bygg er ikke fysisk testet før installert build er kontrollert.
3. Ingen produksjonsrollback er utført eller øvd i denne økten. Før QA-deploy registreres gjeldende Render-artifact og kompatibilitet; databaseendringer kan ikke rulles tilbake med et kode-deploy alene.
