"""Explicitly authorized synthetic QA intake smoke test. Never targets production.

Run with --submit-fixture --run-id <unique-test-label>. No secrets are printed.
The five images say TEST ONLY and are never approved as real documents.
"""
import argparse
import hashlib
import io
import json
from datetime import datetime, timezone

import httpx
from PIL import Image, ImageDraw


def mod11(prefix, weights):
    check = (11 - sum(int(d) * w for d, w in zip(prefix, weights)) % 11) % 11
    return prefix + str(check) if check != 10 else None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--submit-fixture', action='store_true', required=True)
    parser.add_argument('--run-id', required=True)
    args = parser.parse_args()
    base = 'https://api-qa.snarapp.no'
    report = {'environment': 'qa', 'run_id': args.run_id, 'checks': {}}
    with httpx.Client(base_url=base, timeout=30) as client:
        ready = client.get('/api/ready'); ready.raise_for_status()
        assert ready.json()['release']['environment'] == 'qa'
        assert ready.json()['checks']['qa_database_isolated'] is True
        seed = int(hashlib.sha256(args.run_id.encode()).hexdigest()[:8], 16) % 99999
        org = None
        while org is None:
            org = mod11('000' + f'{seed:05d}', [3, 2, 7, 6, 5, 4, 3, 2]); seed = (seed + 1) % 99999
        payload = {'company_name': 'SNAR QA TEST ONLY ' + args.run_id,
                   'org_number': org, 'contact_name': 'SYNTHETIC QA FIXTURE',
                   'contact_email': 'delivered@resend.dev', 'contact_phone': '00000000',
                   'license_count': 1, 'vehicle_count': 1, 'bank_account': '00000000019',
                   'notes': 'FIKTIV QA-SOKNAD. IKKE GODKJENN. Ingen virkelig virksomhet, bank eller loyve.',
                   'accepted_terms': True}
        draft = client.post('/api/fleet-applications/draft', json=payload)
        draft.raise_for_status()
        token = draft.json()['upload_token']
        report['checks']['draft'] = draft.status_code
        missing = client.post('/api/fleet-applications/submit', json={'upload_token': token, 'documents': {}})
        assert missing.status_code == 400
        report['checks']['missing_documents_rejected'] = missing.status_code
        documents = {}
        for kind in ('firmaattest', 'loyvebevis', 'vognkort', 'forsikring', 'bank'):
            im = Image.new('RGB', (900, 300), 'white'); draw = ImageDraw.Draw(im)
            draw.text((25, 35), 'SNAR QA - SYNTHETIC TEST ONLY - NOT VALID', fill='red', font_size=28)
            draw.text((25, 100), kind + ' / ' + args.run_id, fill='black', font_size=24)
            draw.text((25, 160), 'NO REAL COMPANY, LICENCE, PERSON OR BANK DATA', fill='black', font_size=20)
            content = io.BytesIO(); im.save(content, format='PNG')
            filename = 'QA-TEST-ONLY-' + kind + '.png'
            uploaded = client.post('/api/upload/public', data={'application_token': token},
                                   files={'file': (filename, content.getvalue(), 'image/png')})
            uploaded.raise_for_status(); data = uploaded.json()
            documents[kind] = {'path': data['storage_path'], 'original_filename': filename, 'content_type': 'image/png'}
            report['checks']['upload_' + kind] = uploaded.status_code
        submitted = client.post('/api/fleet-applications/submit', json={'upload_token': token, 'documents': documents})
        submitted.raise_for_status(); assert submitted.json()['status'] == 'pending'
        report['checks']['submitted_status'] = submitted.json()['status']
        report['checks']['confirmation_email_status'] = submitted.json().get('confirmation_email_status')
        retry = client.post('/api/fleet-applications/submit', json={'upload_token': token, 'documents': documents})
        assert retry.status_code == 410
        report['checks']['duplicate_submit_rejected'] = retry.status_code
        forbidden = client.get('/api/files/' + documents['firmaattest']['path'])
        assert forbidden.status_code == 401
        report['checks']['unauthenticated_document_blocked'] = forbidden.status_code
        report['submitted_at'] = datetime.now(timezone.utc).isoformat()
    print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    main()
