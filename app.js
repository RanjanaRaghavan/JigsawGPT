require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const OpenAI = require('openai');

const app = express();
const PORT = 3000;

// OpenAI API configuration
// const configuration = new Configuration({
//     apiKey: process.env.OPENAI_API_KEY,
// });
// const openai = new OpenAIApi({
//     api_key: process.env.OPENAI_API_KEY
// });
const openai = new OpenAI({
    api_key: process.env.OPENAI_API_KEY
  });

// Set up multer for handling file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname); 
    },
});
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB limit
    fileFilter: (req, file, cb) => {
        // Check file type
        if (file.mimetype == "image/png" || file.mimetype == "image/jpg" || file.mimetype == "image/jpeg" || file.mimetype == "image/gif" || file.mimetype == "image/webp") {
            cb(null, true);
        } else {
            cb(null, false);
            return cb(new Error('Only .png, .jpg, .jpeg, .gif and .webp format allowed!'));
        }
    }
});

app.use(express.static('public'));

// Set the view engine to use HTML files
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');
app.set('views', path.join(__dirname, 'public'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/upload', upload.fields([
    { name: 'completedPuzzle', maxCount: 1 },
    { name: 'puzzlePiece', maxCount: 1 }
]), async (req, res) => {
    let completedPuzzlePath, puzzlePiecePath;
    try {
        if (!req.files['completedPuzzle'] || !req.files['puzzlePiece']) {
            throw new Error('Missing required files');
        }

        completedPuzzlePath = req.files['completedPuzzle'][0].path;
        puzzlePiecePath = req.files['puzzlePiece'][0].path;

        const completedPuzzle = fs.readFileSync(completedPuzzlePath, { encoding: 'base64' });
        const puzzlePiece = fs.readFileSync(puzzlePiecePath, { encoding: 'base64' });

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",  // Update this to the latest supported model
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Here are two images. The first is a completed puzzle, and the second is a single puzzle piece. Please analyze where the puzzle piece might fit in the completed puzzle. Describe the location and, if possible, provide coordinates or a description of where to circle the area in the completed puzzle image." },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/jpeg;base64,${completedPuzzle}`
                            }
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/jpeg;base64,${puzzlePiece}`
                            }
                        }
                    ]
                }
            ],
            max_tokens: 300
        });

        const answer = response.choices[0].message.content;

        res.json({ answer });
    } catch (error) {
        console.error('Detailed error:', error);
        res.status(400).json({ error: 'Bad Request', details: error.message });
    } finally {
        // Delete the uploaded images if they exist
        if (completedPuzzlePath) {
            fs.unlink(completedPuzzlePath, (err) => {
                if (err) console.error(err);
            });
        }
        if (puzzlePiecePath) {
            fs.unlink(puzzlePiecePath, (err) => {
                if (err) console.error(err);
            });
        }
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
