package com.tcgroyal.lending.preview.network;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;

public final class TcgNetworkModule extends ReactContextBaseJavaModule {
  public TcgNetworkModule(ReactApplicationContext context) { super(context); }
  @Override public String getName() { return "TcgNetworkDiagnostics"; }
  @ReactMethod public void getRecentEvents(Promise promise) {
    WritableArray values = Arguments.createArray();
    for (String event : TcgHttpClients.recentEvents()) values.pushString(event);
    promise.resolve(values);
  }
  @ReactMethod public void clearEvents(Promise promise) {
    TcgHttpClients.clearEvents(); promise.resolve(null);
  }
}
