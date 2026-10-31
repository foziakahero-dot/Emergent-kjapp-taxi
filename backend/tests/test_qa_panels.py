import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi import FastAPI
from fastapi.testclient import TestClient
from qa_panels import install_qa_panels


def test_qa_panels_share_api_origin_but_keep_assets_and_environment_scoped(tmp_path):
    for panel in ('admin-web', 'fleet-web', 'marketing-web'):
        directory = tmp_path / 'artifacts' / 'phase5-qa' / panel
        directory.mkdir(parents=True)
        (directory / 'index.html').write_text('<title>Fixture QA</title>')
    app = FastAPI()
    @app.get('/api/protected')
    async def api(): return {'fixture': 'API remains independent'}
    install_qa_panels(app, tmp_path, environment='qa')
    c = TestClient(app)
    for path in ('/api/qa-admin/', '/api/qa-fleet/', '/api/qa-fleet/drivers', '/api/qa-site/loyvehaver/soknad'):
        r = c.get(path)
        assert r.status_code == 200 and r.headers['cache-control'] == 'no-store'
        assert r.headers['x-robots-tag'].startswith('noindex')
    assert c.get('/api/qa-fleet/assets/missing.js').status_code == 404
    assert c.get('/api/qa-fleet/missing.json').status_code == 404
    assert c.get('/api/qa-site/assets/missing.js').status_code == 404
    assert c.get('/api/protected').json()['fixture'] == 'API remains independent'
    for env in ('production', 'development'):
        other = FastAPI(); install_qa_panels(other, tmp_path, environment=env)
        assert TestClient(other).get('/api/qa-admin/').status_code == 404
        assert TestClient(other).get('/api/qa-site/loyvehaver/soknad').status_code == 404
