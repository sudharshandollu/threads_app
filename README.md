import pandas as pd

def set_path(root, path_parts, value):
    cur = root

    for i, part in enumerate(path_parts):
        is_list = part.endswith("[]")
        key = part[:-2] if is_list else part

        is_last = i == len(path_parts) - 1

        if is_list:
            cur.setdefault(key, [])
            if is_last:
                cur[key].append(value)
                return
            else:
                if not cur[key] or not isinstance(cur[key][-1], dict):
                    cur[key].append({})
                cur = cur[key][-1]
        else:
            if is_last:
                cur[key] = value
            else:
                cur.setdefault(key, {})
                cur = cur[key]


def process_type_3(xlsx_path, sheet_name, root_key):
    df = pd.read_excel(xlsx_path, sheet_name=sheet_name, dtype=str).fillna("")

    result = {}

    for _, row in df.iterrows():
        row_root = {}

        for col in df.columns:
            val = row[col].strip()
            if not val:
                continue

            parts = col.split(".")

            # remove root key if present
            if parts[0] == root_key:
                parts = parts[1:]

            # split comma values into list
            if "," in val:
                val = [v.strip() for v in val.split(",")]

            set_path(row_root, parts, val)

        # merge row_root into result
        for k, v in row_root.items():
            if k not in result:
                result[k] = v
            else:
                # merge lists and dicts safely
                for sk, sv in v.items():
                    if isinstance(sv, list):
                        result[k].setdefault(sk, []).extend(sv)
                    elif isinstance(sv, dict):
                        result[k].setdefault(sk, {}).update(sv)

    return {root_key: result}
