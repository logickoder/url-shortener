import { symbols } from '@adonisjs/auth'
import { SessionGuardUser, SessionUserProviderContract } from '@adonisjs/auth/types/session'
import app from '@adonisjs/core/services/app'
import {
  AccessTokensGuardEvents,
  AccessTokensGuardUser,
  AccessTokensProviderContract,
  AccessTokensUserProviderContract,
  LucidTokenable,
} from '@adonisjs/auth/types/access_tokens'
import { LucidModel } from '@adonisjs/lucid/types/model'
import db from '@adonisjs/lucid/services/db'
import { AccessToken } from '@adonisjs/auth/access_tokens'
import { Secret } from '@adonisjs/core/helpers'
import { GuardContract } from '@adonisjs/auth/types'
import { GUARD_KNOWN_EVENTS, PROVIDER_REAL_USER } from '@adonisjs/auth/build/src/symbols.js'
import { HttpContext } from '@adonisjs/core/http'
import { EmitterLike } from '@adonisjs/core/types/events'
import { E_UNAUTHORIZED_ACCESS } from '@adonisjs/auth/build/src/errors.js'

interface Users extends LucidModel {
  id: string | number
}

const db = await app.container.make('prisma:db')

/**
 * Uses a lucid model to verify access tokens and find a user during
 * authentication
 */
export class AccessTokensPrismaUserProvider<
  TokenableProperty extends string,
  UserModel extends LucidTokenable<TokenableProperty>,
> implements AccessTokensUserProviderContract<InstanceType<UserModel>>
{
  declare [PROVIDER_REAL_USER]: InstanceType<UserModel>

  /**
   * Reference to the lazily imported model
   */
  protected model?: UserModel

  constructor(
    /**
     * Lucid provider options
     */
    protected options: AccessTokensLucidUserProviderOptions<TokenableProperty, UserModel>
  ) {}

  /**
   * Imports the model from the provider, returns and caches it
   * for further operations.
   */
  protected async getModel() {
    if (this.model && !('hot' in import.meta)) {
      return this.model
    }

    const importedModel = await this.options.model()
    this.model = importedModel.default
    return this.model
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
    const model = await this.getModel()
    if (!(user instanceof model)) {
      throw new RuntimeException(
        `Invalid user object. It must be an instance of the "${model.name}" model`
      )
    }

    return {
      getId() {
        return String(user.id)
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
    const model = await this.getModel()
    const user = await model.find(identifier)

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
