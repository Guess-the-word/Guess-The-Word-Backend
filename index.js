const http = require('http');
const socketio = require('socket.io')
const express = require('express');
const app = express();
const router = express.Router();
const ejs = require('ejs');
var bodyParser = require('body-parser');
const server = http.createServer(app);
var user_name;
var room_name;
const io = socketio(server);
const formatMessage = require('./utils/messages');
const {
    userJoin,
    getCurrentUser,
    userLeaves,
    getRoomUsers
} = require('./utils/users')

app.use(bodyParser.json());

app.use(bodyParser.urlencoded({
    extended: true
}))

app.use(express.static(__dirname + '/public'))

app.set('view engine', "ejs");

//run when user connects

// requests
app.post('/room-req', (req, res) => {
    room_name = req.body.room_name;
    user_name = req.body.user_name;

    // res.sendStatus(200)
    res.render('../public/views/room_created', {
        room_name: room_name,
        user_name: user_name
    })
})

app.get
io.on('connection', socket => {

    socket.on('joinRoom', ({
        username,
        room
    }) => {

        const user = userJoin(socket.id, username,
            room);
        console.log(user);
        socket.join(user.room);
        //welcome current user
        socket.emit('message', formatMessage('Guess_It Bot: ', 'welcome to your private room!'))

        //broadcast when a user connects
        socket.broadcast.to(user.room).emit('message', formatMessage('Guess_It Bot: ', `${user.username} has joined the room`));

        io.to(user.room).emit('roomUsers', {
            room: user.room,
            users: getRoomUsers(user.room)
        })
    })

    socket.on('chatMessage', msg => {
        const user = getCurrentUser(socket.id)
        io.to(user.room).emit('message', formatMessage(`${user.username}: `, msg))
    })

    //video stuff
    socket.on('make-offer', function(data) {
        socket.to(data.to).emit('offer-made', {
            offer: data.offer,
            socket: socket.id
        });
    });

    socket.on('make-answer', function(data) {
        socket.to(data.to).emit('answer-made', {
            socket: socket.id,
            answer: data.answer
        });
    });

    socket.on('disconnect', () => {
        const user = userLeaves(socket.id);

        if (user) {
            io.to(user.room).emit('message', formatMessage('Guess_It Bot: ', `${user.username} has left the chat`))
            io.to(user.room).emit('roomUsers', {
                room: user.room,
                users: getRoomUsers(user.room)
            })
        }
    })
})


app.get('/', (req, res) => {
    res.render('../public/views/index')
})

app.get('/room_created.ejs', (req, res) => {
    res.render('../public/views/room_created.ejs')
})

const PORT = process.env.port || 3000

app.use('/', router);
server.listen(PORT, () => {
    console.log('Running at port 3000')
});