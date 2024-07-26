const express = require('express');
const app = express();
const responseTime = require('response-time');
const prisma = require('./prisma/prismaClient');
const redis = require('redis');

app.use(express.json());
app.use(responseTime());

// (async () => {
//   redisClient = redis.createClient();

//   redisClient.on("error", (error) => console.error(`Error : ${error}`));

//   await redisClient.connect();
// })();

// // Connect to Redis server
// redisClient.on('connect', () => {
//   console.log('Redis connected');
// });

// // Handle Redis connection errors
// redisClient.on('error', (err) => {
//   console.error('Redis error:', err);
// });
// Create and configure the Redis client
const redisClient = redis.createClient({
  url: 'redis://localhost:6379'  // Adjust this URL based on your Redis server configuration
});

async function connectToRedis() {
  try {
    // Connect to the Redis server
    await redisClient.connect();
    console.log('Redis connected');
  } catch (error) {
    // Handle connection errors
    console.error('Failed to connect to Redis:', error);
  }
}

// Set up event listeners for Redis client
redisClient.on('error', (err) => {
  console.error('Redis error:', err);
});

// Call the function to connect to Redis
connectToRedis();
// Route to get user by ID
app.get('/users/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const user = await prisma.user.findUnique({ where: { id: parseInt(id) } });
    if (user) {
      res.status(200).json({ user });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (err) {
    console.error('Server error: ', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Add new user
app.post('/users/add', async (req, res) => {
  const { name, email, password } = req.body;

  try {
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password
      },
      select: {
        name: true,
        email: true
      }
    });
    res.json({
      status: 'success',
      data: {
        user
      }
    });
  } catch (err) {
    console.error('Validation error: ', err);
    return res.status(400).json({ error: 'Validation error' });
  }
});

// Route to get all users
app.get('/get-all-users', async (req, res) => {
  const cacheKey = 'allUsers';

  try {
    // Check if the users are in the cache
    const cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
      // If data is found in cache, return it
      const users = JSON.parse(cachedData);
      console.log(`Users retrieved from cache: ${users.length}`);
      return res.json({
        status: 'success',
        data: { users }
      });
    }

    // If not in cache, fetch from the database
    const users = await prisma.user.findMany();
    console.log(`Users retrieved from database: ${users.length}`);

    if (users.length === 0) {
      return res.json({
        message: "No users found"
      });
    }

    // Store the users in the cache with an expiration time (e.g., 3600 seconds)
    await redisClient.set(cacheKey, JSON.stringify(users), 'EX', 3600);
    console.log("Saved in cache");

    // Return the users
    return res.json({
      status: 'success',
      data: { users }
    });
  } catch (err) {
    console.error('Server error: ', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
app.listen(3000, () => {
  console.log('Server started on port 3000');
});
