package com.nexus.config;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
class RateLimitIdentityTest {
 @Test void signedBrowsersAreIndependentAndForwardedSpoofingCannotChooseIdentity(){
  var filter=new RateLimitFilter(mock(StringRedisTemplate.class),"a-test-secret-with-sufficient-length",false);
  var a=new MockHttpServletRequest();a.setRemoteAddr("127.0.0.1");var response=new MockHttpServletResponse();String first=filter.identity(a,response);
  Cookie issued=response.getCookie("NEXUS_CLIENT");assertNotNull(issued);assertTrue(issued.isHttpOnly());
  var b=new MockHttpServletRequest();b.setRemoteAddr("127.0.0.1");String second=filter.identity(b,new MockHttpServletResponse());assertNotEquals(first,second);
  var spoof=new MockHttpServletRequest();spoof.setCookies(issued);spoof.addHeader("X-Forwarded-For","attacker-selected-value");assertEquals(first,filter.identity(spoof,new MockHttpServletResponse()));
  var tamper=new MockHttpServletRequest();tamper.setCookies(new Cookie("NEXUS_CLIENT",issued.getValue()+"x"));assertNotEquals(first,filter.identity(tamper,new MockHttpServletResponse()));
 }
}
