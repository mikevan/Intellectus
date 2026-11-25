const __witness_10s5k9v: { s(id: number): void; f(id: number): void; c(id: number, index: number): void; v<T>(id: number, name: string, value: T): T } = (globalThis as any).__witness__.file("__witness_10s5k9v", {"path":"C:/workspace/HelloWorlds/angular-vitest/src/main.ts","statementMap":{"0":{"start":{"line":5,"column":0},"end":{"line":6,"column":38}},"1":{"start":{"line":6,"column":18},"end":{"line":6,"column":36}}},"fnMap":{"0":{"name":"(anonymous_0)","decl":{"start":{"line":6,"column":9},"end":{"line":6,"column":18}},"loc":{"start":{"line":6,"column":18},"end":{"line":6,"column":36}},"line":6}},"branchMap":{},"skipped":[]});import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

__witness_10s5k9v.s(0);bootstrapApplication(App, appConfig)
  .catch((err) => (__witness_10s5k9v.f(0), __witness_10s5k9v.s(1), console.error(err)));
