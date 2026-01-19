import pandas as pd
import json

EXCEL_FILE = "input.xlsx"

def parse_text_only(sheet_df):
    value = sheet_df.iloc[0, 0]
    return value.strip() if isinstance(value, str) else ""

def parse_row_based_nested(sheet_df):
    headers = list(sheet_df.columns)
    key_col = headers[0]
    value_cols = headers[1:]

    result = {}
    for _, row in sheet_df.iterrows():
        key = row[key_col]
        if pd.isna(key):
            continue
        result[str(key)] = value_cols
    return result

def build_json():
    master = pd.read_excel(EXCEL_FILE, sheet_name="Master_Config")

    final_json = {}

    for _, row in master.iterrows():
        sheet_name = row["SheetName"]
        structure = row["StructureType"]
        root_key = row["RootKey"]

        sheet_df = pd.read_excel(EXCEL_FILE, sheet_name=sheet_name)

        if structure == "TEXT_ONLY":
            final_json[root_key] = parse_text_only(sheet_df)

        elif structure == "ROW_BASED_NESTED":
            final_json[root_key] = parse_row_based_nested(sheet_df)

    return final_json

if __name__ == "__main__":
    output = build_json()
    print(json.dumps(output, separators=(",", ":")))
