require('dotenv').config({ path: __dirname + '/.env' });
const AWS = require('aws-sdk');
const express = require('express');
const helloWorld = require('./routes/hello-world');

AWS.config.update({
    region: process.env.REGION || 'us-east-1',
    accessKeyId: process.env.ACCESS_KEY,
    secretAccessKey: process.env.SECRET_KEY
});

const app = express();

app.use(express.json());

app.use((req, res, next) => {
    const client = new AWS.DynamoDB.DocumentClient({
        region: process.env.REGION || 'us-east-1'
    });
    res.locals.client = client;
    next();
});

app.use('/hello-world', helloWorld);

const port = process.env.PORT || 8001;
app.listen(port, () => console.log(`Listening on ${port}!`));