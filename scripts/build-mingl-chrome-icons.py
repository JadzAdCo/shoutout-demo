#!/usr/bin/env python3
"""Mingl Search chrome tiles.

Delegates to scripts/build-mingl-v3-logo.py — clean vector master from the
owner v3 pack (white glossy people, teal/purple trim, Min white / gl teal,
no orbit / no outer square). Site Chrome owns the enclosing tile.

The old iOS app-icon extract (images/chrome/official/mingl-app-icon.png)
is kept as provenance only and is no longer the Search face.
"""
from __future__ import annotations

import runpy
from pathlib import Path

V3 = Path(__file__).resolve().parent / "build-mingl-v3-logo.py"


def main() -> None:
    runpy.run_path(str(V3), run_name="__main__")


if __name__ == "__main__":
    main()
