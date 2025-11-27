let lastMessage = "";

// Speak function & repetition ability
function speak(text){
    lastMessage = text;
    let msg = new SpeechSynthesisUtterance(text);
    msg.rate = 1; msg.pitch = 1;
    speechSynthesis.speak(msg);
}

// Auto Read Shortcut Keys on Load
window.onload = () => {
    speak("Welcome to Accessible Learning PDF Reader.");
    setTimeout(shortcutGuide,3000);
}

// Shortcut Voice Help
function shortcutGuide(){
    speak("Shortcuts: Shift U to upload and read PDF. Shift S for summary. Shift R to repeat. Shift H for help. Shift D to download text.");
}

// Upload + Extract + Read aloud
async function uploadPDF(){
    speak("Uploading file. Please wait.");
    const file=document.getElementById("pdfFile").files[0];
    let form=new FormData(); form.append("pdf",file);

    let res=await fetch("http://localhost:5000/upload",{method:"POST",body:form});
    let data=await res.json();

    document.getElementById("output").value = data.text;
    
    speak("Text extracted successfully. Reading now...");
    readSlow(data.text);
}

// Slow clear reading for blind users
function readSlow(text){
    let lines=text.split(". ");
    let i=0;
    function next(){
        if(i<lines.length) speak(lines[i++] +".");
        setTimeout(next,3500);
    } next();
}

// Summary for cognitive learners
function summarize(){
    let txt=document.getElementById("output").value;
    let summary=txt.split(".").slice(0,5).join(".")+".";
    speak("Easy summary created. Listening mode on.");
    speak(summary);
}

// Download extracted text
function downloadText(){
    let content=document.getElementById("output").value;
    let file=new Blob([content],{type:"text/plain"});
    let a=document.createElement("a");
    a.href=URL.createObjectURL(file);
    a.download="Extracted_Text.txt";
    a.click();
    speak("File downloaded successfully.");
}

// Keyboard Shortcuts
document.addEventListener("keydown",(e)=>{
    if(e.shiftKey && e.key=="U") uploadPDF();
    if(e.shiftKey && e.key=="S") summarize();
    if(e.shiftKey && e.key=="R") speak(lastMessage);
    if(e.shiftKey && e.key=="H") shortcutGuide();
    if(e.shiftKey && e.key=="D") downloadText();
});
