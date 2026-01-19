import pandas as pd
import json

# -----------------------------
# Utilities
# -----------------------------
def read_master_config(xlsx_path):
    df = pd.read_excel(xlsx_path, sheet_name="Master_Config", dtype=str)
    return df.fillna("")

def non_empty(val):
    return val is not None and str(val).strip() != ""

# -----------------------------
# TYPE_1: Description sheet
# -----------------------------
def process_type_1(xlsx_path, cfg):
    sheet = cfg["sheet_name"]
    root_key = cfg["root_key"]
    cell = cfg["key_column"]  # e.g., A1

    df = pd.read_excel(xlsx_path, sheet_name=sheet, header=None)
    row = int(cell[1:]) - 1
    col = ord(cell[0].upper()) - ord("A")

    value = str(df.iat[row, col]).strip()
    return {root_key: value}

# -----------------------------
# TYPE_5: Key → headers_except_key
# -----------------------------
def process_type_5(xlsx_path, cfg):
    sheet = cfg["sheet_name"]
    root_key = cfg["root_key"]
    key_col = cfg["key_column"]
    include_rule = cfg["include_rule"]

    df = pd.read_excel(xlsx_path, sheet_name=sheet, dtype=str).fillna("")

    headers = list(df.columns)
    value_headers = [h for h in headers if h != key_col]

    result = {}

    for _, row in df.iterrows():
        key = row[key_col]
        if include_rule == "not_empty" and not non_empty(key):
            continue
        result[str(key)] = value_headers

    return {root_key: result}

# -----------------------------
# Dispatcher
# -----------------------------
def build_json_from_master(xlsx_path):
    master = read_master_config(xlsx_path)
    final_json = {}

    for _, cfg in master.iterrows():
        if cfg.get("enabled", "true").lower() == "false":
            continue

        sheet_type = cfg["sheet_type"]

        if sheet_type == "TYPE_1":
            out = process_type_1(xlsx_path, cfg)

        elif sheet_type == "TYPE_5":
            out = process_type_5(xlsx_path, cfg)

        else:
            raise ValueError(f"Unsupported sheet_type: {sheet_type}")

        final_json.update(out)

    return final_json

# -----------------------------
# Run
# -----------------------------
if __name__ == "__main__":
    excel_file = "input.xlsx"

    output = build_json_from_master(excel_file)

    with open("output.json", "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, separators=(",", ":"))

    print(json.dumps(output, indent=2))
