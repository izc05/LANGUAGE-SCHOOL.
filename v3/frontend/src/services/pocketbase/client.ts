import PocketBase from 'pocketbase'
import { pocketBaseUrl } from '../../config/environment'

export const pb = new PocketBase(pocketBaseUrl)

// Keep duplicated requests predictable while the SPA grows. Individual
// services may override this later when realtime or parallel requests need it.
pb.autoCancellation(false)
