import pandas as pd
import json
import re

# ============================================================
# Utility helpers
# ============================================================

def non_empty(val):
    return val is not None and str(val).strip() != "" and str(val).strip().lower() != "nan"


def merge_dict(target, source):
    """
    Deep merge source into target
    - dict → recursive merge
    - list → extend
    - scalar → overwrite
    """
    for k, v in source.items():
        if k not in target:
            target[k] = v
        elif isinstance(v, dict) and isinstance(target[k], dict):
            merge_dict(target[k], v)
        elif isinstance(v, list) and isinstance(target[k], list):
            target[k].extend(v)
        else:
            target[k] = v


# ============================================================
# Header parsing (dot + list aware)
# ============================================================

def parse_header(header):
    """
    Examples:
      Name                         -> (['Name'], None, False)
      Name.stages                  -> (['Name','stages'], None, False)
      Name.stages.steps[tab]       -> (['Name','stages','steps'], 'tab', True)
      Name.stages.steps[field][]   -> (['Name','stages','steps'], 'field', True)
    """
    list_parts = re.findall(r"(.*?)\[(.*?)\]", header)
    base = header.split("[")[0]
    base_path = base.split(".")

    if list_parts:
        _, field = list_parts[-1]
        return base_path, field, True
    else:
        return base_path, None, False


# ============================================================
# TEXT_ONLY sheet processor
# ============================================================

def process_text_only(xlsx_path, sheet_name, root_key):
    df = pd.read_excel(xlsx_path, sheet_name=sheet_name, header=None)
    if df.empty:
        return {}
    value = df.iat[0, 0]
    return {root_key: str(value).strip() if non_empty(value) else ""}


# ============================================================
# TYPE_2: Key → headers_except_key
# ============================================================

def process_headers_except_key(xlsx_path, sheet_name, root_key, key_column):
    df = pd.read_excel(xlsx_path, sheet_name=sheet_name, dtype=str).fillna("")
    headers = list(df.columns)

    if key_column not in headers:
        raise ValueError(f"[{sheet_name}] key column '{key_column}' not found")

    value_headers = [h for h in headers if h != key_column]

    result = {}
    for _, row in df.iterrows():
        key = row[key_column]
        if not non_empty(key):
            continue
        result[str(key).strip()] = value_headers

    return {root_key: result}


# ============================================================
# PIPELINES / DOT-NOTATION GENERIC PROCESSOR
# ============================================================

def process_dot_notation_sheet(xlsx_path, sheet_name):
    df = pd.read_excel(xlsx_path, sheet_name=sheet_name, dtype=str).fillna("")
    headers = list(df.columns)

    final = {}

    for _, row in df.iterrows():
        row_context = {}

        for h in headers:
            val = row[h]
            if not non_empty(val):
                continue

            base_path, field, is_list = parse_header(h)

            # Root scalar (e.g. Name)
            if field is None and len(base_path) == 1:
                row_context[base_path[0]] = val
                continue

            cur = row_context
            for p in base_path[:-1]:
                cur = cur.setdefault(p, {})

            container = base_path[-1]

            if is_list:
                cur.setdefault(container, [])
                if field:
                    cur[container].append({field: val})
            else:
                cur[container] = val

        merge_dict(final, row_context)

    return final


# ============================================================
# MASTER DISPATCHER
# ============================================================

def build_final_json(xlsx_path):
    """
    Master_Config sheet columns expected:
      SheetName | StructureType | RootKey | (optional) KeyColumn
    """
    master = pd.read_excel(xlsx_path, sheet_name="Master_Config", dtype=str).fillna("")
    final = {}

    for _, row in master.iterrows():
        sheet = row["SheetName"]
        stype = row["StructureType"]
        root_key = row["RootKey"]
        key_col = row.get("KeyColumn", "").strip()

        if stype == "TEXT_ONLY":
            merge_dict(final, process_text_only(xlsx_path, sheet, root_key))

        elif stype == "HEADERS_EXCEPT_KEY":
            merge_dict(final, process_headers_except_key(
                xlsx_path, sheet, root_key, key_col
            ))

        elif stype == "DOT_NOTATION":
            merge_dict(final, {root_key: process_dot_notation_sheet(xlsx_path, sheet)})

        else:
            raise ValueError(f"Unknown StructureType: {stype}")

    return final


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":
    EXCEL_FILE = "input.xlsx"
    result = build_final_json(EXCEL_FILE)

    # Compact JSON (NO SPACES) – LLM friendly
    print(json.dumps(result, separators=(",", ":")))
