def dicts_to_md_table(dict_list):
    """
    Convert list of dicts with same structure into a compact markdown table string.
    Example:
        [{"col1": "a", "col2": "b"}, {"col1": "x", "col2": "y"}]
        ->
        "| col1 | col2 |\n| a | b |\n| x | y |"
    """
    if not dict_list:
        return ""

    # Preserve column order of first dict
    cols = list(dict_list[0].keys())

    # Header
    header = "|" + "|".join(cols) + "|"

    # Rows
    rows = []
    for d in dict_list:
        row = "|" + "|".join(str(d.get(c, "")).replace("\n", " ") for c in cols) + "|"
        rows.append(row)

    # Combine all lines with \n
    return "\n".join([header] + rows)
