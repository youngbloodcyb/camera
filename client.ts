const uploadArea = document.getElementById('uploadArea') as HTMLDivElement;
const fileInput = document.getElementById('fileInput') as HTMLInputElement;
const processBtn = document.getElementById('processBtn') as HTMLButtonElement;
const selectedFileDiv = document.getElementById('selectedFile') as HTMLDivElement;
const statusDiv = document.getElementById('status') as HTMLDivElement;
const videoContainer = document.getElementById('videoContainer') as HTMLDivElement;
const outputVideo = document.getElementById('outputVideo') as HTMLVideoElement;
const progressBar = document.getElementById('progressBar') as HTMLDivElement;

let selectedFile: File | null = null;

// Handle click to upload
uploadArea.addEventListener('click', () => {
    fileInput.click();
});

// Handle file selection
fileInput.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
        handleFileSelect(target.files[0]);
    }
});

// Handle drag and drop
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');

    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        handleFileSelect(e.dataTransfer.files[0]);
    }
});

function handleFileSelect(file: File) {
    if (!file.type.startsWith('video/')) {
        showStatus('Please select a valid video file', 'error');
        return;
    }

    selectedFile = file;
    selectedFileDiv.textContent = `Selected: ${file.name} (${formatFileSize(file.size)})`;
    selectedFileDiv.classList.add('visible');
    processBtn.disabled = false;
    statusDiv.innerHTML = '';
    videoContainer.classList.remove('visible');
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function showStatus(message: string, type: 'processing' | 'success' | 'error') {
    statusDiv.innerHTML = message;
    statusDiv.className = `status ${type}`;
}

// Handle process button click
processBtn.addEventListener('click', async () => {
    if (!selectedFile) return;

    processBtn.disabled = true;
    videoContainer.classList.remove('visible');
    progressBar.classList.add('visible');
    showStatus('Uploading and processing video... This may take a while.', 'processing');

    try {
        const formData = new FormData();
        formData.append('video', selectedFile);

        const response = await fetch('/api/process', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
            progressBar.classList.remove('visible');
            showStatus('Video processing complete!', 'success');

            // Load the processed video
            outputVideo.src = `/api/video/${result.videoId}`;
            videoContainer.classList.add('visible');

            // Reset for next upload
            setTimeout(() => {
                processBtn.disabled = false;
            }, 1000);
        } else {
            throw new Error(result.error || 'Processing failed');
        }
    } catch (error) {
        progressBar.classList.remove('visible');
        showStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
        processBtn.disabled = false;
    }
});
