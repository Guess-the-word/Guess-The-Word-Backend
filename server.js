const express = require('express');
const helloWorld = require('./routes/hello-world');
require('dotenv').config({path: __dirname + '/.env'});

const app = express();
app.use(express.json());


app.use('/hello-world', helloWorld);

const port = process.env.PORT || 8001;
app.listen(port, () => console.log(`Listening on ${port}!`));