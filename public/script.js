document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('uploadForm');
    const resultDiv = document.getElementById('result');
    const analysisResult = document.getElementById('analysisResult');
    const completedPuzzleImage = document.getElementById('completedPuzzleImage');
    const circleOverlay = document.getElementById('circleOverlay');

    function previewImage(file, previewElement, nameElement, labelElement) {
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                previewElement.src = e.target.result;
                previewElement.style.display = 'block';
                nameElement.textContent = file.name;
                labelElement.style.display = 'none';
            }
            reader.readAsDataURL(file);
        }
    }

    document.getElementById('completedPuzzle').addEventListener('change', function(e) {
        const file = e.target.files[0];
        const previewElement = document.getElementById('completedPuzzlePreview');
        const nameElement = document.getElementById('completedPuzzleName');
        const labelElement = this.nextElementSibling;
        previewImage(file, previewElement, nameElement, labelElement);
    });

    document.getElementById('puzzlePiece').addEventListener('change', function(e) {
        const file = e.target.files[0];
        const previewElement = document.getElementById('puzzlePiecePreview');
        const nameElement = document.getElementById('puzzlePieceName');
        const labelElement = this.nextElementSibling;
        previewImage(file, previewElement, nameElement, labelElement);
    });

    function drawCircleOnImage(imageElement, xPercent, yPercent, radiusPercent) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = imageElement.width;
        canvas.height = imageElement.height;
        
        ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);
        
        const x = (xPercent / 100) * canvas.width;
        const y = (yPercent / 100) * canvas.height;
        const radius = (radiusPercent / 100) * canvas.width;
        
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'red';
        ctx.stroke();
        
        return canvas.toDataURL();
    }

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
            
            // Assuming the server returns coordinates and radius for the circle
            if (data.circleInfo) {
                const completedPuzzleImg = document.getElementById('completedPuzzlePreview');
                const circledImageUrl = drawCircleOnImage(
                    completedPuzzleImg, 
                    data.circleInfo.x, 
                    data.circleInfo.y, 
                    data.circleInfo.radius
                );
                document.getElementById('resultImage').src = circledImageUrl;
                document.getElementById('resultImage').style.display = 'block';
            } else if (data.originalResponse) {
                // If we couldn't parse coordinates but have the original response
                document.getElementById('resultImage').style.display = 'none';
                document.getElementById('result').textContent = data.originalResponse;
            } else {
                document.getElementById('resultImage').style.display = 'none';
                document.getElementById('result').textContent = 'Unable to analyze the images.';
            }
            
            document.getElementById('result').style.display = 'block';
        } catch (error) {
            console.error('Upload failed:', error);
            document.getElementById('resultImage').style.display = 'none';
            document.getElementById('result').style.display = 'block';
        }
    });
});
