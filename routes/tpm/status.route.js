var express = require('express');
const { getData } = require('../../controllers/master/status.controllers');
var router = express.Router();

router.post('/search', getData)


module.exports = router