export function base(p0: number): number {
    return (p0 + 3);
}

export function discount(p0: number, p1: number): number {
    const v0 = base(p0);
    if (p1 === 1) {
        if (p0 >= 10) {
            return (v0 + 2);
        } else {
            return (v0 + 2);
        }
    } else {
        return v0;
    }
}

