def evaluate(case, x, y):
    match case:
        case "01": return 7 + 3*x - 2*y
        case "02": return 2 + x + y + int(x == 4 and y == 4)
        case "03": return 4 - 2*x + y
        case "04": return -3 + 2*x + 5*y
        case "05": return 6 + 2*x - y - 2*int(x == 4 and y == 0)
        case "06": return -5 + 3*y
        case "07": return 4 - 5*x + 3*y
        case "08": return -1 - x + 3*y + 3*int(x == 0 and y == 4)
        case "09": return 2 + 4*x - 2*y
        case "10": return 6 + 4*x - 3*y
        case "11": return 8 - 2*x - int(x == 3 and y == 4)
        case "12": return 9
    raise ValueError(f"Unknown case {case}")
