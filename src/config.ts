function requireEnv(key: string, fallback?: string): string {
    const value = process.env[key] ?? fallback;
    if (!value) throw new Error(`Environment variable "${key}" wajib diisi`);
    return value;
}

export const config = {
    phoneNumber: requireEnv('APP_NUMBER'),
    dbName: requireEnv('DB_NAME'),
    logLevel: requireEnv('LOG_LEVEL'),
} as const;
