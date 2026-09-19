import User from '../models/User.js';

export const seedSuperAdmin = async () => {
    try {
        const email = process.env.SUPERADMIN_EMAIL;
        const password = process.env.SUPERADMIN_PASSWORD;
        if (!email || !password) {
            console.log('SUPERADMIN_EMAIL/SUPERADMIN_PASSWORD not set - skipping super admin seed.');
            return;
        }

        const existing = await User.findOne({ email: email.toLowerCase() });
        if (existing) return;

        await User.create({
            name: process.env.SUPERADMIN_NAME || 'Super Admin',
            email,
            password,
            role: 'superadmin',
        });
        console.log(`Seeded super admin account: ${email}`);
    } catch (err) {
        console.error('Failed to seed super admin:', err.message);
    }
};