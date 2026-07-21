import mongoose from "mongoose";

const favoriteSchema = new mongoose.Schema({
    cliente: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    comercio: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    }
}, { timestamps: true });

favoriteSchema.index({ cliente: 1, comercio: 1 }, { unique: true });

export const Favorite = mongoose.model("Favorite", favoriteSchema);
