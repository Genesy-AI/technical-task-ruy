import { PrismaClient } from '@prisma/client'

/** Shared client for code outside the HTTP handlers (Temporal activities). */
export const prisma = new PrismaClient()
