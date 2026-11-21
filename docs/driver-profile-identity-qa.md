# Driver profile and licence check

The driver chooses either a manual review or a hosted document check. With profile matching enabled, the Driver app explains the comparison and asks for an affirmative action. New hosted sessions request a driving licence and a matching selfie. Older clients can complete their existing document flow.

The webhook checks its signature and environment, retrieves the canonical session, and checks that its report verifies both a driving licence and a selfie. The report must belong to this session. A restricted Stripe key must be allowed to read these sensitive Identity results and create temporary file links. The selfie link expires after 25 seconds. Images are read in memory, with a 5 MiB limit. The comparison does not create a face collection. Keep request bodies and temporary URLs out of monitoring. Review vendor processing, retention, deletion and legal basis before using real driver data.

SNAR checks ownership and document type for both registered files. Amazon Rekognition in eu-west-1 compares the verified selfie with the account's profile image and the uploaded driving licence separately. Both target images must be supported images with a single face and must pass the configured similarity threshold of 99. Evaluate false matches and false rejections in a representative, consented pilot before using this threshold. PDF, ambiguous images or a mismatch go to human review. A provider failure is retryable. Replacing a bound photo invalidates automatic confirmation for operational use. Driver approval and the professional permit review are separate.

## QA activation and acceptance

The existing Stripe Identity test setup and a QA-only IAM role limited to rekognition:DetectFaces and rekognition:CompareFaces are prerequisites. Set QA_DRIVER_PROFILE_MATCH_ENABLED=true only in the approved QA service. Live uses a separate SNAR_DRIVER_PROFILE_MATCH_ENABLED flag, off by default. QA results do not grant a verified live identity. Provider processing can incur charges. Review supplier pricing and the expected volume before activation.

Run a hosted test with the signed Driver build. Verify the return to the app, delayed webhook delivery, duplicate events, rejection of a changed file, a mismatch, manual review, and an unavailable provider. Record whether the sandbox actually supplies usable biometric images. Use a separately authorized pilot for real accuracy measurement. Never record photos, file URLs, provider session IDs or face scores in the QA log.

Disabling the environment flag stops new comparisons. Review affected pending applications using the manual flow. Existing results remain subject to SNAR's retention and recheck policy.
