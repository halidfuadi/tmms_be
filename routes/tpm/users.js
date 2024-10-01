const router = require('express')()
const { getData, postUser, editUser, deleteUser } = require('../../controllers/master/users.controllers')
const auth = require('../../helpers/auth')

router.put('/edit/:id', auth.verifyToken, editUser)
router.delete('/delete/:id', auth.verifyToken, deleteUser)
router.post('/add', auth.verifyToken, postUser)
router.get('/search', getData)

module.exports = router