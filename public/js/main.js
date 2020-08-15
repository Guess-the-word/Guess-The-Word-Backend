const chatForm = document.getElementById('chat-form')
const socket = io();
const chatmsgs = document.getElementById('chat-msgs')
let Peer = require('simple-peer');
const video = document.querySelector('video')
let client = {}
// const $ = require('jquery');

document.getElementById('submit_name').addEventListener("click", function() {
    document.getElementById('initially_blurred').style.filter = 'none';
    document.getElementById('name-form').style.display = 'none';
    const user_name = document.getElementById('name').value;



    const {
        room_name
    } = Qs.parse(location.search, {
        ignoreQueryPrefix: true
    });

    //get stream
    navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
    }).then(stream => {
        socket.emit('newClient');
        video.srcObject = stream;
        video.play()

        function InitPeer(type) {
            let peer = new Peer({
                initiator: (type == 'init') ? true : false,
                stream: stream,
                trickle: false
            })
            peer.on('stream', (stream) => {
                createVid(stream)
            })
            peer.on('close', () => {
                document.getElementById('peerVideo').remove();
                peer.destroy()
            })
            return peer;
        }

        function makePeer() {
            client.gotAnswer = false;
            let peer = InitPeer('init');
            peer.on('signal', (data) => {
                if (!client.gotAnswer) {
                    socket.emit('Offer', data)
                }
            })
            client.peer = peer;
        }

        function frontAnswer(offer) {
            let peer = InitPeer('notInit');
            peer.on('signal', (data) => {
                socket.emit('Answer', data)
            })
            peer.signal(offer)
        }

        function signalAnswer(answer) {
            client.gotAnswer = true;
            let peer = client.peer;
            peer.signal(answer);
        }

        function createVid(stream) {
            // CreateDiv()
            let video = document.createElement('video');
            video.id = "peerVideo";
            video.srcObject = stream;
            video.class = 'embed-responsive-item';
            document.querySelector('#peerDiv').appendChild(video);
            video.play()
        }

        function sessionActive() {
            document.write('Session Active...Please come back later')
        }

        socket.on('backOffer', frontAnswer)
        socket.on('backAnswer', signalAnswer)
        socket.on('sessionActive', sessionActive)
        socket.on('createPeer', makePeer)
    }).catch(err => document.write(err));




    console.log(room_name, user_name)
    socket.emit('joinRoom', {
        username: user_name,
        room: room_name
    })

    socket.on('roomUsers', ({
        room,
        users
    }) => {
        outputRoom(room)
        outputUsers(users)
    })

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

    function outputRoom(room) {
        document.getElementById('room-name').innerText = `${room}`
    }

    function outputUsers(users) {
        let usersList = document.getElementById('users')
        usersList.innerHTML = `
            ${users.map(user => `<li> ${user.username} </li>`).join('')}
        `
    }
});



// function CreateDiv() {
//     let div = document.createElement('div')
//     div.setAttribute('class', "centered")
//     div.id = "muteText"
//     div.innerHTML = "Click to Mute/Unmute"
//     document.querySelector('#peerDiv').appendChild(div)
// }