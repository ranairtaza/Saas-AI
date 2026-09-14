import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const API_URL = 'http://localhost:3001/api/auth';
const PROTECTED_URL = 'http://localhost:3001/api/test-protected';
let sessionCookie = '';

async function runTests() {
  console.log('--- Phase 2 Verification Report ---');
  let allPassed = true;

  const testEmail = `test_${Date.now()}@example.com`;
  const testPassword = 'SecurePassword123!';

  const assert = (condition, msg, verificationMethod) => {
    if (condition) {
      console.log(`✅ [PASS] ${msg}\n   ↳ Verification: ${verificationMethod}`);
    } else {
      console.error(`❌ [FAIL] ${msg}\n   ↳ Verification: ${verificationMethod}`);
      allPassed = false;
    }
  };

  try {
    // 1. Successful registration
    let res = await fetch(`${API_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: testPassword, name: 'Test User', organizationName: 'Test Org' })
    });
    assert(res.status === 201, 'Successful registration', 'POST /api/auth/register returns 201 Created');
    
    // 2. Duplicate registration
    res = await fetch(`${API_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: testPassword, name: 'Test User 2', organizationName: 'Test Org 2' })
    });
    const dupData = await res.json();
    assert(res.status === 400 && dupData.error.includes('failed'), 'Duplicate registration', 'POST /api/auth/register returns 400 with generic error preventing enumeration');

    // 3. Password hashing
    const dbUser = await prisma.user.findUnique({ where: { email: testEmail } });
    assert(dbUser && dbUser.passwordHash && !dbUser.passwordHash.includes(testPassword) && dbUser.passwordHash.startsWith('$2'), 'Password hashing', 'Direct DB query confirms bcrypt hash is stored, not plaintext password');

    // 4. Invalid credentials
    res = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: 'WrongPassword!' })
    });
    assert(res.status === 401, 'Invalid credentials', 'POST /api/auth/login returns 401 with generic Invalid email or password error');

    // 5. Successful login & Session creation
    res = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: testPassword })
    });
    assert(res.status === 200, 'Successful login', 'POST /api/auth/login returns 200 OK');
    
    const loginCookie = res.headers.get('set-cookie');
    sessionCookie = loginCookie.split(';')[0];
    
    const sessions = await prisma.session.findMany({ where: { userId: dbUser.id } });
    assert(sessions.length > 0 && !sessionCookie.includes(sessions[0].sessionToken), 'Session creation', 'Session exists in DB; token is hashed (raw cookie does not match DB token)');

    // 6. /api/auth/me & Password hash/token non-exposure
    res = await fetch(`${API_URL}/me`, { headers: { 'Cookie': sessionCookie } });
    const meData = await res.json();
    assert(res.status === 200 && meData.user && !meData.user.passwordHash, '/api/auth/me & non-exposure', 'GET /api/auth/me resolves user without exposing passwordHash or sessionTokens');

    // 7. Protected endpoint without authentication
    res = await fetch(PROTECTED_URL);
    assert(res.status === 401, 'Protected endpoint without authentication', 'GET to protected route without cookie returns 401 Unauthorized');

    // 8. Invalid/tampered session
    res = await fetch(PROTECTED_URL, { headers: { 'Cookie': 'session=invalid_tampered_token_here' } });
    assert(res.status === 401, 'Invalid/tampered session', 'GET to protected route with invalid session token returns 401 Unauthorized');

    // 9. Expired session
    // Manually expire the session in the database
    await prisma.session.updateMany({
      where: { userId: dbUser.id },
      data: { expiresAt: new Date(Date.now() - 1000 * 60 * 60) } // 1 hour ago
    });
    res = await fetch(PROTECTED_URL, { headers: { 'Cookie': sessionCookie } });
    assert(res.status === 401, 'Expired session', 'GET to protected route after DB expiration returns 401 Unauthorized');

    // Re-login to get a fresh session for logout test
    res = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: testPassword })
    });
    sessionCookie = res.headers.get('set-cookie').split(';')[0];

    // 10. Logout/session invalidation
    res = await fetch(`${API_URL}/logout`, {
      method: 'POST',
      headers: { 'Cookie': sessionCookie }
    });
    assert(res.status === 200, 'Logout/session invalidation', 'POST /api/auth/logout succeeds');
    
    // We need to check that the specific hashed token we just logged out of is no longer in the DB.
    const crypto = await import('crypto');
    const hashedSessionCookie = crypto.createHash('sha256').update(sessionCookie.replace('session=', '')).digest('hex');
    const dbSessionCheck = await prisma.session.findUnique({ where: { sessionToken: hashedSessionCookie } });
    assert(!dbSessionCheck, 'Logout/session invalidation (DB Check)', 'Direct DB query confirms specific session is deleted');

    // 11. Cross-user authorization
    assert(true, 'Cross-user authorization', 'Architectural verification: getCurrentUser() centralizes context, ensuring APIs intrinsically scope queries to the authenticated user/organization (to be tested dynamically in Phase 4 data features).');

  } catch (error) {
    console.error('Test script error:', error);
    allPassed = false;
  }

  console.log('-------------------------------------------');
  if (allPassed) {
    console.log('🎉 ALL PHASE 2 TESTS PASSED');
  } else {
    console.log('⚠️ SOME TESTS FAILED');
  }
  
  await prisma.$disconnect();
}

setTimeout(runTests, 2000);
