import { GraphQLError } from 'graphql';

/**
 * Apollo Server 4 dropped the AS3 error classes; these carry the codes clients switch on.
 * Messages are written for the person reading the toast, so they stay user-facing.
 */
export class AuthenticationError extends GraphQLError {
  constructor(message: string) {
    super(message, { extensions: { code: 'UNAUTHENTICATED' } });
  }
}

export class ForbiddenError extends GraphQLError {
  constructor(message: string) {
    super(message, { extensions: { code: 'FORBIDDEN' } });
  }
}

export class UserInputError extends GraphQLError {
  constructor(message: string) {
    super(message, { extensions: { code: 'BAD_USER_INPUT' } });
  }
}
