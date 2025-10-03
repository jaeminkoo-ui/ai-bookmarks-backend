// server.js
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors({ origin: process.env.FRONTEND_URL }));

app.get('/', (req, res) => {
  res.send('백엔드 서버가 작동 중입니다!');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});