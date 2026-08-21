import type { APIRequestContext } from '@playwright/test'

const PB_URL = process.env.PB_URL || 'http://127.0.0.1:8090'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`)
  return value
}

type UserFixtureInput = {
  email: string
  password: string
  passwordConfirm?: string
  name: string
  surname: string
  role: 'ADMIN' | 'TEACHER' | 'STUDENT'
  status?: 'ACTIVE' | 'INACTIVE' | 'INVITED' | 'SUSPENDED'
  phone?: string
  verified?: boolean
}

export type PrivilegedFixtureResult<T = Record<string, unknown>> = {
  status: number
  body: T
}

async function superuserToken(request: APIRequestContext): Promise<string> {
  const response = await request.post(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    data: {
      identity: requiredEnv('PB_SUPERUSER_EMAIL'),
      password: requiredEnv('PB_SUPERUSER_PASSWORD'),
    },
  })
  if (response.status() !== 200) {
    throw new Error(`Unable to authenticate E2E superuser (${response.status()}): ${await response.text()}`)
  }
  const payload = await response.json() as { token?: string }
  if (!payload.token) throw new Error('E2E superuser authentication returned no token.')
  return payload.token
}

export async function createPrivilegedUser<T extends Record<string, unknown> = Record<string, unknown>>(
  request: APIRequestContext,
  input: UserFixtureInput,
): Promise<PrivilegedFixtureResult<T>> {
  const token = await superuserToken(request)
  const response = await request.post(`${PB_URL}/api/collections/users/records`, {
    headers: { Authorization: token },
    data: {
      ...input,
      passwordConfirm: input.passwordConfirm || input.password,
      status: input.status || 'ACTIVE',
      phone: input.phone || '',
    },
  })
  let body: T
  try {
    body = await response.json() as T
  } catch {
    body = {} as T
  }
  return { status: response.status(), body }
}
