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
const sessions = db.collection('session')
const tuitions = db.collection('tuitions')
const applications = db.collection('applications')


// verify token
const verifyToken = async(req, res, next) => {
  // find header
  const authHeader = req.headers.authorization;
  if(!authHeader){
    res.status(401).send({message: 'unauthorized'});
    return;
  }

  // find token from header
  const token = authHeader.split(' ')[1]
  if(!token){
    res.status(401).send({message: 'unauthorized'});
    return;
  }

  // find session from token
  const query = {token};
  const session = await sessions.findOne(query);
  if(!session){
    res.status(401).send({message: 'unauthorized'});
    return;
  }
  // find user from session
  const userId = session.userId;
  const userQuery = {_id: new ObjectId(userId)};
  const user = await users.findOne(userQuery);
  if(!user){
    res.status(401).send({message: 'unauthorized'});
    return;
  }

  req.user = user;
  next()
  
}

// verify student
const verifyStudent = async(req, res, next) => {
  if(req.user.role !== 'student'){
    res.status(403).send({message: 'Forbidden'});
    return;
  }
  next();
}

// verify tutor
const verifyTutor = async(req, res, next) => {
  if(req.user.role !== 'tutor'){
    res.status(403).send({message: 'Forbidden'});
    return;
  }
  next();
}

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
app.post('/tuition', verifyToken, verifyTutor, async(req, res) => {
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

app.post('/applications', verifyToken, verifyStudent, async(req, res) => {
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

app.get('/applications', verifyToken, async(req, res) => {
  const query = {}
  if(req.query.userId){
    query.userId = req.query.userId;
  }
  if(req.query.tuitionId){

     const tuitionQuery = {_id: new ObjectId(req.query.tuitionId)};
    const tuition = await tuitions.findOne(tuitionQuery);
    if(tuition.tutorId !== req.user._id.toString() && req.user.userRole !== 'admin'){
      res.status(403).send({message: 'Forbidden'});  
      return;
    }

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


// update user role

app.patch('/users/:id/role', async(req, res) => {
  const {id} = req.params
  const query = {_id: new ObjectId(id)};
  const updateRole = {
     $set: {
      role: req.body.role,
     }
  }
  const result = await users.updateOne(query, updateRole)
  res.send(result)
})



app.get('/users', verifyToken, async(req, res) => {
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