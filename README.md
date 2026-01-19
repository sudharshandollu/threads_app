import pandas as pd

def process_type_3(xlsx_path, sheet_name, root_key):
    df = pd.read_excel(xlsx_path, sheet_name=sheet_name, dtype=str).fillna("")

    result = {}

    for _, row in df.iterrows():

        # -------- 1. Identify KEY column (single-part header)
        key_col = None
        key_val = None

        for col in df.columns:
            if "." not in col and "[]" not in col:
                val = row[col].strip()
                if val:
                    key_col = col
                    key_val = val
                    break

        if not key_val:
            continue

        # Always start from a dict container
        root_container = result.setdefault(key_val, {})

        # -------- 2. Process remaining columns
        for col in df.columns:
            if col == key_col:
                continue

            val = row[col].strip()
            if not val:
                continue

            parts = col.split(".")[1:] if col.startswith(key_col + ".") else col.split(".")
            cur = root_container  # GUARANTEED dict

            for i, part in enumerate(parts):
                is_list = part.endswith("[]")
                key = part[:-2] if is_list else part
                is_last = i == len(parts) - 1

                if is_list:
                    if key not in cur or not isinstance(cur[key], list):
                        cur[key] = []

                    if is_last:
                        # value may be scalar or comma-list
                        if "," in val:
                            cur[key].append([v.strip() for v in val.split(",")])
                        else:
                            cur[key].append(val)
                    else:
                        if not cur[key] or not isinstance(cur[key][-1], dict):
                            cur[key].append({})
                        cur = cur[key][-1]

                else:
                    if is_last:
                        cur[key] = val
                    else:
                        if key not in cur or not isinstance(cur[key], dict):
                            cur[key] = {}
                        cur = cur[key]

    return {root_key: result}
