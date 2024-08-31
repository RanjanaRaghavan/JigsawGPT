console.log('Starting server...');

const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { OpenAI } = require('openai');
const Jimp = require('jimp');

try {
    // Initialize the Express application
    const app = express();

    // Configure multer for file uploads
    const storage = multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, 'uploads/') // Make sure this directory exists
        },
        filename: function (req, file, cb) {
            cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname))
        }
    });

    const upload = multer({ storage: storage });

    // Set up server, multer, etc. (same as your current setup)

    app.post('/upload', upload.fields([
        { name: 'completedPuzzle', maxCount: 1 },
        { name: 'puzzlePiece', maxCount: 1 }
    ]), async (req, res) => {
        console.log('Received upload request');
        let completedPuzzlePath, puzzlePiecePath;
        try {
            if (!req.files.completedPuzzle || !req.files.puzzlePiece) {
                console.log('Missing required files');
                return res.status(400).json({ error: 'Missing required files' });
            }

            completedPuzzlePath = req.files['completedPuzzle'][0].path;
            puzzlePiecePath = req.files['puzzlePiece'][0].path;

            console.log('Files uploaded successfully');
            console.log('Completed puzzle path:', completedPuzzlePath);
            console.log('Puzzle piece path:', puzzlePiecePath);

            // Image processing
            console.log('Starting image processing');
            let completedPuzzleImg, puzzlePieceImg;
            try {
                [completedPuzzleImg, puzzlePieceImg] = await Promise.all([
                    Jimp.read(completedPuzzlePath),
                    Jimp.read(puzzlePiecePath)
                ]);
                console.log('Image processing complete');
            } catch (imgError) {
                console.error('Error processing images:', imgError);
                return res.status(500).json({ error: 'Error processing images', details: imgError.message });
            }

            // Perform template matching
            console.log('Starting template matching');
            let matchResult;
            try {
                matchResult = await findBestMatch(completedPuzzleImg, puzzlePieceImg);
                console.log('Template matching complete', matchResult);
            } catch (matchError) {
                console.error('Error in template matching:', matchError);
                return res.status(500).json({ error: 'Error in template matching', details: matchError.message });
            }

            const { x, y, score } = matchResult;

            console.log('Starting GPT-4 analysis');
            if (score > 0.5) { // Adjusted from 0.8 to 0.5
                try {
                    const gptResponse = await openai.chat.completions.create({
                        model: "gpt-4-1106-preview", // Make sure this is the correct model name
                        messages: [
                            {
                                role: "system",
                                content: "You are an AI assistant specialized in analyzing puzzle piece placements. You have access to image processing results and can explain why a piece fits in a specific location based on coordinates and match scores."
                            },
                            {
                                role: "user",
                                content: `I've used image processing to find a match for a puzzle piece at coordinates (${x}, ${y}) with a confidence score of ${score.toFixed(2)}. The completed puzzle image is ${completedPuzzleImg.getWidth()} pixels wide and ${completedPuzzleImg.getHeight()} pixels tall. Can you describe why this location is likely a good fit and what this might mean in the context of the puzzle?`
                            }
                        ],
                        max_tokens: 300
                    });

                    console.log('GPT-4 analysis complete');
                    res.json({
                        matchCoordinates: { x, y, score },
                        gptExplanation: gptResponse.choices[0].message.content
                    });
                } catch (gptError) {
                    console.error('Error in GPT-4 analysis:', gptError);
                    return res.status(500).json({ error: 'Error in GPT-4 analysis', details: gptError.message });
                }
            } else {
                console.log('Match score too low:', score);
                res.json({
                    error: 'Could not confidently match the puzzle piece in the completed puzzle.',
                    score: score,
                    matchCoordinates: { x, y }
                });
            }
        } catch (error) {
            console.error('Unexpected error:', error);
            res.status(500).json({ error: 'Internal server error', details: error.message });
        } finally {
            // Clean up files
            if (completedPuzzlePath) fs.unlinkSync(completedPuzzlePath);
            if (puzzlePiecePath) fs.unlinkSync(puzzlePiecePath);
        }
    });

    console.log('GPT-4 analysis completed');

    // Helper function for template matching
    async function findBestMatch(largeImg, smallImg) {
        const scaleFactor = 0.5; // Adjust this value to balance speed and accuracy
        const scaledLargeImg = largeImg.scale(scaleFactor);
        const scaledSmallImg = smallImg.scale(scaleFactor);

        let bestScore = -Infinity;
        let bestX = 0;
        let bestY = 0;

        console.log('Scaled image sizes:', 
                    'Large:', scaledLargeImg.getWidth(), 'x', scaledLargeImg.getHeight(),
                    'Small:', scaledSmallImg.getWidth(), 'x', scaledSmallImg.getHeight());

        for (let y = 0; y <= scaledLargeImg.getHeight() - scaledSmallImg.getHeight(); y++) {
            for (let x = 0; x <= scaledLargeImg.getWidth() - scaledSmallImg.getWidth(); x++) {
                let score = 0;
                let totalPixels = 0;

                scaledSmallImg.scan(0, 0, scaledSmallImg.getWidth(), scaledSmallImg.getHeight(), function(sx, sy, idx) {
                    const largePixel = Jimp.intToRGBA(scaledLargeImg.getPixelColor(x + sx, y + sy));
                    const smallPixel = Jimp.intToRGBA(scaledSmallImg.getPixelColor(sx, sy));
                    
                    // Calculate color difference
                    const diff = Math.abs(largePixel.r - smallPixel.r) + 
                                 Math.abs(largePixel.g - smallPixel.g) + 
                                 Math.abs(largePixel.b - smallPixel.b);
                    
                    score += (765 - diff) / 765; // 765 is max difference (255 * 3)
                    totalPixels++;
                });

                score /= totalPixels; // Normalize score

                if (score > bestScore) {
                    bestScore = score;
                    bestX = x;
                    bestY = y;
                }
            }
        }

        console.log('Best match found:', { x: bestX / scaleFactor, y: bestY / scaleFactor, score: bestScore });

        return { x: bestX / scaleFactor, y: bestY / scaleFactor, score: bestScore };
    }

    app.use(express.static('public'));

    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });

} catch (error) {
    console.error('An error occurred while starting the server:', error);
}
