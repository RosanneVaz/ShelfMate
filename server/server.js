const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
require('dotenv').config();

const app = express();
const PORT = 3000;
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Middleware
app.use(cors());
app.use(bodyParser.json());

// MongoDB Connection
mongoose.connect(process.env.ATLAS_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB Atlas!'))
.catch(err => console.error('Atlas connection error:', err));

// User Schema
const userSchema = new mongoose.Schema({
    username: { type: String, unique: true, sparse: true },
    password: { type: String, select: false },
    googleId: { type: String, unique: true, sparse: true },
    email: { type: String, unique: true, sparse: true },
    name: String
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// Book Schema
const bookSchema = new mongoose.Schema({
    title: { type: String, required: true },
    author: { type: String, required: true },
    status: { 
        type: String, 
        required: true,
        enum: ['to-read', 'reading', 'read'],
        default: 'to-read'
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

const Book = mongoose.model('Book', bookSchema);

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Authentication Middleware
const authenticate = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) return res.status(401).json({ error: 'Authentication required' });

        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded._id);
        if (!user) return res.status(401).json({ error: 'User not found' });

        req.user = user;
        req.token = token;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Please authenticate' });
    }
};

// Routes
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (await User.findOne({ username })) {
            return res.status(400).json({ error: 'Username already exists' });
        }
        
        const user = new User({
            username,
            password: await bcrypt.hash(password, 8)
        });
        
        await user.save();
        const token = jwt.sign({ _id: user._id, username }, JWT_SECRET);
        res.status(201).json({ token, user });
    } catch (error) {
        res.status(400).json({ error: 'Registration failed' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username }).select('+password');
        
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const token = jwt.sign({ _id: user._id, username }, JWT_SECRET);
        res.json({ token, user });
    } catch (error) {
        res.status(400).json({ error: 'Login failed' });
    }
});

// Google Auth Route
app.post('/api/auth/google', async (req, res) => {
    try {
        const { token } = req.body;
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID
        });
        
        const { sub: googleId, email, name, picture } = ticket.getPayload();
        let user = await User.findOne({ 
            $or: [{ googleId }, { email }] 
        });
        
        if (!user) {
            user = new User({ 
                googleId, 
                email, 
                name,
                profilePicture: picture
            });
            await user.save();
        } else if (!user.googleId) {
            // Link existing account with Google
            user.googleId = googleId;
            await user.save();
        }
        
        const jwtToken = jwt.sign(
            { _id: user._id, email: user.email },
            JWT_SECRET,
            { expiresIn: '1d' }
        );
        
        res.json({ 
            token: jwtToken, 
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
                name: user.name,
                profilePicture: user.profilePicture
            }
        });
    } catch (error) {
        console.error('Google Auth Error:', error);
        res.status(401).json({ error: 'Google authentication failed' });
    }
});

// Protected Book Routes
app.get('/api/books', authenticate, async (req, res) => {
    try {
        const books = await Book.find({ user: req.user._id });
        res.json(books);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch books' });
    }
});

app.post('/api/books', authenticate, async (req, res) => {
    try {
        const newBook = new Book({ ...req.body, user: req.user._id });
        const savedBook = await newBook.save();
        res.status(201).json(savedBook);
    } catch (error) {
        res.status(400).json({ error: 'Failed to add book' });
    }
});

app.patch('/api/books/:id', authenticate, async (req, res) => {
    try {
        const updatedBook = await Book.findOneAndUpdate(
            { _id: req.params.id, user: req.user._id },
            req.body,
            { new: true }
        );
        
        if (!updatedBook) {
            return res.status(404).json({ error: 'Book not found' });
        }
        
        res.json(updatedBook);
    } catch (error) {
        res.status(400).json({ error: 'Failed to update book' });
    }
});

app.delete('/api/books/:id', authenticate, async (req, res) => {
    try {
        const deletedBook = await Book.findOneAndDelete({ 
            _id: req.params.id, 
            user: req.user._id 
        });
        
        if (!deletedBook) {
            return res.status(404).json({ error: 'Book not found' });
        }
        
        res.status(204).send();
    } catch (error) {
        res.status(400).json({ error: 'Failed to delete book' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});