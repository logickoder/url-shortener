/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'

const UsersController = () => import('#controllers/auth_controller')

router.get('users', [UsersController, 'index'])

router.get('/', async () => {
  return {
    hello: 'world',
  }
})
