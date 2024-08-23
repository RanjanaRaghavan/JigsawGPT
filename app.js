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
    limits: { fileSize: 1024 * 1024 },
});

app.use(express.static('public'));

// Set the view engine to use HTML files
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');
app.set('views', path.join(__dirname, 'public'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/upload', upload.single('image'), async (req, res) => {
    const { question } = req.body;
    const imagePath = req.file.path;

    try {
        const image = fs.readFileSync(imagePath, { encoding: 'base64' });

        const response = await openai.completions.create({
            model: 'gpt-3.5-turbo',
            prompt: `Question: ${question}\n\nImage (base64): ${image}`,
            max_tokens: 150,
        });

        const answer = response.choices[0].text.trim();

        res.render('index', { answer });
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    } finally {
        // Delete the uploaded image
        fs.unlink(imagePath, (err) => {
            if (err) {
                console.error(err);
            }
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
