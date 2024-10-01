var express = require('express');
const { getHistory, getNewItem, getEditItem } = require('../../controllers/tpm/history.controllers');
var router = express.Router();

router.get('/search', getHistory)
router.get('/getNewItem', getNewItem)
router.get('/getEditItem', getEditItem)

module.exports = router