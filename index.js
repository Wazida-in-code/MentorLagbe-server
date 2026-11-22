// import dns from 'node:dns';
// dns.setServers(['8.8.8.8', '8.8.4.4']);
import express from 'express'
import 'dotenv/config'
import cors from 'cors'
import { MongoClient, ObjectId } from 'mongodb';
import Stripe from 'stripe'


const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
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
const payments = db.collection('payments')


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

const verifyAdmin = async(req, res, next) => {
  if(req.user.role !== 'admin'){
    res.status(403).send({message: 'Forbidden'});
    return;
  }
  next();
}


// tuition related API

// Browse Tuitions + Search + Filters + Pagination
app.get('/browse-tuition', async (req, res) => {
  try {
    // Pagination
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 6;
    const skip = (page - 1) * limit;

    // Default filter
    const query = {
      approvalStatus: "approved",
      isActive: true
    };

    // Search and filters
    if (req.query.subject) {
      query.subject = req.query.subject;
    }

    if (req.query.classLevel) {
      query.classLevel = req.query.classLevel;
    }

    if (req.query.mode) {
      query.mode = req.query.mode;
    }

    if (req.query.search) {
      query.$or = [
        { title: { $regex: req.query.search, $options: "i" } },
        { subject: { $regex: req.query.search, $options: "i" } }
      ];
    }

    // Get paginated tuitions
    const tuitionData = await tuitions
      .find(query)
      .skip(skip)
      .limit(limit)
      .toArray();

    // Count matching tuitions
    const totalTuitions = await tuitions.countDocuments(query);

    // Calculate total pages
    const totalPages = Math.ceil(totalTuitions / limit);

    res.send({
      tuitions: tuitionData,
      totalTuitions,
      totalPages,
      currentPage: page
    });

  } catch (error) {
    res.status(500).send({
      message: "Failed to fetch tuitions"
    });
  }
});


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


// tuition count api
app.get('/tuitions/count', async(req, res) => {
   console.log(req.query);
  const query = {}
  if(req.query.tutorId){
    query.tutorId = req.query.tutorId
  }
 
  const result = await tuitions.countDocuments(query)
  res.send({count : result})
})

app.get('/tuitions/:id', async (req, res) => {
    const {id} = req.params 
    const query = {_id: new ObjectId(id)}
    const result = await tuitions.findOne(query)  
    res.send(result)
})

// delete tuition
app.delete('/tuition/:id', verifyToken, verifyTutor, async(req, res) => {
  const {id} = req.params
  const query = {_id: new ObjectId(id)}
  const result = await tuitions.deleteOne(query)
  res.send(result)
})

// edit tuition
app.patch('/tuition/:id', verifyToken, verifyTutor, async (req, res) => {
  const { id } = req.params;
  const { updatedTuition } = req.body;

  const result = await tuitions.updateOne(
    { _id: new ObjectId(id) },
    { $set: updatedTuition }
  );

  res.send(result);
});


app.patch('/tuition-status/:id', verifyToken, verifyTutor, async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const result = await tuitions.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: { isActive: isActive }
      }
    );

    res.send(result);

  } catch (error) {
    res.status(500).send({ message: "Failed to update tuition status" });
  }
});


// get six tuitions
app.get('/six-tuitions', async (req, res) => {
  const query = {
    approvalStatus: "approved",
    isActive: true
  };

  const result = await tuitions
    .find(query)
    .sort({ _id: -1 })
    .limit(6)
    .toArray();

  res.send(result);
});


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
    if(tuition.tutorId !== req.user._id.toString() && req.user.role !== 'admin'){
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

// application count
app.get('/applications/count', async(req, res) => {
  const query = {}
  if(req.query.userId){
    query.userId = req.query.userId
  }
  const result = await applications.countDocuments(query)
  res.send({count : result})
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

app.patch('/users/:id/role', verifyToken, verifyAdmin, async(req, res) => {
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


// Get all tuitions for admin
app.get('/admin-tuitions', verifyToken, verifyAdmin, async(req, res) => {
    const result = await tuitions.find().toArray();
    res.send(result);
});

// update tuitions approvalStatus
app.patch('/admin-tuitions/:id', verifyToken, verifyAdmin, async(req, res) => {
  const {id} = req.params
  const query = {_id: new ObjectId(id)};
  const updateApprovalStatus  = {
     $set: {
      approvalStatus: req.body.approvalStatus,
     }
  }
  const result = await tuitions.updateOne(query, updateApprovalStatus)
  res.send(result)
})


// payments related API
app.post('/payments/checkout-verify', async(req, res) =>{
    const {sessionId} = req.body;
    if(!sessionId){
    return res.send({success: false, msg: "Session Id is required"})
  }
    const {status,
    payment_status,
    customer_email, 
    metadata,
    payment_intent} = await stripe.checkout.sessions.retrieve(sessionId);
    

    if(status === 'complete' && payment_status=='paid'){

       const sessionQuery = {sessionId}
      const existingPayment = await payments.findOne(sessionQuery)
      if(existingPayment){
        return res.send({success: false, msg: "Payment already exist"})
      }

      const payment = {
        sessionId,
      status,
      payment_status,
      customer_email,
      userId: metadata.userId,
      userName: metadata.userName,
      userRole: metadata.userRole,
      userPlan: metadata.userPlan,
      amount: metadata.userAmount,
      payment_date: new Date(),
      payment_intent
      }
      const result = await payments.insertOne(payment)
      const query = {_id: new ObjectId(metadata.userId)}
      const updatedInfo = {
        $set : {
          plan: 'pro'
        }
      }
      const updateResult = await users.updateOne(
        query,
        updatedInfo
      )
      res.send({success: true, result, updateResult})
      return
    }
    res.send({success: false , msg: "Payment failed!"})
})


app.get('/users/:id/pro', async(req, res) => {
  const {id} = req.params
  const query = {_id: new ObjectId(id)}
  const result = await users.findOne(query, { projection: { plan: 1 } })
  res.send(result)
})

app.patch('/update-profile/:id', verifyToken, async (req, res) => {
  const { id } = req.params;

  const { name, phone, bio, image } = req.body;

  const result = await users.updateOne(
    {_id: new ObjectId(id)},
    {
      $set: {
        name,
        phone,
        bio,
        image
      }
    }
  );

  res.send(result);
});


// transactions api
app.get('/transactions', verifyToken, verifyAdmin, async(req, res) => {
   const cursor = payments.find({})
    const result = await cursor.toArray()
    res.send(result);
})

app.get('/tuition-counts', async (req, res) => {
  const pending = await tuitions.countDocuments({
    approvalStatus: "pending"
  });

  const approved = await tuitions.countDocuments({
    approvalStatus: "approved"
  });

  res.send({
    pendingTuitions: pending,
    approvedTuitions: approved
  });
});


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

export default app;