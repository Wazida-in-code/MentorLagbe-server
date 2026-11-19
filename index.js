import express from 'express'
import 'dotenv/config'
import cors from 'cors'
import { MongoClient } from 'mongodb';

const app = express()

app.use(cors())
app.use(express.json())

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
// collections
const mongoClient = await connectToMongoDB()
const db = mongoClient.db('MentorLagbe')
const users = db.collection('user')
const tuitions = db.collection('tuitions')


// tuition related API

app.get('/tuition', async(req, res) => {
    const cursor = tuitions.find()
    const result = await cursor.toArray()
    res.send(result)
})


app.post('/tuition', async(req, res) => {
    const tuition = req.body
    const newTuition = {
    ...tuition,
    approvalStatus: "pending",
    isActive: true,
    createdAt: new Date()};
    const result = await tuitions.insertOne(newTuition)
    console.log(result);
    res.send(result)
})


app.get('/users', async(req, res) => {
    const cursor = users.find({})
    const result = await cursor.toArray()
    res.send(result);
})

app.get('/', (req, res) => {
    res.send(`Server is running perfectly!`)
})

app.listen(PORT, () => {
    console.log(`Server is running on PORT ${PORT}`);
})