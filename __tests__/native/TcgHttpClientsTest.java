import com.tcgroyal.lending.preview.network.TcgHttpClients;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Collections;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import javax.net.SocketFactory;
import okhttp3.*;

/** Real local HTTP exchanges; no Android runtime, external host, account or payment. */
public final class TcgHttpClientsTest {
  private static final InetAddress BAD;
  private static final InetAddress LOCAL;
  static { try { BAD=InetAddress.getByAddress(new byte[]{(byte)192,0,2,1});LOCAL=InetAddress.getByAddress(new byte[]{127,0,0,1}); } catch(Exception e) { throw new RuntimeException(e); } }
  private static void check(boolean condition,String message) { if(!condition)throw new AssertionError(message); }
  private static void stop(OkHttpClient client) { client.connectionPool().evictAll();client.dispatcher().executorService().shutdownNow(); }
  private static class StallingSocket extends Socket {
    private final CountDownLatch closed=new CountDownLatch(1);
    @Override public void connect(SocketAddress endpoint,int timeout) throws IOException {
      if(((InetSocketAddress)endpoint).getAddress().equals(BAD)) {
        try { closed.await(timeout==0?20000:timeout,TimeUnit.MILLISECONDS); }
        catch(InterruptedException e) { Thread.currentThread().interrupt(); }
        throw new SocketTimeoutException("synthetic first address did not connect");
      }
      super.connect(endpoint,timeout);
    }
    @Override public synchronized void close() throws IOException { closed.countDown();super.close(); }
  }
  private static class StallingSockets extends SocketFactory {
    @Override public Socket createSocket() { return new StallingSocket(); }
    @Override public Socket createSocket(String h,int p) throws IOException { throw new UnsupportedOperationException(); }
    @Override public Socket createSocket(String h,int p,InetAddress l,int lp) throws IOException { throw new UnsupportedOperationException(); }
    @Override public Socket createSocket(InetAddress h,int p) throws IOException { throw new UnsupportedOperationException(); }
    @Override public Socket createSocket(InetAddress h,int p,InetAddress l,int lp) throws IOException { throw new UnsupportedOperationException(); }
  }
  private static String readRequest(Socket socket) throws Exception {
    socket.setSoTimeout(5000);BufferedReader reader=new BufferedReader(new InputStreamReader(socket.getInputStream(),StandardCharsets.UTF_8));
    String first=reader.readLine(),line;int size=0;
    while((line=reader.readLine())!=null&&!line.isEmpty())if(line.toLowerCase().startsWith("content-length:"))size=Integer.parseInt(line.substring(15).trim());
    for(int i=0;i<size;i++)check(reader.read()!=-1,"missing request body");return first;
  }
  private static void reply(Socket socket) throws Exception { socket.getOutputStream().write("HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}".getBytes(StandardCharsets.UTF_8));socket.getOutputStream().flush(); }
  private static void fallbackBeforeAbort() throws Exception {
    ExecutorService executor=Executors.newSingleThreadExecutor();
    try(ServerSocket server=new ServerSocket(0,4,LOCAL)) {
      Future<?> accepted=executor.submit(()->{try(Socket socket=server.accept()){readRequest(socket);reply(socket);}catch(Exception e){throw new RuntimeException(e);}});
      String url="http://fixture.invalid:"+server.getLocalPort()+"/";
      OkHttpClient baseline=new OkHttpClient.Builder().proxy(Proxy.NO_PROXY).socketFactory(new StallingSockets()).dns(h->Arrays.asList(BAD,LOCAL)).connectTimeout(0,TimeUnit.SECONDS).callTimeout(1200,TimeUnit.MILLISECONDS).build();
      try { baseline.newCall(new Request.Builder().url(url).build()).execute();throw new AssertionError("unbounded first connect unexpectedly succeeded"); }
      catch(IOException expected) {} finally { stop(baseline); }
      OkHttpClient client=TcgHttpClients.create(new OkHttpClient.Builder().proxy(Proxy.NO_PROXY).socketFactory(new StallingSockets()).dns(h->Arrays.asList(BAD,LOCAL)));
      check(client.connectTimeoutMillis()==3000,"connect timeout");check(client.hostnameVerifier()==new OkHttpClient().hostnameVerifier(),"TLS hostname verifier changed");
      long start=System.nanoTime();
      try(Response response=client.newCall(new Request.Builder().url(url).build()).execute()){check(response.code()==200,"second address failed");}
      long elapsed=TimeUnit.NANOSECONDS.toMillis(System.nanoTime()-start);
      check(elapsed>=2800&&elapsed<8000,"fallback was not bounded: "+elapsed);accepted.get(10,TimeUnit.SECONDS);stop(client);
      System.out.println("PASS: unbounded connect stalls; 3-second connect timeout reaches the next DNS address ("+elapsed+"ms)");
    } finally { executor.shutdownNow(); }
  }
  private static void noMutationReplay(String method) throws Exception {
    ExecutorService executor=Executors.newSingleThreadExecutor();AtomicInteger requests=new AtomicInteger();
    try(ServerSocket server=new ServerSocket(0,4,LOCAL)) {
      Future<?> accepted=executor.submit(()->{
        try { try(Socket socket=server.accept()){check(readRequest(socket).startsWith(method+" "),"wrong method");requests.incrementAndGet();}
          server.setSoTimeout(800);try(Socket socket=server.accept()){requests.incrementAndGet();readRequest(socket);reply(socket);}catch(SocketTimeoutException expected){}
        }catch(Exception e){throw new RuntimeException(e);}
      });
      OkHttpClient client=TcgHttpClients.create(new OkHttpClient.Builder().proxy(Proxy.NO_PROXY).dns(h->Collections.singletonList(LOCAL)));
      RequestBody body=method.equals("DELETE")?null:RequestBody.create("fixture",MediaType.get("application/json"));
      try { client.newCall(new Request.Builder().url("http://fixture.invalid:"+server.getLocalPort()+"/").method(method,body).build()).execute();throw new AssertionError("response should fail after server closes"); }
      catch(IOException expected) {} finally { stop(client); }
      accepted.get(10,TimeUnit.SECONDS);check(requests.get()==1,method+" replayed after request was sent");
      System.out.println("PASS: "+method+" is not automatically replayed after transmission");
    }finally {executor.shutdownNow();}
  }
  public static void main(String[] args) throws Exception {
    fallbackBeforeAbort();noMutationReplay("POST");noMutationReplay("DELETE");
    // A diagnostic event contains only a host, stage, duration, IP or exception class.
    check(TcgHttpClients.recentEvents().isEmpty(),"foreign fixture host must not be traced");
    System.out.println("PASS: platform TLS verification preserved; foreign hosts are not traced");
  }
}
