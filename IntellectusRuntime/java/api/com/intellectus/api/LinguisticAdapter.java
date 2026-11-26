package com.intellectus.api;
public interface LinguisticAdapter {
    String language();
    String encode(String source) throws Exception;
}

