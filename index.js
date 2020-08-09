const http = require('http');
const socketio = require('socket.io')
const express = require('express');
const app = express();
const router = express.Router();
const ejs = require('ejs');
var bodyParser = require('body-parser');
const server = http.createServer(app);
var user_name;
const io = socketio(server);
const formatMessage = require('./utils/messages');

app.use(bodyParser.json());

app.use(bodyParser.urlencoded({
    extended: true
}))

app.use(express.static(__dirname + '/public'))

app.set('view engine', "ejs");

//run when user connects

// requests
app.post('/room-req', (req, res) => {
    const room_name = req.body.room_name;
    user_name = req.body.user_name;

    // res.sendStatus(200)
    res.render('../public/views/room_created', {
        room_name: room_name,
        user_name: user_name
    })
})
io.on('connection', socket => {
    //welcome current user
    socket.emit('message', formatMessage('Guess_It Bot: ', 'welcome to your private room!'))

    //broadcast when a user connects
    socket.broadcast.emit('message', formatMessage('Guess_It Bot: ', 'Your friend has joined the room'));

    //user disconnects
    socket.on('disconnect', () => {
        io.emit('message', formatMessage('Guess_It Bot: ', 'A user has left the chat!'))
    })

    //catch the chat message
    socket.on('chatMessage', msg => {
        io.emit('message', formatMessage(`${user_name}: `, msg))
    })
})

app.get('/', (req, res) => {
    res.render('../public/views/index')
})

const PORT = process.env.port || 3000

app.use('/', router);
server.listen(PORT, () => {
    console.log('Running at port 3000')
});