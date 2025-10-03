// server.js

// 필요한 라이브러리들을 불러옵니다.
const express = require('express');
const cors = require('cors');
const { OAuth2Client } = require('google-auth-library'); // Google 인증 라이브러리

const app = express();
app.use(express.json()); // JSON 형태의 요청 본문을 파싱하기 위해 추가합니다.

// Render에서 설정한 환경 변수를 가져옵니다.
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const FRONTEND_URL = process.env.FRONTEND_URL;

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

// 프론트엔드(매장)에서 오는 요청을 허용해줍니다.
app.use(cors({ origin: FRONTEND_URL }));

const PORT = process.env.PORT || 8080;

// 기본 테스트 주소
app.get('/', (req, res) => {
  res.send('백엔드 서버가 작동 중입니다!');
});

// --- Google 로그인 요청을 처리할 API 엔드포인트 ---
app.post('/api/auth/google', async (req, res) => {
  try {
    const { token } = req.body; // 프론트엔드에서 보낸 idToken
    
    // Google 라이브러리를 사용해 토큰을 검증합니다.
    const ticket = await client.verifyIdToken({
        idToken: token,
        audience: GOOGLE_CLIENT_ID, 
    });

    const payload = ticket.getPayload();
    const { sub, email, name, picture } = payload; // Google 사용자 정보
    
    console.log('✅ Google User Verified:', { email, name });

    // TODO: 이 정보를 데이터베이스에 저장하거나 찾는 로직이 여기에 들어갑니다.
    // 예시: let user = await findOrCreateUser({ googleId: sub, email, name, avatarUrl: picture });

    // 프론트엔드에 성공 응답과 사용자 정보를 보내줍니다.
    res.status(200).json({
      message: "Login successful",
      user: { email, name, avatarUrl: picture },
      // token: ourServiceToken, // 실제로는 우리 서비스의 JWT 토큰을 생성해서 보내야 합니다.
    });

  } catch (error) {
    console.error('❌ Authentication error:', error);
    res.status(401).json({ message: "Authentication failed" });
  }
});


// 서버를 실행합니다.
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

