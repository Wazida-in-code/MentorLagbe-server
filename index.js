import express from 'express'
import 'dotenv/config'
import cors from 'cors'
import { MongoClient, ObjectId } from 'mongodb';

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
const applications = db.collection('applications')


// tuition related API

app.get('/browse-tuition', async(req, res) => {
    const query = {
      approvalStatus : "approved",
      isActive: true
    }
    console.log(req.query);
    if(req.query){
      if(req.query.subject){
        query.subject = req.query.subject
      }
      if(req.query.classLevel){
        query.classLevel = req.query.classLevel
      }
      if(req.query.mode){
        query.mode = req.query.mode;
      }
      if(req.query.search){
      query.$or = [
        { title: { $regex: req.query.search, $options: "i" } },
        { subject: { $regex: req.query.search, $options: "i" } }
      ]
    }
    }
    const cursor = tuitions.find(query)
    const result = await cursor.toArray()
    res.send(result)
})

// add tuition
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

app.get('/tuition', async(req, res) => {
    const tutorId = req.query.tutorId;
    const cursor = tuitions.find({tutorId:tutorId})
    const result = await cursor.toArray()
    res.send(result)
})

app.get('/tuitions/:id' , async (req, res) => {
    const {id} = req.params 
    const query = {_id: new ObjectId(id)}
    const result = await tuitions.findOne(query)  
    res.send(result)
})

// delete tuition
app.delete('/tuition/:id', async(req, res) => {
  const {id} = req.params
  const query = {_id: new ObjectId(id)}
  const result = await tuitions.deleteOne(query)
  res.send(result)
})


// applications related API

app.post('/applications', async(req, res) => {
   const application = req.body;

  const existingApplication = await applications.findOne({
    tuitionId: application.tuitionId,
    userId: application.userId,
  });

  if (existingApplication) {
    return res.send({ message: "Already applied" });
  }

  const newApplication = {
    ...application,
    status: "pending",
    appliedAt: new Date(),
  };
    const result = await applications.insertOne(newApplication)
    console.log(result);
    res.send(result)
})


// get applications

app.get('/applications', async(req, res) => {
  const query = {}
  if(req.query.userId){
    query.userId = req.query.userId;
  }
  if(req.query.tuitionId){
    query.tuitionId = req.query.tuitionId;
  }

  if (req.query.tutorEmail) {
    query.tutorEmail = req.query.tutorEmail;
  }

  const cursor = applications.find(query)
  const result = await cursor.toArray()
  res.send(result);
})

// delete application
app.delete('/applications/:id', async(req, res) => {
  const {id} = req.params
  const query = {_id: new ObjectId(id)}
  const result = await applications.deleteOne(query)
  res.send(result)
})

app.patch('/applications/:id', async(req, res) => {
  const {id} = req.params
  const query = {_id: new ObjectId(id)}
  const updateApp = {
    $set: {
      status: req.body.status
    }
  }
  const result = await applications.updateOne(query, updateApp)
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