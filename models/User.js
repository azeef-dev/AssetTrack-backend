import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
    {
        name: { type: String, required: [true, 'Name is required'], trim: true },
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
        },
        password: {
            type: String,
            required: [true, 'Password is required'],
            minlength: [6, 'Password must be at least 6 characters'],
            select: false,
        },
        phone: { type: String, trim: true, default: '' },
        role: {
            type: String,
            enum: {
                values: ['superadmin', 'technician', 'user'],
                message: 'Role must be superadmin, technician or user',
            },
            default: 'user',
        },
        department: { type: String, trim: true, default: '' },
        avatar: { type: String, default: '' },
        isActive: { type: Boolean, default: true },
        lastLogin: { type: Date },
    },
    { timestamps: true }
);

userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
    return bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.toSafeObject = function () {
    const obj = this.toObject();
    delete obj.password;
    delete obj.__v;
    return obj;
};

export default mongoose.model('User', userSchema);