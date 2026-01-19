def process_type_pipeline(xlsx_path, cfg):
    sheet = cfg["sheet_name"]
    root_key = cfg["root_key"]
    stage_col = cfg["key_column"]
    value_cols = [c.strip() for c in cfg["value_columns"].split(",")]

    df = pd.read_excel(xlsx_path, sheet_name=sheet, dtype=str).fillna("")

    pipeline_name = sheet  # can be changed later to master-driven
    pipeline = {"stages": {}}

    for _, row in df.iterrows():
        stage = row.get(stage_col, "").strip()
        if not stage:
            continue

        stage_obj = pipeline["stages"].setdefault(stage, {"steps": []})

        step_obj = {
            "tab": row.get("Configuration File Sheet Name for the Step", "").strip(),
            "description": row.get("Step", "").strip(),
            "Permitted Action List": []
        }

        stage_obj["steps"].append(step_obj)

    return {root_key: {pipeline_name: pipeline}}
