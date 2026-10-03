"""Produce a reviewable, source-backed matrix without inventing device evidence."""
import json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
# screen, component path, design section, action, route, API wrappers, fix/device acceptance
H='frontend/app/(app)/home.tsx'; B='frontend/app/booking/[tripId].tsx'; R='frontend/app/receipt/[tripId].tsx'; P='frontend/app/(app)/profile.tsx'
rows=[
('Splash','frontend/app/index.tsx','Splash.tsx','Enter app / recover session','/','authApi.me','Cold launch/font/icon screenshot acceptance'),
('Permissions','frontend/app/permissions.tsx','Permissions','Grant location/notifications','/permissions','api.post','Grant/reject on physical iOS and Android'),
('Login','frontend/app/login.tsx','Login.tsx','Password login / 2FA','/login','authApi.login','Authenticated runtime + rejected credentials/2FA'),
('Google login','frontend/src/lib/socialSignIn.native.ts','Login.tsx','Open Google chooser / cancel','/login','authApi.nativeConfig authApi.nativeSignIn','P0: provision OAuth clients/package signing; physical login'),
('Apple login','frontend/src/components/AppleSignInButton.ios.tsx','Login.tsx','Sign in / cancel / private relay','/login','authApi.nativeSignIn','Physical iOS capability/private relay/existing account'),
('Register','frontend/app/register.tsx','Login.tsx','Register + terms','/register','authApi.register','Unique email/password/consent runtime acceptance'),
('Forgot password','frontend/app/forgot-password.tsx','Not supplied as separate Make screen','Request reset link','/forgot-password','authApi.forgotPassword','P0: email sender and actual delivery'),
('Reset password','frontend/app/reset-password/[token].tsx','Not supplied as separate Make screen','Validate token / submit new password','/reset-password/[token]','authApi.checkResetToken authApi.resetPassword','Real email deep link, expired token, session invalidation'),
('Legal consent','frontend/app/legal-consent.tsx','Login/setup consent','Read terms / accept','/legal-consent','authApi.acceptLegal','Native links + server persistence'),
('Home/map',H,'Browse/LiveMap','GPS, recenter, pan, nearby cars','/(app)/home','carsApi.nearby placesApi.reverse tripsApi.active','P0: Mapbox token + native map acceptance'),
('Destination search',H,'Browse','Search and select destination','/(app)/home','placesApi.search','Search latency/zero-results/offline acceptance'),
('Recent/favorite locations',H,'Browse','Select real recent or saved destination','/(app)/home','tripsApi.list mePlacesApi.list placesApi.list','Verify real customer history; no demo places'),
('Saved locations','frontend/app/saved-places.tsx','Profile addresses','Create/edit/remove address','/saved-places','mePlacesApi.list mePlacesApi.add mePlacesApi.update mePlacesApi.remove','CRUD and cross-customer runtime acceptance'),
('Ride categories',H,'Browse; latest tier SVGs','Select SNAR / SNAR XL / Premium','/(app)/home','tripsApi.estimate','Latest source has Standard/Comfort/Premium/Van/accessible; primary mapping retained. Realistic category renders not supplied/complete'),
('Price estimate',H,'Browse/Confirm','Estimate route and fare','/(app)/home','tripsApi.estimate','Road geometry/time/fare/service-area live acceptance'),
('Booking review',H,'Confirm','Review fare/stops/payment','/(app)/home','tripsApi.estimate paymentApi.list','Native keyboard/sheet/layout + exact server fare'),
('Booking submit',H,'Confirm','Submit once / recover lost response','/booking/[tripId]','tripsApi.request tripsApi.active','Real rider/driver runtime; duplicate/lost response'),
('Driver matching',B,'Matching','Wait / cancel / minimize','/booking/[tripId]','tripsApi.get tripsApi.cancelPreview tripsApi.cancel','Real available driver accepts; no timed fake state'),
('Driver approaching',B,'Arriving/DriverCard','View driver/car/plate/ETA','/booking/[tripId]','tripsApi.get tripDriverPhotoSource','Real location/heading/ETA/photo on device'),
('Driver arrived',B,'Arriving','Confirm actual assigned driver','/booking/[tripId]','tripsApi.get','Real at_pickup status and push'),
('Active/in-ride',B,'InRide','View route / update destination','/booking/[tripId]','tripsApi.get tripsApi.changeDestination','Driver-controlled start/end/route progress device E2E'),
('Customer-driver chat','frontend/src/components/ChatSheet.tsx','Arriving/InRide chat action','Read/send actual messages','/booking/[tripId]','messagesApi.list messagesApi.send','Two-party runtime/retry/keyboard acceptance'),
('Safety/SOS/share trip',B,'InRide/Profile safety','Emergency call / report / share link','/booking/[tripId]','safetyApi.log safetyApi.shareLink','Native call/share and trip-link permissions'),
('Active trip minimize',B,'InRide/Arriving; added required minimized view','Minimize to persistent card','/booking/[tripId]','tripsApi.get','Component minimize/reopen/completion verified; device layout/tab sequence pending'),
('Active trip reopen',H,'Browse/active trip recovery','Recover on focus/foreground and reopen','/(app)/home -> /booking/[tripId]','tripsApi.active','Cold restart/background/tab recovery with real active trip'),
('Payment methods','frontend/app/payment-methods.tsx','Wallet/Profile payment','List/add/remove card','/payment-methods','paymentApi.list paymentApi.cardSetup paymentApi.cardSetupStatus paymentApi.remove paymentApi.nativeConfig','P0: Stripe test keys; setup callback device acceptance'),
('Google Pay','frontend/src/lib/nativePayment.native.ts','Wallet','Confirm Google Pay test payment','/receipt/[tripId]','paymentApi.nativeConfig paymentApi.nativeIntent paymentApi.nativeStatus','P0: keys + enable test Google Pay; Android physical payment'),
('Apple Pay','frontend/src/lib/nativePayment.native.ts','Wallet','Confirm Apple Pay test payment','/receipt/[tripId]','paymentApi.nativeConfig paymentApi.nativeIntent paymentApi.nativeStatus','P0: Merchant ID/certificate/entitlement; iOS physical payment'),
('Stripe card','frontend/src/lib/nativePayment.native.ts','Wallet/Receipt','Present PaymentSheet test card','/receipt/[tripId]','paymentApi.nativeConfig paymentApi.nativeIntent paymentApi.nativeStatus','P0: keys; webhook success/duplicate/status reconciliation'),
('Receipt',R,'Receipt','Read server receipt / pay / email','/receipt/[tripId]','tripsApi.get paymentApi.checkout paymentApi.checkoutStatus','Real settled trip/receipt; email sender missing'),
('Rating',R,'Receipt','Submit score/comment','/receipt/[tripId]','tripsApi.rate','Duplicate/backend persistence/clean home acceptance'),
('Activity/history','frontend/app/(app)/history.tsx','Activity','List/filter and open real trip','/(app)/history','tripsApi.list','Completed/live/cancelled route runtime acceptance'),
('Profile',P,'Profile','Open details / Google link / logout','/(app)/profile','authApi.linkGoogle authApi.logout','Identity error branding updated; live link/device layout pending'),
('Customer profile picture','frontend/src/components/CustomerPhoto.tsx','Profile avatar','Camera/gallery/crop/upload/replace/delete','/(app)/profile','customerProfileApi.uploadPhoto customerProfileApi.photoSource customerProfileApi.deletePhoto','Protected backend tests PASS; camera and authenticated native Image/device reload pending'),
('Privacy/GDPR export/delete','frontend/src/components/CustomerProfileDetails.tsx','Profile privacy','Export actual JSON / confirmed erasure','/(app)/profile -> /settings','gdprApi.export gdprApi.delete','Photo included and auth-scoped in tests; OS export sharing/erasure acceptance pending'),
('Settings','frontend/app/settings.tsx','Profile safety/privacy/language','Read/update server settings / export/delete','/settings','settingsApi.get settingsApi.update gdprApi.export gdprApi.delete','Network error/retry and update rollback implemented; persistence device acceptance'),
('Support','frontend/src/components/CustomerSupport.tsx','Support','AI question / human escalation','/(app)/profile','aiApi.chat api.post','Replies/ticket IDs use server; reward redemption unavailable, explicitly reported by UI'),
('Notifications/push','frontend/src/lib/nativeRuntime.ts','Permissions','Register OS push token and react to events','all authenticated Customer routes','api.post','Physical FCM/APNs permission/token/delivery/background acceptance'),
('Offline/network errors','frontend/src/context/AuthContext.tsx','No dedicated Make screen','Retry cold session / reconcile trip/payment','all Customer routes','authApi.me tripsApi.active paymentApi.nativeStatus','Transient session failure preserves token; physical outage sequence still pending'),
('Profile setup','frontend/app/profile-setup.tsx','ProfileSetup','Open payment/address setup and finish','/profile-setup','paymentApi.list mePlacesApi.list','Real onboarding resume/required data runtime acceptance'),
('Wallet','frontend/app/(app)/wallet.tsx','Wallet','Inspect balance/receipts and add card','/(app)/wallet','paymentApi.list','Configure Stripe; compare device Wallet screenshot'),
('Assist','frontend/app/(app)/assist.tsx','Support AI','Send text/voice destination request','/(app)/assist','aiApi.chat aiApi.transcribe','Actual model/transcription permissions/runtime acceptance'),
('Payment callbacks','frontend/app/payment/success.tsx','No dedicated Make screen','Reconcile Checkout result','/payment/success and /payment/cancel','paymentApi.checkoutStatus paymentApi.cardSetupStatus','Native external-browser return/deep-link/cancel acceptance'),
]
contracts=json.loads((ROOT/'docs/CUSTOMER_API_CONTRACT_20261004.json').read_text())
actions=json.loads((ROOT/'docs/CUSTOMER_ACTION_INVENTORY_20261004.json').read_text())
matrix=[]
for name,file,design,action,route,wrappers,fix in rows:
    text=(ROOT/file).read_text()
    def evidence(pattern):
        return [{'line':i,'source':line.strip()[:220]} for i,line in enumerate(text.splitlines(),1) if re.search(pattern,line)][:10]
    tokens=wrappers.split();apis=[c for c in contracts if c['wrapper'] in tokens and (not c['wrapper'].startswith('api.') or any(x.get('file')==file for x in c.get('mobile_callers',[]) if isinstance(x,dict)))]
    matrix.append({'SCREEN':name,'COMPONENT':file,'USER ACTION':action,'ROUTE':route,'API CALL':wrappers,'BACKEND ENDPOINT':sorted({c['method']+' /api'+r['path'] for c in apis for r in c['backend']}),'AUTH REQUIREMENT':'public onboarding/OS or provider login' if name in ['Splash','Permissions','Login','Google login','Apple login','Register','Forgot password','Reset password'] else 'customer bearer session; backend role/ownership gates where applicable','LOADING STATE':evidence(r'loading|Loading|busy|Busy|ActivityIndicator|Loader|pending|Pending'),'EMPTY STATE':evidence(r'empty|Empty|Ingen |ingen |length === 0|\.length\s*\?'),'ERROR STATE':evidence(r'error|Error|catch|alert|Alert'),'OFFLINE/NETWORK STATE':'Source evidence in ERROR STATE; physical network interruption unverified','SUCCESS STATE':'Server result/navigation in source; authenticated device sequence unverified','FIGMA PARITY':{'status':'PARTIAL','reference':design,'source':'latest attached Revolutionary AI Taxi App Design (3).zip; src/apps/CustomerApp.tsx / src/screens','limitation':'No native screenshot/device comparison; additional real backend states are requirements beyond prototype'},'STATUS':'PARTIAL','FIX REQUIRED':fix,'ACTION INVENTORY IDS':[a['testID'] for a in actions if a['file']==file]})
(ROOT/'docs/CUSTOMER_SCREEN_MATRIX_20261004.json').write_text(json.dumps(matrix,indent=2)+'\n')
md=['# Customer screen audit — 4 October 2026','', 'All rows are PARTIAL until actual native/device acceptance. Source existence is never a PASS. Full requested columns, source lines and API/auth mappings are in the companion JSON.','', '| Screen | Route | Figma section | Remaining acceptance |','|---|---|---|---|']
for r in matrix: md.append('| '+ ' | '.join([r['SCREEN'],r['ROUTE'],r['FIGMA PARITY']['reference'],r['FIX REQUIRED']]).replace('\n',' ')+' |')
(ROOT/'docs/CUSTOMER_SCREEN_MATRIX_20261004.md').write_text('\n'.join(md)+'\n')
print(json.dumps({'screens':len(matrix)}))
