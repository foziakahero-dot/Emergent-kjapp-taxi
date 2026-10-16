"""SNAR-owned compatibility namespace.

The project previously depended on the Emergent LLM proxy.  The local modules in
this package intentionally shadow that dependency and route SNAR AI directly to
OpenAI while preserving the tiny interface used by backend/server.py.
"""
