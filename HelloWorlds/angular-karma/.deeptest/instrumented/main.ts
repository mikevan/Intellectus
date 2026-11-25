const __witness_okg3qo: { s(id: number): void; f(id: number): void; c(id: number, index: number): void; v<T>(id: number, name: string, value: T): T } = (globalThis as any).__witness__.file("__witness_okg3qo", {"path":"C:/workspace/HelloWorlds/angular-karma/src/main.ts","statementMap":{"0":{"start":{"line":5,"column":0},"end":{"line":6,"column":38}},"1":{"start":{"line":6,"column":18},"end":{"line":6,"column":36}}},"fnMap":{"0":{"name":"(anonymous_0)","decl":{"start":{"line":6,"column":9},"end":{"line":6,"column":18}},"loc":{"start":{"line":6,"column":18},"end":{"line":6,"column":36}},"line":6}},"branchMap":{},"skipped":[]});import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

__witness_okg3qo.s(0);bootstrapApplication(App, appConfig)
  .catch((err) => (__witness_okg3qo.f(0), __witness_okg3qo.s(1), console.error(err)));
