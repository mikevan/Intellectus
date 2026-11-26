package com.intellectus.provider;
import com.intellectus.api.LinguisticAdapter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.concurrent.*;
public final class NodeAdapter implements LinguisticAdapter {
    private final String language;
    public NodeAdapter(String language) { this.language=language; }
    public String language() { return language; }
    public String encode(String source) throws Exception {
        String root=System.getProperty("intellectus.root");
        if(root==null || root.isBlank()) throw new IllegalStateException("Set intellectus.root to the monorepo");
        String node=System.getProperty("intellectus.node","node");
        Path base=Path.of(root).toAbsolutePath();
        Process p=new ProcessBuilder(node,base.resolve("IntellectusRuntime/bridge.mjs").toString(),
            language,System.getProperty("intellectus.understanding",base.resolve("Understanding").toString())).redirectError(ProcessBuilder.Redirect.INHERIT).start();
        ExecutorService io=Executors.newFixedThreadPool(2);
        try {
            Future<byte[]> result=io.submit(()->p.getInputStream().readAllBytes());
            Future<?> input=io.submit(()->{try(var stream=p.getOutputStream()){stream.write(source.getBytes(StandardCharsets.UTF_8));}return null;});
            if(!p.waitFor(30,TimeUnit.SECONDS)) throw new TimeoutException("Encoder timed out");
            input.get(1,TimeUnit.SECONDS);
            if(p.exitValue()!=0) throw new IllegalStateException("Encoder exited "+p.exitValue());
            return new String(result.get(1,TimeUnit.SECONDS),StandardCharsets.UTF_8);
        } finally { if(p.isAlive()) p.destroyForcibly(); io.shutdownNow(); }
    }
}


