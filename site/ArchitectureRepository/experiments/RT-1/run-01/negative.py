def discount(p0, p1):
    if p0 >= 10001:
        if p1 == 1:
            return 15
        else:
            return 5
    else:
        if p1 == 1:
            return 5
        else:
            return 0
