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

            cur = row_context
            for p in base_path[:-1]:
                if p not in cur:
                    cur[p] = {}
                elif not isinstance(cur[p], dict):
                    cur[p] = {"_value": cur[p]}
                cur = cur[p]

            container = base_path[-1]

            if is_list:
                if container not in cur or not isinstance(cur.get(container), list):
                    cur[container] = []
                if field:
                    cur[container].append({field: val})
            else:
                if container in cur and isinstance(cur[container], dict):
                    cur[container]["_value"] = val
                else:
                    cur[container] = val

        merge_dict(final, row_context)

    return final
