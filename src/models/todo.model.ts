import mongoose, { Schema, Document } from "mongoose";
import { ITodo, TodoStatus, TodoPriority } from "@/interfaces/todo.interface";

export interface ITodoDocument extends ITodo, Document {
	_id: string;
	version: number;
}

const TodoSchema: Schema = new Schema(
	{
		title: {
			type: String,
			required: true,
			trim: true,
			minlength: 1,
			maxlength: 255,
			index: true,
		},
		description: {
			type: String,
			trim: true,
			maxlength: 1000,
		},
		status: {
			type: String,
			enum: Object.values(TodoStatus),
			default: TodoStatus.PENDING,
			required: true,
			index: true,
		},
		priority: {
			type: String,
			enum: Object.values(TodoPriority),
			default: TodoPriority.MEDIUM,
			required: true,
			index: true,
		},
		dueDate: {
			type: Date,
			index: true,
		},
		tags: [
			{
				type: String,
				trim: true,
				lowercase: true,
				index: true,
			},
		],
		assignedTo: {
			type: String,
			index: true,
		},
		createdBy: {
			type: String,
			required: true,
			index: true,
		},
		completedAt: {
			type: Date,
		},
		isDeleted: {
			type: Boolean,
			default: false,
			index: true,
		},
		version: {
			type: Number,
			default: 1,
		},
	},
	{
		timestamps: true,
		versionKey: false,
		optimisticConcurrency: true,
	},
);

// Compound indexes for common query patterns
TodoSchema.index({ createdBy: 1, status: 1 });
TodoSchema.index({ assignedTo: 1, status: 1 });
TodoSchema.index({ dueDate: 1, status: 1 });
TodoSchema.index({ isDeleted: 1, status: 1 });

// Pre-save middleware to handle versioning
TodoSchema.pre<ITodoDocument>("save", function (next) {
	if (this.isModified() && !this.isNew) {
		this.version += 1;
	}
	next();
});

// Create text index for search functionality
TodoSchema.index(
	{
		title: "text",
		description: "text",
		tags: "text",
	},
	{
		weights: {
			title: 10,
			tags: 5,
			description: 1,
		},
		name: "todo_text_index",
	},
);

// Method to safely serialize the document
TodoSchema.methods.toJSON = function () {
	const obj = this.toObject();
	delete obj.__v;
	return obj;
};

// Virtual for remaining time until due date
TodoSchema.virtual("timeRemaining").get(function (this: ITodoDocument) {
	if (!this.dueDate) return null;
	return this.dueDate.getTime() - new Date().getTime();
});

// Static method to find non-deleted todos
TodoSchema.statics.findActive = function (filter = {}) {
	return this.find({ ...filter, isDeleted: false });
};

export const TodoModel = mongoose.model<ITodoDocument>("Todo", TodoSchema);
