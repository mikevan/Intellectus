# Persistence experiment

Prediction: a Python linguistic service encodes the deterministic eligible(total) fixture. A separate OSGi probe persists four assertions through the existing Understanding Journal API. After stopping Python, the probe queries the journal for its concept, fingerprint and complementary threshold predicates without invoking a linguistic service. Restarting Python must yield the same fingerprint and leave the journal unchanged.

Expected: three INTELLECTUS_PERSIST_PASS lines (learn, recall, compare), with the same concept ID and SHA-256 journal hash, and three INTELLECTUS_PASS adapter registry assertions. The threshold query checks 100 is not greater than 100 and 101 is greater than 100. This is a narrow evidence query, not execution or full reconstruction. The journal lives in the dedicated probe bundle data directory, not Understanding's existing research journal. A second learn refuses to overwrite it. The test requires a fresh probe data directory for a new run.

Local evidence: the three independent Node processes returned the same concept, fingerprint e65298394ded8fe272f143ba and threshold 100; the final SHA-256 matched the original. The Java probe compiled against the real Karaf OSGi 8 API using Java 17 and the unchanged LinguisticAdapter interface source. The prior qualified bundle was compiled by the user's Java 21 toolchain, so the review environment compiled the same interface source with --release 17 rather than using the Java 21 class file. The probe JAR contains only the probe classes, not a duplicate API.

Rebuild: compile the existing runtime API with javac --release 17, compile java/com/intellectus/persistence/Activator.java against those classes and Karaf lib/boot/osgi.core-8.0.0.jar, then jar --create --file intellectus.persistence.probe.jar --manifest manifest.mf -C <probe classes> . Do not include API classes in this JAR.

Live Karaf qualification pending. No change to baseline or existing runtime service implementation.
