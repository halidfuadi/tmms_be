var express = require('express');
const { getItemcheck, addItemCheck, editItemCheck, deleteItemCheck, approveItemCheck, getUpdate, approvedItem, approvedNewItem, denyAdded, denyEdit, getItemchecks } = require('../../controllers/master/itemcheck.controllers');
var router = express.Router();

router.get('/search', getItemchecks)
router.post('/addItemCheck', addItemCheck) //add item check parameter nya ledger id, lalu datanya yang akan di add disimpan di body
router.post('/editItemCheck', editItemCheck) ////edit item check parameter nya ledger id, lalu datanya yang akan di add disimpan di body
router.delete('/deleteItemCheck', deleteItemCheck)
router.put('/approvalItem', approveItemCheck)
router.get('/updatedItem', getUpdate)
router.post('/approvedUpdated', approvedItem)
router.post('/approvedNew', approvedNewItem)
router.post('/deleteItemcheck', deleteItemCheck)
router.post('/denyAdded', denyAdded)
router.post('/denyEdit', denyEdit)

module.exports = router