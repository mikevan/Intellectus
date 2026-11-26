package com.intellectus.probe;
import com.intellectus.api.LinguisticAdapter;
import org.osgi.framework.*;
import java.util.Hashtable;
public final class Activator implements BundleActivator {
    public void start(BundleContext c){
        Hashtable<String,Object> props=new Hashtable<>();props.put("osgi.command.scope","intellectus");props.put("osgi.command.function",new String[]{"adapters","encode","assertAdapters","assertEncode"});
        c.registerService(Object.class,new Commands(c),props);
    }
    public void stop(BundleContext c){}
    public static final class Commands {
        private final BundleContext c;
        public Commands(BundleContext c){this.c=c;}
        public void adapters() throws Exception {
            for(ServiceReference<LinguisticAdapter> ref:c.getServiceReferences(LinguisticAdapter.class,null))
                System.out.println(ref.getProperty("language"));
        }
        public void assertAdapters(String expected) throws Exception {
            java.util.SortedSet<String> actual=new java.util.TreeSet<>();
            for(ServiceReference<LinguisticAdapter> ref:c.getServiceReferences(LinguisticAdapter.class,null))
                actual.add(String.valueOf(ref.getProperty("language")));
            java.util.SortedSet<String> want=new java.util.TreeSet<>();
            if(!expected.equals("none")) want.addAll(java.util.Arrays.asList(expected.split(",")));
            if(!actual.equals(want)) throw new AssertionError("Expected "+want+" but found "+actual);
            System.out.println("INTELLECTUS_PASS adapters "+expected);
        }
        public void assertEncode(String language,String source,String expectedHash) throws Exception {
            String result=encoded(language,source);
            String hash=java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(result.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
            if(!hash.equalsIgnoreCase(expectedHash)) throw new AssertionError("Encoder output mismatch: "+hash);
            System.out.println("INTELLECTUS_PASS encode "+language);
        }
        public void encode(String language,String source) throws Exception {
            System.out.println(encoded(language,source));
        }
        private String encoded(String language,String source) throws Exception {
            for(ServiceReference<LinguisticAdapter> ref:c.getServiceReferences(LinguisticAdapter.class,null)){
                if(!language.equals(ref.getProperty("language"))) continue;
                LinguisticAdapter adapter=c.getService(ref);
                if(adapter==null) continue;
                try{return adapter.encode(source);}finally{c.ungetService(ref);}
            }
            throw new IllegalStateException("No active adapter: "+language);
        }
    }
}


