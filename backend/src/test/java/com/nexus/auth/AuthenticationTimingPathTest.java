package com.nexus.auth;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.nexus.common.Db;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;
class AuthenticationTimingPathTest {
 @Test void unknownAccountUsesAValidComparableCostBcryptHash(){
  var db=mock(Db.class);when(db.rows(anyString(),any(Object[].class))).thenReturn(List.of());var encoder=spy(new BCryptPasswordEncoder(12));var auth=new AuthController(db,encoder);String hash=(String)ReflectionTestUtils.getField(auth,"dummyHash");
  assertNotNull(hash);assertTrue(hash.matches("\\$2[aby]\\$12\\$[./A-Za-z0-9]{53}"));
  assertThrows(ResponseStatusException.class,()->auth.login(new AuthController.Credentials("unknown@example.test","synthetic-valid-password"),new MockHttpServletRequest()));
  verify(encoder).matches("synthetic-valid-password",hash);
 }
}
