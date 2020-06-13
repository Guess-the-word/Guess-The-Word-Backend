const express = require('express');
const router = express.Router();

/**
 * /hello-world:
 *   get: 
 *     summary: Hello World!
 *     description: This is a GET endpoint returning a hello world message.
 *     request: -
 *     responses:
 *      str: hello world
 */
router.get('/', async (req, res, next) => {
    res.json('hello world');
    res.end();
});

module.exports = router;
