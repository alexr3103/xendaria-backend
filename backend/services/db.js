import { MongoClient } from "mongodb";

const uri = process.env.MONGO_URI || "mongodb+srv://alexysol_db:nosvamosagraduar2026@alexysol.kofkqam.mongodb.net/";
let client;
let db;

export async function connectDB() {
  if (db) return db; // si ya está conectada, la reutiliza
  client = new MongoClient(uri);
  await client.connect();
  db = client.db(process.env.MONGO_DB || "AH20232CP1");
  console.log("Conectado a MongoDB");
  return db;
}

export function getDB() {
  if (!db) throw new Error("DB no inicializada. Llamá primero a connectDB()");
  return db;
}

export async function closeDB() {
  if (client) await client.close();
}