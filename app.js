require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { OpenAI } = require('openai');

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
    apiKey: process.env.OPENAI_API_KEY
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
    try {
        const completedPuzzle = req.files['completedPuzzle'][0];
        const puzzlePiece = req.files['puzzlePiece'][0];

        // Read the images and convert them to base64
        const completedPuzzleBase64 = fs.readFileSync(completedPuzzle.path, { encoding: 'base64' });
        const puzzlePieceBase64 = fs.readFileSync(puzzlePiece.path, { encoding: 'base64' });

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "user",
                    content: [
                        { 
                            type: "text", 
                            text: "Analyze these two images. The first is a completed puzzle, and the second is a single puzzle piece. Determine where the puzzle piece fits in the completed puzzle. Provide your answer in the following format: 'The piece fits at coordinates (x, y) with a radius of z.' Where x and y are percentages of the image width and height, and z is a percentage of the image width. For example: 'The piece fits at coordinates (25, 30) with a radius of 5.'" 
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/jpeg;base64,${completedPuzzleBase64}`
                            }
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/jpeg;base64,${puzzlePieceBase64}`
                            }
                        }
                    ]
                }
            ],
            max_tokens: 300
        });

        const aiResponse = response.choices[0].message.content;
        console.log("AI Response:", aiResponse);  // Log the full AI response

        // Parse the AI response to extract coordinates and radius
        const match = aiResponse.match(/coordinates \((\d+(?:\.\d+)?), (\d+(?:\.\d+)?)\) with a radius of (\d+(?:\.\d+)?)/);
        
        if (match) {
            const [, x, y, radius] = match.map(Number);
            
            res.json({
                circleInfo: { x, y, radius },
                originalResponse: aiResponse
            });
        } else {
            console.log("Failed to parse AI response. Regex didn't match.");
            // If we can't parse the coordinates, send back the original response
            res.json({
                error: 'Unable to parse coordinates',
                originalResponse: aiResponse
            });
        }

    } catch (error) {
        console.error('Detailed error:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    } finally {
        // Clean up uploaded files
        if (req.files['completedPuzzle']) {
            fs.unlinkSync(req.files['completedPuzzle'][0].path);
        }
        if (req.files['puzzlePiece']) {
            fs.unlinkSync(req.files['puzzlePiece'][0].path);
        }
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
