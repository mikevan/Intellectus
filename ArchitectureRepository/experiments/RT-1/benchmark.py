import importlib.util
import json
import statistics
import sys
import time

def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.discount

original = load(sys.argv[1], "original")
improved = load(sys.argv[2], "improved")
cases = [(n, m) for n in range(20001) for m in (0, 1)]
samples = {"original": [], "improved": []}
def time_one(fn):
    start = time.perf_counter_ns()
    total = 0
    for _ in range(5):
        for x, m in cases:
            total += fn(x, m)
    return (time.perf_counter_ns() - start) / 1e6, total

assert time_one(original)[1] == time_one(improved)[1]
for round_id in range(9):
    order = [("original", original), ("improved", improved)]
    if round_id % 2: order.reverse()
    for name, fn in order:
        elapsed, _ = time_one(fn)
        samples[name].append(elapsed)
print(json.dumps({"calls_per_sample": len(cases)*5, "samples_per_implementation": 9,
  "median_ms": {k: statistics.median(v) for k,v in samples.items()}, "raw_ms": samples,
  "note": "Local illustrative timing; not a release or platform-wide performance guarantee."}, indent=2))
