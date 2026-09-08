const textBox = document.querySelector(".text-box");

textBox.addEventListener("keypress", (event) => {
    if (textBox.textContent === "Edit Text") {
        textBox.textContent = "";
    }
    textBox.textContent = textBox.textContent  + event.key;
});

const debugButton = document.querySelector(".debug");
debugButton.addEventListener("keypress", (event) => {
    console.log(`key=${event.key},code=${event.code}`);
});