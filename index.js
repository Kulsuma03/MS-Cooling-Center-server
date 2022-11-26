const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken')

require('dotenv').config()
const port = process.env.PORT || 5000;
// const stripe = require("stripe")(process.env.STRIPE_SECRETE);


const app = express();

// middleware
app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ohvfmrr.mongodb.net/?retryWrites=true&w=majority`;
console.log(uri);
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

// verifyJWT

function verifyJWT(req, res, next) {

    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send('unauthorized access')
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'forbidden access' })
        }
        req.decoded = decoded;
        next();
    })
}


async function run(){
    try{
        const categoriesCollection = client.db('msCooling').collection('categories');
        const productsCollection = client.db('msCooling').collection('products');
        const usersCollection = client.db('msCooling').collection('users');
        const bookingCollections = client.db('msCooling').collection('bookings');
        const wishlistCollections = client.db('msCooling').collection('wishlist');

        app.get('/categories', async (req, res) => {
            const query = {};
            const result = await categoriesCollection.find(query).toArray();
            res.send(result);
        });

        app.get('/products/:id', async (req, res) => {
            const id = req.params.id
            const query = {categoryId: id };
            const products = await productsCollection.find(query).toArray()
            // console.log(user);
            res.send(products)
        });

        // get all products 

        app.get('/allproduct', async (req, res) => {
           
            const query = {};
            const products = await productsCollection.find(query).toArray()
            // console.log(user);
            res.send(products)
        });


        //  jwt 

         app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            // console.log(user);
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '1h' });
                return res.send({ accessToken: token });
            }
            res.status(403).send({ accessToken: '' })
        });

        // insert user 
        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            res.send(result)
        });

        // post booking 

        app.post('/bookings', async (req, res) => {
            const booking = req.body;
            const result = await bookingCollections.insertOne(booking);
            res.send(result)
        });

        // post wishList 

        app.post('/wishlist', async (req, res) => {
            const wishlist = req.body;
            console.log(wishlist);
            const result = await wishlistCollections.insertOne(wishlist);
            res.send(result)
        });

        // get my order api 
        app.get('/myorders', async (req, res) => {
           
            const query = {};
            const orders = await bookingCollections.find(query).toArray()
            // console.log(user);
            res.send(orders)
        });

        // get wishlist data 

        app.get('/wishlist', async (req, res) => {
            const query = {};
            const wishData = await wishlistCollections.find(query).toArray();
            const filterWish = wishData.filter(w => !w.purchase);
            console.log(filterWish);
            res.send(filterWish)
        });

        // update wishList 

        app.put('/wishlist/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };

            const options = { upsert: true };
            const updatedWish = {
                $set: {
                    purchase: true
                }
            }
            const result = await wishlistCollections.updateOne(filter, updatedWish , options);
            res.send(result)
        });


        // app.delete('/reviewd/:id', verifyJWT, async (req, res) => {
        //     const id = req.params.id;
        //     const query = { _id: ObjectId(id) };
        //     const result = await reviewCollection.deleteOne(query);
        //     res.send(result);
        // })

    }
    finally{

    }
}

run().catch(console.log())



app.get('/', async (req, res) => {
    res.send('MS Cooling Point server is running')
})

app.listen(port, () => {
    console.log(`MS Cooling Point running on ${port}`)
})
