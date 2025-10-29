import ast
import json
import pandas as pd

def parse_str_to_dict(val):
    """
    Convert a string like '{"generic": {"key": "value"}}' into a dict.
    Handles both JSON and Python literal formats safely.
    Returns the original value if not convertible.
    """
    if not isinstance(val, str):
        return val
    
    text = val.strip()
    if not text:
        return val
    
    # Fast check — must start with { or [
    if not (text.startswith("{") or text.startswith("[")):
        return val

    # Try JSON parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Fallback: Python literal eval
    try:
        return ast.literal_eval(text)
    except Exception:
        return val
