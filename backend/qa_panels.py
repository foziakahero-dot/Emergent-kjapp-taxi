"""Serve the QA panel exports alongside the QA API, with no production proxy."""
from pathlib import Path
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.staticfiles import StaticFiles


class PanelFiles(StaticFiles):
    async def get_response(self, path, scope):
        try:
            response = await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            # Fleet uses browser history. Missing assets must remain real 404s.
            if exc.status_code != 404 or Path(path).suffix or path.startswith('assets/'):
                raise
            response = await super().get_response('index.html', scope)
        response.headers['X-Robots-Tag'] = 'noindex, nofollow, noarchive'
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['Cache-Control'] = 'no-store'
        response.headers['Referrer-Policy'] = 'same-origin'
        return response


def install_qa_panels(app, root, *, environment):
    if environment != 'qa':
        return
    for slug, directory in [('qa-admin', 'admin-web'), ('qa-fleet', 'fleet-web'), ('qa-site', 'marketing-web')]:
        path = Path(root) / 'artifacts' / 'phase5-qa' / directory
        if (path / 'index.html').is_file():
            app.mount('/api/' + slug, PanelFiles(directory=path, html=True), name=slug)
