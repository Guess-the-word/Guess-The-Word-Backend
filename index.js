const http = require('http');
const express = require('express');
const app = express();
const path = require('path');
const router = express.Router();
const ejs = require('ejs');
var bodyParser = require('body-parser');
const $ = require('jquery')

app.use(bodyParser.json());

app.use(bodyParser.urlencoded({
    extended: true
}))
app.set('view engine', "ejs");
app.post('/room-req', (req, res) => {
    const room_name = req.body.room_name;
    // res.sendStatus(200)
    res.render('room_created', {
        room_name: room_name
    })
})

app.get('/', (req, res) => {
    res.render('index')
})

console.log(process.env.port)
app.use('/', router);
app.listen(process.env.port || 3000);
console.log('Running at port 3000')