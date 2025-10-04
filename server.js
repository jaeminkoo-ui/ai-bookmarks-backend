// server.js

const express = require('express');
const cors = require('cors');
const { OAuth2Client } = require('google-auth-library');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const app = express();
const prisma = new PrismaClient();

app.use(express.json());

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const FRONTEND_URL = process.env.FRONTEND_URL;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("FATAL ERROR: JWT_SECRET is not defined in the .env file");
}

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

app.use(cors({ origin: FRONTEND_URL }));

const PORT = process.env.PORT || 8080;

const authenticateUser = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) {
    return res.status(401).json({ message: "Authentication token is required" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: "Invalid or expired token" });
    }
    req.user = user; 
    next(); 
  });
};

app.get('/', (req, res) => {
  res.send('백엔드 서버가 작동 중입니다!');
});

app.post('/api/auth/google', async (req, res) => {
  try {
    const { token } = req.body;
    
    const ticket = await client.verifyIdToken({
        idToken: token,
        audience: GOOGLE_CLIENT_ID, 
    });

    const payload = ticket.getPayload();
    const { sub, email, name, picture } = payload;
    
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

    const jwtToken = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      message: "Login successful",
      token: jwtToken,
      user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl },
    });

  } catch (error) {
    console.error('❌ Authentication error:', error);
    res.status(401).json({ message: "Authentication failed" });
  }
});

app.get('/api/user/tools', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const tools = await prisma.userTool.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({ tools });
  } catch (error) {
    console.error('❌ Error fetching tools:', error);
    res.status(500).json({ message: "Failed to fetch tools" });
  }
});

app.post('/api/user/tools', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { categoryId, toolName, toolUrl, iconUrl } = req.body;

    if (!categoryId || !toolName || !toolUrl) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const newTool = await prisma.userTool.create({
      data: {
        userId,
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

app.get('/api/user/tool-overrides', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const overrides = await prisma.toolOverride.findMany({
      where: { userId: userId }
    });

    res.status(200).json({ overrides });
  } catch (error) {
    console.error('❌ Error fetching tool overrides:', error);
    res.status(500).json({ message: "Failed to fetch tool overrides" });
  }
});

app.post('/api/user/tool-overrides', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { categoryId, toolName, action, newName, newUrl, newIconUrl } = req.body;

    if (!categoryId || !toolName || !action) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    
    const override = await prisma.toolOverride.upsert({
      where: {
        userId_categoryId_toolName: {
          userId,
          categoryId,
          toolName
        }
      },
      update: { action, newName, newUrl, newIconUrl },
      create: {
        userId,
        categoryId,
        toolName,
        action,
        newName,
        newUrl,
        newIconUrl,
      }
    });

    res.status(200).json({ override });
  } catch (error) {
    console.error('❌ Error saving tool override:', error);
    res.status(500).json({ message: "Failed to save tool override" });
  }
});

process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});