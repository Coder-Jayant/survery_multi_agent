"""
tests/conftest.py
Pytest configuration — sets up sys.path so tests can import project modules.
"""

import sys
import os

# Ensure project root is on sys.path regardless of where pytest is invoked from
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
