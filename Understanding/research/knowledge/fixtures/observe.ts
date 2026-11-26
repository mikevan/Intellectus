import {readFileSync} from 'node:fs';
function transform(x: bigint,y: bigint): bigint {
    return 7n + 3n*x - 2n*y;
}
const inputs: string[][]=JSON.parse(readFileSync(0,'utf8'));
console.log(JSON.stringify(inputs.map(([x,y])=>String(transform(BigInt(x),BigInt(y))))));
