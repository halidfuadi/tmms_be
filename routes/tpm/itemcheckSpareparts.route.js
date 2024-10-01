var express = require('express');
const { addItemCheckSparepart } = require('../../controllers/master/itemcheck-sparepart');
var router = express.Router();

router.post('/add-itemcheck-part', addItemCheckSparepart)

module.exports = router