import mongoose from 'mongoose';

// MongoDB connection
export const connectMongoDB = async (): Promise<void> => {
	try {
		const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/nodejs_backend';
		await mongoose.connect(mongoUri);
		console.log('Connected to MongoDB successfully');

		mongoose.connection.on('error', (err) => {
			console.error('MongoDB connection error:', err);
		});

		mongoose.connection.on('disconnected', () => {
			console.log('MongoDB disconnected');
		});
	} catch (error) {
		console.error('Failed to connect to MongoDB:', error);
		throw error;
	}
};

// Main database connection function
export const connectDatabase = async (): Promise<void> => {
	try {
		await connectMongoDB();
	} catch (error) {
		console.error('Database connection failed:', error);
		console.log('Server will continue without database connection');
	}
};

// Graceful database disconnect
export const disconnectDatabase = async (): Promise<void> => {
	try {
		await mongoose.disconnect();
		console.log('Disconnected from MongoDB');
	} catch (error) {
		console.error('Error disconnecting from database:', error);
	}
};
