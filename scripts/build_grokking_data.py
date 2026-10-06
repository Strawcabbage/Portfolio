"""Build assets/data/grokking-sweep.json from the grokking repo's sweep logs.

    python scripts/build_grokking_data.py ../grokking/logs

Reads logs/{wd,width,dip}/*.json (written by sweep.py) and keeps only what the
site's charts need, rounded to keep the file small.
"""
import glob
import json
import os
import sys


def load(path):
    with open(path) as f:
        return json.load(f)


def curve(d, keys=("train_acc", "val_acc", "weight_norm")):
    out = {"step": d["step"]}
    for k in keys:
        nd = 1 if k == "weight_norm" else 3
        out[k] = [round(v, nd) for v in d[k]]
    return out


def main(logs, dest):
    data = {"source": "github.com/Strawcabbage/grokking/tree/master/logs", "wd": {}, "dip": {},
            "scaling": {"wd": [], "width": []}}

    for f in sorted(glob.glob(os.path.join(logs, "wd", "*.json"))):
        d = load(f)
        c = d["config"]
        run = {"seed": c["seed"], "grok": d["grok_step"], "memorize": d["memorize_step"], **curve(d)}
        data["wd"].setdefault(f"{c['wd']:g}", []).append(run)
        data["scaling"]["wd"].append({"wd": c["wd"], "seed": c["seed"], "grok": d["grok_step"],
                                      "last": d["step"][-1]})

    for f in sorted(glob.glob(os.path.join(logs, "width", "*.json"))):
        d = load(f)
        c = d["config"]
        data["scaling"]["width"].append({"d": c["d"], "seed": c["seed"], "grok": d["grok_step"]})

    for f in sorted(glob.glob(os.path.join(logs, "dip", "*.json"))):
        d = load(f)
        c = d["config"]
        data["dip"].setdefault(f"{c['beta2']:g}", []).append(
            {"seed": c["seed"], "grok": d["grok_step"], **curve(d)})

    for group in (data["wd"], data["dip"]):
        for runs in group.values():
            runs.sort(key=lambda r: r["seed"])
    data["scaling"]["wd"].sort(key=lambda r: (r["wd"], r["seed"]))
    data["scaling"]["width"].sort(key=lambda r: (r["d"], r["seed"]))

    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, "w") as f:
        json.dump(data, f, separators=(",", ":"))
    print(f"wrote {dest} ({os.path.getsize(dest) / 1024:.0f} KB)")


if __name__ == "__main__":
    logs = sys.argv[1] if len(sys.argv) > 1 else "../grokking/logs"
    here = os.path.dirname(os.path.abspath(__file__))
    main(logs, os.path.join(here, "..", "assets", "data", "grokking-sweep.json"))
