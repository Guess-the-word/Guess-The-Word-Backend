const chatForm = document.getElementById('chat-form')
const socket = io();
const chatmsgs = document.getElementById('chat-msgs')
const userName = document.getElementById("user").innerText;


socket.on('message', message => {
    console.log(message)
    outputMessage(message.text, message.time, message.username);

    chatmsgs.scrollTop = chatmsgs.scrollHeight;
})

chatForm.addEventListener('submit', e => {
    e.preventDefault();
    //get the msg
    const msg = e.target.elements.msg.value;
    //emit msg to server
    socket.emit('chatMessage', msg)

    e.target.elements.msg.value = "";
    e.target.elements.msg.focus();
    console.log(e.target.elements.msg)
})

function outputMessage(msg, time, user) {
    let messages = document.getElementById('chat-msgs');
    messages.insertAdjacentHTML(`beforeend`, `
        <div class="message"> 
            <p class="meta">${user} <span>${time}</span> </p>
            <p class="text">
                ${msg}
            </p>
        </div>
    `);
}