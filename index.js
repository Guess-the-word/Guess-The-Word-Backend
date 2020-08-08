const http = require('http');
const express = require('express');
const app = express();
const path = require('path');
const router = express.Router();
const axios = require('axios');
const hostname = '127.0.0.1';

const port = 3000;

router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname+'/index.html'));
})

app.use('/', router);
app.listen(process.env.port || 3000);
console.log('Running at port 3000')
