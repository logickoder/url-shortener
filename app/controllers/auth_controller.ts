import type { HttpContext } from '@adonisjs/core/http'

export default class AuthController {
  async index({ prisma }: HttpContext) {
    const users = await prisma.user.findMany()
    console.log(users)
    return users
  }

  /**
   * Show individual record
   */
  async show({ params, response, prisma }: HttpContext) {
    const id = params.id

    // Find the user with the id
    const user = await prisma.user.findUnique({
      where: {
        id: Number(id),
      },
    })

    if (user) {
      return response.json({
        success: true,
        message: 'User found successfully',
        data: user,
      })
    } else {
      return response.json({
        success: false,
        message: 'User not found',
      })
    }
  }
}
