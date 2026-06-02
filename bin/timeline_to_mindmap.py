#!/usr/bin/env python3
"""
Kill Chain Mind Map Generator

Connects to Splunk, pulls flagged events from the KVStore for one or more indexes,
and builds an XMind mind map as a chronological kill chain.

The generated XMind does not include index information.

Output: .xmind file compatible with XMind 2020+
Dependencies: pip install splunk-sdk
"""

import argparse
import json
import sys
import uuid
import zipfile
from datetime import datetime
from xml.etree.ElementTree import Element, SubElement, tostring

import splunklib.client as client
import splunklib.results as results


# MITRE tactic colors background fill
TACTIC_COLORS = {
    "Reconnaissance": "#4FC3F7",
    "Resource Development": "#4DB6AC",
    "Initial Access": "#FF8A65",
    "Execution": "#E57373",
    "Persistence": "#BA68C8",
    "Privilege Escalation": "#F06292",
    "Defense Evasion": "#FFD54F",
    "Credential Access": "#FF8A65",
    "Discovery": "#64B5F6",
    "Lateral Movement": "#81C784",
    "Collection": "#A1887F",
    "Command and Control": "#90A4AE",
    "Exfiltration": "#7986CB",
    "Impact": "#EF5350",
    "Uncategorized": "#BDBDBD",
}


# Pool of colors for hosts, cycled if more hosts than colors
HOST_COLOR_POOL = [
    "#26A69A",
    "#42A5F5",
    "#AB47BC",
    "#EC407A",
    "#FFA726",
    "#66BB6A",
    "#5C6BC0",
    "#EF5350",
    "#29B6F6",
    "#8D6E63",
    "#FFCA28",
    "#78909C",
]


def uid():
    return str(uuid.uuid4())


def splunk_quote(value):
    """
    Escape a value for safe use inside Splunk double quotes.
    """
    return str(value).replace("\\", "\\\\").replace('"', '\\"')


def normalize_indexes(index_args):
    """
    Accept all these forms:

      --index idx1 idx2
      --index idx1,idx2
      --index idx1 --index idx2

    Returns a de-duplicated list while preserving order.
    """
    indexes = []

    for item in index_args:
        for part in item.split(","):
            part = part.strip()
            if part:
                indexes.append(part)

    return list(dict.fromkeys(indexes))


def build_index_search(indexes):
    """
    Build Splunk search filter for real Splunk indexes.

    Example:
      (index="idx1" OR index="idx2")
    """
    return "(" + " OR ".join(f'index="{splunk_quote(idx)}"' for idx in indexes) + ")"


def build_idx_lookup_filter(indexes):
    """
    Build lookup filter for the flagged_events lookup/KVStore idx field.

    Example:
      (idx="idx1" OR idx="idx2")
    """
    return "(" + " OR ".join(f'idx="{splunk_quote(idx)}"' for idx in indexes) + ")"


def styled_topic(title, bg_color=None, children=None, notes=None):
    topic = {
        "id": uid(),
        "title": title,
    }

    props = {"fo:font-size": "14pt"}

    if bg_color:
        props["svg:fill"] = bg_color

    topic["style"] = {
        "id": uid(),
        "properties": props,
    }

    if children:
        topic["children"] = {"attached": children}

    if notes:
        topic["notes"] = {"plain": {"content": notes}}

    return topic


def build_content_xml(root_title, sheet_title):
    xmap = Element(
        "xmap-content",
        {
            "xmlns": "urn:xmind:xmap:xmlns:content:2.0",
            "xmlns:fo": "http://www.w3.org/1999/XSL/Format",
            "xmlns:svg": "http://www.w3.org/2000/svg",
            "xmlns:xhtml": "http://www.w3.org/1999/xhtml",
            "xmlns:xlink": "http://www.w3.org/1999/xlink",
            "version": "2.0",
        },
    )

    sheet = SubElement(xmap, "sheet", {"id": uid()})

    title_el = SubElement(sheet, "title")
    title_el.text = sheet_title

    topic = SubElement(sheet, "topic", {"id": uid()})

    topic_title = SubElement(topic, "title")
    topic_title.text = root_title

    return '<?xml version="1.0" encoding="UTF-8" standalone="no"?>' + tostring(
        xmap,
        encoding="unicode",
    )


def connect_splunk(host, port, username, password):
    service = client.connect(
        host=host,
        port=port,
        username=username,
        password=password,
        autologin=True,
    )

    print(f"[+] Connected to Splunk at {host}:{port}")
    return service


def pull_flagged_events(service, indexes):
    """
    Pull flagged events for multiple indexes.

    Flow:
      1. Read flagged_events where flag=1 and idx is in the selected indexes.
      2. Extract IDs.
      3. Search original Splunk events across all selected indexes by uid.
      4. Merge host/source/time into the flagged metadata.
      5. Remove idx from the final event object so it is not used in the XMind output.
    """
    idx_filter = build_idx_lookup_filter(indexes)

    query_kv = (
        "| inputlookup flagged_events where flag=1"
        f" | search {idx_filter}"
        " | table id, description, mitre_tactic, status, added_when, idx"
    )

    print("[+] Pulling KVStore entries...")
    job = service.jobs.oneshot(query_kv, output_mode="json", count=0)
    reader = results.JSONResultsReader(job)

    kv_entries = {}
    uids = []

    for item in reader:
        if isinstance(item, dict):
            uid_val = item.get("id", "")
            if uid_val:
                kv_entries[uid_val] = item
                uids.append(uid_val)

    if not uids:
        print(f"[+] No flagged events found for indexes: {', '.join(indexes)}")
        return []

    print(f"[+] Found {len(uids)} KVStore entries")

    uid_filter = "(" + " OR ".join(f'uid="{splunk_quote(u)}"' for u in uids) + ")"
    index_search = build_index_search(indexes)

    query_events = (
        f"search {index_search} {uid_filter}"
        " | stats latest(host) as host, latest(source) as source, latest(_time) as event_time by uid"
        " | table uid, host, source, event_time"
    )

    print("[+] Enriching with host/source from original events...")
    job2 = service.jobs.oneshot(query_events, output_mode="json", count=0)
    reader2 = results.JSONResultsReader(job2)

    event_details = {}

    for item in reader2:
        if isinstance(item, dict):
            uid_val = item.get("uid", "")
            if uid_val:
                event_details[uid_val] = item

    merged = []

    for uid_val, kv in kv_entries.items():
        ev = dict(kv)
        details = event_details.get(uid_val, {})

        ev["host"] = details.get("host", "N/A")
        ev["source"] = details.get("source", "N/A")
        ev["event_time"] = details.get("event_time", ev.get("added_when", "0"))

        # Do not keep index information in final event object.
        ev.pop("idx", None)

        merged.append(ev)

    print(f"[+] Merged {len(merged)} events")
    return merged


def get_event_time(ev):
    for field in ["event_time", "added_when"]:
        val = ev.get(field)

        if val:
            try:
                return float(val)
            except (ValueError, TypeError):
                pass

    return 0


def format_timestamp(epoch_val):
    try:
        ts = float(epoch_val)
        return datetime.fromtimestamp(ts).strftime("%Y-%m-%d %H:%M:%S")
    except (ValueError, TypeError, OSError):
        return str(epoch_val) if epoch_val else "Unknown"


def build_host_color_map(events):
    """
    Assign a stable color to each host.
    """
    hosts = sorted(set(ev.get("host", "N/A") for ev in events))
    color_map = {}

    for i, host in enumerate(hosts):
        color_map[host] = HOST_COLOR_POOL[i % len(HOST_COLOR_POOL)]

    return color_map


def build_event_topic(ev, host_colors):
    description = ev.get("description", "").strip()
    host = ev.get("host", "N/A")
    source = ev.get("source", "N/A")
    timestamp = format_timestamp(get_event_time(ev))

    title = timestamp
    host_color = host_colors.get(host)

    details = []

    if description:
        details.append(styled_topic(description))

    details.append(styled_topic(host, bg_color=host_color))
    details.append(styled_topic(source))

    topic = styled_topic(title, children=details)
    topic["structureClass"] = "org.xmind.ui.logic.right"

    return topic


def group_consecutive_tactics(events):
    groups = []
    current_tactic = None
    current_group = []

    for ev in events:
        tactic = ev.get("mitre_tactic", "").strip() or "Uncategorized"

        if tactic != current_tactic:
            if current_group:
                groups.append((current_tactic, current_group))

            current_tactic = tactic
            current_group = [ev]
        else:
            current_group.append(ev)

    if current_group:
        groups.append((current_tactic, current_group))

    return groups


def build_mindmap(events, output_file):
    events.sort(key=get_event_time)

    groups = group_consecutive_tactics(events)
    host_colors = build_host_color_map(events)

    phase_topics = []

    for tactic, group_events in groups:
        event_topics = [build_event_topic(ev, host_colors) for ev in group_events]

        first_time = format_timestamp(get_event_time(group_events[0]))
        last_time = format_timestamp(get_event_time(group_events[-1]))

        if first_time == last_time:
            time_range = first_time
        else:
            time_range = f"{first_time} - {last_time}"

        title = f"{tactic} | {time_range}"
        tactic_color = TACTIC_COLORS.get(tactic, TACTIC_COLORS["Uncategorized"])

        phase = styled_topic(title, bg_color=tactic_color, children=event_topics)
        phase["structureClass"] = "org.xmind.ui.logic.right"

        phase_topics.append(phase)

    root_title = "Kill Chain"

    root = styled_topic(root_title, children=phase_topics)
    root["structureClass"] = "org.xmind.ui.tree.right"

    # Build legend as a separate branch.
    legend_items = []

    tactic_legend_children = []
    tactics_used = sorted(set(group[0] for group in groups))

    for tactic in tactics_used:
        color = TACTIC_COLORS.get(tactic, TACTIC_COLORS["Uncategorized"])
        tactic_legend_children.append(styled_topic(tactic, bg_color=color))

    legend_items.append(styled_topic("Tactics", children=tactic_legend_children))

    host_legend_children = []

    for host in sorted(host_colors.keys()):
        host_legend_children.append(styled_topic(host, bg_color=host_colors[host]))

    legend_items.append(styled_topic("Hosts", children=host_legend_children))

    legend = styled_topic("Legend", children=legend_items)
    root["children"]["attached"].append(legend)

    sheet_title = "Kill Chain"

    sheet = {
        "id": uid(),
        "title": sheet_title,
        "rootTopic": root,
        "topicPositioning": "fixed",
    }

    content = [sheet]

    manifest = {
        "file-entries": {
            "content.json": {},
            "metadata.json": {},
        }
    }

    content_xml = build_content_xml(root_title, sheet_title)

    with zipfile.ZipFile(output_file, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("content.json", json.dumps(content))
        zf.writestr("metadata.json", json.dumps({}))
        zf.writestr("manifest.json", json.dumps(manifest))
        zf.writestr("content.xml", content_xml)

    print(f"[+] Mind map saved to: {output_file}")


def main():
    parser = argparse.ArgumentParser(
        description="Generate a chronological kill chain XMind mind map from Splunk flagged events"
    )

    parser.add_argument(
        "--host",
        default="localhost",
        help="Splunk host, default: localhost",
    )

    parser.add_argument(
        "--port",
        default=8089,
        type=int,
        help="Splunk management port, default: 8089",
    )

    parser.add_argument(
        "--username",
        "-u",
        default="admin",
        help="Splunk username, default: admin",
    )

    parser.add_argument(
        "--password",
        "-p",
        required=True,
        help="Splunk password",
    )

    parser.add_argument(
        "--index",
        "-i",
        required=True,
        action="append",
        nargs="+",
        help=(
            "One or more indexes to filter. "
            "Examples: -i idx1 idx2, -i idx1,idx2, or -i idx1 -i idx2"
        ),
    )

    parser.add_argument(
        "--output",
        "-o",
        default=None,
        help="Output .xmind filename",
    )

    args = parser.parse_args()

    raw_indexes = [item for group in args.index for item in group]
    indexes = normalize_indexes(raw_indexes)

    if not indexes:
        print("[!] No valid index provided.")
        sys.exit(1)

    if not args.output:
        args.output = "killchain.xmind"

    service = connect_splunk(
        args.host,
        args.port,
        args.username,
        args.password,
    )

    events = pull_flagged_events(service, indexes)

    if not events:
        print("[!] No flagged events found. Nothing to map.")
        sys.exit(0)

    build_mindmap(events, args.output)

    groups = group_consecutive_tactics(sorted(events, key=get_event_time))
    tactics_seq = [group[0] for group in groups]
    unique_tactics = set(tactics_seq)

    print("\n[+] Summary:")
    print(f"    Indexes:  {len(indexes)} selected")
    print(f"    Events:   {len(events)}")
    print(f"    Phases:   {len(tactics_seq)} ({' -> '.join(tactics_seq)})")
    print(f"    Tactics:  {len(unique_tactics)} unique")
    print(f"    Output:   {args.output}")


if __name__ == "__main__":
    main()