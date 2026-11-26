package com.intellectus.provider;
import com.intellectus.api.LinguisticAdapter;
import org.osgi.framework.*;
import java.util.Hashtable;
public final class Activator implements BundleActivator {
    private ServiceRegistration<LinguisticAdapter> registration;
    public void start(BundleContext context) {
        String language=context.getBundle().getHeaders().get("Intellectus-Language");
        Hashtable<String,Object> props=new Hashtable<>(); props.put("language",language);
        registration=context.registerService(LinguisticAdapter.class,new NodeAdapter(language),props);
    }
    public void stop(BundleContext context) { if(registration!=null){registration.unregister();registration=null;} }
}

