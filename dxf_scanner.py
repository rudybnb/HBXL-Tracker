# DXF Scanner - ezdxf required (pip install ezdxf)
"""
DXF Fittings Scanner
====================
Parses DXF files to detect BLOCK INSERT entities representing electrical
and plumbing fittings. Maps block names to standard fitting types and
spatially assigns each fitting to rooms via point-in-polygon testing.

Usage:
    from dxf_scanner import scan_dxf_fittings

    result = scan_dxf_fittings("path/to/file.dxf", rooms)
"""

import os
import re
import json
from typing import Dict, List, Optional, Tuple
from collections import defaultdict

def _safe_str(s):
    """Encode string safely for Windows console output."""
    if isinstance(s, str):
        return s.encode('ascii', errors='replace').decode('ascii')
    return str(s)

try:
    import ezdxf
except ImportError:
    ezdxf = None


# =============================================
# BLOCK NAME → FITTING TYPE DICTIONARY
# =============================================
# Patterns are matched case-insensitively.
# Order matters: first match wins.

BLOCK_PATTERNS = [
    # Electrical — Lights
    (r"LIGHT",           "lights"),
    (r"LAMP",            "lights"),
    (r"LUMINAIRE",       "lights"),
    (r"DOWNLIGHT",       "lights"),
    (r"SPOTLIGHT",       "lights"),
    (r"PENDANT",         "lights"),
    (r"CEILING_ROSE",    "lights"),
    (r"BULKHEAD",        "lights"),

    # Electrical — Sockets
    (r"SOCKET",          "sockets"),
    (r"OUTLET",          "sockets"),
    (r"DB_SOCKET",       "sockets"),
    (r"DOUBLE_SOCKET",   "sockets"),
    (r"SINGLE_SOCKET",   "sockets"),
    (r"USB_SOCKET",      "sockets"),
    (r"FUSED_SPUR",      "sockets"),

    # Electrical — Switches
    (r"SWITCH",          "switches"),
    (r"DIMMER",          "switches"),
    (r"2_GANG",          "switches"),
    (r"1_GANG",          "switches"),

    # Electrical — Extractor Fans
    (r"FAN",             "extractor_fans"),
    (r"EXTRACTOR",       "extractor_fans"),
    (r"EXTRACT",         "extractor_fans"),
    (r"VENT_FAN",        "extractor_fans"),

    # Electrical — Smoke / Fire
    (r"SMOKE",           "smoke_alarms"),
    (r"FIRE_ALARM",      "smoke_alarms"),
    (r"DETECTOR",        "smoke_alarms"),
    (r"CO_ALARM",        "smoke_alarms"),

    # Electrical — Data
    (r"DATA",            "data_points"),
    (r"CAT[56]",         "data_points"),
    (r"ETHERNET",        "data_points"),
    (r"RJ45",            "data_points"),

    # Electrical — TV
    (r"TV",              "tv_points"),
    (r"AERIAL",          "tv_points"),
    (r"COAX",            "tv_points"),
    (r"SATELLITE",       "tv_points"),

    # Plumbing — Radiators
    (r"RAD",             "radiators"),
    (r"RADIATOR",        "radiators"),
    (r"TOWEL_RAIL",      "radiators"),

    # Plumbing — Sanitaryware (mapped to waste_points for counting)
    (r"WC",              "waste_points"),
    (r"TOILET",          "waste_points"),
    (r"BASIN",           "waste_points"),
    (r"SINK",            "waste_points"),
    (r"BATH",            "waste_points"),
    (r"SHOWER",          "waste_points"),
    (r"SHWR",            "waste_points"),
    (r"BIDET",           "waste_points"),

    # Plumbing — Hot water points
    (r"HOT_WATER",       "hot_points"),
    (r"HWS",             "hot_points"),
    (r"BOILER",          "hot_points"),

    # Plumbing — Cold water points
    (r"CWS",             "cold_points"),
    (r"STOPCOCK",        "cold_points"),
]

# Layers Fallback
LAYER_PATTERNS = [
    (r"LIGHT",           "lights"),
    (r"SOCKET",          "sockets"),
    (r"POWER",           "sockets"),
    (r"ELECTRICAL",      "electrical_unknown"), # Generic — NOT sockets
    (r"DATA",            "data_points"),
    (r"FIRE",            "smoke_alarms"),
    (r"ALARM",           "smoke_alarms"),
    (r"RADIATOR",        "radiators"),
    (r"HEATING",         "radiators"),
    (r"PLUMBING",        "waste_points"),
    (r"SANITARY",        "waste_points"),
]

# Pre-compile all patterns
_COMPILED_PATTERNS = [(re.compile(p, re.IGNORECASE), fitting) for p, fitting in BLOCK_PATTERNS]
_COMPILED_LAYERS = [(re.compile(p, re.IGNORECASE), fitting) for p, fitting in LAYER_PATTERNS]


# =============================================
# FITTING TYPE KEYS (blank template)
# =============================================
FITTING_KEYS = [
    "lights", "sockets", "switches", "extractor_fans",
    "smoke_alarms", "data_points", "tv_points",
    "hot_points", "cold_points", "waste_points", "radiators",
    "electrical_unknown"
]


def _empty_fittings() -> dict:
    """Return a zeroed fittings dict."""
    return {k: 0 for k in FITTING_KEYS}


# =============================================
# BLOCK NAME MATCHING
# =============================================

def classify_block(block_name: str, layer_name: str = "") -> Optional[str]:
    """
    Match a DXF block name against the pattern dictionary.
    If no match, try matching the layer name.
    """
    upper_name = block_name.upper().strip()
    
    # 1. Check Block Name
    for pattern, fitting_type in _COMPILED_PATTERNS:
        if pattern.search(upper_name):
            return fitting_type
            
    # 2. Check Layer Name
    if layer_name:
        upper_layer = layer_name.upper().strip()
        for pattern, fitting_type in _COMPILED_LAYERS:
            if pattern.search(upper_layer):
                return fitting_type
                
    return None


# =============================================
# POINT-IN-POLYGON (ray casting)
# =============================================

def _point_in_polygon(x: float, y: float, polygon: list) -> bool:
    """Ray-casting point-in-polygon test."""
    inside = False
    n = len(polygon)
    j = n - 1
    for i in range(n):
        xi, yi = polygon[i][0], polygon[i][1]
        xj, yj = polygon[j][0], polygon[j][1]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside


# =============================================
# CORE SCANNER
# =============================================

def extract_inserts_from_dxf(dxf_path: str) -> List[dict]:
    """Parse a DXF file and extract all INSERT entities."""
    if ezdxf is None:
        raise ImportError("ezdxf is not installed.")
    
    try:
        doc = ezdxf.readfile(dxf_path, encoding='utf-8')
    except:
        doc = ezdxf.readfile(dxf_path, encoding='latin-1')
    
    msp = doc.modelspace()
    inserts = []
    for entity in msp:
        if entity.dxftype() == "INSERT":
            block_name = entity.dxf.name
            insert_point = entity.dxf.insert
            layer = entity.dxf.layer
            fitting_type = classify_block(block_name, layer)
            
            inserts.append({
                "block_name": block_name,
                "x": round(float(insert_point.x), 4),
                "y": round(float(insert_point.y), 4),
                "layer": layer,
                "fitting_type": fitting_type
            })
    return inserts

def scan_dxf_fittings(dxf_path: str, rooms: List[dict], negate_y: bool = True) -> dict:
    """Main entry point for scanning fittings into rooms."""
    all_inserts = extract_inserts_from_dxf(dxf_path)
    matched = [ins for ins in all_inserts if ins["fitting_type"] is not None]
    
    per_room = {}
    for room in rooms:
        # Expected room format: { "id": "...", "name": "...", "polygon": [{x,y}, ...] }
        # Convert list of dicts to list of tuples if needed
        poly_raw = room.get("polygon", [])
        if isinstance(poly_raw, str):
            poly_raw = json.loads(poly_raw)
        
        poly = [(p['x'], p['y']) for p in poly_raw]
        
        rid = str(room.get("id"))
        per_room[rid] = {
            "room_id": rid,
            "room_name": room.get("name", "Unknown"),
            "fittings": _empty_fittings(),
            "has_fittings": False,
            "source": "DXF_AUTO"
        }

        for ins in matched:
            x = ins["x"]
            y = -ins["y"] if negate_y else ins["y"]
            
            if _point_in_polygon(x, y, poly):
                ftype = ins["fitting_type"]
                per_room[rid]["fittings"][ftype] += 1
                per_room[rid]["has_fittings"] = True

    return {
        "status": "success",
        "total_inserts": len(all_inserts),
        "total_matched": len(matched),
        "per_room": per_room
    }
