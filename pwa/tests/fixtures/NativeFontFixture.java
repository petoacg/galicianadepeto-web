import androidx.compose.ui.unit.fontscaling.FontScaleConverter;
import androidx.compose.ui.unit.fontscaling.FontScaleConverterFactory;
public class NativeFontFixture {
 public static void main(String[] args) {
  float[] scales={0f,.85f,1f,1.02999f,1.03f,1.03001f,1.04f,1.1f,1.14999f,1.15f,1.15999f,1.16f,1.175f,1.2f,1.2999f,1.3f,1.4f,1.5f,1.65f,1.8f,1.9f,1.9999f,2f,2.01f,2.5f,3f};
  float[] sizes={-140f,-100f,-40f,-32f,-28f,-24f,-22f,-20f,-16f,-14f,-12f,-11f,-8f,-.5f,-.4f,-.2f,-.1f,-0f,0f,.1f,.2f,.4f,.5f,1f,7.99f,8f,9f,10f,11f,12f,13f,14f,15f,16f,18f,20f,22f,24f,28f,30f,32f,36f,40f,100f,101f,140f};
  System.out.print("{\"source\":\"androidx.compose.ui:ui-unit-android:1.7.5 classes.jar original, no translated algorithm\",\"cases\":[");
  boolean first=true;
  for(float scale:scales) {
   FontScaleConverter converter=FontScaleConverterFactory.INSTANCE.forScale(scale);
   for(float size:sizes) {
    float dp=converter==null?size*scale:converter.convertSpToDp(size);
    float sp=converter==null?size/scale:converter.convertDpToSp(size);
    if(!Float.isFinite(sp))continue;
    if(!first)System.out.print(",");first=false;
    System.out.print("{\"scale\":"+scale+",\"input\":"+size+",\"dp\":"+dp+",\"sp\":"+sp+"}");
   }
  }
  System.out.println("]}");
 }
}
