# Intellectus runtime experiment 0.1

Question: can existing Understanding encoders be made independently discoverable OSGi services without altering measured semantics? Prediction: wrappers return precisely the same function IR and fingerprints, and only installed/started providers appear in Karaf's service registry.

The Node bridge consumes UTF-8 source via stdin and emits one JSON document, preserving the legacy encoder's result. It deliberately reports partial representation; JavaScript/TSX, framework lexicons, source anchors, reconstruction and journal service are not implemented in this increment. Module lifecycle is independent of the existing on-disk evidence journal; persistence across activation remains to be demonstrated in Karaf.

## Local validation
Build Understanding using its lockfile dependencies and npm test, then:
```powershell
$env:INTELLECTUS_UNDERSTANDING = 'C:\workspace-Intellectus\Understanding'
node --test test/bridge.test.mjs
```

The four bridge tests passed against the verified P0 build d7efd55eb399, including exact equality of every function IR and fingerprint on all three frozen corpora. Java 17 independently compiled the API and Node process bridge and a Python subprocess smoke test passed. No changes to Understanding source were made.

## Karaf provisioning (not yet executed)
Use a local Karaf distribution compatible with Java 17. Supply the path to an OSGi API JAR containing org/osgi/framework/BundleActivator.class and BundleContext.class; a compatible framework JAR from the local distribution may serve. Build:
```powershell
.\Build-KarafBundles.ps1 -OsgiJar 'C:\path\to\osgi-api.jar'
```
Start Karaf with JVM system property intellectus.root=C:\workspace-Intellectus (and optionally intellectus.node set to the Node executable). Register the printed feature repository URI in the Karaf console:
```
feature:repo-add <printed file URI>
feature:install intellectus-core
intellectus:adapters
feature:install intellectus-python
intellectus:adapters
intellectus:encode python "def f(x): return x"
feature:install intellectus-typescript
intellectus:adapters
intellectus:encode typescript "function f(x:number){return x;}"
feature:stop intellectus-python
intellectus:adapters
feature:start intellectus-python
intellectus:adapters
```
Expected: no adapters initially, Python only, both, TypeScript only, both again. Encoding an inactive language must fail, and the output after restart must match its prior output. Actual OSGi compilation, registry lifecycle and feature provisioning remain unverified because Karaf and its API JAR are not installed in the review environment. Do not claim Phase 2 complete yet.

References: https://karaf.apache.org/manual/latest/ and https://docs.osgi.org/specification/osgi.core/8.0.0/framework.api.html

