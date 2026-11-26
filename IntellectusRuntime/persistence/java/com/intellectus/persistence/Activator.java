package com.intellectus.persistence;
import com.intellectus.api.LinguisticAdapter;
import org.osgi.framework.*;
import java.util.Hashtable;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.concurrent.*;
public final class Activator implements BundleActivator {
 public void start(BundleContext c){
   Hashtable<String,Object> props=new Hashtable<>();
   props.put("osgi.command.scope","knowledge");
   props.put("osgi.command.function",new String[]{"learn","recall","compare"});
   c.registerService(Object.class,new Commands(c),props);
 }
 public void stop(BundleContext c){}
 public static final class Commands{
   private static final String SOURCE="def eligible(total):\n    if total > 100:\n        return 1\n    return 0\n";
   private final BundleContext c;
   Commands(BundleContext c){this.c=c;}
   private Path journal(){return c.getDataFile("trial.ndjson").toPath();}
   private String encode() throws Exception{
     for(var ref:c.getServiceReferences(LinguisticAdapter.class,null)){
       if(!"python".equals(ref.getProperty("language")))continue;
       var service=c.getService(ref);if(service==null)continue;
       try{return service.encode(SOURCE);}finally{c.ungetService(ref);}
     }
     throw new IllegalStateException("Python adapter inactive");
   }
   private void assertInactive() throws Exception{
     for(var ref:c.getServiceReferences(LinguisticAdapter.class,null))
       if("python".equals(ref.getProperty("language")))throw new IllegalStateException("Python must be inactive");
   }
   private String hash() throws Exception{
     return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(journal())));
   }
   private String process(String mode,String payload) throws Exception{
     String root=System.getProperty("intellectus.root");
     if(root==null)throw new IllegalStateException("Missing intellectus.root");
     Path base=Path.of(root);
     Files.createDirectories(journal().getParent());
     var p=new ProcessBuilder(System.getProperty("intellectus.node","node"),base.resolve("IntellectusRuntime/persistence/journal-trial.mjs").toString(),mode,base.resolve("Understanding").toString(),journal().toString()).redirectError(ProcessBuilder.Redirect.INHERIT).start();
     var io=Executors.newFixedThreadPool(2);
     try{
       var out=io.submit(()->p.getInputStream().readAllBytes());
       var in=io.submit(()->{try(var stream=p.getOutputStream()){stream.write(payload.getBytes(StandardCharsets.UTF_8));}return null;});
       if(!p.waitFor(30,TimeUnit.SECONDS))throw new TimeoutException("Journal operation timed out");
       in.get(1,TimeUnit.SECONDS);
       if(p.exitValue()!=0)throw new IllegalStateException("Journal operation failed "+p.exitValue());
       return new String(out.get(1,TimeUnit.SECONDS),StandardCharsets.UTF_8).strip();
     }finally{if(p.isAlive())p.destroyForcibly();io.shutdownNow();}
   }
   public void learn() throws Exception{
     String result=process("learn",encode());
     System.out.println("INTELLECTUS_PERSIST_PASS learn "+result+" journalHash="+hash());
   }
   public void recall() throws Exception{
     assertInactive();String before=hash();String result=process("recall","");
     if(!before.equals(hash()))throw new IllegalStateException("Journal changed during recall");
     System.out.println("INTELLECTUS_PERSIST_PASS recall "+result+" journalHash="+hash());
   }
   public void compare() throws Exception{
     String before=hash(),result=process("compare",encode());
     if(!before.equals(hash()))throw new IllegalStateException("Journal changed during comparison");
     System.out.println("INTELLECTUS_PERSIST_PASS compare "+result+" journalHash="+hash());
   }
 }
}

