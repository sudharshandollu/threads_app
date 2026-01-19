def set_path(root, path_parts, value):
    cur = root

    for i, part in enumerate(path_parts):
        is_list = part.endswith("[]")
        key = part[:-2] if is_list else part
        is_last = i == len(path_parts) - 1

        # If current container is not dict, force convert
        if not isinstance(cur, dict):
            return  # safety exit; malformed row

        if is_list:
            # overwrite scalar with list if needed
            if key in cur and not isinstance(cur[key], list):
                cur[key] = []

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
                # overwrite scalar with dict if needed
                if key in cur and not isinstance(cur[key], dict):
                    cur[key] = {}

                cur.setdefault(key, {})
                cur = cur[key]
