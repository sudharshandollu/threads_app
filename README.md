    row["linked_issues"] = "; ".join(link_strs)

    # ── Capture all remaining fields (Details, Label Manager, Other tabs, etc.)
    KNOWN_FIELDS = {
        "project", "issuetype", "status", "priority", "resolution",
        "summary", "description", "creator", "reporter", "assignee",
        "created", "updated", "resolutiondate", "duedate", "labels",
        "components", "fixVersions", "versions", "subtasks", "attachment",
        "comment", "watches", "votes", "issuelinks", "timeoriginalestimate",
        "timespent", "parent", "sprint", "story_points",
        "customfield_10028", "customfield_10014", "customfield_10020",
    }

    for field_key, value in f.items():
        if field_key in KNOWN_FIELDS:
            continue

        if value is None or value == "" or value == []:
            row[field_key] = ""
        elif isinstance(value, dict):
            row[field_key] = (
                value.get("name")
                or value.get("value")
                or value.get("displayName")
                or clean(value)
            )
        elif isinstance(value, list):
            parts = []
            for item in value:
                if isinstance(item, dict):
                    parts.append(
                        item.get("name")
                        or item.get("value")
                        or item.get("displayName")
                        or str(item)
                    )
                else:
                    parts.append(str(item))
            row[field_key] = ", ".join(parts)
        else:
            row[field_key] = clean(value)

    return row



    # Rename customfield_* columns to human-readable names
    resp = client.session.get(f"{client.api}/field")
    resp.raise_for_status()
    field_map = {f["id"]: f["name"] for f in resp.json()}
    df_issues_new.rename(columns=field_map, inplace=True)
