"""
Vercel Serverless Function Entry Point for KrishiOpt AI
Exposes the Flask app as a WSGI application for Vercel Python runtime.
"""

import os
import sys

# Ensure repository root is in sys.path so backend and data packages resolve
root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from backend.app import app

# WSGI Middleware for Vercel
# Ensures that whether Vercel passes PATH_INFO with or without the /api prefix,
# Flask's @app.route('/api/...') rules match properly.
class VercelPathHandler:
    def __init__(self, wsgi_app):
        self.wsgi_app = wsgi_app

    def __call__(self, environ, start_response):
        path = environ.get('PATH_INFO', '')
        # If Vercel stripped /api from PATH_INFO, restore it for Flask route matching
        if path and not path.startswith('/api'):
            environ['PATH_INFO'] = '/api' + path
        return self.wsgi_app(environ, start_response)

# Wrap Flask with path handler
app.wsgi_app = VercelPathHandler(app.wsgi_app)
