document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('uploadForm');
    const resultDiv = document.getElementById('result');
    const analysisResult = document.getElementById('analysisResult');
    const completedPuzzleImage = document.getElementById('completedPuzzleImage');
    const circleOverlay = document.getElementById('circleOverlay');

    function previewImage(file, previewElement) {
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                previewElement.src = e.target.result;
                previewElement.style.display = 'block';
            }
            reader.readAsDataURL(file);
        }
    }

    document.getElementById('completedPuzzle').addEventListener('change', function(e) {
        const file = e.target.files[0];
        document.getElementById('completedPuzzleName').textContent = file ? file.name : '';
        previewImage(file, document.getElementById('completedPuzzlePreview'));
    });

    document.getElementById('puzzlePiece').addEventListener('change', function(e) {
        const file = e.target.files[0];
        document.getElementById('puzzlePieceName').textContent = file ? file.name : '';
        previewImage(file, document.getElementById('puzzlePiecePreview'));
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const completedPuzzle = document.getElementById('completedPuzzle').files[0];
        const puzzlePiece = document.getElementById('puzzlePiece').files[0];

        if (!completedPuzzle || !puzzlePiece) {
            alert('Please select both images');
            return;
        }

        const validTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
        if (!validTypes.includes(completedPuzzle.type) || !validTypes.includes(puzzlePiece.type)) {
            alert('Please upload only PNG, JPEG, GIF, or WebP images');
            return;
        }

        if (completedPuzzle.size > 20 * 1024 * 1024 || puzzlePiece.size > 20 * 1024 * 1024) {
            alert('Each image must be less than 20 MB');
            return;
        }

        const formData = new FormData(e.target);
        
        try {
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.details || 'Upload failed');
            }
            
            const data = await response.json();
            document.getElementById('resultText').textContent = data.answer;
            
            // Assuming the server returns a URL for the circled image
            if (data.circledImageUrl) {
                document.getElementById('resultImage').src = data.circledImageUrl;
                document.getElementById('resultImage').style.display = 'block';
            } else {
                document.getElementById('resultImage').style.display = 'none';
            }
            
            document.getElementById('result').style.display = 'block';
        } catch (error) {
            console.error('Upload failed:', error);
            document.getElementById('resultText').textContent = `Upload failed: ${error.message}`;
            document.getElementById('resultImage').style.display = 'none';
            document.getElementById('result').style.display = 'block';
        }
    });
});
