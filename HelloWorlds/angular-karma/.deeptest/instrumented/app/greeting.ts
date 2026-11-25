const __witness_1h1hc6o: { s(id: number): void; f(id: number): void; c(id: number, index: number): void; v<T>(id: number, name: string, value: T): T } = (globalThis as any).__witness__.file("__witness_1h1hc6o", {"path":"C:/workspace/HelloWorlds/angular-karma/src/app/greeting.ts","statementMap":{"0":{"start":{"line":11,"column":33},"end":{"line":11,"column":51}}},"fnMap":{"0":{"name":"(anonymous_0)","decl":{"start":{"line":11,"column":27},"end":{"line":11,"column":33}},"loc":{"start":{"line":11,"column":33},"end":{"line":11,"column":51}},"line":11}},"branchMap":{},"skipped":[{"line":10,"reason":"this class carries a decorator, and a decorating compiler may require a field initialiser to appear exactly as written (Angular rejects any wrapper with NG8110), so the initialiser is not counted; code inside it still is"},{"line":11,"reason":"this class carries a decorator, and a decorating compiler may require a field initialiser to appear exactly as written (Angular rejects any wrapper with NG8110), so the initialiser is not counted; code inside it still is"}]});import { Component, computed, input } from '@angular/core';
import { hello } from './greet';

/** The one tested component. It shows the classic greeting; the villain is not wired in, on purpose. */
@Component({
  selector: 'app-greeting',
  template: '<h1>{{ text() }}</h1>',
})
export class Greeting {
  readonly name = input.required<string>();
  readonly text = computed(() => (__witness_1h1hc6o.f(0), __witness_1h1hc6o.s(0), hello(this.name())));
}
