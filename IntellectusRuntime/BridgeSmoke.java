import com.intellectus.provider.NodeAdapter;
class BridgeSmoke {
 public static void main(String[] args) throws Exception {
  String s=new NodeAdapter("python").encode("def f(x):\n    return x\n");
  if(!s.contains("\"name\":\"f\"") || !s.contains("\"irSchema\":6")) throw new AssertionError(s);
  System.out.println("JVM-to-Node bridge passed");
 }
}
