var express = require('express');
const {
    getBaseItemcheck,
    addItemCheck,
    editItemCheck,
    deleteItemCheck,
    approveItemCheck,
    getChangeItemRequest,
    approvedChangeItem,
    approvedNewItem,
    denyNewItem,
    denyChangeItem,
    getItemchecks,
    getNewItemRequest
} = require('../../controllers/master/itemcheck.controllers');
var router = express.Router();

router.get('/base', getBaseItemcheck)
router.get('/search', getItemchecks)
router.post('/addItemCheck', addItemCheck) //add item check parameter nya ledger id, lalu datanya yang akan di add disimpan di body
router.post('/editItemCheck', editItemCheck) ////edit item check parameter nya ledger id, lalu datanya yang akan di add disimpan di body
router.delete('/deleteItemCheck', deleteItemCheck)
router.put('/approvalItem', approveItemCheck)
router.get('/updatedItem', getChangeItemRequest)
router.post('/approvedUpdated', approvedChangeItem)
router.post('/approvedNew', approvedNewItem)
router.post('/deleteItemcheck', deleteItemCheck)
router.post('/denyAdded', denyNewItem)
router.post('/denyEdit', denyChangeItem)
router.get('/newItemRequest', getNewItemRequest)

module.exports = router