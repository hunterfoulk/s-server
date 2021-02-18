const express = require('express');
const app = express();
const server = require('http').createServer(app);
const PORT = process.env.PORT || 8000;
// const { cors, corsOptions } = require("./cors");
// var whitelist = ["http://localhost:3000", "https://springboard-server.herokuapp.com", "https://dashboard.heroku.com"];
const short = require('short-uuid');
require("dotenv").config();

// app.use(cors(corsOptions(whitelist)), (req, res, next) => {
//   console.log("cors fired");
//   res.header(
//     "Access-Control-Allow-Headers",
//     "Origin, X-Requested-With, Content-Type, Accept"
//   );
//   if (req.method === "OPTIONS") {
//     res.header("Access-Control-Allow-Methods", "GET, PUT, POST, PATCH, DELETE");
//     return res.status(200).json({});
//   }
//   next();
// });

app.use(express.json());


var knex = require('knex')({
  client: 'pg',
  connection: {
    host: process.env.HOST,
    user: process.env.USER,
    password: process.env.PASS,
    database: process.env.DATABASE
  },
  pool: { min: 0, max: 7 }
})



app.get('/', (req, res, next) => {

  res.send({ message: 'test' });
});


app.get('/all', async (req, res, next) => {
  try {
    let categories = await knex.select('*').from('category')

    for (const category of categories) {
      const threads = await knex.from('threads').select('*').where('category', '=', category.category_id)
      category.threads = threads

    }


    if (!categories) {
      throw new Error("no categories found!");
    }


    res.send(categories);

  } catch (e) {
    console.log(e);
    res.send({
      status: 'fail',
      message: 'categories do not exist!'
    });
  }

});


app.get('/fetchThreads', async (req, res, next) => {
  try {
    const { term } = req.query;
    console.log("fired")
    console.log("term", term)

    let category = parseInt(term)


    const newThreads = await knex.raw("select c.*, coalesce(e.comments, '[]') as comments from threads as c left outer join(select e.thread_id, json_agg(e) as comments from comments as e group by e.thread_id ) as e on e.thread_id = c.thread_id WHERE c.category = ?", [term])

    console.log("new threads", newThreads.rows)

    for (const thread of newThreads.rows) {
      thread.sharing = false
    }

    res.send(newThreads.rows)

  } catch (error) {
    console.log(error)
  }

});


app.get('/fetchCategoryImage', async (req, res, next) => {
  try {
    const { term } = req.query;
    console.log("fired")
    let category = parseInt(term)
    console.log("image term", category)
    const image = await knex.from('category').select('image').where('category_id', '=', category)
    console.log("yo", image[0].image)
    res.send(image[0].image)

  } catch (error) {
    console.log(error)
  }

});


app.post('/createThread', async (req, res, next) => {
  console.log("fired")
  try {
    const { body } = req.body;
    const { title } = req.body;
    const { category } = req.body;
    let newCategory = parseInt(category)
    let user = short.generate()
    let date = new Date().toLocaleString();

    await knex('threads').insert({ thread_title: title, body: body, category: newCategory, user: user, date: date })

    res.send({
      status: 200,
      message: 'new thread created!'
    });

  } catch (error) {
    console.error("error", error.message)
  }
});


app.get('/fetchRecents', async (req, res, next) => {
  try {
    const { term } = req.query;
    console.log("fetch fired", term)

    const recents = await knex.from('category').select('image', 'title').where('title', '=', term.toLowerCase())
    console.log("recents", recents)

    res.send(recents[0])

  } catch (error) {
    console.log(error)
  }

});

app.get('/fetchThread', async (req, res, next) => {
  try {
    const { id } = req.query;
    console.log("fetch fired for thread", id)


    const thread = await knex.from('threads').select("*").where('thread_id', '=', id).join("category", "category.category_id", "=", "threads.category")

    const comments = await knex.raw("select c.*, coalesce(e.replies, '[]') as replies from comments as c left outer join(select e.comment_id, json_agg(e) as replies from replies as e group by e.comment_id ) as e on e.comment_id = c.comment_id WHERE c.thread_id = ?", [id])
    const number = await knex('threads').count('*')
    const date = await knex.raw('SELECT date from threads WHERE thread_id = (SELECT MAX (thread_id) FROM threads)')
    console.log("date", date.rows[0].date)

    console.log("COMMENTS", comments.rows)

    comments.rows.forEach((item) => {
      item.replying = false
      item.reporting = false
      item.repliesShow = false
    })

    thread[0].comments = comments.rows



    res.send({ thread: thread[0], count: number[0].count, date: date.rows[0].date })


  } catch (error) {
    console.log(error)
  }

});


app.post('/createComment', async (req, res, next) => {
  console.log("fired")
  try {
    const { message } = req.body;
    const { thread_id } = req.body;
    let user = short.generate()
    let date = new Date().toLocaleString();

    await knex('comments').insert({ message: message, thread_id: thread_id, user: user, date: date })

    res.send({
      status: 200,
      message: 'new comment created!'
    });

  } catch (error) {
    console.error("error", error.message)
  }
});



app.post('/createReply', async (req, res, next) => {
  console.log("fired")
  try {
    const { message } = req.body;
    const { comment_id } = req.body;
    const { id } = req.body;
    console.log("this is the id", id)
    let user = short.generate()
    let date = new Date().toLocaleString();

    await knex('replies').insert({ reply_message: message, comment_id: comment_id, user: user, date: date })
    const comments = await knex.raw("select c.*, coalesce(e.replies, '[]') as replies from comments as c left outer join(select e.comment_id, json_agg(e) as replies from replies as e group by e.comment_id ) as e on e.comment_id = c.comment_id WHERE c.thread_id = ?", [id])
    console.log("COMMENTS", comments.rows)
    res.send({
      status: 200,
      message: 'new comment created!',
      comments: comments.rows
    });

  } catch (error) {
    console.error("error", error.message)
  }
});


app.get('/fetchTrends', async (req, res, next) => {
  try {
    console.log("TRENDS FIRED")
    let threads = await knex.select('*').from('threads').join("category", "category.category_id", "=", "threads.category")




    for (const thread of threads) {
      const comments = await knex.from('comments').select('*').where('thread_id', '=', thread.thread_id)

      thread.comments = comments

    }
    threads.sort(function (b, a) {
      return a.comments.length - b.comments.length;
    })

    console.log("TRENDING THREADS", threads)


    res.send(threads)

  } catch (error) {
    console.log(error)
  }

});



app.get('/search', async (req, res, next) => {
  try {
    const { term } = req.query;
    console.log("fetch fired", term)

    const searchResults = await knex('threads').where('thread_title', 'like', `%${term}%`).join("category", "category.category_id", "=", "threads.category")
    console.log("searchResults", searchResults)

    for (const result of searchResults) {

      const comments = await knex('comments').where('thread_id', '=', result.thread_id)
      result.comments = comments
      result.sharing = false
    }

    res.send(searchResults)

  } catch (error) {
    console.log(error)
  }

});

server.listen(PORT, () => console.log(`Server started on port: ${process.env.PORT}`));