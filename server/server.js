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
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        console.log('Continuing without database connection (will fail on requests)');
    }
};

if (process.env.MONGODB_URI) {
    connectDB().then(async () => {
        // cleanup stale indexes from previous schema versions if they exist
        try {
            await mongoose.connection.collection('appdatas').dropIndex('type_1');
            console.log('Fixed: Dropped stale unique index "type_1" that was causing signup errors.');
        } catch (e) {
            // Index doesn't exist or other error, ignore
        }
    });
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
    folders: { type: Object, default: {} },
    selectedList: { type: String, default: null },
    darkMode: { type: Boolean, default: false }
}, { timestamps: true });

const AppData = mongoose.model('AppData', AppDataSchema);


// --- Middleware ---

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
                darkMode: data.darkMode // Include dark mode here
            });
        } else {
            res.json({ lists: {}, folders: {}, selectedList: null, darkMode: false });
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
