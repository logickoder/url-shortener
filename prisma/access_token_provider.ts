import {Secret} from '@adonisjs/core/helpers'
import type {LucidRow} from '@adonisjs/lucid/types/model'
import {RuntimeException} from '@adonisjs/core/exceptions'
import {
  AccessTokensGuardUser,
  AccessTokensLucidUserProviderOptions,
  AccessTokensUserProviderContract,
  LucidTokenable
} from '@adonisjs/auth/types/access_tokens'
import {AccessToken} from '@adonisjs/auth/access_tokens'
import {symbols} from '@adonisjs/auth';
import app from '@adonisjs/core/services/app';

const db = await app.container.make('prisma:db')

/**
 * Uses a lucid model to verify access tokens and find a user during
 * authentication
 */
export class AccessTokensLucidUserProvider<
  TokenableProperty extends string,
  UserModel extends LucidTokenable<TokenableProperty> & { id: string | number }
> implements AccessTokensUserProviderContract<InstanceType<UserModel>> {
  declare [symbols.PROVIDER_REAL_USER]: InstanceType<UserModel>

  /**
   * Reference to the lazily imported model
   */
  protected model?: UserModel

  constructor(
    /**
     * Lucid provider options
     */
    protected options: AccessTokensLucidUserProviderOptions<TokenableProperty, UserModel>
  ) {
  }

  /**
   * Returns the tokens provider associated with the user model
   */
  protected async getTokensProvider() {
    const model = await this.getModel()

    if (!model[this.options.tokens]) {
      throw new RuntimeException(
        `Cannot use "${model.name}" model for verifying access tokens. Make sure to assign a token provider to the model.`
      )
    }

    return model[this.options.tokens]
  }

  /**
   * Creates an adapter user for the guard
   */
  async createUserForGuard(
    user: InstanceType<UserModel>
  ): Promise<AccessTokensGuardUser<InstanceType<UserModel>>> {
    return {
      getId() {
        return user.id
      },
      getOriginal() {
        return user
      },
    }
  }

  /**
   * Create a token for a given user
   */
  async createToken(
    user: InstanceType<UserModel>,
    abilities?: string[] | undefined,
    options?: {
      name?: string
      expiresIn?: string | number
    }
  ): Promise<AccessToken> {
    const tokensProvider = await this.getTokensProvider()
    return tokensProvider.create(user as LucidRow, abilities, options)
  }

  /**
   * Finds a user by the user id
   */
  async findById(
    identifier: string | number | BigInt
  ): Promise<AccessTokensGuardUser<InstanceType<UserModel>> | null> {
    const user = await db.user.findUnique({
      where: {id: identifier},
    })

    if (!user) {
      return null
    }

    return this.createUserForGuard(user)
  }

  /**
   * Verifies a publicly shared access token and returns an
   * access token for it.
   */
  async verifyToken(tokenValue: Secret<string>): Promise<AccessToken | null> {
    const tokensProvider = await this.getTokensProvider()
    return tokensProvider.verify(tokenValue)
  }
}
