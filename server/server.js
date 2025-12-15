import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;
const DATA_FILE = path.join(__dirname, '../data.json');
const SETTINGS_FILE = path.join(__dirname, '../settings.json');

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Helper to ensure file exists
const ensureFile = async (filePath, defaultContent) => {
    try {
        await fs.access(filePath);
    } catch (error) {
        await fs.writeFile(filePath, JSON.stringify(defaultContent, null, 2));
    }
};

// Initialize files
(async () => {
    try {
        await ensureFile(DATA_FILE, {});
        await ensureFile(SETTINGS_FILE, false);
    } catch (err) {
        console.error("Initialization error:", err);
    }
})();

// GET Data
app.get('/api/data', async (req, res) => {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        console.error('Error reading data:', error);
        res.status(500).json({ error: 'Failed to read data' });
    }
});

// POST Data
app.post('/api/data', async (req, res) => {
    try {
        await fs.writeFile(DATA_FILE, JSON.stringify(req.body, null, 2));
        res.json({ success: true });
    } catch (error) {
        console.error('Error writing data:', error);
        res.status(500).json({ error: 'Failed to save data' });
    }
});

// GET Dark Mode
app.get('/api/darkmode', async (req, res) => {
    try {
        const data = await fs.readFile(SETTINGS_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        // If file doesn't exist or error, default to false (light mode)
        res.json(false);
    }
});

// POST Dark Mode
app.post('/api/darkmode', async (req, res) => {
    try {
        await fs.writeFile(SETTINGS_FILE, JSON.stringify(req.body, null, 2));
        res.json({ success: true });
    } catch (error) {
        console.error('Error writing settings:', error);
        res.status(500).json({ error: 'Failed to save settings' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
