import pandas as pd

def process_type_3(xlsx_path, sheet_name, root_key):
    df = pd.read_excel(xlsx_path, sheet_name=sheet_name, dtype=str).fillna("")

    result = {}

    for _, row in df.iterrows():

        # ---- 1. Identify the ROOT KEY (first path segment)
        key_value = None
        key_name = None

        for col in df.columns:
            parts = col.split(".")
            if len(parts) == 1 and row[col].strip():
                key_name = parts[0]
                key_value = row[col].strip()
                break

        if not key_value:
            continue

        root = result.setdefault(key_value, {})

        # ---- 2. Process remaining columns (skip the key column)
        for col in df.columns:
            if col == key_name:
                continue

            val = row[col].strip()
            if not val:
                continue

            parts = col.split(".")[1:]  # drop key name
            cur = root

            for i, part in enumerate(parts):
                is_list = part.endswith("[]")
                key = part[:-2] if is_list else part
                is_last = i == len(parts) - 1

                if is_list:
                    cur.setdefault(key, [])
                    if is_last:
                        # split comma values if needed
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
                        cur.setdefault(key, {})
                        cur = cur[key]

    return {root_key: result}
