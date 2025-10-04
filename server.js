// server.js

const express = require('express');
const cors = require('cors');
const { OAuth2Client } = require('google-auth-library');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken'); // ★ 1. jsonwebtoken 라이브러리 추가

const app = express();
const prisma = new PrismaClient();

app.use(express.json());

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const FRONTEND_URL = process.env.FRONTEND_URL;
const JWT_SECRET = process.env.JWT_SECRET; // ★ 2. JWT 서명을 위한 비밀 키 (.env 파일에 추가해야 함)

if (!JWT_SECRET) {
  // 서버 시작 전 비밀키가 설정되었는지 확인
  throw new Error("FATAL ERROR: JWT_SECRET is not defined in the .env file");
}

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

app.use(cors({ origin: FRONTEND_URL }));

const PORT = process.env.PORT || 8080;

// =================================================================
// ★ 3. 인증 미들웨어 (가장 중요한 부분)
// =================================================================
// 이 미들웨어는 API 요청에 포함된 JWT 토큰을 검증해서
// req 객체에 user 정보를 넣어주는 역할을 합니다.
const authenticateUser = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN" 형식

  if (token == null) {
    // 토큰이 없는 경우 401 Unauthorized 에러 반환
    return res.status(401).json({ message: "Authentication token is required" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      // 토큰이 유효하지 않은 경우 (만료 등) 403 Forbidden 에러 반환
      return res.status(403).json({ message: "Invalid or expired token" });
    }
    // ★ 요청 객체에 사용자 정보(id, email)를 추가!
    req.user = user; 
    // 다음 로직으로 진행
    next(); 
  });
};

// =================================================================

// 기본 테스트
app.get('/', (req, res) => {
  res.send('백엔드 서버가 작동 중입니다!');
});

// Google 로그인
app.post('/api/auth/google', async (req, res) => {
  try {
    const { token } = req.body;
    
    const ticket = await client.verifyIdToken({
        idToken: token,
        audience: GOOGLE_CLIENT_ID, 
    });

    const payload = ticket.getPayload();
    const { sub, email, name, picture } = payload;
    
    // ★ 4. DB에서 사용자를 찾거나 새로 생성 (upsert 사용)
    // schema.prisma에 User 모델이 추가되어 있어야 합니다.
    const user = await prisma.user.upsert({
      where: { email: email },
      update: { name, avatarUrl: picture },
      create: {
        googleId: sub,
        email,
        name,
        avatarUrl: picture,
      },
    });

    console.log('✅ Google User Verified & Synced:', { email, name });

    // ★ 5. 사용자 정보를 담은 JWT 토큰 생성
    const jwtToken = jwt.sign(
      { id: user.id, email: user.email }, // 토큰에 담을 정보
      JWT_SECRET,                        // 비밀 키
      { expiresIn: '7d' }                 // 유효 기간 (예: 7일)
    );

    res.status(200).json({
      message: "Login successful",
      token: jwtToken, // ★ 프론트엔드로 토큰 전달
      user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl },
    });

  } catch (error) {
    console.error('❌ Authentication error:', error);
    res.status(401).json({ message: "Authentication failed" });
  }
});

// =================================================================
//      ▼▼▼▼▼▼ 모든 사용자 API에 인증 미들웨어 적용 ▼▼▼▼▼▼
// =================================================================

// 사용자 툴 조회
app.get('/api/user/tools', authenticateUser, async (req, res) => { // ★ 미들웨어 적용, :email 제거
  try {
    const userId = req.user.id; // ★ 이제 req.user에서 안전하게 사용자 ID를 가져옴
    
    const tools = await prisma.userTool.findMany({
      where: { userId: userId }, // ★ userEmail 대신 userId 사용
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({ tools });
  } catch (error) {
    console.error('❌ Error fetching tools:', error);
    res.status(500).json({ message: "Failed to fetch tools" });
  }
});

// 사용자 툴 추가
app.post('/api/user/tools', authenticateUser, async (req, res) => { // ★ 미들웨어 적용
  try {
    const userId = req.user.id; // ★ req.user에서 사용자 ID 가져오기
    const { categoryId, toolName, toolUrl, iconUrl } = req.body;

    if (!categoryId || !toolName || !toolUrl) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const newTool = await prisma.userTool.create({
      data: {
        userId, // ★ userEmail 대신 userId 사용
        categoryId,
        toolName,
        toolUrl,
        iconUrl: iconUrl || null,
      }
    });

    res.status(201).json({ tool: newTool });
  } catch (error) {
    console.error('❌ Error creating tool:', error);
    res.status(500).json({ message: "Failed to create tool" });
  }
});

// 툴 오버라이드 조회
app.get('/api/user/tool-overrides', authenticateUser, async (req, res) => { // ★ 미들웨어 적용, :email 제거
  try {
    const userId = req.user.id; // ★ req.user에서 사용자 ID 가져오기
    
    const overrides = await prisma.toolOverride.findMany({
      where: { userId: userId } // ★ userEmail 대신 userId 사용
    });

    res.status(200).json({ overrides });
  } catch (error) {
    console.error('❌ Error fetching tool overrides:', error);
    res.status(500).json({ message: "Failed to fetch tool overrides" });
  }
});

// 툴 오버라이드 추가/수정
app.post('/api/user/tool-overrides', authenticateUser, async (req, res) => { // ★ 미들웨어 적용
  try {
    const userId = req.user.id; // ★ req.user에서 사용자 ID 가져오기
    const { categoryId, toolName, action, newName, newUrl, newIconUrl } = req.body;

    if (!categoryId || !toolName || !action) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    
    // schema.prisma의 @@unique 필드 순서와 일치해야 합니다.