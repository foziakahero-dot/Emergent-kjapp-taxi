# Driver screen evidence

Reference captures: original SNAR V10 prototype, **light theme**, reduced motion, 370×824 inner phone canvas. The prototype defaults Driver to dark but also provides this light variant. Dark-mode implementation remains outstanding.

Implementation captures: actual React Native login/profile routes rendered through React Native Web in Chromium at 370×824. Auth, safe areas and backend responses are fixtures. OS status bar/notch/home indicator and the navigator's dock are omitted in the isolated implementation harness. The original external avatar image could not load; actual implementation uses the account's private photo or initials, not a stock person.

The profile row geometry and spacing were compared with the source's computed styles; compact profile and login layout were inspected. Differences in authentication (password versus the prototype's SMS/BankID), real document status, supplied vehicle/account data, font weight and native rendering remain validation limits. These captures do not certify pixel-identical native apps.


Ninth checkpoint adds original dark Driver profile/offline and actual dark frames. Offline implementation fixture omits map and dock; the warm map source comparison is not reused as dark evidence. Profile uses actual fixture data/initials; source remote photos are unavailable. These are React Native Web captures, not device certification.
