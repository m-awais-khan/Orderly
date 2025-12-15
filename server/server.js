import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();


const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'secret_key_change_me';

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// MongoDB Connection
let cached = global.mongoose;

if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
    if (cached.conn) {
        return cached.conn;
    }

    if (!cached.promise) {
        const opts = {
            bufferCommands: false,
        };

        cached.promise = mongoose.connect(process.env.MONGODB_URI, opts).then((mongoose) => {
            console.log(`MongoDB Connected: ${mongoose.connection.host}`);
            return mongoose;
        });
    }

    try {
        cached.conn = await cached.promise;
    } catch (e) {
        cached.promise = null;
        throw e;
    }

    return cached.conn;
};

// Clean up stale indexes (Best effort, fire and forget)
if (process.env.MONGODB_URI) {
    connectDB().then(async (conn) => {
        try {
            await conn.connection.collection('appdatas').dropIndex('type_1');
            console.log('Fixed: Dropped stale unique index "type_1"');
        } catch (e) { }
    }).catch(e => console.error("Initial connection attempt failed:", e));
} else {
    console.error("CRITICAL: MONGODB_URI is missing from environment variables.");
}

// --- Schemas ---

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    // For simplicity, we can embed the data directly in the User document or keep it separate.
    // Keeping separate allows for larger data without hitting document limits easily, but embedding is faster for this size.
    // Let's use a separate Data collection referenced by userId, similar to before but scoped.
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);

const AppDataSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    lists: { type: Object, default: {} },
    folders: { type: Map, of: [String], default: {} },
    selectedList: { type: String, default: null },
    darkMode: { type: Boolean, default: false },
    sharedLists: [{
        listName: String,
        shareId: String,
        createdAt: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

const AppData = mongoose.model('AppData', AppDataSchema);


// --- Middleware ---

const checkDbConnection = async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (error) {
        console.error("DB Connection Error in Middleware:", error);
        return res.status(503).json({
            error: 'Service Unavailable: Database connection failed.',
            details: error.message
        });
    }
};

// Apply DB check to all API routes
app.use('/api', checkDbConnection);

const protect = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, JWT_SECRET);
            req.user = await User.findById(decoded.id).select('-password');
            next();
        } catch (error) {
            console.error(error);
            res.status(401).json({ error: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        res.status(401).json({ error: 'Not authorized, no token' });
    }
};

// --- Auth Routes ---

// Signup
app.post('/api/auth/signup', async (req, res) => {
    const { username, password } = req.body;

    // Password Strength Check
    const passwordRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{8,}$/;
    if (!passwordRegex.test(password)) {
        return res.status(400).json({
            error: 'Password must be at least 8 characters long and include at least one number and one special character.'
        });
    }

    let user = null;
    try {
        const userExists = await User.findOne({ username });
        if (userExists) {
            return res.status(400).json({ error: 'User already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        user = await User.create({
            username,
            password: hashedPassword
        });

        // Initialize empty data for user
        await AppData.create({
            userId: user._id,
            lists: {},
            folders: {},
            selectedList: null
        });

        res.status(201).json({
            _id: user._id,
            username: user.username,
            token: jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '30d' })
        });
    } catch (error) {
        console.error("Signup Error:", error);
        // Rollback: If user was created but subsequent steps failed, delete the user
        if (user) {
            await User.findByIdAndDelete(user._id);
        }

        let errorMessage = error.message || 'Invalid user data';
        if (error.message.includes('E11000')) {
            errorMessage = "This username is already taken (or database conflict). Try a different one.";
        }
        res.status(400).json({ error: errorMessage });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username });

        if (user && (await bcrypt.compare(password, user.password))) {
            res.json({
                _id: user._id,
                username: user.username,
                token: jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '30d' })
            });
        } else {
            res.status(401).json({ error: 'Invalid username or password' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete Account
app.delete('/api/auth/delete', protect, async (req, res) => {
    try {
        await User.findByIdAndDelete(req.user._id);
        await AppData.findOneAndDelete({ userId: req.user._id });
        res.json({ message: 'Account deleted successfully' });
    } catch (error) {
        console.error("Delete Account Error:", error);
        res.status(500).json({ error: 'Failed to delete account' });
    }
});

// ------------------------------------------------------------------
// SHARE LIST ROUTES
// ------------------------------------------------------------------

// 1. Generate Share Link (POST /api/share/:listName)
app.post('/api/share/:listName', checkDbConnection, protect, async (req, res) => {
    try {
        const listName = req.params.listName;
        const userId = req.user.id;

        const appData = await AppData.findOne({ userId });
        if (!appData) {
            return res.status(404).json({ error: 'Data not found' });
        }

        if (!appData.lists[listName]) {
            return res.status(404).json({ error: 'List not found' });
        }

        // Check if already shared
        let shareEntry = appData.sharedLists.find(s => s.listName === listName);

        if (!shareEntry) {
            // Generate unique Share ID (using builtin crypto or math if simple)
            const { randomBytes } = await import('crypto');
            const shareId = randomBytes(8).toString('hex'); // 16 params chars

            shareEntry = { listName, shareId };
            appData.sharedLists.push(shareEntry);
            await appData.save();
        }

        // Return the full share URL or just the ID (frontend constructs URL)
        res.json({ shareId: shareEntry.shareId });

    } catch (error) {
        console.error('Share Error:', error);
        res.status(500).json({ error: 'Failed to share list' });
    }
});

// 2. Revoke Share Link (DELETE /api/share/:listName)
app.delete('/api/share/:listName', checkDbConnection, protect, async (req, res) => {
    try {
        const listName = req.params.listName;
        const userId = req.user.id;

        const appData = await AppData.findOne({ userId });
        if (!appData) {
            return res.status(404).json({ error: 'Data not found' });
        }

        appData.sharedLists = appData.sharedLists.filter(s => s.listName !== listName);
        await appData.save();

        res.json({ message: 'Share link revoked' });

    } catch (error) {
        console.error('Revoke Share Error:', error);
        res.status(500).json({ error: 'Failed to revoke share' });
    }
});

// 3. Get Shared List (GET /api/share/:shareId) - PUBLIC ROUTE
app.get('/api/share/:shareId', checkDbConnection, async (req, res) => {
    try {
        const shareId = req.params.shareId;

        // Find the AppData that contains this shareId
        const appData = await AppData.findOne({ 'sharedLists.shareId': shareId }).populate('userId', 'username');

        if (!appData) {
            return res.status(404).json({ error: 'Shared list not found or link expired' });
        }

        const shareEntry = appData.sharedLists.find(s => s.shareId === shareId);
        const listName = shareEntry.listName;
        const rootItems = appData.lists[listName];

        if (!rootItems) {
            return res.status(404).json({ error: 'List data missing' });
        }

        // Recursive function to gather all referenced lists
        const relatedLists = {};
        const visited = new Set([listName]);

        const collectReferences = (items) => {
            if (!items) return;

            items.forEach(item => {
                if (item.type === 'reference' && item.ref) {
                    const refName = item.ref;
                    if (!visited.has(refName)) {
                        visited.add(refName);
                        // Add to related lists
                        const refItems = appData.lists[refName] || [];
                        relatedLists[refName] = refItems;
                        // Recurse
                        collectReferences(refItems);
                    }
                }
            });
        };

        collectReferences(rootItems);

        // Return the main list plus all related lists needed for rendering
        res.json({
            listName: listName,
            items: rootItems,
            relatedLists: relatedLists,
            ownerUsername: appData.userId.username,
            lastUpdated: shareEntry.createdAt
        });

    } catch (error) {
        console.error('Get Shared List Error:', error);
        res.status(500).json({ error: 'Failed to fetch shared list' });
    }
});

// --- Data Routes (Protected) ---

// GET Data
app.get('/api/data', protect, async (req, res) => {
    try {
        const data = await AppData.findOne({ userId: req.user._id });
        if (data) {
            res.json({
                lists: data.lists,
                folders: data.folders,
                selectedList: data.selectedList,
                sharedLists: data.sharedLists || [],
                darkMode: data.darkMode // Include dark mode here
            });
        } else {
            res.json({ lists: {}, folders: {}, selectedList: null, darkMode: false, sharedLists: [] });
        }
    } catch (error) {
        console.error('Error reading data:', error);
        res.status(500).json({ error: 'Failed to read data' });
    }
});

// POST Data (Save all state)
app.post('/api/data', protect, async (req, res) => {
    try {
        const { lists, folders, selectedList } = req.body;
        // Allows partial updates if we wanted, but for now we replace the structure
        await AppData.findOneAndUpdate(
            { userId: req.user._id },
            { lists, folders, selectedList },
            { upsert: true, new: true }
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Error writing data:', error);
        res.status(500).json({ error: 'Failed to save data' });
    }
});

// POST Dark Mode (Separate endpoint or combined? Let's keep it compatible but use the same DB doc)
app.post('/api/darkmode', protect, async (req, res) => {
    try {
        const { darkMode } = req.body; // Expecting { darkMode: boolean } directly or check how frontend sends it
        // The frontend sends just the boolean value or an object? 
        // Previous code: body: JSON.stringify(newMode) => body is just the boolean if content-type json? No, standard fetch body is string.
        // Let's assume frontend sends { darkMode: val } or adjust frontend.
        // Looking at frontend: body: JSON.stringify(newMode). So body is `true` or `false`.
        // Express body parser might handle boolean body if configured, but usually it expects object.
        // Safest is to update frontend to send object, or handle raw body.
        // Let's UPDATE FRONTEND to send { darkMode: value }.

        // For now, let's assume body is { value: boolean } or similar if we change frontend.
        // Actually, let's keep it flexible.

        // If we strictly follow previous implementation:
        // req.body was the boolean value.

        const mode = req.body;

        await AppData.findOneAndUpdate(
            { userId: req.user._id },
            { darkMode: mode },
            { upsert: true, new: true }
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Error writing settings:', error);
        res.status(500).json({ error: 'Failed to save settings' });
    }
});

app.get('/api/darkmode', protect, async (req, res) => {
    try {
        const data = await AppData.findOne({ userId: req.user._id });
        res.json(data ? data.darkMode : false);
    } catch (error) {
        res.json(false);
    }
});


if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

export default app;
