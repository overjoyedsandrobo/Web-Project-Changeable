const canvas = document.getElementById("generation-canvas");
const ctx = canvas.getContext("2d");

canvas.width = 600;
canvas.height = 600;

// Placeholder visual
ctx.strokeStyle = "#555";
ctx.strokeRect(50, 50, 500, 500);
function resizeCanvas() {
    const container = document.getElementById("canvas-container");
    const maxWidth = container.clientWidth * 0.95;
    const maxHeight = container.clientHeight * 0.95;

    const aspect = 4 / 3;

    let width = maxWidth;
    let height = width / aspect;

    if (height > maxHeight) {
        height = maxHeight;
        width = height * aspect;
    }

    canvas.width = width;
    canvas.height = height;
}

function drawGridPreview(size = 16) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const cell = canvas.width / size;
    ctx.strokeStyle = "#1f1f1f";
    ctx.lineWidth = 1;

    for (let i = 0; i <= size; i++) {
        ctx.beginPath();
        ctx.moveTo(i * cell, 0);
        ctx.lineTo(i * cell, canvas.height);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, i * cell);
        ctx.lineTo(canvas.width, i * cell);
        ctx.stroke();
    }
}

drawGridPreview();


window.addEventListener("resize", resizeCanvas);
resizeCanvas();
