import json
import sys

def branch(a, b):
    result = a
    if b == 0:
        result += 3
    else:
        result += 5
    return result

def iteration(a, b):
    result = 3
    for _ in range(a):
        result += 1
    for _ in range(b):
        result += 2
    return result

fn = {"branch": branch, "iteration": iteration}[sys.argv[1]]
print(json.dumps([str(fn(int(a), int(b))) for a, b in json.load(sys.stdin)]))
