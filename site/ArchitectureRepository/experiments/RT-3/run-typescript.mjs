import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const {discount}=await import(pathToFileURL(process.argv[2]));
console.log(JSON.stringify(JSON.parse(readFileSync(0,'utf8')).map(args=>discount(...args))));

