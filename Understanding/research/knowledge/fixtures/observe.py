import json
import sys

def transform(x, y):
    result = 7
    for _ in range(x):
        result += 3
    return result - 2*y

print(json.dumps([str(transform(int(a), int(b))) for a,b in json.load(sys.stdin)]))
