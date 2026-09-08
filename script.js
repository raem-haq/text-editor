const textBox = document.querySelector(".text-box");
var hasWritten = false;

textBox.addEventListener("keypress", (event) => {
    if (!hasWritten) {
        textBox.textContent = "";
        hasWritten = true;
    }
    if (event.key === "Enter") {
        textBox.textContent = textBox.textContent + "\n";
        event.preventDefault();
    } else {
        textBox.textContent = textBox.textContent + event.key;
    }
});

