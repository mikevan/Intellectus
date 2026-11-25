const __witness_t4tusc: { s(id: number): void; f(id: number): void; c(id: number, index: number): void; v<T>(id: number, name: string, value: T): T } = (globalThis as any).__witness__.file("__witness_t4tusc", {"path":"C:/workspace/HelloWorlds/angular-karma/src/app/app.ts","statementMap":{},"fnMap":{},"branchMap":{},"skipped":[]});import { Component } from '@angular/core';
import { Greeting } from './greeting';

@Component({
  imports: [Greeting],
  selector: 'app-root',
  template: '<app-greeting name="World" />',
})
export class App {}
