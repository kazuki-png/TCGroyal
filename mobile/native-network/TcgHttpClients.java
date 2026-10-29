package com.tcgroyal.lending.preview.network;

import java.io.IOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.Proxy;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import okhttp3.Call;
import okhttp3.EventListener;
import okhttp3.Handshake;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Protocol;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okio.BufferedSink;

/** Keep the platform DNS, TLS verification, cookie jar and per-request redirect policy. */
public final class TcgHttpClients {
  private static final ConcurrentLinkedDeque<String> EVENTS = new ConcurrentLinkedDeque<>();
  private static final AtomicInteger IDS = new AtomicInteger();
  private TcgHttpClients() {}

  public static OkHttpClient create(OkHttpClient.Builder builder) {
    return builder.connectTimeout(3, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS).writeTimeout(60, TimeUnit.SECONDS)
        .callTimeout(90, TimeUnit.SECONDS)
        // OkHttp can try another platform-DNS address before any HTTP bytes are sent.
        .retryOnConnectionFailure(true)
        .addInterceptor(chain -> {
          Request request = chain.request();
          if (!request.method().equals("GET") && !request.method().equals("HEAD")) {
            RequestBody body = request.body();
            if (body == null) body = RequestBody.create(new byte[0], null);
            final RequestBody original = body;
            request = request.newBuilder().method(request.method(), new RequestBody() {
              @Override public MediaType contentType() { return original.contentType(); }
              @Override public long contentLength() throws IOException { return original.contentLength(); }
              @Override public void writeTo(BufferedSink sink) throws IOException { original.writeTo(sink); }
              @Override public boolean isDuplex() { return original.isDuplex(); }
              // Never automatically replay a mutation after request transmission has started.
              @Override public boolean isOneShot() { return true; }
            }).build();
          }
          return chain.proceed(request);
        })
        .eventListenerFactory(call -> {
          String host = call.request().url().host();
          if (!host.equals("tcg-royal-mobile-preview-collectorsrepublic.vercel.app")
              && !host.equals("mkmkkkdserlcaycknuxp.supabase.co")) return EventListener.NONE;
          return new Trace(host, IDS.incrementAndGet());
        }).build();
  }

  public static List<String> recentEvents() { return new ArrayList<>(EVENTS); }
  public static void clearEvents() { EVENTS.clear(); }

  private static final class Trace extends EventListener {
    private final String host;
    private final int id;
    private final long start = System.nanoTime();
    Trace(String host, int id) { this.host = host; this.id = id; }
    private void add(String event) {
      // Bounded in-memory transport metadata only: no URL paths, headers, bodies or identity.
      EVENTS.add("#" + id + " " + TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start)
          + "ms " + host + " " + event);
      while (EVENTS.size() > 80) EVENTS.pollFirst();
    }
    @Override public void callStart(Call call) { add("CALL_START"); }
    @Override public void dnsStart(Call call, String name) { add("DNS_START"); }
    @Override public void dnsEnd(Call call, String name, List<InetAddress> addresses) {
      List<String> ips = new ArrayList<>();
      for (InetAddress address : addresses) if (ips.size() < 6) ips.add(address.getHostAddress());
      add("DNS_END " + ips);
    }
    @Override public void connectStart(Call call, InetSocketAddress address, Proxy proxy) {
      add("CONNECT_START " + (address.getAddress() == null ? "unresolved" : address.getAddress().getHostAddress()) + ":" + address.getPort()
          + " proxy=" + proxy.type());
    }
    @Override public void secureConnectStart(Call call) { add("TLS_START"); }
    @Override public void secureConnectEnd(Call call, Handshake handshake) { add("TLS_OK"); }
    @Override public void connectFailed(Call call, InetSocketAddress address, Proxy proxy,
        Protocol protocol, IOException error) { add("CONNECT_FAILED " + error.getClass().getSimpleName()); }
    @Override public void requestHeadersEnd(Call call, Request request) { add("REQUEST_HEADERS_SENT"); }
    @Override public void responseHeadersStart(Call call) { add("RESPONSE_HEADERS_WAIT"); }
    @Override public void responseHeadersEnd(Call call, Response response) { add("HTTP " + response.code()); }
    @Override public void callEnd(Call call) { add("CALL_END"); }
    @Override public void callFailed(Call call, IOException error) { add("CALL_FAILED " + error.getClass().getSimpleName()); }
  }
}
