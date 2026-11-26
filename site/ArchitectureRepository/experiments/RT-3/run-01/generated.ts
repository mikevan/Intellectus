export function discount(p0: number, p1: number): number {
    if (p0 >= 10000) {
        if (p1 === 1) {
            if (p0 >= 10000) {
                return 15;
            } else {
                return 15;
            }
        } else {
            if (p0 >= 10000) {
                return 5;
            } else {
                return 5;
            }
        }
    } else {
        if (p1 === 1) {
            return 5;
        } else {
            return 0;
        }
    }
}

