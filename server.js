// server.js

const express = require('express');
const cors = require('cors');
const { OAuth2Client } = require('google-auth-library');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();

app.use(express.json());

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const FRONTEND_URL = process.env.FRONTEND_URL;

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

app.use(cors({ origin: FRONTEND_URL }));

const PORT = process.env.PORT || 8080;

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
    
    console.log('✅ Google User Verified:', { email, name });

    res.status(200).json({
      message: "Login successful",
      user: { email, name, avatarUrl: picture },
    });

  } catch (error) {
    console.error('❌ Authentication error:', error);
    res.status(401).json({ message: "Authentication failed" });
  }
});

// 사용자 툴 조회
app.get('/api/user/tools/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    const tools = await prisma.userTool.findMany({
      where: { userEmail: email },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({ tools });
  } catch (error) {
    console.error('❌ Error fetching tools:', error);
    res.status(500).json({ message: "Failed to fetch tools" });
  }
});

// 사용자 툴 추가
app.post('/api/user/tools', async (req, res) => {
  try {
    const { userEmail, categoryId, toolName, toolUrl, iconUrl } = req.body;

    if (!userEmail || !categoryId || !toolName || !toolUrl) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const newTool = await prisma.userTool.create({
      data: {
        userEmail,
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

// 사용자 툴 수정
app.put('/api/user/tools/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { toolName, toolUrl, iconUrl } = req.body;

    const updatedTool = await prisma.userTool.update({
      where: { id: parseInt(id) },
      data: {
        toolName,
        toolUrl,
        iconUrl: iconUrl || null,
      }
    });

    res.status(200).json({ tool: updatedTool });
  } catch (error) {
    console.error('❌ Error updating tool:', error);
    res.status(500).json({ message: "Failed to update tool" });
  }
});

// 사용자 툴 삭제
app.delete('/api/user/tools/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.userTool.delete({
      where: { id: parseInt(id) }
    });

    res.status(200).json({ message: "Tool deleted successfully" });
  } catch (error) {
    console.error('❌ Error deleting tool:', error);
    res.status(500).json({ message: "Failed to delete tool" });
  }
});

// 서버 종료 시 Prisma 연결 해제
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});