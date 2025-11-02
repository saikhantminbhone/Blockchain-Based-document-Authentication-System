const { MongoClient } = require('mongodb');

const { MONGODB_URI } = process.env;
if (!MONGODB_URI) {
    throw new Error('Please define the MONGODB_URI environment variable');
}

let client;
let db;

const connectDB = async () => {
    if (db) return db;
    if (!client) {
        client = new MongoClient(MONGODB_URI);
        await client.connect();
        console.log("MongoDB connected for testing...");
    }
    db = client.db("blocklease"); 
    return db;
};

const getDB = () => db;

const closeDB = async () => {
    if (client) {
        await client.close();
        client = null;
        db = null;
        console.log("MongoDB connection closed.");
    }
};

module.exports = { connectDB, getDB, closeDB };