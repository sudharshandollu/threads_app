def dot_key_to_dict(dotted_key):
    """
    Examples:
      "Name.stage"               -> {"Name": {"stage": ""}}
      "steps[].tab"              -> {"steps": [{"tab": ""}]}
      "a.b.c[].d"                -> {"a": {"b": {"c": [{"d": ""}]}}}
      "a.b.c[].d.e"              -> {"a": {"b": {"c": [{"d": {"e": ""}}]}}}
    """

    parts = dotted_key.split(".")
    root = {}
    cur = root

    for i, part in enumerate(parts):
        is_list = part.endswith("[]")
        key = part[:-2] if is_list else part
        is_last = i == len(parts) - 1

        if is_list:
            cur[key] = []
            if is_last:
                cur[key].append("")
            else:
                new_obj = {}
                cur[key].append(new_obj)
                cur = new_obj
        else:
            if is_last:
                cur[key] = ""
            else:
                cur[key] = {}
                cur = cur[key]

    return root
