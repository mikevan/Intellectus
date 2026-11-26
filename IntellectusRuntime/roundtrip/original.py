# Intentionally redundant implementation; returns integer discount percentage.
def discount(total, member):
    if total >= 10000:
        if member == 1:
            if total >= 10000:
                return 15
            else:
                return 15
        else:
            if total >= 10000:
                return 5
            else:
                return 5
    else:
        if member == 1:
            return 5
        else:
            return 0

