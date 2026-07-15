import { MongoClient } from "mongodb";

let client;
let db;

export async function connectDB() {
  if (db) return db;

  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI no configurado");
  }

  client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  db = client.db(process.env.MONGO_DB || "AH20232CP1");
  console.log("Conectado a MongoDB");
  return db;
}

export function getDB() {
  if (!db) throw new Error("DB no inicializada. Llama primero a connectDB()");
  return db;
}

export async function closeDB() {
  if (client) await client.close();
}
