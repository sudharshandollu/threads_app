import pandas as pd
import json

# ---------------- TYPE 1 ----------------
def process_type_1(xlsx, sheet):
    df = pd.read_excel(xlsx, sheet_name=sheet, header=None)
    return df.iat[0, 0] if not df.empty else ""


# ---------------- TYPE 2 ----------------
def process_type_2(xlsx, sheet):
    df = pd.read_excel(xlsx, sheet_name=sheet)
    key_col = df.columns[0]
    value_cols = list(df.columns[1:])

    result = {}
    for _, row in df.iterrows():
        key = row[key_col]
        if pd.isna(key):
            continue
        result[str(key)] = value_cols
    return result


# ---------------- TYPE 3 (INTENTIONALLY SEMANTIC) ----------------
def process_type_3_pipelines(xlsx, sheet):
    df = pd.read_excel(xlsx, sheet_name=sheet).fillna("")

    pipelines = {}

    for _, row in df.iterrows():
        pipeline = row["Pipeline"].strip()
        stage = row["Stage"].strip()

        step = {
            "tab": row["StepTab"].strip(),
            "description": row["StepDescription"].strip(),
            "Permitted Action List": (
                [v.strip() for v in row["PermittedActionList"].split(",")]
                if row["PermittedActionList"] else []
            )
        }

        pipelines \
            .setdefault(pipeline, {}) \
            .setdefault("stages", {}) \
            .setdefault(stage, {}) \
            .setdefault("steps", []) \
            .append(step)

    return pipelines


# ---------------- MASTER DISPATCHER ----------------
def build_final_json(xlsx):
    master = pd.read_excel(xlsx, sheet_name="Master").fillna("")
    final = {}

    for _, row in master.iterrows():
        sheet = row["sheet_name"]
        stype = row["sheet_type"]
        root = row["root_key"]

        if stype == "TYPE_1":
            final[root] = process_type_1(xlsx, sheet)

        elif stype == "TYPE_2":
            final[root] = process_type_2(xlsx, sheet)

        elif stype == "TYPE_3":
            final[root] = process_type_3_pipelines(xlsx, sheet)

    return final


# ---------------- RUN ----------------
if __name__ == "__main__":
    result = build_final_json("input.xlsx")
    print(json.dumps(result, separators=(",", ":")))
