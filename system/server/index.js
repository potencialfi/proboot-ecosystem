import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();
const app = express();
const PORT = 3005;

app.use(cors());
app.use(express.json());

// --- API ROUTES ---
app.get('/api/materials', async (req, res) => {
  try {
    const materials = await prisma.material.findMany();
    res.json(materials);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/materials', async (req, res) => {
  try {
    const { name, unit, costPerUnit } = req.body;
    const material = await prisma.material.create({
      data: { name, unit, costPerUnit: parseFloat(costPerUnit) }
    });
    res.json(material);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- FRONTEND SERVING ---

// 1. Статика (JS, CSS, картинки) отдается из папки dist
// Важно: express.static должен быть привязан к пути /system
app.use('/system', express.static(path.join(__dirname, '../dist')));

app.get('/', (req, res) => {
  res.send('ProBoot ERP System is running. Please access via /system/');
});

// 3. Любой другой запрос внутри /system/* отдаем index.html (для React Router)
app.get('/system/*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server ready at http://localhost:${PORT}/system/`);
});