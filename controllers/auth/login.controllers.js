const table = 'tb_m_users'
const { queryGET } = require('../../helpers/query')
const security = require('../../helpers/security')
const auth = require('../../helpers/auth')
const response = require('../../helpers/response')

module.exports = {
    login: async(req, res) => {
        try {
            await queryGET(table, `WHERE noreg = '${req.body.noreg}'`)
                .then(async(result) => {
                    if (result.length > 0) {
                        let hashPassword = result[0].user_password
                        await security.decryptPassword(req.body.user_password, hashPassword).then(async decryptPass => {
                            if (decryptPass) {
                                let token = await auth.generateToken({ user_nm: result[0].user_nm, noreg: result[0].noreg })
                                response.success(res, 'Success to Login', token)
                            }
                        })
                    } else {
                        // User not found in DB
                        throw null
                    }
                })
        } catch (error) {
            console.log(error);
            response.notAllowed(res, error == null || error == false ? error == false ? 'Noreg / Password Salah' : 'User belum terdaftar / User belum di aktivasi, silahkan register / kontak admin' : error)
        }
    }
}