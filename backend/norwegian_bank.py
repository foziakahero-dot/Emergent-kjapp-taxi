"""Normalize and validate Norwegian BBAN/IBAN; format checks do not verify ownership."""
import re


def normalize_bank_account(value):
    account = re.sub(r"[ .]", "", str(value or "")).upper()
    if account.startswith("NO"):
        if not re.fullmatch(r"NO[0-9]{13}", account):
            raise ValueError("Ugyldig norsk IBAN")
        rearranged = account[4:] + "2324" + account[2:4]
        if int(rearranged) % 97 != 1:
            raise ValueError("Ugyldig kontrollsiffer i norsk IBAN")
        account = account[4:]
    if not re.fullmatch(r"[0-9]{11}", account):
        raise ValueError("Oppgi et norsk kontonummer med 11 sifre, eller norsk IBAN")
    remainder = sum(int(d) * w for d, w in zip(account[:10], (5,4,3,2,7,6,5,4,3,2))) % 11
    check = (11 - remainder) % 11
    if check == 10 or int(account[-1]) != check:
        raise ValueError("Kontonummeret har ugyldig kontrollsiffer")
    return account
