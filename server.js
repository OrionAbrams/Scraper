const express = require("express");
const exphbs = require("express-handlebars");
const logger = require("morgan");
const mongoose = require("mongoose");

var axios = require("axios");
var cheerio = require("cheerio");
// If deployed, use the deployed database. Otherwise use the local mongoHeadlines database
var MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost/mongoHeadlines";

// Set mongoose to leverage built in JavaScript ES6 Promises
// Connect to the Mongo DB
mongoose.Promise = Promise;
mongoose.connect(MONGODB_URI);

// Require all models
var db = require("./models");

var PORT = process.env.PORT || 3000;

// Initialize Express
var app = express();

// Configure middleware

// Use morgan logger for logging requests
app.use(logger("dev"));
// Parse request body as JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
// Make public a static folder
app.use(express.static("public"));

//handlebars
app.engine("handlebars", exphbs({ defaultLayout: "main" }));
app.set("view engine", "handlebars");

// Routes
app.get("/", (req, res) => {
  db.Article.find({})
  .sort({date: -1})
    .then(dbArticle => {
      var hbsObject = {
        articles: dbArticle
      };
      res.render("index", hbsObject);
    });
});

// A GET route for scraping the echoJS website
app.get("/scrape", function (req, res) {
  // First, we grab the body of the html with axios
  axios.get("http://ind13.com").then(function (response) {
    var $ = cheerio.load(response.data);
    var resultArray = [];
    $("div.cb-meta").each(function () {
      var result = {}
      result.title = $(this)
        .find("a")
        .text();
      result.link = $(this)
        .find("a")
        .attr("href");
      result.summary = $(this)
        .find("div.cb-excerpt")
        .text();
      result.imgLink = $(this)
        .parent()
        .find("div.cb-mask")
        .find("img")
        .attr("src")
      if (result.summary && result.title && result.link && result.imgLink) {
        resultArray.push(result)
        resultArray.reverse()
      }
    })

    // Create a new Article using the `result` object built from scraping
    db.Article.create(resultArray)
      .then(function (dbArticle) {
        // View the added result in the console
        console.log(dbArticle)
      }).then(function () {
        res.redirect("/")
      }).catch(function (err) {
        console.log(err)
        res.redirect("/")
      });

  });
});

// Route for getting all Articles from the db
app.get("/articles", function (req, res) {
  // TODO: Finish the route so it grabs all of the articles
  db.Article.find({})
    .then(function (dbArticle) {
      // If all Notes are successfully found, send them back to the client
      res.json(dbArticle);
    })
    .catch(function (err) {
      // If an error occurs, send the error back to the client
      res.json(err);
    });
});
app.get("/articles/:id", function (req, res) {

  db.Article.findById(req.params.id)
    .populate("note")
    .then(function (dbArticle) {
      res.json(dbArticle);
    })
    .catch(function (err) {
      res.json(err);
    });
});
app.get("/delete/:id", function (req, res) {

  db.Article.findById(req.params.id)
    .remove()
    .then(function (dbArticle) {
      res.json(dbArticle);
    })
    .catch(function (err) {
      res.json(err);
    });
});

// Route for saving/updating an Article's associated Note
app.post("/articles/:id", function (req, res) {

  db.Note.create(req.body)
    .then(function (dbNote) {
      return db.Article.findByIdAndUpdate(req.params.id, { note: dbNote._id }, { new: true });
    })
    .then(function (dbNote) {
      res.json(dbNote);
    })
    .catch(function (err) {
      res.json(err);
    });
});

// Start the server
app.listen(PORT, function () {
  console.log("App running on port " + PORT + "!");
});
