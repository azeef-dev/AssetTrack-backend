import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    seq: { type: Number, default: 0 },
});

const Counter = mongoose.model('Counter', counterSchema);

export const getNextSequence = async (name) => {
    const counter = await Counter.findOneAndUpdate(
        { name },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );
    return counter.seq;
};

export default Counter;