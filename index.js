const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken')

require('dotenv').config()
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.STRIPE_SECRETE);


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
    console.log(authHeader);
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
        const paymentsCollection = client.db('msCooling').collection('payments');
        // const advertiseCollection = client.db('msCooling').collection('advertise');

        // verifyAdmin

        const verifyAdmin = async (req, res, next) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);
            if (user.role !== 'admin') {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next()
        }

        // verifySeller

        const verifySeller = async (req, res, next) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);
            if (user.role !== 'seller') {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next()
        }

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

        app.get('/product/:email', async (req, res) => {
            const name = req.params.email;
            const query = { email: name };
            const result = await productsCollection.find(query).toArray();
            res.send(result)
        });

        // get all products 

        app.get('/allproduct', async (req, res) => {
           
            const query = {};
            const products = await productsCollection.find(query).toArray()
            // console.log(user);
            res.send(products)
        });

         // insert product
         app.post('/product', verifyJWT, async (req, res) => {
            const user = req.body;
            const result = await productsCollection.insertOne(user);
            res.send(result)
        });
         

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

        // admin api 

        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email
            const query = { email };
            const user = await usersCollection.findOne(query);
            // console.log(user);
            res.send({ isAdmin: user?.role === 'admin' })
        })

         // get seller 
         app.get('/users/seller/:email', async (req, res) => {
            const email = req.params.email
            const query = { email };
            const user = await usersCollection.findOne(query);
            console.log(user);
            res.send({ isSeller: user?.role === 'seller' })
        })



        // get all seller api 

        app.get('/dashboard/allseller',verifyJWT, verifyAdmin, async (req, res) => {
            const query = {};
            const seller = await usersCollection.find(query).toArray();
            
            const filterSeller = seller.filter(w => w.role === 'seller');
            res.send(filterSeller)
        });
        // get buyer api 

        app.get('/dashboard/allbuyer',verifyJWT, verifyAdmin, async (req, res) => {
            const query = {};
            const buyer = await usersCollection.find(query).toArray();
            // console.log(buyer);
            const filterBuyer = buyer.filter(w => w.role === 'buyer');
            res.send(filterBuyer)
        });

        // get booking by id 

        app.get('/bookings/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const booking = await bookingCollections.findOne(query);
            res.send(booking)
        })

        // post booking 

        app.post('/bookings',  async (req, res) => {
            const booking = req.body;
            const result = await bookingCollections.insertOne(booking);
            res.send(result)
        });

          // create payment

          app.post('/create-payment-intent', verifyJWT, async (req, res) => {

            const booking = req.body;
            const price = booking.price;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                currency: "usd",
                amount: amount,
                "payment_method_types": [
                    "card"
                ]

            })

            res.send({
                clientSecret: paymentIntent.client_secret,
              }); 
            
        });

        
        // store payments data

        app.post('/payments', verifyJWT, async (req, res) => {
            const payment = req.body;
            const result = await paymentsCollection.insertOne(payment);
            const id = payment.bookingId;
            const filter = {_id: ObjectId(id)};
            const updatedDoc = {
                $set:{
                    paid: true,
                    transactionId: payment.transactionId
                }
            }
            const updateResult = await bookingCollections.updateOne(filter, updatedDoc);

            res.send(result);
        });

        // update products collections

        app.put('/product/:id', verifyJWT, verifySeller, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };

            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    paid: true
                }
            }
            const result = await productsCollection.updateOne(filter, updatedDoc, options);
            res.send(result)
        });

        // update products collections for advertise

        app.put('/advertise/:id', verifyJWT, verifySeller, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };

            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    advertise: true
                }
            }
            const result = await productsCollection.updateOne(filter, updatedDoc, options);
            console.log(result);
            res.send(result)
        });

        // get advertise product 

        app.get('/advertise',  async (req, res) => {
           
            const query = {};
            const products = await productsCollection.find(query).toArray();
            const advertise = products.filter(p => p.advertise)
            // console.log(user);
            res.send(advertise)
        });


        // post wishList 

        app.post('/wishlist',  async (req, res) => {
            const wishlist = req.body;
            // console.log(wishlist);
            const result = await bookingCollections.insertOne(wishlist);
            res.send(result)
        });

        // get my order api 
        app.get('/myorders', verifyJWT, async (req, res) => {
           
            const email = req.query.email;
            const decodedEmail = req.decoded.email;
            console.log(email);
            if (email !== decodedEmail) {
                return res.status(403).send({ message: 'forbidden access' })
            }

            const query = { email: email };
            const bookings = await bookingCollections.find(query).toArray();
            res.send(bookings)
        });

        
        // insert user 
        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            console.log(result);
            res.send(result);
           
        });

        // get wishlist data 

        app.get('/wishlist', async (req, res) => {
            const query = {};
            const wishData = await bookingCollections.find(query).toArray();
            const filterWish = wishData.filter(w => w.wishList);
            // console.log(filterWish);
            res.send(filterWish)
        });

        // update wishList 

        app.put('/wishlist/:id', verifyJWT,async (req, res) => {
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

        // verify seller 

        app.put('/verifyseller/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };

            const options = { upsert: true };
            const updatedWish = {
                $set: {
                    verifySeller: true
                }
            }
            const result = await productsCollection.updateMany(filter, updatedWish , options);
            res.send(result)
        });


        app.delete('/user/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await usersCollection.deleteOne(query);
            res.send(result);
        })
        app.delete('/product/:id', verifyJWT, verifySeller, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await productsCollection.deleteOne(query);
            res.send(result); 
        })

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
