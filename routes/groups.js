const express = require("express");
const router = express.Router();
const uuidv4 = require("uuidv4");

/**
 * /group:
 *   post:
 *     description: This endpoint create a new group
 *     request: -
 *     responses:
 *      str: groupId
 */
router.post("/", async (req, res, next) => {
    console.log("ok");
    // generate a random group Id
    const groupId = uuidv4();
    //create a new group with the genrated Id
    await res.locals.client
        .put({
            TableName: "groups",
            Item: {
                groupId: groupId,
            },
        })
        .promise();
    res.json(groupId);
    res.end();
});

module.exports = router;
