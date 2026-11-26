def base(p0):
    return (p0 + 3)

def discount(p0, p1):
    v0 = base(p0)
    if p1 == 1:
        return (v0 + 1)
    else:
        return v0

