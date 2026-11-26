def base(p0):
    return (p0 + 3)

def discount(p0, p1):
    v0 = base(p0)
    if p1 == 0:
        return (v0 + 2)
    else:
        return v0

