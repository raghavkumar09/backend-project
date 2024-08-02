import mongoose from "mongoose";
const { Schema } = mongoose;

const subscriptionSchema = new Schema({
    subscriber: {
        type: Schema.Types.ObjectId, // who subscribe
        ref: 'User',
        required: true
    },
    channel: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

const Subscription = mongoose.model('Subscription', subscriptionSchema);
export default Subscription