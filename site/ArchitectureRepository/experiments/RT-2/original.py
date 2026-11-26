def base(total):
    return total + 3

def discount(total, member):
    amount = base(total)
    if member == 1:
        if total >= 10:
            return amount + 2
        else:
            return amount + 2
    else:
        return amount
