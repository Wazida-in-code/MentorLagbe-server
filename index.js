import express from 'express'
import 'dotenv/config'
import cors from 'cors'
import { MongoClient } from 'mongodb';

const app = express()
app.use(cors())
const PORT = process.env.PORT || 8000

const client = new MongoClient(process.env.MONGODB_URI);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}

const mongoClient = await connectToMongoDB()


app.get('/', (req, res) => {
    res.send(`Server is running perfectly!`)
})

app.listen(PORT, () => {
    console.log(`Server is running on PORT ${PORT}`);
})